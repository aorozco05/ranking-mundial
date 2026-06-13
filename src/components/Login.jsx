import React, { useState } from 'react';
import { Trophy, ShieldAlert, User, LogIn, UserPlus, Key, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';

export default function Login({ users, addUser, onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  
  // Login Form States
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register Form States
  const [registerName, setRegisterName] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  
  // Admin Form States
  const [adminPassword, setAdminPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    const trimmedName = loginName.trim();
    if (!trimmedName || !loginPassword) {
      setError('Por favor ingresa usuario y contraseña.');
      return;
    }
    
    // Buscar usuario (ignorando mayúsculas/minúsculas y espacios)
    const user = users.find(
      (u) => u.name.toLowerCase().trim() === trimmedName.toLowerCase()
    );
    
    if (!user) {
      setError('El usuario no existe. Regístrate si eres nuevo.');
      return;
    }
    
    if (user.password !== loginPassword) {
      setError('Contraseña incorrecta.');
      return;
    }
    
    onLogin({ id: user.id, name: user.name, role: 'user' });
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    const trimmedName = registerName.trim();
    if (!trimmedName || !registerPassword) {
      setError('Por favor ingresa un usuario y contraseña válidos.');
      return;
    }
    
    if (registerPassword.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    
    // Verificar si ya existe
    const exists = users.some(
      (u) => u.name.toLowerCase().trim() === trimmedName.toLowerCase()
    );
    
    if (exists || trimmedName.toLowerCase() === 'administrador' || trimmedName.toLowerCase() === 'admin') {
      setError('Este nombre de usuario ya está registrado o no es válido.');
      return;
    }
    
    const newUser = addUser(trimmedName, registerPassword);
    onLogin({ id: newUser.id, name: newUser.name, role: 'user' });
  };

  const handleAdminSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    if (adminPassword === 'admin') {
      onLogin({ id: 'admin', name: 'Administrador', role: 'admin' });
    } else {
      setError('Contraseña de administrador incorrecta.');
    }
  };

  return (
    <div className="min-h-screen pitch-pattern flex items-center justify-center p-4">
      {/* Círculo central decorativo de la cancha */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-white/5 rounded-full pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border border-white/2.5 rounded-full pointer-events-none"></div>

      <div className="glass-panel w-full max-w-md p-8 rounded-3xl relative z-10">
        
        {/* Cabecera / Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-primary mb-4 shadow-[0_0_15px_var(--color-emerald-glow)] pulse-glow">
            <Trophy size={40} />
          </div>
          <h1 className="text-3xl font-bold font-title tracking-tight text-white">
            POLLA MUNDIALISTA
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Organiza, pronostica y compite en familia ⚽
          </p>
        </div>

        {showAdminPassword ? (
          /* Vista de Contraseña de Administrador */
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <button 
                onClick={() => {
                  setShowAdminPassword(false);
                  setError('');
                  setAdminPassword('');
                }}
                className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                title="Volver"
              >
                <ArrowLeft size={16} />
              </button>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                <ShieldCheck size={12} className="text-emerald-primary" /> Acceso de Administrador
              </h3>
            </div>
            
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                  <Key size={16} />
                </span>
                <input
                  type="password"
                  placeholder="Contraseña del Administrador"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full pl-10 pr-4 p-3 bg-white/5 border border-white/10 focus:border-emerald-500 focus:outline-none rounded-xl text-sm text-white placeholder-gray-500 transition-all"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-primary hover:bg-emerald-600 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-[0_4px_12px_rgba(16,185,129,0.25)] hover:translate-y-[-1px]"
              >
                Validar e Ingresar
              </button>
            </form>
            
            {error && <p className="text-xs text-rose-500 font-medium text-center">{error}</p>}
          </div>
        ) : (
          /* Formulario Normal de Usuarios (Login / Registro) */
          <div>
            {/* Selector de Pestañas (Iniciar Sesión / Registro) */}
            <div className="flex bg-white/5 p-1 rounded-xl mb-6 border border-white/5">
              <button
                onClick={() => {
                  setIsRegister(false);
                  setError('');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${!isRegister ? 'bg-emerald-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                <LogIn size={13} />
                Iniciar Sesión
              </button>
              <button
                onClick={() => {
                  setIsRegister(true);
                  setError('');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${isRegister ? 'bg-emerald-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
              >
                <UserPlus size={13} />
                Registrarse
              </button>
            </div>

            {/* Formulario de Inicio de Sesión */}
            {!isRegister ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                    <User size={16} />
                  </span>
                  <input
                    type="text"
                    placeholder="Usuario"
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    className="w-full pl-10 pr-4 p-3 bg-white/5 border border-white/10 focus:border-emerald-500 focus:outline-none rounded-xl text-sm text-white placeholder-gray-500 transition-all"
                  />
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                    <Key size={16} />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Contraseña"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-10 pr-10 p-3 bg-white/5 border border-white/10 focus:border-emerald-500 focus:outline-none rounded-xl text-sm text-white placeholder-gray-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-primary hover:bg-emerald-600 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-[0_4px_12px_rgba(16,185,129,0.25)] hover:translate-y-[-1px] flex items-center justify-center gap-2"
                >
                  <LogIn size={15} />
                  Entrar
                </button>
              </form>
            ) : (
              /* Formulario de Registro */
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                    <User size={16} />
                  </span>
                  <input
                    type="text"
                    placeholder="Tu nombre o apodo"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    className="w-full pl-10 pr-4 p-3 bg-white/5 border border-white/10 focus:border-emerald-500 focus:outline-none rounded-xl text-sm text-white placeholder-gray-500 transition-all"
                  />
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                    <Key size={16} />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Contraseña"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="w-full pl-10 pr-10 p-3 bg-white/5 border border-white/10 focus:border-emerald-500 focus:outline-none rounded-xl text-sm text-white placeholder-gray-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-primary hover:bg-emerald-600 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-[0_4px_12px_rgba(16,185,129,0.25)] hover:translate-y-[-1px] flex items-center justify-center gap-2"
                >
                  <UserPlus size={15} />
                  Registrarse y Entrar
                </button>
              </form>
            )}

            {error && <p className="text-xs text-rose-500 mt-3 font-medium text-center">{error}</p>}
            
            {/* Contraseña predeterminada de ayuda */}
            <div className="mt-4 text-center">
              <span className="text-[10px] text-gray-500">
                Tip: La contraseña de las cuentas por defecto es <strong className="text-emerald-primary/80">1234</strong>.
              </span>
            </div>
          </div>
        )}

        {/* Roles Especiales */}
        <div className="border-t border-white/10 mt-5 pt-5 flex gap-2">
          <button
            onClick={() => {
              setShowAdminPassword(true);
              setError('');
              setAdminPassword('');
            }}
            className="flex-1 flex items-center justify-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500 hover:bg-emerald-500/20 rounded-xl text-sm font-semibold text-emerald-primary transition-all"
          >
            <ShieldAlert size={16} />
            Administrador
          </button>
          
          <button
            onClick={() => onLogin({ id: 'guest', name: 'Invitado', role: 'guest' })}
            className="flex-1 flex items-center justify-center gap-2 p-3 bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 rounded-xl text-sm font-semibold text-gray-300 transition-all"
          >
            Modo Lector
          </button>
        </div>

      </div>
    </div>
  );
}
