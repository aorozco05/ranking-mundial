import React, { useState, useMemo, useEffect } from 'react';
import { CalendarClock, Clock, Lock, Save, CheckCircle2, ShieldAlert, Plus, Minus, Trophy, Target, Loader2, AlertCircle } from 'lucide-react';
import { calculateMatchPoints } from '../utils/scoring';
import { hasMatchStarted } from '../utils/matchSchedule';
import { translateTeam } from '../utils/teamNames';

// Obtener la fecha de hoy en formato YYYY-MM-DD según la zona horaria local
const getTodayString = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getStageLabel = (match) => {
  switch (match.stage) {
    case 'r32': return 'Dieciseisavos';
    case 'r16': return 'Octavos';
    case 'qf': return 'Cuartos';
    case 'sf': return 'Semifinal';
    case 'final': return 'Final';
    default: return `Grupo ${match.group}`;
  }
};

export default function DailyMatches({ matches, currentUser, users, updateMatchResult, updateUserPredictions }) {
  const isAdmin = currentUser?.role === 'admin';
  const isGuest = currentUser?.role === 'guest';

  // Marcadores en edición local (solo modo admin)
  const [editingScores, setEditingScores] = useState({});

  const today = useMemo(() => getTodayString(), []);

  // Partidos programados para el día de hoy
  const todayMatches = useMemo(() => {
    return matches.filter(m => m.date === today);
  }, [matches, today]);

  // Usuario completo (con sus predicciones) para los participantes normales
  const targetUser = useMemo(() => {
    if (isAdmin || isGuest) return null;
    return users.find(u => u.id === currentUser?.id) || null;
  }, [users, currentUser, isAdmin, isGuest]);

  /* ---------- LÓGICA DE ADMIN: REGISTRAR RESULTADOS ---------- */
  const handleScoreChange = (matchId, side, value) => {
    const cleanValue = value === '' ? '' : parseInt(value, 10);
    setEditingScores(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [side]: isNaN(cleanValue) ? '' : cleanValue
      }
    }));
  };

  const adjustScore = (match, side, delta) => {
    const currentEdit = editingScores[match.id] || {};
    const currentValue = currentEdit[side] !== undefined
      ? currentEdit[side]
      : (match[side] !== null ? match[side] : 0);
    const newValue = Math.max(0, (parseInt(currentValue, 10) || 0) + delta);
    handleScoreChange(match.id, side, newValue);
  };

  const handleSaveResult = (match) => {
    const edit = editingScores[match.id];
    if (!edit) return;

    const homeScore = edit.homeScore === '' || edit.homeScore === undefined ? null : edit.homeScore;
    const awayScore = edit.awayScore === '' || edit.awayScore === undefined ? null : edit.awayScore;

    const isKnockout = match.stage !== 'groups';
    const isTie = isKnockout && homeScore !== null && awayScore !== null && parseInt(homeScore, 10) === parseInt(awayScore, 10);
    const penaltyWinner = edit.penaltyWinner || match.penaltyWinner;

    if (homeScore !== null && awayScore !== null) {
      if (isTie && !penaltyWinner) {
        alert('Por favor selecciona el ganador de la tanda de penaltis.');
        return;
      }
      updateMatchResult(match.id, homeScore, awayScore, 'finished', isTie ? penaltyWinner : null);
      const updated = { ...editingScores };
      delete updated[match.id];
      setEditingScores(updated);
    }
  };

  /* ---------- LÓGICA DE USUARIO: REGISTRAR PRONÓSTICOS (guardado por partido) ---------- */
  // Cada partido tiene su propio botón "Guardar". Los cambios se acumulan en un
  // borrador local por partido y solo se persisten al pulsar el botón.
  const [predEdits, setPredEdits] = useState({});   // { [matchId]: {homeScore, awayScore, penaltyWinner} }
  const [predStatus, setPredStatus] = useState({}); // { [matchId]: 'saving' | 'saved' | 'error' }

  // Descartar borradores si cambia el usuario actual (patrón recomendado de
  // React: ajustar estado durante el render al detectar el cambio).
  const [syncedUserId, setSyncedUserId] = useState(targetUser?.id);
  if (targetUser?.id !== syncedUserId) {
    setSyncedUserId(targetUser?.id);
    setPredEdits({});
    setPredStatus({});
  }

  const hasUnsavedPreds = Object.keys(predEdits).length > 0;
  useEffect(() => {
    if (!hasUnsavedPreds) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedPreds]);

  const getSavedPred = (matchId) => targetUser?.predictions?.matches?.[matchId] || {};
  const getCurrentPred = (matchId) =>
    matchId in predEdits ? predEdits[matchId] : getSavedPred(matchId);

  const isMatchDirty = (matchId) => {
    if (!(matchId in predEdits)) return false;
    const saved = getSavedPred(matchId);
    const edit = predEdits[matchId];
    return (edit.homeScore ?? null) !== (saved.homeScore ?? null)
      || (edit.awayScore ?? null) !== (saved.awayScore ?? null)
      || (edit.penaltyWinner ?? null) !== (saved.penaltyWinner ?? null);
  };

  const applyLocalEdit = (matchId, patch) => {
    setPredEdits(prev => {
      const base = matchId in prev ? prev[matchId] : getSavedPred(matchId);
      return { ...prev, [matchId]: { ...base, ...patch } };
    });
    setPredStatus(prev => {
      if (!prev[matchId]) return prev;
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
  };

  const handlePredictionScoreChange = (matchId, side, value) => {
    if (!targetUser) return;

    const match = matches.find(m => m.id === matchId);
    const isOfficialized = match && match.homeScore !== null && match.awayScore !== null;
    if (isOfficialized || hasMatchStarted(match)) return; // No editar si ya comenzó o finalizó

    const cleanValue = value === '' ? null : parseInt(value, 10);
    applyLocalEdit(matchId, { [side]: isNaN(cleanValue) ? null : cleanValue });
  };

  const adjustPredictionScore = (match, side, delta) => {
    if (!targetUser) return;
    const isOfficialized = match.homeScore !== null && match.awayScore !== null;
    if (isOfficialized || hasMatchStarted(match)) return;

    const currentPred = getCurrentPred(match.id) || {};
    const currentValue = currentPred[side] !== undefined && currentPred[side] !== null
      ? currentPred[side]
      : 0;
    const newValue = Math.max(0, (parseInt(currentValue, 10) || 0) + delta);
    handlePredictionScoreChange(match.id, side, newValue);
  };

  const handlePredictionPenaltyWinnerChange = (matchId, penaltyWinner) => {
    if (!targetUser) return;
    const match = matches.find(m => m.id === matchId);
    const isOfficialized = match && match.homeScore !== null && match.awayScore !== null;
    if (isOfficialized || hasMatchStarted(match)) return;

    applyLocalEdit(matchId, { penaltyWinner });
  };

  const handleSavePrediction = async (matchId) => {
    if (!targetUser || !(matchId in predEdits)) return;
    if (predStatus[matchId] === 'saving') return;

    const updatedPredictions = {
      ...targetUser.predictions,
      matches: {
        ...targetUser.predictions?.matches,
        [matchId]: { ...getSavedPred(matchId), ...predEdits[matchId] }
      }
    };

    setPredStatus(prev => ({ ...prev, [matchId]: 'saving' }));
    try {
      await updateUserPredictions(targetUser.id, updatedPredictions);
      setPredEdits(prev => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      setPredStatus(prev => ({ ...prev, [matchId]: 'saved' }));
    } catch (err) {
      console.error('Error al guardar el pronóstico:', err);
      setPredStatus(prev => ({ ...prev, [matchId]: 'error' }));
    }
  };

  // Botón de guardado por partido (check verde si está guardado; ámbar si hay
  // cambios sin guardar; rojo si falló el guardado).
  const renderSaveButton = (matchId) => {
    const status = predStatus[matchId];
    const dirty = isMatchDirty(matchId);
    const saved = getSavedPred(matchId);
    const hasSavedPred = saved.homeScore !== undefined && saved.homeScore !== null
      && saved.awayScore !== undefined && saved.awayScore !== null;

    if (status === 'saving') {
      return (
        <button disabled className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-gray-300">
          <Loader2 size={14} className="animate-spin" /> Guardando…
        </button>
      );
    }
    if (status === 'error') {
      return (
        <button onClick={() => handleSavePrediction(matchId)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:bg-rose-500/25 transition-all">
          <AlertCircle size={14} /> Reintentar
        </button>
      );
    }
    if (dirty) {
      return (
        <button onClick={() => handleSavePrediction(matchId)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 shadow-md animate-pulse transition-all">
          <Save size={14} /> Guardar
        </button>
      );
    }
    if (hasSavedPred) {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-primary">
          <CheckCircle2 size={14} /> Guardado
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-gray-400">
        <Save size={14} /> Sin guardar
      </span>
    );
  };

  const getPredictionBadge = (match) => {
    const hasResult = match.homeScore !== null && match.awayScore !== null;
    const pred = targetUser?.predictions?.matches?.[match.id];
    const hasPred = pred && pred.homeScore !== null && pred.homeScore !== undefined && pred.awayScore !== null && pred.awayScore !== undefined;

    if (!hasResult) {
      if (hasMatchStarted(match)) {
        return hasPred
          ? <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-primary px-2.5 py-0.5 rounded-lg text-[10px] font-bold">Pronóstico cerrado</span>
          : <span className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">No pronosticaste</span>;
      }
      return hasPred
        ? <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-primary px-2.5 py-0.5 rounded-lg text-[10px] font-bold">Pronóstico guardado</span>
        : <span className="bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">Sin pronóstico</span>;
    }

    if (!hasPred) {
      return <span className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">Sin Predicción (0 pts)</span>;
    }
    if (match.stage !== 'groups') {
      return <span className="bg-white/5 border border-white/10 text-gray-400 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">Solo Grupos (0 pts)</span>;
    }
    const result = calculateMatchPoints(pred, match);
    if (result.points === 5) return <span className="bg-amber-500/10 border border-gold text-gold px-2.5 py-0.5 rounded-lg text-[10px] font-bold">Exacto (+5)</span>;
    if (result.points === 3) return <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-primary px-2.5 py-0.5 rounded-lg text-[10px] font-bold">Diferencia (+3)</span>;
    if (result.points === 2) return <span className="bg-sky-500/10 border border-sky-500/20 text-sky-400 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">Ganador (+2)</span>;
    return <span className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">Fallado (0)</span>;
  };

  // Fecha legible para el encabezado
  const readableDate = useMemo(() => {
    try {
      return new Date(`${today}T00:00:00`).toLocaleDateString('es-CO', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
    } catch {
      return today;
    }
  }, [today]);

  return (
    <div className="glass-panel p-6 rounded-3xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-primary rounded-xl shadow-[0_0_12px_var(--color-emerald-glow)]">
            <CalendarClock size={22} />
          </div>
          <div>
            <h2 className="text-xl font-bold font-title text-white leading-tight">Partidos del Día</h2>
            <p className="text-xs text-gray-400 capitalize">{readableDate}</p>
          </div>
        </div>

        {/* Indicador de modo según el rol */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs justify-center">
          {isAdmin ? (
            <>
              <ShieldAlert size={14} className="text-emerald-primary" />
              <span className="text-gray-300">Modo Admin: Registra los resultados</span>
            </>
          ) : isGuest ? (
            <>
              <ShieldAlert size={14} className="text-amber-500" />
              <span className="text-gray-300">Modo Lector: Solo visualización</span>
            </>
          ) : (
            <>
              <Target size={14} className="text-emerald-primary" />
              <span className="text-gray-300">Agrega tu pronóstico</span>
            </>
          )}
        </div>
      </div>

      {todayMatches.length === 0 ? (
        <div className="p-8 text-center text-gray-400 border border-dashed border-white/10 rounded-2xl">
          <CalendarClock size={28} className="mx-auto text-gray-500 mb-2" />
          <p className="text-sm font-semibold">No hay partidos programados para hoy.</p>
          <p className="text-xs text-gray-500 mt-1">Vuelve más tarde para ver los próximos encuentros.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {todayMatches.map(match => {
            const hasResult = match.homeScore !== null && match.awayScore !== null;

            /* ----- Vista Admin: editar resultado ----- */
            if (isAdmin) {
              const currentEdit = editingScores[match.id] || {};
              const homeVal = currentEdit.homeScore !== undefined ? currentEdit.homeScore : (match.homeScore ?? '');
              const awayVal = currentEdit.awayScore !== undefined ? currentEdit.awayScore : (match.awayScore ?? '');
              const isEdited = currentEdit.homeScore !== undefined || currentEdit.awayScore !== undefined;

              const isKnockout = match.stage !== 'groups';
              const homeScoreNum = homeVal !== '' ? parseInt(homeVal, 10) : null;
              const awayScoreNum = awayVal !== '' ? parseInt(awayVal, 10) : null;
              const isTie = isKnockout && homeScoreNum !== null && awayScoreNum !== null && homeScoreNum === awayScoreNum;

              return (
                <div key={match.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/7.5 transition-all">
                  <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-primary px-2 py-0.5 rounded-md text-[10px] font-bold self-center md:self-auto">
                    {getStageLabel(match)}
                  </span>

                  <div className="flex flex-col flex-grow items-center justify-center">
                    <div className="flex items-center justify-center gap-3 w-full">
                      <div className="w-24 sm:w-28 text-right font-bold text-gray-200 text-sm break-words leading-tight">{translateTeam(match.homeTeam)}</div>
                      <div className="flex items-center gap-1 bg-white/5 border border-white/15 p-1 rounded-xl">
                        <button type="button" onClick={() => adjustScore(match, 'homeScore', -1)} className="w-7 h-7 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-gray-300">
                          <Minus size={12} />
                        </button>
                        <input type="number" placeholder="-" value={homeVal} onChange={(e) => handleScoreChange(match.id, 'homeScore', e.target.value)}
                          className="w-9 bg-transparent text-center font-bold text-white text-base focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <span className="text-gray-500 text-xs">:</span>
                        <input type="number" placeholder="-" value={awayVal} onChange={(e) => handleScoreChange(match.id, 'awayScore', e.target.value)}
                          className="w-9 bg-transparent text-center font-bold text-white text-base focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <button type="button" onClick={() => adjustScore(match, 'awayScore', 1)} className="w-7 h-7 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-gray-300">
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="w-24 sm:w-28 text-left font-bold text-gray-200 text-sm break-words leading-tight">{translateTeam(match.awayTeam)}</div>
                    </div>

                    {isTie && (
                      <div className="flex flex-col items-center mt-2.5">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Avanza por Penaltis:</span>
                        <div className="flex gap-2">
                          <button type="button"
                            onClick={() => setEditingScores(prev => ({ ...prev, [match.id]: { ...prev[match.id], homeScore: homeVal, awayScore: awayVal, penaltyWinner: 'home' } }))}
                            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${(currentEdit.penaltyWinner || match.penaltyWinner) === 'home' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
                            {translateTeam(match.homeTeam)}
                          </button>
                          <button type="button"
                            onClick={() => setEditingScores(prev => ({ ...prev, [match.id]: { ...prev[match.id], homeScore: homeVal, awayScore: awayVal, penaltyWinner: 'away' } }))}
                            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${(currentEdit.penaltyWinner || match.penaltyWinner) === 'away' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
                            {translateTeam(match.awayTeam)}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end">
                    {hasResult && !isEdited ? (
                      <span className="text-emerald-primary text-xs font-semibold flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20">
                        <CheckCircle2 size={13} /> Oficial
                      </span>
                    ) : (
                      <button onClick={() => handleSaveResult(match)} disabled={homeVal === '' || awayVal === ''}
                        className="w-full md:w-auto bg-emerald-primary hover:bg-emerald-600 disabled:bg-white/10 disabled:text-gray-500 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1">
                        <Save size={14} /> Guardar
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            /* ----- Vista Usuario / Invitado: pronóstico ----- */
            const pred = (isGuest ? getSavedPred(match.id) : getCurrentPred(match.id)) || {};
            const homeVal = pred.homeScore !== undefined && pred.homeScore !== null ? pred.homeScore : '';
            const awayVal = pred.awayScore !== undefined && pred.awayScore !== null ? pred.awayScore : '';

            const isKnockout = match.stage !== 'groups';
            const homeScoreNum = homeVal !== '' ? parseInt(homeVal, 10) : null;
            const awayScoreNum = awayVal !== '' ? parseInt(awayVal, 10) : null;
            const isTie = isKnockout && homeScoreNum !== null && awayScoreNum !== null && homeScoreNum === awayScoreNum;

            const started = hasMatchStarted(match);
            const canEditMatch = !isGuest && targetUser && !hasResult && !started;

            return (
              <div key={match.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/7.5 transition-all">
                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-primary px-2 py-0.5 rounded-md text-[10px] font-bold self-center md:self-auto">
                  {getStageLabel(match)}
                </span>

                <div className="flex flex-col flex-grow items-center justify-center">
                  <div className="flex items-center justify-center gap-3 w-full">
                    <span className="w-24 sm:w-28 text-right font-bold text-gray-200 text-sm break-words leading-tight">{translateTeam(match.homeTeam)}</span>
                    <div className="flex items-center gap-1 bg-white/5 border border-white/15 p-1 rounded-xl">
                      {canEditMatch ? (
                        <>
                          <button type="button" onClick={() => adjustPredictionScore(match, 'homeScore', -1)} className="w-7 h-7 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-gray-300">
                            <Minus size={12} />
                          </button>
                          <input type="number" placeholder="-" value={homeVal} onChange={(e) => handlePredictionScoreChange(match.id, 'homeScore', e.target.value)}
                            className="w-9 bg-transparent text-center font-bold text-white text-base focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                          <span className="text-gray-500 text-xs">:</span>
                          <input type="number" placeholder="-" value={awayVal} onChange={(e) => handlePredictionScoreChange(match.id, 'awayScore', e.target.value)}
                            className="w-9 bg-transparent text-center font-bold text-white text-base focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                          <button type="button" onClick={() => adjustPredictionScore(match, 'awayScore', 1)} className="w-7 h-7 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-gray-300">
                            <Plus size={12} />
                          </button>
                        </>
                      ) : (
                        <div className="font-bold text-base text-gray-300 px-3 tracking-widest text-center min-w-[60px]">
                          {homeVal !== '' && awayVal !== '' ? `${homeVal}:${awayVal}` : '-:-'}
                        </div>
                      )}
                    </div>
                    <span className="w-24 sm:w-28 text-left font-bold text-gray-200 text-sm break-words leading-tight">{translateTeam(match.awayTeam)}</span>
                  </div>

                  {/* Hora de inicio y aviso de cierre del pronóstico */}
                  <div className="flex items-center gap-2 mt-2 text-[10px]">
                    {match.time && (
                      <span className="text-gray-400 flex items-center gap-1">
                        <Clock size={10} /> {match.time}
                      </span>
                    )}
                    {!isGuest && !hasResult && started && (
                      <span className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                        <Lock size={10} /> Pronóstico cerrado
                      </span>
                    )}
                  </div>

                  {/* Resultado oficial cuando ya finalizó */}
                  {hasResult && (
                    <div className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                      <Trophy size={11} className="text-gold" /> Resultado oficial:
                      <span className="text-white font-bold">{match.homeScore}:{match.awayScore}</span>
                    </div>
                  )}

                  {/* Penaltis para pronóstico (empate en eliminatorias) */}
                  {isTie && canEditMatch && (
                    <div className="flex flex-col items-center mt-2.5">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">¿Quién avanza por Penaltis?</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handlePredictionPenaltyWinnerChange(match.id, 'home')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${pred.penaltyWinner === 'home' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
                          {translateTeam(match.homeTeam)}
                        </button>
                        <button type="button" onClick={() => handlePredictionPenaltyWinnerChange(match.id, 'away')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${pred.penaltyWinner === 'away' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}>
                          {translateTeam(match.awayTeam)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Botón Guardar por partido / Estado del pronóstico (solo participantes) */}
                {!isGuest && (
                  <div className="min-w-[120px] flex flex-col items-center md:items-end gap-1.5">
                    {canEditMatch ? renderSaveButton(match.id) : getPredictionBadge(match)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
