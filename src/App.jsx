import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  UserSquare2, 
  Settings, 
  LogOut, 
  FileDown, 
  FileUp, 
  RefreshCw, 
  Trophy,
  Loader2,
  ShieldCheck
} from 'lucide-react';

import Dashboard from './components/Dashboard';
import MatchesList from './components/MatchesList';
import UserPredictions from './components/UserPredictions';
import UsersManager from './components/UsersManager';
import Login from './components/Login';

import db from './utils/db';
import { resolveFullBracket } from './utils/bracketResolver';
import { calculateUserTotalScore } from './utils/scoring';
import { INITIAL_MATCHES, INITIAL_KNOCKOUT_MATCHES } from './utils/mockData';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Estados de datos
  const [users, setUsers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [prizePool, setPrizePool] = useState(100000); // Bote de apuestas (persistido)
  
  // Navegación
  const [activeTab, setActiveTab] = useState('dashboard');

  // Inicializar estado cargando desde IndexedDB
  useEffect(() => {
    const initDatabase = async () => {
      try {
        let storedUsers = await db.get('users') || [];
        let storedMatches = await db.get('matches') || [];
        let storedSession = await db.get('session');
        let storedPrizePool = await db.get('prizePool');

        // Inicializar partidos reales si la base de datos está vacía
        if (storedMatches.length === 0) {
          storedMatches = [...INITIAL_MATCHES, ...INITIAL_KNOCKOUT_MATCHES].map(m => ({
            ...m,
            time: m.time || '15:00'
          }));
          await db.set('matches', storedMatches);
        }

        // Asegurar que todos los partidos tengan una hora de inicio (migración)
        let matchesUpdated = false;
        const matchesWithTime = storedMatches.map(match => {
          if (match.time === undefined) {
            matchesUpdated = true;
            return { ...match, time: '15:00' };
          }
          return match;
        });
        if (matchesUpdated) {
          storedMatches = matchesWithTime;
          await db.set('matches', storedMatches);
        }

        // Asegurar que todos los usuarios cargados tengan una contraseña asignada
        // (migración). Se hace de forma transaccional para no pisar datos recientes.
        if (storedUsers.some(user => !user.password)) {
          storedUsers = await db.updateUsers(prev =>
            prev.map(user => (user.password ? user : { ...user, password: '1234' }))
          );
        }

        setUsers(storedUsers);
        setMatches(storedMatches);
        if (storedPrizePool !== undefined && storedPrizePool !== null) {
          setPrizePool(storedPrizePool);
        }

        if (storedSession) {
          setCurrentUser(storedSession);
        }
      } catch (err) {
        console.error('Error al inicializar IndexedDB:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initDatabase();
  }, []);

  // Refrescar usuarios y partidos al volver a la app (foco/visibilidad). Así el
  // admin ve los pronósticos recién guardados por otros y cada quien recupera el
  // estado más reciente sin tener que recargar manualmente la página.
  useEffect(() => {
    const refreshData = async () => {
      try {
        const [latestUsers, latestMatches] = await Promise.all([
          db.get('users'),
          db.get('matches')
        ]);
        if (Array.isArray(latestUsers)) setUsers(latestUsers);
        if (Array.isArray(latestMatches) && latestMatches.length > 0) setMatches(latestMatches);
      } catch (err) {
        console.error('Error al refrescar datos:', err);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshData();
    };

    window.addEventListener('focus', refreshData);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', refreshData);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Calcular el bracket real y partidos resueltos dinámicamente
  const resolvedBracketData = useMemo(() => {
    return resolveFullBracket(matches);
  }, [matches]);

  const actualBracket = resolvedBracketData.bracket;
  const resolvedMatches = resolvedBracketData.unifiedMatches;

  // Manejador del Login
  const handleLogin = async (userSession) => {
    setCurrentUser(userSession);
    await db.set('session', userSession);
  };

  // Manejador del Logout
  const handleLogout = async () => {
    setCurrentUser(null);
    await db.delete('session');
    setActiveTab('dashboard');
  };

  // 1. Agregar nuevo usuario
  const addUser = (name, password) => {
    const newUser = {
      id: `user-${Date.now()}`,
      name,
      password: password || '1234',
      predictions: {
        matches: {},
        bracket: {
          r32: Array(32).fill(null),
          r16: Array(16).fill(null),
          qf: Array(8).fill(null),
          sf: Array(4).fill(null),
          final: Array(2).fill(null),
          champion: null,
          runnerUp: null
        }
      }
    };

    // Persistir de forma segura (transacción): se agrega sin reescribir/pisar a
    // los demás usuarios. Se devuelve newUser de inmediato para el flujo de login.
    db.updateUsers(prev => [...prev, newUser])
      .then(setUsers)
      .catch(err => console.error('Error al agregar usuario:', err));
    return newUser;
  };

  // 2. Eliminar usuario
  const deleteUser = async (userId) => {
    const updatedUsers = await db.updateUsers(prev => prev.filter(user => user.id !== userId));
    setUsers(updatedUsers);

    // Si el usuario eliminado es el logueado actualmente, cerrar sesión
    if (currentUser && currentUser.id === userId) {
      handleLogout();
    }
  };

  // 3. Restablecer predicciones de un usuario
  const resetUserPredictions = async (userId) => {
    const emptyPredictions = {
      matches: {},
      bracket: {
        r32: Array(32).fill(null),
        r16: Array(16).fill(null),
        qf: Array(8).fill(null),
        sf: Array(4).fill(null),
        final: Array(2).fill(null),
        champion: null,
        runnerUp: null
      }
    };
    const updatedUsers = await db.updateUsers(prev =>
      prev.map(user => (user.id === userId ? { ...user, predictions: emptyPredictions } : user))
    );
    setUsers(updatedUsers);
  };

  // 4. Actualizar predicciones de un usuario
  // Usa una actualización transaccional: lee la versión más reciente del array
  // de usuarios y modifica SOLO al usuario objetivo. Así nunca se pierden los
  // pronósticos de otros (ni los propios por una copia local desactualizada).
  const updateUserPredictions = async (userId, predictions) => {
    const updatedUsers = await db.updateUsers(prev =>
      prev.map(user => (user.id === userId ? { ...user, predictions } : user))
    );
    setUsers(updatedUsers);
  };

  // 5. Registrar resultado real de un partido (con soporte opcional de penaltis)
  const updateMatchResult = async (matchId, homeScore, awayScore, status, penaltyWinner) => {
    const updatedMatches = matches.map(match => {
      if (match.id === matchId) {
        return { ...match, homeScore, awayScore, status, penaltyWinner };
      }
      return match;
    });

    setMatches(updatedMatches);
    await db.set('matches', updatedMatches);
  };

  // 6. Editar la fecha de un partido (solo administrador)
  const updateMatchDate = async (matchId, date) => {
    const updatedMatches = matches.map(match => {
      if (match.id === matchId) {
        return { ...match, date };
      }
      return match;
    });

    setMatches(updatedMatches);
    await db.set('matches', updatedMatches);
  };

  // 6.1. Editar la hora de inicio de un partido (solo administrador)
  const updateMatchTime = async (matchId, time) => {
    const updatedMatches = matches.map(match => {
      if (match.id === matchId) {
        return { ...match, time };
      }
      return match;
    });

    setMatches(updatedMatches);
    await db.set('matches', updatedMatches);
  };

  // 7. Actualizar el bote de apuestas (persistido en IndexedDB)
  const updatePrizePool = async (value) => {
    const safeValue = Number.isNaN(value) ? 0 : value;
    setPrizePool(safeValue);
    await db.set('prizePool', safeValue);
  };

  const handleResetDB = async () => {
    if (window.confirm('¿Seguro que deseas limpiar la base de datos de la polla? Se borrarán todos los participantes y cambios.')) {
      await db.clear();
      window.location.reload();
    }
  };

  // 8. Exportar datos a JSON
  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      JSON.stringify({ users, matches }, null, 2)
    );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `polla_mundial_db_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // 9. Importar datos desde JSON
  const handleImportData = (e) => {
    const fileReader = new FileReader();
    const file = e.target.files[0];
    if (!file) return;

    fileReader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.users && parsed.matches) {
          setUsers(parsed.users);
          setMatches(parsed.matches);
          
          await db.set('users', parsed.users);
          await db.set('matches', parsed.matches);
          
          alert('¡Datos de la base de datos cargados con éxito!');
        } else {
          alert('El archivo JSON no coincide con el formato esperado.');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON.');
      }
    };
    fileReader.readAsText(file);
  };

  // Mostrar indicador de carga al iniciar IndexedDB
  if (isLoading) {
    return (
      <div className="min-h-screen bg-soccer-dark flex flex-col items-center justify-center text-gray-300">
        <Loader2 size={40} className="animate-spin text-emerald-primary mb-3" />
        <p className="text-sm font-semibold tracking-wider">Cargando Base de Datos Local...</p>
      </div>
    );
  }

  // Redirigir a Login si no se ha autenticado
  if (!currentUser) {
    return (
      <Login 
        users={users} 
        addUser={addUser} 
        onLogin={handleLogin} 
      />
    );
  }

  // Enriquecer usuarios con puntajes calculados
  const enrichedUsers = users.map(user => {
    const scoreDetails = calculateUserTotalScore(user.predictions, resolvedMatches, actualBracket);
    return {
      ...user,
      scoreDetails
    };
  });

  return (
    <div className="flex flex-col min-h-screen bg-soccer-dark">
      
      {/* HEADER DE ESCRITORIO (Oculto en móvil) */}
      <header className="hidden md:block bg-soccer-card border-b border-white/10 sticky top-0 z-50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-primary rounded-xl shadow-[0_0_15px_var(--color-emerald-glow)]">
              <Trophy size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold font-title tracking-wide text-white leading-tight">POLLA FAMILIAR 2026</h1>
              <p className="text-[10px] text-gray-400">Base de Datos: Activa (IndexedDB)</p>
            </div>
          </div>

          {/* Menú de Navegación de Escritorio */}
          <nav className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'dashboard' ? 'bg-emerald-primary text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <LayoutDashboard size={14} /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'matches' ? 'bg-emerald-primary text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <CalendarDays size={14} /> Resultados
            </button>
            <button
              onClick={() => setActiveTab('predictions')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'predictions' ? 'bg-emerald-primary text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              <UserSquare2 size={14} /> Mis Pronósticos
            </button>
            {currentUser.role === 'admin' && (
              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-emerald-primary text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <Settings size={14} /> Configuración
              </button>
            )}
          </nav>

          {/* Detalle Perfil Logueado */}
          <div className="flex items-center gap-4 border-l border-white/10 pl-6">
            <div className="text-right">
              <span className="text-xs text-gray-200 font-bold block leading-none">{currentUser.name}</span>
              <span className="text-[10px] text-gray-400 capitalize flex items-center justify-end gap-1 mt-1">
                {currentUser.role === 'admin' && <ShieldCheck size={10} className="text-emerald-primary" />}
                {currentUser.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl transition-all"
              title="Cerrar Sesión"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* HEADER DE MÓVIL (Con información del usuario) */}
      <header className="md:hidden bg-soccer-card border-b border-white/10 px-4 py-3.5 flex items-center justify-between sticky top-0 z-50 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-emerald-primary" />
          <span className="font-bold font-title text-sm text-white">POLLA 2026</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-gray-200 font-bold block">{currentUser.name}</span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 bg-rose-500/10 text-rose-400 rounded-lg text-xs"
          >
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 md:px-6 py-6 pb-24 md:pb-8">
        {activeTab === 'dashboard' && (
          <Dashboard
            users={enrichedUsers}
            matches={resolvedMatches}
            currentUser={currentUser}
            updateMatchResult={updateMatchResult}
            updateUserPredictions={updateUserPredictions}
            prizePool={prizePool}
            updatePrizePool={updatePrizePool}
          />
        )}
        {activeTab === 'matches' && (
          <MatchesList
            matches={resolvedMatches}
            users={enrichedUsers}
            updateMatchResult={updateMatchResult}
            updateMatchDate={updateMatchDate}
            updateMatchTime={updateMatchTime}
            actualBracket={actualBracket}
            currentUserRole={currentUser.role}
          />
        )}
        {activeTab === 'predictions' && (
          <UserPredictions 
            users={enrichedUsers} 
            matches={resolvedMatches} 
            actualBracket={actualBracket} 
            updateUserPredictions={updateUserPredictions}
            activeUser={currentUser}
          />
        )}
        {activeTab === 'users' && currentUser.role === 'admin' && (
          <UsersManager
            users={enrichedUsers}
            addUser={addUser}
            deleteUser={deleteUser}
            resetUserPredictions={resetUserPredictions}
            currentUserRole={currentUser.role}
          />
        )}
      </main>

      {/* BARRA DE NAVEGACIÓN INFERIOR PARA MÓVILES (Fija) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-soccer-card/95 border-t border-white/10 py-2.5 px-4 flex justify-around items-center z-50 backdrop-blur-xl">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 bg-transparent border-none ${activeTab === 'dashboard' ? 'text-emerald-primary' : 'text-gray-400'}`}
        >
          <LayoutDashboard size={20} />
          <span className="text-[9px] font-bold">Dashboard</span>
        </button>
        
        <button
          onClick={() => setActiveTab('matches')}
          className={`flex flex-col items-center gap-1 bg-transparent border-none ${activeTab === 'matches' ? 'text-emerald-primary' : 'text-gray-400'}`}
        >
          <CalendarDays size={20} />
          <span className="text-[9px] font-bold">Resultados</span>
        </button>

        <button
          onClick={() => setActiveTab('predictions')}
          className={`flex flex-col items-center gap-1 bg-transparent border-none ${activeTab === 'predictions' ? 'text-emerald-primary' : 'text-gray-400'}`}
        >
          <UserSquare2 size={20} />
          <span className="text-[9px] font-bold">Pronósticos</span>
        </button>

        {currentUser.role === 'admin' && (
          <button
            onClick={() => setActiveTab('users')}
            className={`flex flex-col items-center gap-1 bg-transparent border-none ${activeTab === 'users' ? 'text-emerald-primary' : 'text-gray-400'}`}
          >
            <Settings size={20} />
            <span className="text-[9px] font-bold">Ajustes</span>
          </button>
        )}
      </nav>

      {/* FOOTER GENERAL (Administración de Datos) */}
      <footer className="bg-soccer-dark border-t border-white/5 py-6 px-4 text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <span>Polla Mundialista 2026 • Diseñado con Tailwind CSS v4 e IndexedDB ⚽</span>
          </div>

          <div className="flex flex-wrap gap-2.5 justify-center">
            {/* Importar JSON */}
            <label className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg font-semibold text-gray-300 cursor-pointer transition-colors flex items-center gap-1">
              <FileUp size={12} /> Importar Copia
              <input 
                type="file" 
                accept=".json" 
                onChange={handleImportData} 
                style={{ display: 'none' }} 
              />
            </label>

            {/* Exportar JSON */}
            <button 
              onClick={handleExportData} 
              className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg font-semibold text-gray-300 transition-colors flex items-center gap-1"
            >
              <FileDown size={12} /> Exportar Copia
            </button>

            {/* Limpiar Base de Datos (solo administrador) */}
            {currentUser.role === 'admin' && (
              <button
                onClick={handleResetDB}
                className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 px-3 py-1.5 rounded-lg font-semibold text-rose-400 transition-colors flex items-center gap-1"
              >
                <RefreshCw size={12} /> Limpiar Base de Datos
              </button>
            )}
          </div>
        </div>
      </footer>

    </div>
  );
}
