import React, { useState, useMemo } from 'react';
import { Trophy, Lock, Save, CheckCircle2, Loader2, AlertCircle, Calendar, Clock, Settings, ChevronDown, Trash2, Award } from 'lucide-react';
import { translateTeam } from '../utils/teamNames';
import { TEAMS } from '../utils/mockData';
import { isPredictionLocked, isPhaseDeadlinePassed } from '../utils/matchSchedule';
import { getAdvancePointsForStage, winnerSideOf, calculateMatchPoints } from '../utils/scoring';

// Estructura del árbol de llaves dividido en lado izquierdo y lado derecho,
// siguiendo el emparejamiento definido en bracketResolver (k32 → k16 → k8 → k4 → k2).
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
  { key: 'final', label: 'Final' },
  { key: 'champion', label: 'Campeón / Subcampeón' }
];

const isPlaceholder = (name) => {
  if (!name) return true;
  return (
    name.startsWith('1') ||
    name.startsWith('2') ||
    name.startsWith('3-') ||
    name.startsWith('W') ||
    name.startsWith('RU') ||
    name.includes('Ganador') ||
    name.includes('Perdedor') ||
    name.includes('Campeón') ||
    name.includes('Subcampeón') ||
    name === 'Vacío'
  );
};

const hasScore = (s) => s !== null && s !== undefined && s !== '';

