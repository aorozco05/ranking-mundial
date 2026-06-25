import React, { useState, useMemo } from 'react';
import { Trophy, Lock, Save, CheckCircle2, Calendar, Clock, Settings, ChevronDown, Trash2, Award } from 'lucide-react';
import { translateTeam } from '../utils/teamNames';
import { TEAMS } from '../utils/mockData';
import { resolveFullBracket } from '../utils/bracketResolver';
import { isPhaseDeadlinePassed, hasMatchStarted } from '../utils/matchSchedule';

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

// Puntos de avance ("llaves") que otorga el ganador de un partido al pasar a la
// siguiente fase. SF y Final no otorgan puntos por avance: los finalistas se
// puntúan mediante la selección directa de campeón (30) y subcampeón (20).
const STAGE_ADVANCE = {
  r32: { set: 'r16', pts: 9 },
  r16: { set: 'qf', pts: 12 },
  qf: { set: 'sf', pts: 18 }
};

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
  updateMatchResult,
  phaseDeadlines = {},
  updatePhaseDeadline
}) {
  const isUser = currentUser?.role === 'user';
  const isAdmin = currentUser?.role === 'admin';
  const targetUser = useMemo(
    () => (isUser ? users.find(u => u.id === currentUser.id) || null : null),
    [isUser, users, currentUser]
  );

  const [activeStage, setActiveStage] = useState('r32');
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [editingScores, setEditingScores] = useState({}); // edición de resultados (admin)
  const [championSaveStatus, setChampionSaveStatus] = useState(null);

  const stage = STAGES.find(s => s.key === activeStage) || STAGES[0];

  // Mapa de partidos reales (estructura y resultados oficiales).
  const liveMatchMap = useMemo(() => {
    const map = {};
    (matches || []).forEach(m => { map[m.id] = m; });
    return map;
  }, [matches]);

  // Bracket que el usuario pronosticó (a partir de sus marcadores), usado solo
  // para saber qué equipos esperaba que avanzaran y así mostrar sus puntos.
  const userBracket = useMemo(() => {
    if (!targetUser) return null;
    return resolveFullBracket(matches, targetUser.predictions?.matches || {}).bracket;
  }, [targetUser, matches]);

  /* ---------- Selección de campeón / subcampeón (usuario) ---------- */
  const savedBracket = targetUser?.predictions?.bracket || {};
  const selectedChampion = savedBracket.champion || '';
  const selectedRunnerUp = savedBracket.runnerUp || '';
  const knockoutStarted = matches.some(m => m.stage !== 'groups' && hasMatchStarted(m));
  const championLocked = !isUser || knockoutStarted || isPhaseDeadlinePassed('final', phaseDeadlines);

  const handleChampionPick = async (field, value) => {
    if (!isUser || !targetUser || championLocked) return;
    const updatedPredictions = {
      ...targetUser.predictions,
      bracket: { ...targetUser.predictions?.bracket, [field]: value || null }
    };
    setChampionSaveStatus('saving');
    try {
      await updateUserPredictions(targetUser.id, updatedPredictions);
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

  /* ---------- Helpers de render (funciones, no componentes) ---------- */
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

  const teamRow = (key, team, score, isWinner, played, byPenalty) => {
    const pending = isPlaceholder(team);
    return (
      <div key={key} className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${isWinner ? 'bg-emerald-500/15' : ''}`}>
        <span className={`truncate ${pending ? 'text-gray-500 italic' : isWinner ? 'text-emerald-primary font-bold' : 'text-gray-200 font-semibold'}`}>
          {pending ? 'Por definir' : translateTeam(team)}
          {isWinner && byPenalty && <span className="ml-1 text-[9px] text-gold font-bold align-top" title="Avanza por penales">PEN</span>}
        </span>
        <span className={`tabular-nums shrink-0 ${isWinner ? 'text-emerald-primary font-bold' : 'text-gray-400'}`}>
          {played ? score : '–'}
        </span>
      </div>
    );
  };

  // Insignia de puntos de avance para el usuario (una vez jugado el partido).
  const advanceBadge = (id, stageKey) => {
    if (!isUser || !userBracket) return null;
    const cfg = STAGE_ADVANCE[stageKey];
    if (!cfg) return null; // SF / Final no otorgan puntos por avance
    const m = liveMatchMap[id];
    const winnerSide = m ? getWinnerSide(m.homeScore, m.awayScore, m.penaltyWinner) : null;
    if (!winnerSide) {
      return <span className="text-[10px] text-gray-500 font-semibold">Pendiente</span>;
    }
    const realWinner = winnerSide === 'home' ? m.homeTeam : m.awayTeam;
    const predicted = (userBracket[cfg.set] || []).includes(realWinner);
    return predicted
      ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-primary bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">✓ Acertaste +{cfg.pts}</span>
      : <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">✗ 0 pts</span>;
  };

  // Tarjeta de lectura (usuario / invitado): equipos y resultado reales.
  const viewerCard = (id, stageKey) => {
    const m = liveMatchMap[id];
    const played = m && m.homeScore !== null && m.homeScore !== undefined && m.awayScore !== null && m.awayScore !== undefined;
    const winner = m ? getWinnerSide(m.homeScore, m.awayScore, m.penaltyWinner) : null;
    const isTie = played && parseInt(m.homeScore, 10) === parseInt(m.awayScore, 10);
    return (
      <div key={id} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden text-xs w-full">
        {matchHeader(m)}
        {teamRow('h', m?.homeTeam, m?.homeScore, winner === 'home', played, isTie)}
        <div className="h-px bg-white/10" />
        {teamRow('a', m?.awayTeam, m?.awayScore, winner === 'away', played, isTie)}
        {isUser && STAGE_ADVANCE[stageKey] && (
          <div className="px-2.5 py-1.5 border-t border-white/10 flex justify-end">
            {advanceBadge(id, stageKey)}
          </div>
        )}
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
    const hasResult = m && m.homeScore !== null && m.homeScore !== undefined && m.awayScore !== null && m.awayScore !== undefined;
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
          <span className={`truncate ${homePending ? 'text-gray-500 italic' : 'text-gray-200 font-semibold'}`}>
            {homePending ? 'Por definir' : translateTeam(m?.homeTeam)}
          </span>
          <input type="number" placeholder="-" value={homeVal} onChange={(e) => handleScoreChange(id, 'homeScore', e.target.value)}
            className="w-9 bg-white/5 border border-white/15 rounded-md text-center font-bold text-white text-sm py-0.5 focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        </div>
        <div className="h-px bg-white/10" />
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
          <span className={`truncate ${awayPending ? 'text-gray-500 italic' : 'text-gray-200 font-semibold'}`}>
            {awayPending ? 'Por definir' : translateTeam(m?.awayTeam)}
          </span>
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

  const renderCard = (id, stageKey) => (isAdmin ? adminCard(id) : viewerCard(id, stageKey));

  /* ---------- Campeón / subcampeón ---------- */
  const realChampion = actualBracket?.champion && !isPlaceholder(actualBracket.champion) ? actualBracket.champion : null;
  const realRunnerUp = actualBracket?.runnerUp && !isPlaceholder(actualBracket.runnerUp) ? actualBracket.runnerUp : null;

  const championStatus = (field, picked, real, pts) => {
    if (!isUser) return null;
    if (!picked) return <span className="text-[10px] text-gray-500">Sin elegir</span>;
    if (!real) return <span className="text-[10px] text-gray-400">Elegido</span>;
    return picked === real
      ? <span className="text-[10px] font-bold text-gold">🏆 Acertaste +{pts}</span>
      : <span className="text-[10px] font-bold text-rose-400">✗ 0 pts</span>;
  };

  return (
    <div className="glass-panel p-6 rounded-3xl space-y-6" style={{ contentVisibility: 'auto' }}>
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold font-title text-white flex items-center justify-center gap-2">
          <Trophy size={20} className="text-gold" /> Las Llaves del Mundial
        </h2>
        <p className="text-xs text-gray-400">Resultados al momento • selecciona la fase</p>
      </div>

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
                {championStatus('champion', selectedChampion, realChampion, 30)}
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
                {championStatus('runnerUp', selectedRunnerUp, realRunnerUp, 20)}
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
    </div>
  );
}
