import React, { useState } from 'react';
import { CalendarDays, UserSquare2 } from 'lucide-react';
import MatchesList from './MatchesList';
import UserPredictions from './UserPredictions';

// Pestaña unificada "Mi Estado": agrupa la pantalla de Resultados (marcadores
// oficiales y bracket real) y la de Mis Pronósticos en una sola vista con una
// sub-navegación interna. Así el usuario consulta y edita todo desde un mismo lugar.
export default function MiEstado({
  matches,
  users,
  updateMatchResult,
  updateMatchDate,
  updateMatchTime,
  actualBracket,
  currentUser,
  updateUserPredictions,
  phaseDeadlines,
}) {
  const [activeView, setActiveView] = useState('resultados'); // 'resultados' o 'pronosticos'

  return (
    <div className="space-y-6">
      {/* Sub-navegación interna de Mi Estado */}
      <div className="flex gap-1 bg-white/5 p-1.5 rounded-2xl border border-white/10 max-w-md mx-auto sm:mx-0">
        <button
          onClick={() => setActiveView('resultados')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeView === 'resultados' ? 'bg-emerald-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
        >
          <CalendarDays size={15} /> Resultados
        </button>
        <button
          onClick={() => setActiveView('pronosticos')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${activeView === 'pronosticos' ? 'bg-emerald-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
        >
          <UserSquare2 size={15} /> Mis Pronósticos
        </button>
      </div>

      {activeView === 'resultados' ? (
        <MatchesList
          matches={matches}
          users={users}
          updateMatchResult={updateMatchResult}
          updateMatchDate={updateMatchDate}
          updateMatchTime={updateMatchTime}
          actualBracket={actualBracket}
          currentUserRole={currentUser.role}
        />
      ) : (
        <UserPredictions
          users={users}
          matches={matches}
          actualBracket={actualBracket}
          updateUserPredictions={updateUserPredictions}
          activeUser={currentUser}
          phaseDeadlines={phaseDeadlines}
        />
      )}
    </div>
  );
}