export default function BracketView({
  matches,
  actualBracket,
  currentUser,
  users = [],
  updateUserPredictions,
  updateMatchResult,
  phaseDeadlines = {},
  updatePhaseDeadline,
  collapsible = false,
  defaultOpen = true
}) {
  const isUser = currentUser?.role === 'user';
  const isAdmin = currentUser?.role === 'admin';
  const [sectionOpen, setSectionOpen] = useState(defaultOpen);
  const showBody = !collapsible || sectionOpen;
  const targetUser = useMemo(
    () => (isUser ? users.find(u => u.id === currentUser.id) || null : null),
    [isUser, users, currentUser]
  );

  const [activeStage, setActiveStage] = useState('r32');
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [editingScores, setEditingScores] = useState({}); // resultados (admin)
  const [predEdits, setPredEdits] = useState({});          // borradores de pronóstico (usuario)
  const [predStatus, setPredStatus] = useState({});        // estado de guardado por partido
  const [championSaveStatus, setChampionSaveStatus] = useState(null);

  const stage = STAGES.find(s => s.key === activeStage) || STAGES[0];

  // Mapa de partidos reales (estructura y resultados oficiales).
  const liveMatchMap = useMemo(() => {
    const map = {};
    (matches || []).forEach(m => { map[m.id] = m; });
    return map;
  }, [matches]);

  /* ---------- Pronósticos del usuario (sobre enfrentamientos reales) ---------- */
  const getSavedPred = (id) => targetUser?.predictions?.matches?.[id] || {};
  const getCurrentPred = (id) => (id in predEdits ? predEdits[id] : getSavedPred(id));
  const isMatchDirty = (id) => {
    if (!(id in predEdits)) return false;
    const s = getSavedPred(id);
    const e = predEdits[id];
    return (e.homeScore ?? null) !== (s.homeScore ?? null)
      || (e.awayScore ?? null) !== (s.awayScore ?? null)
      || (e.penaltyWinner ?? null) !== (s.penaltyWinner ?? null);
  };
  const applyLocalEdit = (id, patch) => {
    setPredEdits(prev => {
      const base = id in prev ? prev[id] : getSavedPred(id);
      return { ...prev, [id]: { ...base, ...patch } };
    });
    setPredStatus(prev => {
      if (!prev[id]) return prev;
      const n = { ...prev }; delete n[id]; return n;
    });
  };
  const handlePredScore = (id, side, value, realMatch) => {
    if (!isUser || isPredictionLocked(realMatch, phaseDeadlines)) return;
    const clean = value === '' ? null : parseInt(value, 10);
    applyLocalEdit(id, { [side]: isNaN(clean) ? null : clean });
  };
  const handlePredPenalty = (id, pen, realMatch) => {
    if (!isUser || isPredictionLocked(realMatch, phaseDeadlines)) return;
    applyLocalEdit(id, { penaltyWinner: pen });
  };
  const handleSavePred = async (id) => {
    if (!isUser || !targetUser || !(id in predEdits) || predStatus[id] === 'saving') return;
    const updated = {
      ...targetUser.predictions,
      matches: { ...targetUser.predictions?.matches, [id]: { ...getSavedPred(id), ...predEdits[id] } }
    };
    setPredStatus(prev => ({ ...prev, [id]: 'saving' }));
    try {
      await updateUserPredictions(targetUser.id, updated);
      setPredEdits(prev => { const n = { ...prev }; delete n[id]; return n; });
      setPredStatus(prev => ({ ...prev, [id]: 'saved' }));
    } catch (err) {
      console.error('Error al guardar el pronóstico:', err);
      setPredStatus(prev => ({ ...prev, [id]: 'error' }));
    }
  };

  /* ---------- Selección de campeón / subcampeón (usuario) ---------- */
  const savedBracket = targetUser?.predictions?.bracket || {};
  const selectedChampion = savedBracket.champion || '';
  const selectedRunnerUp = savedBracket.runnerUp || '';
  // El campeón/subcampeón se bloquea con su propia fecha límite dedicada ('champion'),
  // independiente de las fases. El admin siempre puede editar.
  const championLocked = !isUser || isPhaseDeadlinePassed('champion', phaseDeadlines);

  const handleChampionPick = async (field, value) => {
    if (!isUser || !targetUser || championLocked) return;
    const updated = {
      ...targetUser.predictions,
      bracket: { ...targetUser.predictions?.bracket, [field]: value || null }
    };
    setChampionSaveStatus('saving');
    try {
      await updateUserPredictions(targetUser.id, updated);
      setChampionSaveStatus('saved');
    } catch (err) {
      console.error('Error al guardar campeón/subcampeón:', err);
      setChampionSaveStatus('error');
    }
  };

  /* ---------- Registro de resultados (admin) ---------- */
  const handleScoreChange = (id, side, value) => {
    const clean = value === '' ? '' : parseInt(value, 10);
    setEditingScores(prev => ({ ...prev, [id]: { ...prev[id], [side]: isNaN(clean) ? '' : clean } }));
  };
  const setPenalty = (id, homeVal, awayVal, pen) => {
    setEditingScores(prev => ({ ...prev, [id]: { ...prev[id], homeScore: homeVal, awayScore: awayVal, penaltyWinner: pen } }));
  };
  const handleSaveResult = (id) => {
    const edit = editingScores[id];
    if (!edit) return;
    const homeScore = edit.homeScore === '' || edit.homeScore === undefined ? null : edit.homeScore;
    const awayScore = edit.awayScore === '' || edit.awayScore === undefined ? null : edit.awayScore;
    if (homeScore === null || awayScore === null) return;
    const isTie = parseInt(homeScore, 10) === parseInt(awayScore, 10);
    const penaltyWinner = edit.penaltyWinner || liveMatchMap[id]?.penaltyWinner;
    if (isTie && !penaltyWinner) {
      alert('Por favor selecciona el equipo que avanza (penales).');
      return;
    }
    updateMatchResult(id, homeScore, awayScore, 'finished', isTie ? penaltyWinner : null);
    setEditingScores(prev => { const n = { ...prev }; delete n[id]; return n; });
  };
  const handleClearResult = (id) => {
    if (window.confirm('¿Borrar el resultado de este partido?')) {
      updateMatchResult(id, null, null, 'scheduled', null);
    }
  };

  /* ---------- Render helpers (funciones, no componentes) ---------- */
  const matchHeader = (m) => {
    if (!m?.date && !m?.time) return null;
    return (
      <div className="flex items-center justify-between gap-2 px-2.5 py-1 bg-white/2.5 border-b border-white/10 text-[10px] text-gray-400">
        <span className="flex items-center gap-2">
          {m?.date && <span className="flex items-center gap-1"><Calendar size={10} /> {m.date}</span>}
          {m?.time && <span className="flex items-center gap-1"><Clock size={10} /> {m.time}</span>}
        </span>
      </div>
    );
  };

  const nameCell = (team, highlight, byPenalty) => {
    const pending = isPlaceholder(team);
    return (
      <span className={`truncate ${pending ? 'text-gray-500 italic' : highlight ? 'text-emerald-primary font-bold' : 'text-gray-200 font-semibold'}`}>
        {pending ? 'Por definir' : translateTeam(team)}
        {highlight && byPenalty && <span className="ml-1 text-[9px] text-gold font-bold align-top" title="Avanza por penales">PEN</span>}
      </span>
    );
  };

  // Insignia de puntos por partido (estilo similar a "Partidos del Día").
  // Suma los puntos por resultado (exacto/diferencia/ganador) MÁS los puntos de
  // avance de la llave si acertó el equipo que avanza.
  const pointsBadge = (id, stageKey) => {
    const real = liveMatchMap[id];
    const played = real && hasScore(real.homeScore) && hasScore(real.awayScore);
    if (!played) return <span className="text-[10px] text-gray-500 font-semibold uppercase">Pendiente</span>;
    const saved = getSavedPred(id);
    const hasPred = hasScore(saved.homeScore) && hasScore(saved.awayScore);
    if (!hasPred) return <span className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-2 py-0.5 rounded-md text-[10px] font-bold">Sin predicción (0)</span>;

    const matchRes = calculateMatchPoints(saved, real); // 5 / 3 / 2 / 0
    const advPts = getAdvancePointsForStage(stageKey);   // 9 / 12 / 18 / 0
    let adv = 0;
    if (advPts) {
      const realSide = winnerSideOf(real.homeScore, real.awayScore, real.penaltyWinner);
      const predSide = winnerSideOf(saved.homeScore, saved.awayScore, saved.penaltyWinner);
      if (realSide && predSide && realSide === predSide) adv = advPts;
    }
    const total = matchRes.points + adv;
    const marcadorLabel = matchRes.points === 5 ? 'Exacto +5'
      : matchRes.points === 3 ? 'Diferencia +3'
      : matchRes.points === 2 ? 'Ganador +2'
      : 'Marcador 0';

    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${total > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-primary' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
          {total > 0 ? `Ganaste +${total}` : 'Fallado (0)'}
        </span>
        <span className="text-[9px] text-gray-400">
          {marcadorLabel}{advPts ? ` · Llave ${adv ? `+${adv}` : '0'}` : ''}
        </span>
      </div>
    );
  };

  // Tarjeta de solo lectura (invitado): equipos y resultado reales.
  const guestCard = (id) => {
    const m = liveMatchMap[id];
    const played = m && hasScore(m.homeScore) && hasScore(m.awayScore);
    const winner = m ? winnerSideOf(m.homeScore, m.awayScore, m.penaltyWinner) : null;
    const isTie = played && parseInt(m.homeScore, 10) === parseInt(m.awayScore, 10);
    return (
      <div key={id} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden text-xs w-full">
        {matchHeader(m)}
        <div className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${winner === 'home' ? 'bg-emerald-500/15' : ''}`}>
          {nameCell(m?.homeTeam, winner === 'home', isTie)}
          <span className="tabular-nums shrink-0 text-gray-400">{played ? m.homeScore : '–'}</span>
        </div>
        <div className="h-px bg-white/10" />
        <div className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${winner === 'away' ? 'bg-emerald-500/15' : ''}`}>
          {nameCell(m?.awayTeam, winner === 'away', isTie)}
          <span className="tabular-nums shrink-0 text-gray-400">{played ? m.awayScore : '–'}</span>
        </div>
      </div>
    );
  };

  // Tarjeta de pronóstico del usuario sobre el enfrentamiento REAL.
  const userCard = (id, stageKey) => {
    const real = liveMatchMap[id];
    const hasResult = real && hasScore(real.homeScore) && hasScore(real.awayScore);
    const locked = isPredictionLocked(real, phaseDeadlines);
    const editable = !locked;
    const closedByDeadline = isPhaseDeadlinePassed(real?.stage, phaseDeadlines);

    const pred = getCurrentPred(id) || {};
    const hv = hasScore(pred.homeScore) ? pred.homeScore : '';
    const av = hasScore(pred.awayScore) ? pred.awayScore : '';
    const filled = hv !== '' && av !== '';
    const isTie = filled && parseInt(hv, 10) === parseInt(av, 10);
    const predWinner = winnerSideOf(hv, av, pred.penaltyWinner);
    const homePending = isPlaceholder(real?.homeTeam);
    const awayPending = isPlaceholder(real?.awayTeam);

    const scoreCell = (side, val) => editable
      ? <input type="number" placeholder="-" value={val} onChange={(e) => handlePredScore(id, side, e.target.value, real)}
          className="w-9 bg-white/5 border border-white/15 rounded-md text-center font-bold text-white text-sm py-0.5 focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
      : <span className={`tabular-nums shrink-0 ${(side === 'homeScore' ? predWinner === 'home' : predWinner === 'away') ? 'text-emerald-primary font-bold' : 'text-gray-400'}`}>{val === '' ? '–' : val}</span>;

    return (
      <div key={id} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden text-xs w-full">
        {matchHeader(real)}

        <div className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${predWinner === 'home' ? 'bg-emerald-500/15' : ''}`}>
          {nameCell(real?.homeTeam, predWinner === 'home', isTie)}
          {scoreCell('homeScore', hv)}
        </div>
        <div className="h-px bg-white/10" />
        <div className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${predWinner === 'away' ? 'bg-emerald-500/15' : ''}`}>
          {nameCell(real?.awayTeam, predWinner === 'away', isTie)}
          {scoreCell('awayScore', av)}
        </div>

        {/* Empate pronosticado: ¿quién avanza? */}
        {isTie && (
          <div className="px-2.5 py-2 border-t border-white/10 bg-white/2.5">
            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1">¿Quién avanza?</span>
            {editable ? (
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" onClick={() => handlePredPenalty(id, 'home', real)}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold border truncate transition-colors ${pred.penaltyWinner === 'home' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
                  {homePending ? 'Local' : translateTeam(real?.homeTeam)}
                </button>
                <button type="button" onClick={() => handlePredPenalty(id, 'away', real)}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold border truncate transition-colors ${pred.penaltyWinner === 'away' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
                  {awayPending ? 'Visitante' : translateTeam(real?.awayTeam)}
                </button>
              </div>
            ) : (
              <span className="text-[10px] text-emerald-primary font-bold">
                {pred.penaltyWinner ? `Avanza: ${translateTeam(pred.penaltyWinner === 'away' ? real?.awayTeam : real?.homeTeam)}` : 'Sin definir'}
              </span>
            )}
          </div>
        )}

        {/* Resultado oficial cuando ya se jugó */}
        {hasResult && (
          <div className="px-2.5 pt-1.5 text-[10px] text-gray-400 flex items-center gap-1">
            <Trophy size={11} className="text-gold" /> Resultado oficial:
            <span className="text-white font-bold">{real.homeScore}:{real.awayScore}</span>
          </div>
        )}

        {/* Pie: guardar (editable) o puntos/estado (cerrado) */}
        <div className="px-2.5 py-1.5 border-t border-white/10 mt-1.5 flex justify-end items-center">
          {editable ? (
            isMatchDirty(id) ? (
              <button onClick={() => handleSavePred(id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500 text-black hover:bg-amber-400 transition-all">
                <Save size={12} /> Guardar
              </button>
            ) : predStatus[id] === 'saving' ? (
              <span className="flex items-center gap-1 text-[10px] text-gray-300"><Loader2 size={12} className="animate-spin" /> Guardando…</span>
            ) : predStatus[id] === 'error' ? (
              <button onClick={() => handleSavePred(id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/15 border border-rose-500/40 text-rose-400">
                <AlertCircle size={12} /> Reintentar
              </button>
            ) : filled ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-primary font-bold"><CheckCircle2 size={12} /> Guardado</span>
            ) : (
              <span className="text-[10px] text-gray-500">Sin pronóstico</span>
            )
          ) : hasResult ? (
            pointsBadge(id, stageKey)
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              <Lock size={11} /> {closedByDeadline ? 'Cerrado (fecha límite)' : 'Pronóstico cerrado'}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Tarjeta editable de resultados (admin).
  const adminCard = (id) => {
    const m = liveMatchMap[id];
    const edit = editingScores[id] || {};
    const homeVal = edit.homeScore !== undefined ? edit.homeScore : (m?.homeScore ?? '');
    const awayVal = edit.awayScore !== undefined ? edit.awayScore : (m?.awayScore ?? '');
    const isEdited = edit.homeScore !== undefined || edit.awayScore !== undefined;
    const hasResult = m && hasScore(m.homeScore) && hasScore(m.awayScore);
    const hn = homeVal !== '' ? parseInt(homeVal, 10) : null;
    const an = awayVal !== '' ? parseInt(awayVal, 10) : null;
    const isTie = hn !== null && an !== null && hn === an;
    const pen = edit.penaltyWinner || m?.penaltyWinner;
    const homePending = isPlaceholder(m?.homeTeam);
    const awayPending = isPlaceholder(m?.awayTeam);

    return (
      <div key={id} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden text-xs w-full">
        {matchHeader(m)}
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
          {nameCell(m?.homeTeam, false, false)}
          <input type="number" placeholder="-" value={homeVal} onChange={(e) => handleScoreChange(id, 'homeScore', e.target.value)}
            className="w-9 bg-white/5 border border-white/15 rounded-md text-center font-bold text-white text-sm py-0.5 focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        </div>
        <div className="h-px bg-white/10" />
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
          {nameCell(m?.awayTeam, false, false)}
          <input type="number" placeholder="-" value={awayVal} onChange={(e) => handleScoreChange(id, 'awayScore', e.target.value)}
            className="w-9 bg-white/5 border border-white/15 rounded-md text-center font-bold text-white text-sm py-0.5 focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        </div>

        {isTie && (
          <div className="px-2.5 py-2 border-t border-white/10 bg-white/2.5">
            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Avanza por penales:</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => setPenalty(id, homeVal, awayVal, 'home')}
                className={`px-2 py-1 rounded-md text-[10px] font-bold border truncate transition-colors ${pen === 'home' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
                {homePending ? 'Local' : translateTeam(m?.homeTeam)}
              </button>
              <button type="button" onClick={() => setPenalty(id, homeVal, awayVal, 'away')}
                className={`px-2 py-1 rounded-md text-[10px] font-bold border truncate transition-colors ${pen === 'away' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
                {awayPending ? 'Visitante' : translateTeam(m?.awayTeam)}
              </button>
            </div>
          </div>
        )}

        <div className="px-2.5 py-1.5 border-t border-white/10 flex justify-end gap-2">
          {hasResult && !isEdited ? (
            <>
              <span className="flex items-center gap-1 text-[10px] text-emerald-primary font-bold"><CheckCircle2 size={12} /> Oficial</span>
              <button onClick={() => handleClearResult(id)} className="p-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-md" title="Borrar resultado">
                <Trash2 size={12} />
              </button>
            </>
          ) : (
            <button onClick={() => handleSaveResult(id)} disabled={homeVal === '' || awayVal === ''}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-primary text-white hover:bg-emerald-600 disabled:bg-white/10 disabled:text-gray-500 transition-all">
              <Save size={12} /> Guardar
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderCard = (id, stageKey) => {
    if (isAdmin) return adminCard(id);
    if (isUser) return userCard(id, stageKey);
    return guestCard(id);
  };

  /* ---------- Campeón / subcampeón ---------- */
  const realChampion = actualBracket?.champion && !isPlaceholder(actualBracket.champion) ? actualBracket.champion : null;
  const realRunnerUp = actualBracket?.runnerUp && !isPlaceholder(actualBracket.runnerUp) ? actualBracket.runnerUp : null;

  const championStatus = (picked, real, pts) => {
    if (!isUser) return null;
    if (!picked) return <span className="text-[10px] text-gray-500">Sin elegir</span>;
    if (!real) return <span className="text-[10px] text-gray-400">Elegido</span>;
    return picked === real
      ? <span className="text-[10px] font-bold text-gold">🏆 Acertaste +{pts}</span>
      : <span className="text-[10px] font-bold text-rose-400">Fallado (0)</span>;
  };

  return (
    <div className="glass-panel p-6 rounded-3xl space-y-6" style={{ contentVisibility: 'auto' }}>
      {collapsible ? (
        <button
          onClick={() => setSectionOpen(o => !o)}
          className="w-full flex items-center justify-center gap-2 text-center"
        >
          <div className="space-y-1">
            <h2 className="text-2xl font-bold font-title text-white flex items-center justify-center gap-2">
              <Trophy size={20} className="text-gold" /> Partidos por Fases
              <ChevronDown size={20} className={`text-gray-400 transition-transform ${sectionOpen ? 'rotate-180' : ''}`} />
            </h2>
            <p className="text-xs text-gray-400">
              {sectionOpen
                ? (isUser ? 'Pronostica los partidos reales por fase' : 'Resultados al momento • selecciona la fase')
                : 'Toca para ver y editar el bracket'}
            </p>
          </div>
        </button>
      ) : (
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold font-title text-white flex items-center justify-center gap-2">
            <Trophy size={20} className="text-gold" /> Partidos por Fases
          </h2>
          <p className="text-xs text-gray-400">
            {isUser ? 'Pronostica los partidos reales por fase' : 'Resultados al momento • selecciona la fase'}
          </p>
        </div>
      )}

      {showBody && (<>
      {/* Resumen de puntos del usuario */}
      {isUser && targetUser?.scoreDetails && (
        <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
          <div className="p-3 bg-white/5 border border-emerald-500/20 rounded-xl text-center">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Total</span>
            <span className="text-xl font-black text-emerald-primary">{targetUser.scoreDetails.total}</span>
          </div>
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Partidos</span>
            <span className="text-xl font-black text-sky-400">{targetUser.scoreDetails.matchPoints}</span>
          </div>
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Llaves</span>
            <span className="text-xl font-black text-gold">{targetUser.scoreDetails.bracketPoints}</span>
          </div>
        </div>
      )}

      {/* Panel de administrador: fechas deshabilitadoras por fase */}
      {isAdmin && (
        <div className="border border-emerald-500/20 rounded-2xl overflow-hidden">
          <button onClick={() => setAdminPanelOpen(o => !o)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors">
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
                    <input type="datetime-local" value={phaseDeadlines[f.key] || ''}
                      onChange={(e) => updatePhaseDeadline(f.key, e.target.value)}
                      className="w-full p-2 bg-soccer-dark border border-white/10 focus:border-emerald-500 focus:outline-none rounded-lg text-xs text-white" />
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
          <button key={s.key} onClick={() => setActiveStage(s.key)}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeStage === s.key ? 'bg-emerald-primary text-white shadow-md' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {stage.key === 'final' ? (
        <div className="max-w-md mx-auto space-y-5">
          {/* Selección directa de campeón / subcampeón */}
          <div className="p-4 bg-white/5 border border-gold/30 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
                <Award size={14} /> Campeón y Subcampeón
              </span>
              {isUser && championLocked && (
                <span className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                  <Lock size={10} /> Cerrado
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">🏆 Campeón (+30)</label>
                {isUser && !championLocked ? (
                  <select value={selectedChampion} onChange={(e) => handleChampionPick('champion', e.target.value)}
                    className="w-full p-2.5 bg-soccer-dark border border-white/10 focus:border-gold focus:outline-none rounded-xl text-sm font-bold text-white">
                    <option value="">— Elegir equipo —</option>
                    {TEAMS.map(t => <option key={t} value={t}>{translateTeam(t)}</option>)}
                  </select>
                ) : (
                  <span className={`text-lg font-black block ${isUser ? (selectedChampion ? 'text-gold' : 'text-gray-500 italic') : (realChampion ? 'text-gold' : 'text-gray-500 italic')}`}>
                    {isUser
                      ? (selectedChampion ? `🏆 ${translateTeam(selectedChampion)}` : 'Sin elegir')
                      : (realChampion ? `🏆 ${translateTeam(realChampion)}` : 'Pendiente')}
                  </span>
                )}
                {championStatus(selectedChampion, realChampion, 30)}
              </div>

              <div>
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">🥈 Subcampeón (+20)</label>
                {isUser && !championLocked ? (
                  <select value={selectedRunnerUp} onChange={(e) => handleChampionPick('runnerUp', e.target.value)}
                    className="w-full p-2.5 bg-soccer-dark border border-white/10 focus:border-emerald-500 focus:outline-none rounded-xl text-sm font-bold text-white">
                    <option value="">— Elegir equipo —</option>
                    {TEAMS.map(t => <option key={t} value={t}>{translateTeam(t)}</option>)}
                  </select>
                ) : (
                  <span className={`text-base font-bold block ${isUser ? (selectedRunnerUp ? 'text-gray-200' : 'text-gray-500 italic') : (realRunnerUp ? 'text-gray-200' : 'text-gray-500 italic')}`}>
                    {isUser
                      ? (selectedRunnerUp ? `🥈 ${translateTeam(selectedRunnerUp)}` : 'Sin elegir')
                      : (realRunnerUp ? `🥈 ${translateTeam(realRunnerUp)}` : 'Pendiente')}
                  </span>
                )}
                {championStatus(selectedRunnerUp, realRunnerUp, 20)}
              </div>
            </div>

            {isUser && selectedChampion && selectedRunnerUp && selectedChampion === selectedRunnerUp && (
              <p className="text-[10px] text-rose-400 font-semibold">Campeón y subcampeón no pueden ser el mismo equipo.</p>
            )}
            {isUser && !championLocked && (
              <div className="text-[10px] font-semibold h-3">
                {championSaveStatus === 'saving' && <span className="text-gray-400">Guardando…</span>}
                {championSaveStatus === 'saved' && <span className="text-emerald-primary">✓ Guardado</span>}
                {championSaveStatus === 'error' && <span className="text-rose-400">Error al guardar</span>}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center mb-2">Partido Final</h3>
            {renderCard('k2-1', 'final')}
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center mb-2">🥉 Tercer Puesto</h3>
            {renderCard('k3rd-1', 'third')}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-8">
          <div className="space-y-2 sm:space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Lado Izquierdo</h3>
            {stage.left.map(id => renderCard(id, stage.key))}
          </div>
          <div className="space-y-2 sm:space-y-3">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Lado Derecho</h3>
            {stage.right.map(id => renderCard(id, stage.key))}
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}
