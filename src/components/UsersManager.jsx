import React, { useState } from 'react';
import { ShieldAlert, Trash2, RotateCcw, UserPlus, ShieldCheck, User } from 'lucide-react';

export default function UsersManager({ users, addUser, deleteUser, resetUserPredictions, currentUserRole }) {
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [error, setError] = useState('');

  const handleAddUser = (e) => {
    e.preventDefault();
    setError('');
    
    const trimmedName = newUserName.trim();
    const trimmedPassword = newUserPassword.trim();
    
    if (!trimmedName) {
      setError('Por favor ingresa un nombre válido.');
      return;
    }
    if (!trimmedPassword) {
      setError('Por favor ingresa una contraseña.');
      return;
    }
    if (trimmedPassword.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    
    // Validar duplicado
    const exists = users.some(
      (u) => u.name.toLowerCase().trim() === trimmedName.toLowerCase()
    );
    if (exists || trimmedName.toLowerCase() === 'administrador' || trimmedName.toLowerCase() === 'admin') {
      setError('Este nombre de usuario ya está registrado o no es válido.');
      return;
    }
    
    addUser(trimmedName, trimmedPassword);
    setNewUserName('');
    setNewUserPassword('');
  };

  const handleDelete = (userId, name) => {
    if (window.confirm(`¿Seguro que deseas eliminar a ${name}? Se perderán todas sus predicciones de forma permanente.`)) {
      deleteUser(userId);
    }
  };

  const handleReset = (userId, name) => {
    if (window.confirm(`¿Seguro que deseas limpiar las predicciones de ${name}?`)) {
      resetUserPredictions(userId);
    }
  };

  // Restricción si no es Administrador
  if (currentUserRole !== 'admin') {
    return (
      <div className="glass-panel p-8 rounded-3xl text-center max-w-lg mx-auto my-12">
        <div className="inline-flex p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-500 mb-4 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-2xl font-bold font-title text-white mb-2">Acceso Restringido</h2>
        <p className="text-sm text-gray-400 mb-6">
          Solo los perfiles con rol de **Administrador** pueden gestionar los participantes de la polla mundialista.
        </p>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-gray-400 text-left space-y-1">
          <p>• Como Administrador podrás agregar nuevos participantes.</p>
          <p>• Podrás restablecer las predicciones de un familiar si se equivoca.</p>
          <p>• Podrás eliminar participantes que no completaron sus cuotas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Sección Superior: Agregar Usuario */}
      <div className="glass-panel p-6 rounded-2xl">
        <h2 className="text-xl font-bold font-title text-white mb-4 flex items-center gap-2">
          <UserPlus size={20} className="text-emerald-primary" /> Agregar Nuevo Participante
        </h2>
        
        <form onSubmit={handleAddUser} className="flex flex-col md:flex-row gap-3">
          <div className="flex-grow">
            <input
              type="text"
              placeholder="Nombre completo o apodo del familiar"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="w-full p-3 bg-white/5 border border-white/10 focus:border-emerald-500 focus:outline-none rounded-xl text-sm text-white placeholder-gray-500 transition-all"
            />
          </div>
          <div className="flex-grow">
            <input
              type="password"
              placeholder="Contraseña del nuevo usuario"
              value={newUserPassword}
              onChange={(e) => setNewUserPassword(e.target.value)}
              className="w-full p-3 bg-white/5 border border-white/10 focus:border-emerald-500 focus:outline-none rounded-xl text-sm text-white placeholder-gray-500 transition-all"
            />
          </div>
          <button
            type="submit"
            className="bg-emerald-primary hover:bg-emerald-600 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all shadow-[0_4px_12px_rgba(16,185,129,0.25)] hover:translate-y-[-1.5px] whitespace-nowrap"
          >
            Agregar Participante
          </button>
        </form>
        {error && <p className="text-xs text-rose-500 mt-2 font-medium">{error}</p>}
      </div>

      {/* Listado de Participantes */}
      <div className="glass-panel p-6 rounded-2xl">
        <h2 className="text-xl font-bold font-title text-white mb-6 flex items-center gap-2">
          <ShieldCheck size={20} className="text-emerald-primary" /> Participantes Registrados ({users.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {users.map((user) => (
            <div
              key={user.id}
              className="p-5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between gap-4 transition-all hover:bg-white/7.5"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-primary">
                  <User size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base leading-tight">{user.name}</h4>
                  <p className="text-xs text-gray-400 mt-1">
                    Puntos totales: <strong className="text-emerald-primary">{user.scoreDetails?.total || 0}</strong>
                  </p>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleReset(user.id, user.name)}
                  title="Restablecer Predicciones"
                  className="p-2.5 bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/40 rounded-xl text-gray-400 hover:text-amber-500 transition-all"
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  onClick={() => handleDelete(user.id, user.name)}
                  title="Eliminar Participante"
                  className="p-2.5 bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 rounded-xl text-gray-400 hover:text-rose-500 transition-all"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}

          {users.length === 0 && (
            <div className="col-span-2 text-center py-8 text-gray-500">
              No hay participantes registrados todavía. ¡Agrega el primero arriba!
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
