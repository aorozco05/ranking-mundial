import React, { useState, useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { translateTeam } from '../utils/teamNames';

// Estructura del árbol de llaves dividido en lado izquierdo y lado derecho,
// siguiendo el emparejamiento definido en bracketResolver (k32 → k16 → k8 → k4 → k2).
// El orden de cada lista respeta el orden vertical del bracket (de arriba a abajo).
const STAGES = [
  {
    key: 'r32',
    label: '2ª Fase',
    left: ['k32-2', 'k32-5', 'k32-1', 'k32-3', 'k32-11', 'k32-12', 'k32-9', 'k32-10'],
    right: ['k32-4', 'k32-6', 'k32-7', 'k32-8', 'k32-14', 'k32-16', 'k32-13', 'k32-15']
  },
  {
    key: 'r16',
    label: 'Octavos',
    left: ['k16-1', 'k16-2', 'k16-5', 'k16-6'],
    right: ['k16-3', 'k16-4', 'k16-7', 'k16-8']
  },
  {
    key: 'qf',
    label: 'Cuartos',
    left: ['k8-1', 'k8-2'],
    right: ['k8-3', 'k8-4']
  },
  {
    key: 'sf',
    label: 'Semis',
    left: ['k4-1'],
    right: ['k4-2']
  },
  {
    key: 'final',
    label: 'Final',
    left: [],
    right: [],
    final: ['k2-1']
  }
];

// Un nombre es un marcador de posición (aún sin definir) si corresponde a una
// etiqueta del bracket en lugar de a un equipo real.
const isPlaceholder = (name) => {
  if (!name) return true;
  return (
    name.startsWith('1') ||
    name.startsWith('2') ||
    name.startsWith('3-') ||
    name.startsWith('W') ||
    name.startsWith('RU') ||
    name.includes('Ganador') ||
    name.includes('Campeón') ||
    name.includes('Subcampeón') ||
    name === 'Vacío'
  );
};

function getWinnerSide(match) {
  if (!match) return null;
  const played =
    match.homeScore !== null && match.homeScore !== undefined &&
    match.awayScore !== null && match.awayScore !== undefined;
  if (!played) return null;
  const hs = parseInt(match.homeScore, 10);
  const as = parseInt(match.awayScore, 10);
  if (hs > as) return 'home';
  if (as > hs) return 'away';
  return match.penaltyWinner === 'away' ? 'away' : 'home';
}

function TeamRow({ team, score, isWinner, played, byPenalty }) {
  const pending = isPlaceholder(team);
  return (
    <div className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${isWinner ? 'bg-emerald-500/15' : ''}`}>
      <span
        className={`truncate ${
          pending
            ? 'text-gray-500 italic'
            : isWinner
              ? 'text-emerald-primary font-bold'
              : 'text-gray-200 font-semibold'
        }`}
      >
        {pending ? 'Por definir' : translateTeam(team)}
        {isWinner && byPenalty && (
          <span className="ml-1 text-[9px] text-gold font-bold align-top" title="Avanza por penales">PEN</span>
        )}
      </span>
      <span className={`tabular-nums shrink-0 ${isWinner ? 'text-emerald-primary font-bold' : 'text-gray-400'}`}>
        {played ? score : '–'}
      </span>
    </div>
  );
}

function MatchCard({ match }) {
  if (!match) {
    return (
      <div className="rounded-lg border border-white/5 bg-white/2.5 text-xs px-2.5 py-3 text-center text-gray-600 italic">
        Por definir
      </div>
    );
  }
  const played =
    match.homeScore !== null && match.homeScore !== undefined &&
    match.awayScore !== null && match.awayScore !== undefined;
  const winner = getWinnerSide(match);
  const isTie = played && parseInt(match.homeScore, 10) === parseInt(match.awayScore, 10);

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden text-xs w-full">
      <TeamRow
        team={match.homeTeam}
        score={match.homeScore}
        isWinner={winner === 'home'}
        played={played}
        byPenalty={isTie}
      />
      <div className="h-px bg-white/10" />
      <TeamRow
        team={match.awayTeam}
        score={match.awayScore}
        isWinner={winner === 'away'}
        played={played}
        byPenalty={isTie}
      />
    </div>
  );
}

export default function BracketView({ matches, actualBracket }) {
  const [activeStage, setActiveStage] = useState('r32');

  const matchMap = useMemo(() => {
    const map = {};
    (matches || []).forEach(m => { map[m.id] = m; });
    return map;
  }, [matches]);

  const stage = STAGES.find(s => s.key === activeStage) || STAGES[0];

  const champion = actualBracket?.champion;
  const runnerUp = actualBracket?.runnerUp;
  const championReady = champion && !isPlaceholder(champion);
  const runnerUpReady = runnerUp && !isPlaceholder(runnerUp);

  return (
    <div className="glass-panel p-6 rounded-3xl space-y-6" style={{ contentVisibility: 'auto' }}>
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold font-title text-white flex items-center justify-center gap-2">
          <Trophy size={20} className="text-gold" /> Las Llaves del Mundial
        </h2>
        <p className="text-xs text-gray-400">Resultados al momento • selecciona la fase</p>
      </div>

      {/* Tabs de fases */}
      <div className="flex flex-wrap justify-center gap-1.5 bg-white/5 border border-white/10 p-1.5 rounded-2xl">
        {STAGES.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveStage(s.key)}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeStage === s.key
                ? 'bg-emerald-primary text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {stage.key === 'final' ? (
        // FINAL: campeón / subcampeón + partido final centrado
        <div className="max-w-md mx-auto space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-white/5 border border-gold/30 rounded-2xl text-center">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Campeón</span>
              <span className={`mt-1 block font-black ${championReady ? 'text-gold text-lg' : 'text-gray-500 italic text-sm'}`}>
                {championReady ? `🏆 ${translateTeam(champion)}` : 'Pendiente'}
              </span>
            </div>
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Subcampeón</span>
              <span className={`mt-1 block font-bold ${runnerUpReady ? 'text-gray-200 text-base' : 'text-gray-500 italic text-sm'}`}>
                {runnerUpReady ? `🥈 ${translateTeam(runnerUp)}` : 'Pendiente'}
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center mb-2">Partido Final</h3>
            <MatchCard match={matchMap['k2-1']} />
          </div>
        </div>
      ) : (
        // Fases con lado izquierdo y lado derecho
        <div className="grid grid-cols-2 gap-3 sm:gap-8">
          <div className="space-y-2 sm:space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Lado Izquierdo</h3>
            {stage.left.map(id => (
              <MatchCard key={id} match={matchMap[id]} />
            ))}
          </div>
          <div className="space-y-2 sm:space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Lado Derecho</h3>
            {stage.right.map(id => (
              <MatchCard key={id} match={matchMap[id]} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
