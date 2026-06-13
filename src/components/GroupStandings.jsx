import React, { useState, useMemo } from 'react';
import { ListOrdered, ChevronLeft, ChevronRight } from 'lucide-react';
import { calculateGroupStandings } from '../utils/bracketResolver';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export default function GroupStandings({ matches }) {
  const [selectedGroup, setSelectedGroup] = useState('A');

  // Tabla ordenada por coeficiente, enriquecida con PJ/G/E/P calculados desde los partidos
  const standings = useMemo(() => {
    const base = calculateGroupStandings(matches, selectedGroup);

    // Inicializar contadores de partidos jugados/ganados/empatados/perdidos
    const stats = {};
    base.forEach(t => {
      stats[t.name] = { played: 0, won: 0, drawn: 0, lost: 0 };
    });

    matches
      .filter(m => m.stage === 'groups' && m.group === selectedGroup && m.homeScore !== null && m.awayScore !== null)
      .forEach(m => {
        const hs = parseInt(m.homeScore, 10);
        const as = parseInt(m.awayScore, 10);
        if (!stats[m.homeTeam] || !stats[m.awayTeam]) return;
        stats[m.homeTeam].played += 1;
        stats[m.awayTeam].played += 1;
        if (hs > as) {
          stats[m.homeTeam].won += 1;
          stats[m.awayTeam].lost += 1;
        } else if (hs < as) {
          stats[m.awayTeam].won += 1;
          stats[m.homeTeam].lost += 1;
        } else {
          stats[m.homeTeam].drawn += 1;
          stats[m.awayTeam].drawn += 1;
        }
      });

    return base.map(t => ({ ...t, ...stats[t.name] }));
  }, [matches, selectedGroup]);

  const goPrev = () => {
    const idx = GROUPS.indexOf(selectedGroup);
    if (idx > 0) setSelectedGroup(GROUPS[idx - 1]);
  };
  const goNext = () => {
    const idx = GROUPS.indexOf(selectedGroup);
    if (idx < GROUPS.length - 1) setSelectedGroup(GROUPS[idx + 1]);
  };

  return (
    <div className="glass-panel p-6 rounded-3xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-xl">
          <ListOrdered size={22} />
        </div>
        <div>
          <h2 className="text-xl font-bold font-title text-white leading-tight">Tabla de Posiciones</h2>
          <p className="text-xs text-gray-400">Clasificación de los equipos por grupo</p>
        </div>
      </div>

      {/* Selector de Grupos */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={goPrev}
          disabled={selectedGroup === 'A'}
          className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 disabled:opacity-20 disabled:pointer-events-none hover:text-white"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
          {GROUPS.map(g => (
            <button
              key={g}
              onClick={() => setSelectedGroup(g)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all min-w-[64px] ${selectedGroup === g ? 'bg-white/15 text-white border border-white/20' : 'text-gray-400 hover:text-white border border-transparent'}`}
            >
              Grupo {g}
            </button>
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={selectedGroup === 'L'}
          className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 disabled:opacity-20 disabled:pointer-events-none hover:text-white"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto border border-white/10 rounded-xl">
        <table className="w-full border-collapse text-left text-sm text-gray-300">
          <thead>
            <tr className="bg-white/5 border-b border-white/10 font-title font-semibold text-gray-400 uppercase tracking-wider text-xs">
              <th className="p-3">#</th>
              <th className="p-3">Equipo</th>
              <th className="p-3 text-center">PJ</th>
              <th className="p-3 text-center">G</th>
              <th className="p-3 text-center">E</th>
              <th className="p-3 text-center">P</th>
              <th className="p-3 text-center">GF</th>
              <th className="p-3 text-center">GC</th>
              <th className="p-3 text-center">DG</th>
              <th className="p-3 text-center">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {standings.map((team, index) => {
              const isQualified = index < 2; // Top 2 clasifican directo
              const isThird = index === 2;   // Posible mejor tercero
              return (
                <tr key={team.name} className={`hover:bg-white/2.5 transition-colors ${isQualified ? 'bg-emerald-500/5' : ''}`}>
                  <td className="p-3 font-bold">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                      isQualified ? 'bg-emerald-500/20 text-emerald-primary' : (isThird ? 'bg-amber-500/15 text-amber-500' : 'text-gray-400')
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-white">{team.name}</td>
                  <td className="p-3 text-center">{team.played}</td>
                  <td className="p-3 text-center">{team.won}</td>
                  <td className="p-3 text-center">{team.drawn}</td>
                  <td className="p-3 text-center">{team.lost}</td>
                  <td className="p-3 text-center">{team.gf}</td>
                  <td className="p-3 text-center">{team.ga}</td>
                  <td className={`p-3 text-center font-semibold ${team.gd > 0 ? 'text-emerald-primary' : (team.gd < 0 ? 'text-rose-500' : '')}`}>
                    {team.gd > 0 ? `+${team.gd}` : team.gd}
                  </td>
                  <td className="p-3 text-center text-lg font-bold text-emerald-primary">{team.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 text-[10px] text-gray-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500/40 border border-emerald-500"></span> Clasifican directo (1º y 2º)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500/30 border border-amber-500"></span> Posible mejor tercero</span>
      </div>
    </div>
  );
}
