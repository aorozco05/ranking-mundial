import React, { useState, useMemo } from 'react';
import { Trophy, Lock, Save, CheckCircle2, Loader2, AlertCircle, Calendar, Clock, Settings, ChevronDown } from 'lucide-react';
import { translateTeam } from '../utils/teamNames';
import { resolveFullBracket } from '../utils/bracketResolver';
import { isPredictionLocked, isPhaseDeadlinePassed, hasMatchStarted } from '../utils/matchSchedule';

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

const DEADLINE_FIELDS = [
  { key: 'r32', label: '2ª Fase' },
  { key: 'r16', label: 'Octavos' },
  { key: 'qf', label: 'Cuartos' },
  { key: 'sf', label: 'Semis' },
  { key: 'final', label: 'Final' }
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

function getWinnerSide(homeScore, awayScore, penaltyWinner) {
  const played =
    homeScore !== null && homeScore !== undefined &&
    awayScore !== null && awayScore !== undefined && homeScore !== '' && awayScore !== '';
  if (!played) return null;
  const hs = parseInt(homeScore, 10);
  const as = parseInt(awayScore, 10);
  if (hs > as) return 'home';
  if (as > hs) return 'away';
  return penaltyWinner === 'away' ? 'away' : 'home';
}

export default function BracketView({
  matches,
  actualBracket,
  currentUser,
  users = [],
  updateUserPredictions,
  phaseDeadlines = {},
  updatePhaseDeadline
}) {
  const isUser = currentUser?.role === 'user';
  const isAdmin = currentUser?.role === 'admin';
  const targetUser = useMemo(
    () => (isUser ? users.find(u => u.id === currentUser.id) || null : null),
    [isUser, users, currentUser]
  );
  const canEditPreds = isUser && !!targetUser;

  const [activeStage, setActiveStage] = useState('r32');
  // 'mine' por defecto; para invitado/admin (sin pronósticos) mode cae a 'live'.
  const [viewMode, setViewMode] = useState('mine');
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);

  // Borradores y estado de guardado por partido (modo "Mis Pronósticos").
  const [predEdits, setPredEdits] = useState({});
  const [predStatus, setPredStatus] = useState({});

  const mode = canEditPreds ? viewMode : 'live';

  // Mapa de partidos reales (resultados oficiales): fuente para fecha/hora,
  // bloqueo y la vista "Al Momento".
  const liveMatchMap = useMemo(() => {
    const map = {};
    (matches || []).forEach(m => { map[m.id] = m; });
    return map;
  }, [matches]);

  // Bracket calculado a partir de los pronósticos del usuario (modo "Mis Pronósticos").
  const effectiveMatchesPred = useMemo(
    () => ({ ...(targetUser?.predictions?.matches || {}), ...predEdits }),
    [targetUser?.predictions?.matches, predEdits]
  );
  const userMatchMap = useMemo(() => {
    if (!targetUser) return {};
    const { unifiedMatches } = resolveFullBracket(matches, effectiveMatchesPred);
    const map = {};
    unifiedMatches.forEach(m => { map[m.id] = m; });
    return map;
  }, [targetUser, matches, effectiveMatchesPred]);

  const stage = STAGES.find(s => s.key === activeStage) || STAGES[0];

  /* ---------- Helpers de pronóstico (modo "Mis Pronósticos") ---------- */
  const getSavedPred = (id) => targetUser?.predictions?.matches?.[id] || {};
  const getCurrentPred = (id) => (id in predEdits ? predEdits[id] : getSavedPred(id));
  const isMatchDirty = (id) => {
    if (!(id in predEdits)) return false;
    const saved = getSavedPred(id);
    const edit = predEdits[id];
    return (edit.homeScore ?? null) !== (saved.homeScore ?? null)
      || (edit.awayScore ?? null) !== (saved.awayScore ?? null)
      || (edit.penaltyWinner ?? null) !== (saved.penaltyWinner ?? null);
  };
  const applyLocalEdit = (id, patch) => {
    setPredEdits(prev => {
      const base = id in prev ? prev[id] : getSavedPred(id);
      return { ...prev, [id]: { ...base, ...patch } };
    });
    setPredStatus(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };
  const handleScoreChange = (id, side, value, realMatch) => {
    if (!canEditPreds || isPredictionLocked(realMatch, phaseDeadlines)) return;
    const clean = value === '' ? null : parseInt(value, 10);
    applyLocalEdit(id, { [side]: isNaN(clean) ? null : clean });
  };
  const handlePenaltyChange = (id, penaltyWinner, realMatch) => {
    if (!canEditPreds || isPredictionLocked(realMatch, phaseDeadlines)) return;
    applyLocalEdit(id, { penaltyWinner });
  };
  const handleSave = async (id) => {
    if (!canEditPreds || !(id in predEdits) || predStatus[id] === 'saving') return;
    const updatedPredictions = {
      ...targetUser.predictions,
      matches: {
        ...targetUser.predictions?.matches,
        [id]: { ...getSavedPred(id), ...predEdits[id] }
      }
    };
    setPredStatus(prev => ({ ...prev, [id]: 'saving' }));
    try {
      await updateUserPredictions(targetUser.id, updatedPredictions);
      setPredEdits(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setPredStatus(prev => ({ ...prev, [id]: 'saved' }));
    } catch (err) {
      console.error('Error al guardar el pronóstico:', err);
      setPredStatus(prev => ({ ...prev, [id]: 'error' }));
    }
  };

  /* ---------- Tarjeta de partido ---------- */
  // Helpers de render (funciones, NO componentes): se invocan en línea para que
  // los <input> conserven su identidad/enfoque entre renders al escribir.
  const teamRow = ({ key, team, score, isWinner, played, byPenalty }) => {
    const pending = isPlaceholder(team);
    return (
      <div key={key} className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${isWinner ? 'bg-emerald-500/15' : ''}`}>
        <span className={`truncate ${pending ? 'text-gray-500 italic' : isWinner ? 'text-emerald-primary font-bold' : 'text-gray-200 font-semibold'}`}>
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
  };

  const matchHeader = (realMatch, closedByDeadline) => {
    if (!realMatch?.date && !realMatch?.time && !closedByDeadline) return null;
    return (
      <div className="flex items-center justify-between gap-2 px-2.5 py-1 bg-white/2.5 border-b border-white/10 text-[10px] text-gray-400">
        <span className="flex items-center gap-2">
          {realMatch?.date && <span className="flex items-center gap-1"><Calendar size={10} /> {realMatch.date}</span>}
          {realMatch?.time && <span className="flex items-center gap-1"><Clock size={10} /> {realMatch.time}</span>}
        </span>
        {closedByDeadline && (
          <span className="flex items-center gap-1 text-rose-400 font-bold uppercase tracking-wider">
            <Lock size={9} /> Cerrado
          </span>
        )}
      </div>
    );
  };

  const liveCard = (id) => {
    const m = liveMatchMap[id];
    const played = m && m.homeScore !== null && m.homeScore !== undefined && m.awayScore !== null && m.awayScore !== undefined;
    const winner = m ? getWinnerSide(m.homeScore, m.awayScore, m.penaltyWinner) : null;
    const isTie = played && parseInt(m.homeScore, 10) === parseInt(m.awayScore, 10);
    return (
      <div key={id} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden text-xs w-full">
        {matchHeader(m)}
        {teamRow({ key: 'h', team: m?.homeTeam, score: m?.homeScore, isWinner: winner === 'home', played, byPenalty: isTie })}
        <div className="h-px bg-white/10" />
        {teamRow({ key: 'a', team: m?.awayTeam, score: m?.awayScore, isWinner: winner === 'away', played, byPenalty: isTie })}
      </div>
    );
  };

  const mineCard = (id) => {
    const display = userMatchMap[id] || {};
    const realMatch = liveMatchMap[id];
    const pred = getCurrentPred(id) || {};
    const hv = pred.homeScore !== undefined && pred.homeScore !== null ? pred.homeScore : '';
    const av = pred.awayScore !== undefined && pred.awayScore !== null ? pred.awayScore : '';
    const filled = hv !== '' && av !== '';
    const isTie = filled && parseInt(hv, 10) === parseInt(av, 10);
    const winner = getWinnerSide(hv, av, pred.penaltyWinner);

    const closedByDeadline = isPhaseDeadlinePassed(realMatch?.stage, phaseDeadlines);
    const locked = isPredictionLocked(realMatch, phaseDeadlines);
    const editable = canEditPreds && !locked;

    const homePending = isPlaceholder(display.homeTeam);
    const awayPending = isPlaceholder(display.awayTeam);

    return (
      <div key={id} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden text-xs w-full">
        {matchHeader(realMatch, closedByDeadline)}

        <div className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${winner === 'home' ? 'bg-emerald-500/15' : ''}`}>
          <span className={`truncate ${homePending ? 'text-gray-500 italic' : winner === 'home' ? 'text-emerald-primary font-bold' : 'text-gray-200 font-semibold'}`}>
            {homePending ? 'Por definir' : translateTeam(display.homeTeam)}
            {winner === 'home' && isTie && <span className="ml-1 text-[9px] text-gold font-bold align-top">PEN</span>}
          </span>
          {editable
            ? <input type="number" placeholder="-" value={hv} onChange={(e) => handleScoreChange(id, 'homeScore', e.target.value, realMatch)}
                className="w-9 bg-white/5 border border-white/15 rounded-md text-center font-bold text-white text-sm py-0.5 focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            : <span className={`tabular-nums shrink-0 ${winner === 'home' ? 'text-emerald-primary font-bold' : 'text-gray-400'}`}>{hv === '' ? '–' : hv}</span>}
        </div>

        <div className="h-px bg-white/10" />

        <div className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${winner === 'away' ? 'bg-emerald-500/15' : ''}`}>
          <span className={`truncate ${awayPending ? 'text-gray-500 italic' : winner === 'away' ? 'text-emerald-primary font-bold' : 'text-gray-200 font-semibold'}`}>
            {awayPending ? 'Por definir' : translateTeam(display.awayTeam)}
            {winner === 'away' && isTie && <span className="ml-1 text-[9px] text-gold font-bold align-top">PEN</span>}
          </span>
          {editable
            ? <input type="number" placeholder="-" value={av} onChange={(e) => handleScoreChange(id, 'awayScore', e.target.value, realMatch)}
                className="w-9 bg-white/5 border border-white/15 rounded-md text-center font-bold text-white text-sm py-0.5 focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            : <span className={`tabular-nums shrink-0 ${winner === 'away' ? 'text-emerald-primary font-bold' : 'text-gray-400'}`}>{av === '' ? '–' : av}</span>}
        </div>

        {/* Empate: ¿quién avanza a la siguiente fase? */}
        {isTie && (
          <div className="px-2.5 py-2 border-t border-white/10 bg-white/2.5">
            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1">¿Quién avanza?</span>
            {editable ? (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePenaltyChange(id, 'home', realMatch)}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold border truncate transition-colors ${pred.penaltyWinner === 'home' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                >
                  {homePending ? 'Local' : translateTeam(display.homeTeam)}
                </button>
                <button
                  type="button"
                  onClick={() => handlePenaltyChange(id, 'away', realMatch)}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold border truncate transition-colors ${pred.penaltyWinner === 'away' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                >
                  {awayPending ? 'Visitante' : translateTeam(display.awayTeam)}
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-emerald-primary font-bold">
                {pred.penaltyWinner
                  ? `Avanza: ${translateTeam(pred.penaltyWinner === 'away' ? display.awayTeam : display.homeTeam)}`
                  : 'Sin definir'}
              </span>
            )}
          </div>
        )}

        {/* Pie: guardar / estado */}
        <div className="px-2.5 py-1.5 border-t border-white/10 flex justify-end">
          {editable ? (
            isMatchDirty(id) ? (
              <button
                onClick={() => handleSave(id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500 text-black hover:bg-amber-400 transition-all"
              >
                <Save size={12} /> Guardar
              </button>
            ) : predStatus[id] === 'saving' ? (
              <span className="flex items-center gap-1 text-[10px] text-gray-300"><Loader2 size={12} className="animate-spin" /> Guardando…</span>
            ) : predStatus[id] === 'error' ? (
              <button onClick={() => handleSave(id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/15 border border-rose-500/40 text-rose-400">
                <AlertCircle size={12} /> Reintentar
              </button>
            ) : filled ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-primary font-bold"><CheckCircle2 size={12} /> Guardado</span>
            ) : (
              <span className="text-[10px] text-gray-500">Sin pronóstico</span>
            )
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              <Lock size={11} /> {realMatch && hasMatchStarted(realMatch) ? 'Cerrado (inició)' : closedByDeadline ? 'Cerrado (fecha límite)' : 'Cerrado'}
            </span>
          )}
        </div>
      </div>
    );
  };

  const renderCard = (id) => (mode === 'mine' ? mineCard(id) : liveCard(id));

  // Campeón / subcampeón a mostrar en la pestaña Final.
  const champion = mode === 'mine' ? targetUser?.predictions?.bracket?.champion : actualBracket?.champion;
  const runnerUp = mode === 'mine' ? targetUser?.predictions?.bracket?.runnerUp : actualBracket?.runnerUp;
  const championReady = champion && !isPlaceholder(champion);
  const runnerUpReady = runnerUp && !isPlaceholder(runnerUp);

  const stageClosed = mode === 'mine' && isPhaseDeadlinePassed(stage.key, phaseDeadlines);

  return (
    <div className="glass-panel p-6 rounded-3xl space-y-6" style={{ contentVisibility: 'auto' }}>
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold font-title text-white flex items-center justify-center gap-2">
          <Trophy size={20} className="text-gold" /> Las Llaves del Mundial
        </h2>
        <p className="text-xs text-gray-400">
          {mode === 'mine' ? 'Ingresa tus pronósticos por fase' : 'Resultados al momento • selecciona la fase'}
        </p>
      </div>

      {/* Conmutador Mis Pronósticos / Al Momento (solo participantes) */}
      {canEditPreds && (
        <div className="flex justify-center">
          <div className="inline-flex bg-white/5 border border-white/10 p-1 rounded-2xl">
            <button
              onClick={() => setViewMode('mine')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'mine' ? 'bg-emerald-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              Mis Pronósticos
            </button>
            <button
              onClick={() => setViewMode('live')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'live' ? 'bg-emerald-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              Al Momento
            </button>
          </div>
        </div>
      )}

      {/* Panel de administrador: fechas deshabilitadoras por fase */}
      {isAdmin && (
        <div className="border border-emerald-500/20 rounded-2xl overflow-hidden">
          <button
            onClick={() => setAdminPanelOpen(o => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors"
          >
            <span className="flex items-center gap-2 text-xs font-bold text-emerald-primary uppercase tracking-wider">
              <Settings size={14} /> Fechas límite de pronóstico por fase
            </span>
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${adminPanelOpen ? 'rotate-180' : ''}`} />
          </button>
          {adminPanelOpen && (
            <div className="p-4 space-y-3">
              <p className="text-[11px] text-gray-400">
                Al pasar la fecha y hora, los usuarios ya no podrán ingresar ni editar sus pronósticos de esa fase.
                Los pronósticos ya guardados se conservan.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {DEADLINE_FIELDS.map(f => (
                  <div key={f.key}>
                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">{f.label}</label>
                    <input
                      type="datetime-local"
                      value={phaseDeadlines[f.key] || ''}
                      onChange={(e) => updatePhaseDeadline(f.key, e.target.value)}
                      className="w-full p-2 bg-soccer-dark border border-white/10 focus:border-emerald-500 focus:outline-none rounded-lg text-xs text-white"
                    />
                    {isPhaseDeadlinePassed(f.key, phaseDeadlines) && (
                      <span className="text-[9px] text-rose-400 font-bold uppercase tracking-wider mt-1 block">Cerrada</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs de fases */}
      <div className="flex flex-wrap justify-center gap-1.5 bg-white/5 border border-white/10 p-1.5 rounded-2xl">
        {STAGES.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveStage(s.key)}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeStage === s.key ? 'bg-emerald-primary text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Aviso de fase cerrada (modo Mis Pronósticos) */}
      {stageClosed && (
        <div className="flex items-center justify-center gap-2 text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl py-2 px-3">
          <Lock size={13} /> Los pronósticos de esta fase están cerrados.
        </div>
      )}

      {stage.key === 'final' ? (
        // FINAL: campeón / subcampeón + partido final centrado
        <div className="max-w-md mx-auto space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-white/5 border border-gold/30 rounded-2xl text-center">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Campeón</span>
              <span className={`mt-1 block font-black ${championReady ? 'text-gold text-lg' : 'text-gray-500 italic text-sm'}`}>
                {championReady ? `🏆 ${translateTeam(champion)}` : (mode === 'mine' ? 'Sin elegir' : 'Pendiente')}
              </span>
            </div>
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Subcampeón</span>
              <span className={`mt-1 block font-bold ${runnerUpReady ? 'text-gray-200 text-base' : 'text-gray-500 italic text-sm'}`}>
                {runnerUpReady ? `🥈 ${translateTeam(runnerUp)}` : (mode === 'mine' ? 'Sin elegir' : 'Pendiente')}
              </span>
            </div>
          </div>
          {mode === 'mine' && (
            <p className="text-[10px] text-gray-500 text-center -mt-2">
              Elige campeón y subcampeón en la pestaña “Mis Pronósticos” → Bracket Llaves.
            </p>
          )}

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center mb-2">Partido Final</h3>
            {renderCard('k2-1')}
          </div>
        </div>
      ) : (
        // Fases con lado izquierdo y lado derecho
        <div className="grid grid-cols-2 gap-3 sm:gap-8">
          <div className="space-y-2 sm:space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Lado Izquierdo</h3>
            {stage.left.map(id => renderCard(id))}
          </div>
          <div className="space-y-2 sm:space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Lado Derecho</h3>
            {stage.right.map(id => renderCard(id))}
          </div>
        </div>
      )}
    </div>
  );
}
