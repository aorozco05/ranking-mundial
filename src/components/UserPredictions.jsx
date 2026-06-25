import React, { useState, useMemo, useEffect } from 'react';
import { Award, Calendar, Clock, Lock, CheckCircle2, ShieldAlert, Plus, Minus, User, Save, Loader2, AlertCircle } from 'lucide-react';
import { TEAMS } from '../utils/mockData';
import { calculateMatchPoints } from '../utils/scoring';
import { resolveFullBracket } from '../utils/bracketResolver';
import { hasMatchStarted, isPhaseDeadlinePassed } from '../utils/matchSchedule';
import { translateTeam } from '../utils/teamNames';

export default function UserPredictions({ users, matches, actualBracket, updateUserPredictions, activeUser, phaseDeadlines = {} }) {
  const [selectedUserId, setSelectedUserId] = useState(activeUser?.id && activeUser?.id !== 'admin' && activeUser?.id !== 'guest' ? activeUser.id : (users[0]?.id || ''));
  const [activeSubTab, setActiveSubTab] = useState('matches'); // 'matches' o 'bracket'
  const [activeStage, setActiveStage] = useState('groups'); // 'groups' o 'knockout'
  const [selectedGroup, setSelectedGroup] = useState('A');

  const groupsList = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

  // Obtener usuario seleccionado y permisos
  const targetUser = users.find(u => u.id === selectedUserId) || users[0];
  
  // Lógica de permisos de edición
  // El Admin puede editar todo. Un usuario normal solo puede editar sus propios datos. Invitado no edita nada.
  const canEdit = activeUser && (
    activeUser.role === 'admin' ||
    (activeUser.role === 'user' && activeUser.id === selectedUserId)
  );

  // --- BORRADOR POR PARTIDO ---
  // Cada partido tiene su propio botón "Guardar". Los cambios se acumulan en un
  // borrador local por partido (localEdits) y solo se persisten al pulsar el
  // botón de ese partido. saveStatus guarda el estado de guardado por partido.
  const [localEdits, setLocalEdits] = useState({}); // { [matchId]: {homeScore, awayScore, penaltyWinner} }
  const [saveStatus, setSaveStatus] = useState({}); // { [matchId]: 'saving' | 'saved' | 'error' }

  // Re-sincronizar (descartar borradores) al cambiar de usuario seleccionado.
  // Patrón recomendado de React: ajustar estado durante el render al detectar el
  // cambio, en lugar de usar un useEffect.
  const [syncedUserId, setSyncedUserId] = useState(selectedUserId);
  if (selectedUserId !== syncedUserId) {
    setSyncedUserId(selectedUserId);
    setLocalEdits({});
    setSaveStatus({});
  }

  const hasUnsavedChanges = Object.keys(localEdits).length > 0;

  // Avisar antes de cerrar/recargar la pestaña si hay cambios sin guardar.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  const handleSelectUser = (newUserId) => {
    if (hasUnsavedChanges && !window.confirm('Tienes pronósticos sin guardar que se perderán. ¿Deseas continuar?')) {
      return;
    }
    setSelectedUserId(newUserId);
  };

  // Predicción guardada (persistida) de un partido
  const getSavedPred = (matchId) => targetUser?.predictions?.matches?.[matchId] || {};

  // Predicción mostrada actualmente (borrador si existe, si no la guardada)
  const getCurrentPred = (matchId) =>
    matchId in localEdits ? localEdits[matchId] : getSavedPred(matchId);

  // ¿El partido tiene cambios sin guardar?
  const isMatchDirty = (matchId) => {
    if (!(matchId in localEdits)) return false;
    const saved = getSavedPred(matchId);
    const edit = localEdits[matchId];
    return (edit.homeScore ?? null) !== (saved.homeScore ?? null)
      || (edit.awayScore ?? null) !== (saved.awayScore ?? null)
      || (edit.penaltyWinner ?? null) !== (saved.penaltyWinner ?? null);
  };

  const applyLocalEdit = (matchId, patch) => {
    setLocalEdits(prev => {
      const base = matchId in prev ? prev[matchId] : getSavedPred(matchId);
      return { ...prev, [matchId]: { ...base, ...patch } };
    });
    setSaveStatus(prev => {
      if (!prev[matchId]) return prev;
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
  };

  const handleSaveMatch = async (matchId) => {
    if (!canEdit || !targetUser || !(matchId in localEdits)) return;
    if (saveStatus[matchId] === 'saving') return;

    const edit = localEdits[matchId];
    const updatedPredictions = {
      ...targetUser.predictions,
      matches: {
        ...targetUser.predictions?.matches,
        [matchId]: { ...getSavedPred(matchId), ...edit }
      }
    };

    setSaveStatus(prev => ({ ...prev, [matchId]: 'saving' }));
    try {
      await updateUserPredictions(targetUser.id, updatedPredictions);
      setLocalEdits(prev => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
      setSaveStatus(prev => ({ ...prev, [matchId]: 'saved' }));
    } catch (err) {
      console.error('Error al guardar el pronóstico:', err);
      setSaveStatus(prev => ({ ...prev, [matchId]: 'error' }));
    }
  };

  // --- SELECCIÓN DIRECTA DE CAMPEÓN Y SUBCAMPEÓN ---
  // El campeón y subcampeón NO se calculan según avanza el bracket: el usuario los
  // selecciona directamente de entre todos los equipos. Se persisten en
  // predictions.bracket.{champion,runnerUp}.
  const savedBracket = targetUser?.predictions?.bracket || {};
  const selectedChampion = savedBracket.champion || '';
  const selectedRunnerUp = savedBracket.runnerUp || '';

  // El pronóstico de campeón/subcampeón se cierra (para usuarios) una vez que
  // arranca la eliminación directa o pasa la fecha límite de la Final. El admin
  // siempre puede editarlo.
  const knockoutStarted = matches.some(m => m.stage !== 'groups' && hasMatchStarted(m));
  const championLocked = (knockoutStarted || isPhaseDeadlinePassed('final', phaseDeadlines)) && activeUser?.role !== 'admin';

  const [championSaveStatus, setChampionSaveStatus] = useState(null); // 'saving' | 'saved' | 'error'

  const handleChampionPick = async (field, teamName) => {
    if (!canEdit || !targetUser || championLocked) return;
    const value = teamName === '' ? null : teamName;
    const updatedPredictions = {
      ...targetUser.predictions,
      bracket: {
        ...targetUser.predictions?.bracket,
        [field]: value
      }
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

  // Predicciones efectivas (guardadas + borradores) para calcular el bracket en vivo
  const effectiveMatchesPred = useMemo(() => {
    return { ...(targetUser?.predictions?.matches || {}), ...localEdits };
  }, [targetUser?.predictions?.matches, localEdits]);

  const userResolvedData = useMemo(() => {
    return resolveFullBracket(matches, effectiveMatchesPred);
  }, [matches, effectiveMatchesPred]);

  const userBracket = userResolvedData.bracket;
  const userMatches = userResolvedData.unifiedMatches;

  const filteredMatches = userMatches.filter(match => {
    if (activeStage === 'groups') {
      return match.stage === 'groups' && match.group === selectedGroup;
    } else {
      return match.stage !== 'groups';
    }
  });

  const handlePredictionScoreChange = (matchId, side, value) => {
    if (!targetUser || !canEdit) return;

    // Bloquear edición si el partido ya comenzó, está oficializado o pasó la fecha
    // límite de su fase (el admin no se restringe)
    const match = matches.find(m => m.id === matchId);
    const isOfficialized = match && match.homeScore !== null && match.awayScore !== null;
    if (activeUser?.role !== 'admin' && (isOfficialized || hasMatchStarted(match) || isPhaseDeadlinePassed(match?.stage, phaseDeadlines))) return;

    const cleanValue = value === '' ? null : parseInt(value, 10);

    applyLocalEdit(matchId, { [side]: isNaN(cleanValue) ? null : cleanValue });
  };

  const handlePredictionPenaltyWinnerChange = (matchId, penaltyWinner) => {
    if (!targetUser || !canEdit) return;

    // Bloquear edición si el partido ya comenzó, está oficializado o pasó la fecha
    // límite de su fase (el admin no se restringe)
    const match = matches.find(m => m.id === matchId);
    const isOfficialized = match && match.homeScore !== null && match.awayScore !== null;
    if (activeUser?.role !== 'admin' && (isOfficialized || hasMatchStarted(match) || isPhaseDeadlinePassed(match?.stage, phaseDeadlines))) return;

    applyLocalEdit(matchId, { penaltyWinner });
  };

  // Stepper rápido para móviles
  const adjustPredictionScore = (match, side, delta) => {
    if (!canEdit) return;

    // Bloquear edición si el partido ya comenzó, está oficializado o pasó la fecha
    // límite de su fase (el admin no se restringe)
    const actualMatch = matches.find(m => m.id === match.id);
    const isOfficialized = actualMatch && actualMatch.homeScore !== null && actualMatch.awayScore !== null;
    if (activeUser?.role !== 'admin' && (isOfficialized || hasMatchStarted(actualMatch) || isPhaseDeadlinePassed(actualMatch?.stage, phaseDeadlines))) return;

    const currentPred = getCurrentPred(match.id) || {};
    const currentValue = currentPred[side] !== undefined && currentPred[side] !== null
      ? currentPred[side]
      : 0;

    const newValue = Math.max(0, (parseInt(currentValue, 10) || 0) + delta);
    handlePredictionScoreChange(match.id, side, newValue);
  };

  const getMatchPointBadge = (match) => {
    // Use actual match data (not the predicted-overlay version) to check if match was played
    const actualMatch = matches.find(m => m.id === match.id);
    if (!actualMatch || actualMatch.homeScore === null || actualMatch.awayScore === null) {
      return <span className="text-[10px] text-gray-500 font-semibold uppercase">Pendiente</span>;
    }
    const pred = getSavedPred(match.id);
    if (!pred || pred.homeScore === null || pred.homeScore === undefined || pred.awayScore === null || pred.awayScore === undefined) {
      return <span className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-2 py-0.5 rounded-lg text-[10px] font-bold">Sin Predicción (0 pts)</span>;
    }

    if (match.stage !== 'groups') {
      return <span className="bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded-lg text-[10px] font-bold">Solo Grupos (0 pts)</span>;
    }

    // Compare prediction vs actual match result (not prediction vs itself)
    const result = calculateMatchPoints(pred, actualMatch);
    if (result.points === 5) {
      return <span className="bg-amber-500/10 border border-gold text-gold px-2.5 py-0.5 rounded-lg text-[10px] font-bold">Exacto (+5)</span>;
    } else if (result.points === 3) {
      return <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-primary px-2.5 py-0.5 rounded-lg text-[10px] font-bold">Diferencia (+3)</span>;
    } else if (result.points === 2) {
      return <span className="bg-sky-500/10 border border-sky-500/20 text-sky-400 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">Ganador (+2)</span>;
    }
    return <span className="bg-rose-500/10 border border-rose-500/20 text-rose-500 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">Fallado (0)</span>;
  };

  const getBracketPredictionStatus = (stageKey, teamName) => {
    if (!teamName) return { label: 'Sin elegir', class: 'text-gray-500' };
    
    const actualList = actualBracket?.[stageKey] || [];
    const isDefined = actualList.some(t => t);

    if (!isDefined) {
      return { label: `Elegido: ${translateTeam(teamName)}`, class: 'text-gray-400 font-medium' };
    }

    const isHit = actualList.includes(teamName);
    if (isHit) {
      const pts = stageKey === 'r16' ? 9 : (stageKey === 'qf' ? 12 : 18);
      return { label: `✅ Acertado (+${pts})`, class: 'text-emerald-primary font-bold' };
    } else {
      return { label: `❌ Fallado`, class: 'text-rose-500' };
    }
  };

  const getSinglePredictionStatus = (field, teamName) => {
    if (!teamName) return { label: 'Sin elegir', class: 'text-gray-500' };

    const actualTeam = actualBracket?.[field];
    if (!actualTeam) {
      return { label: `Elegido: ${translateTeam(teamName)}`, class: 'text-gray-400 font-medium' };
    }

    if (actualTeam === teamName) {
      const pts = field === 'champion' ? 30 : 20;
      return { label: `🏆 Acertado (+${pts}!)`, class: 'text-gold font-bold' };
    } else {
      return { label: `❌ Fallado`, class: 'text-rose-500' };
    }
  };

  // Botón de guardado por partido. Verde con check cuando está guardado; cambia
  // a ámbar cuando hay cambios sin guardar; rojo si falló el guardado.
  const renderSaveButton = (matchId) => {
    const status = saveStatus[matchId];
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
        <button
          onClick={() => handleSaveMatch(matchId)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:bg-rose-500/25 transition-all"
        >
          <AlertCircle size={14} /> Reintentar
        </button>
      );
    }

    if (dirty) {
      // Cambios sin guardar: el botón cambia de color (ámbar) para avisar.
      return (
        <button
          onClick={() => handleSaveMatch(matchId)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 shadow-md animate-pulse transition-all"
        >
          <Save size={14} /> Guardar
        </button>
      );
    }

    // Sin cambios pendientes: estado guardado (check verde) o aún sin pronóstico.
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

  return (
    <div className="space-y-6">
      
      {/* Barra superior de Selección y Permisos */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div>
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Ver predicciones de:</label>
            <select
              value={selectedUserId}
              onChange={(e) => handleSelectUser(e.target.value)}
              className="p-2.5 bg-soccer-dark border border-white/10 focus:border-emerald-500 focus:outline-none rounded-xl text-sm font-bold text-white min-w-[200px]"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} (Ptos: {u.scoreDetails?.total || 0})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-1 sm:mt-4">
            <button
              onClick={() => setActiveSubTab('matches')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-center ${activeSubTab === 'matches' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Marcadores
            </button>
            <button
              onClick={() => setActiveSubTab('bracket')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-center ${activeSubTab === 'bracket' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Bracket Llaves
            </button>
          </div>
        </div>

        {/* Indicador de Permisos de Edición */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold justify-center ${canEdit ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-primary' : 'bg-white/5 border border-white/10 text-gray-400'}`}>
          {canEdit ? (
            <>
              <CheckCircle2 size={14} />
              <span>Tienes permiso para editar estas predicciones</span>
            </>
          ) : (
            <>
              <ShieldAlert size={14} className="text-amber-500" />
              <span>Modo Lectura: No puedes editar estas predicciones</span>
            </>
          )}
        </div>
      </div>

      {targetUser ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* CONFIGURADOR DE PREDICCIONES */}
          <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold font-title text-white flex items-center gap-2">
              <User size={18} className="text-emerald-primary" />
              {activeSubTab === 'matches' 
                ? `Predicciones de Marcadores - ${targetUser.name}` 
                : `Predicciones de Clasificados - ${targetUser.name}`}
            </h2>

            {activeSubTab === 'matches' ? (
              <div className="space-y-4">
                {/* Selector de Fases */}
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/10">
                  <div className="grid grid-cols-2 sm:flex gap-1 w-full">
                    <button
                      onClick={() => setActiveStage('groups')}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-center flex-1 sm:flex-initial ${activeStage === 'groups' ? 'bg-emerald-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                      Fase de Grupos
                    </button>
                    <button
                      onClick={() => setActiveStage('knockout')}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-center flex-1 sm:flex-initial ${activeStage === 'knockout' ? 'bg-emerald-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
                    >
                      Eliminación Directa
                    </button>
                  </div>
                </div>

                {/* Selector de Grupos */}
                {activeStage === 'groups' && (
                  <div className="flex gap-1 overflow-x-auto no-scrollbar py-1 border-b border-white/5 pb-3 justify-center sm:justify-start">
                    {groupsList.map(g => (
                      <button
                        key={g}
                        onClick={() => setSelectedGroup(g)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-w-[36px] ${selectedGroup === g ? 'bg-white/15 text-white border border-white/20' : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  {filteredMatches.map(match => {
                    const pred = getCurrentPred(match.id) || {};
                    const homeVal = pred.homeScore !== undefined && pred.homeScore !== null ? pred.homeScore : '';
                    const awayVal = pred.awayScore !== undefined && pred.awayScore !== null ? pred.awayScore : '';

                    const isKnockout = match.stage !== 'groups';
                    const homeScoreNum = homeVal !== '' ? parseInt(homeVal, 10) : null;
                    const awayScoreNum = awayVal !== '' ? parseInt(awayVal, 10) : null;
                    const isTie = isKnockout && homeScoreNum !== null && awayScoreNum !== null && homeScoreNum === awayScoreNum;

                    const actualMatchData = matches.find(m => m.id === match.id);
                    const isOfficialized = actualMatchData && actualMatchData.homeScore !== null && actualMatchData.awayScore !== null;
                    const started = hasMatchStarted(actualMatchData);
                    const closedByDeadline = isPhaseDeadlinePassed(match.stage, phaseDeadlines);
                    const lockedForUser = (isOfficialized || started || closedByDeadline) && activeUser?.role !== 'admin';
                    const canEditMatch = canEdit && !lockedForUser;

                    return (
                      <div 
                        key={match.id} 
                        className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 transition-all hover:bg-white/7.5"
                      >
                        {/* Equipos y Controles Stepper */}
                        <div className="flex flex-col flex-grow items-center justify-center w-full">
                           <div className="flex items-center justify-center gap-3 w-full">
                            <span className="w-24 sm:w-28 text-right font-bold text-gray-200 text-sm break-words leading-tight">{translateTeam(match.homeTeam)}</span>
                            
                            <div className="flex items-center gap-1 bg-white/5 border border-white/15 p-1 rounded-xl">
                              {canEditMatch ? (
                                <>
                                  <button 
                                    type="button"
                                    onClick={() => adjustPredictionScore(match, 'homeScore', -1)}
                                    className="w-7 h-7 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-gray-300"
                                  >
                                    <Minus size={12} />
                                  </button>
                                  
                                  <input
                                    type="number"
                                    placeholder="-"
                                    value={homeVal}
                                    onChange={(e) => handlePredictionScoreChange(match.id, 'homeScore', e.target.value)}
                                    className="w-9 bg-transparent text-center font-bold text-white text-base focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  
                                  <span className="text-gray-500 text-xs">:</span>
                                  
                                  <input
                                    type="number"
                                    placeholder="-"
                                    value={awayVal}
                                    onChange={(e) => handlePredictionScoreChange(match.id, 'awayScore', e.target.value)}
                                    className="w-9 bg-transparent text-center font-bold text-white text-base focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />

                                  <button 
                                    type="button"
                                    onClick={() => adjustPredictionScore(match, 'awayScore', 1)}
                                    className="w-7 h-7 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-gray-300"
                                  >
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

                          {/* Horario de inicio y estado de cierre del pronóstico */}
                          <div className="flex items-center gap-2 mt-2 text-[10px]">
                            {match.date && (
                              <span className="text-gray-400 flex items-center gap-1">
                                <Calendar size={10} /> {match.date}
                              </span>
                            )}
                            {match.time && (
                              <span className="text-gray-400 flex items-center gap-1">
                                <Clock size={10} /> {match.time}
                              </span>
                            )}
                            {lockedForUser && (
                              <span className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                <Lock size={10} /> {isOfficialized ? 'Finalizado' : (closedByDeadline && !started ? 'Cerrado (fecha límite)' : 'Pronóstico cerrado')}
                              </span>
                            )}
                          </div>

                          {/* Selector de Penaltis para Pronóstico */}
                          {isTie && canEditMatch && (
                            <div className="flex flex-col items-center mt-2.5">
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                                ¿Quién avanza por Penaltis?
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handlePredictionPenaltyWinnerChange(match.id, 'home')}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                                    pred.penaltyWinner === 'home'
                                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-primary'
                                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                  }`}
                                >
                                  {translateTeam(match.homeTeam)}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePredictionPenaltyWinnerChange(match.id, 'away')}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                                    pred.penaltyWinner === 'away'
                                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-primary'
                                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                  }`}
                                >
                                  {translateTeam(match.awayTeam)}
                                </button>
                              </div>
                            </div>
                          )}

                          {isTie && !canEdit && pred.penaltyWinner && (
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1.5 text-center">
                              Avanza penaltis: <span className="text-emerald-primary font-bold">{translateTeam(pred.penaltyWinner === 'away' ? match.awayTeam : match.homeTeam)}</span>
                            </div>
                          )}
                        </div>

                        {/* Botón Guardar por partido / Puntaje Obtenido */}
                        <div className="min-w-[110px] flex flex-col items-center sm:items-end gap-1.5">
                          {canEditMatch
                            ? renderSaveButton(match.id)
                            : getMatchPointBadge(match)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              // PREDICCIONES BRACKET
              <div className="space-y-6">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold font-title text-white">🏆 Pronóstico de Bracket</h3>
                  <p className="text-xs text-gray-400">
                    Octavos, cuartos y semifinales se calculan automáticamente a partir de tus
                    pronósticos de marcadores de eliminación directa. El campeón y el subcampeón
                    los eliges directamente abajo.
                  </p>
                </div>

                {/* SELECCIÓN DIRECTA DE CAMPEÓN Y SUBCAMPEÓN */}
                <div className="p-4 bg-white/5 border border-gold/30 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gold uppercase tracking-wider">
                      Campeón y Subcampeón (selección directa)
                    </span>
                    {championLocked && (
                      <span className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                        <Lock size={10} /> Cerrado
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                        🏆 Campeón (+30)
                      </label>
                      {canEdit && !championLocked ? (
                        <select
                          value={selectedChampion}
                          onChange={(e) => handleChampionPick('champion', e.target.value)}
                          className="w-full p-2.5 bg-soccer-dark border border-white/10 focus:border-gold focus:outline-none rounded-xl text-sm font-bold text-white"
                        >
                          <option value="">— Elegir equipo —</option>
                          {TEAMS.map(t => (
                            <option key={t} value={t}>{translateTeam(t)}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-lg font-black block ${selectedChampion ? 'text-gold' : 'text-gray-500 italic'}`}>
                          {selectedChampion ? `🏆 ${translateTeam(selectedChampion)}` : 'Sin elegir'}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">
                        🥈 Subcampeón (+20)
                      </label>
                      {canEdit && !championLocked ? (
                        <select
                          value={selectedRunnerUp}
                          onChange={(e) => handleChampionPick('runnerUp', e.target.value)}
                          className="w-full p-2.5 bg-soccer-dark border border-white/10 focus:border-emerald-500 focus:outline-none rounded-xl text-sm font-bold text-white"
                        >
                          <option value="">— Elegir equipo —</option>
                          {TEAMS.map(t => (
                            <option key={t} value={t}>{translateTeam(t)}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-sm font-bold block ${selectedRunnerUp ? 'text-gray-200' : 'text-gray-500 italic'}`}>
                          {selectedRunnerUp ? `🥈 ${translateTeam(selectedRunnerUp)}` : 'Sin elegir'}
                        </span>
                      )}
                    </div>
                  </div>

                  {selectedChampion && selectedRunnerUp && selectedChampion === selectedRunnerUp && (
                    <p className="text-[10px] text-rose-400 font-semibold flex items-center gap-1">
                      <AlertCircle size={11} /> Campeón y subcampeón no pueden ser el mismo equipo.
                    </p>
                  )}

                  {canEdit && !championLocked && (
                    <div className="text-[10px] font-semibold h-3">
                      {championSaveStatus === 'saving' && <span className="text-gray-400">Guardando…</span>}
                      {championSaveStatus === 'saved' && <span className="text-emerald-primary">✓ Guardado</span>}
                      {championSaveStatus === 'error' && <span className="text-rose-400">Error al guardar</span>}
                    </div>
                  )}
                </div>

                {['sf', 'qf', 'r16'].map(stageKey => {
                  const list = userBracket[stageKey] || [];
                  const count = stageKey === 'sf' ? 4 : (stageKey === 'qf' ? 8 : 16);

                  const isPlaceholder = (name) => {
                    if (!name) return true;
                    return name.startsWith('1') ||
                           name.startsWith('2') ||
                           name.startsWith('3-') ||
                           name.includes('Ganador') ||
                           name.includes('Campeón') ||
                           name.includes('Subcampeón') ||
                           name === 'Vacío';
                  };

                  const definedCount = list.filter(t => !isPlaceholder(t)).length;
                  const getStageTitle = (k) => {
                    switch(k) {
                      case 'r16': return 'Octavos de Final (+9 c/u)';
                      case 'qf': return 'Cuartos de Final (+12 c/u)';
                      case 'sf': return 'Semifinales (+18 c/u)';
                    }
                  };

                  return (
                    <div key={stageKey} className="border-t border-white/5 pt-3 space-y-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                        {getStageTitle(stageKey)} ({definedCount} / {count} clasificados)
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {list.map((t, idx) => {
                          const pending = isPlaceholder(t);
                          return (
                            <span 
                              key={idx} 
                              className={`px-2 py-1.5 rounded-lg text-xs truncate text-center font-semibold border ${
                                pending 
                                  ? 'bg-white/2.5 border-white/5 text-gray-500 italic' 
                                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-primary'
                              }`}
                            >
                              {pending ? (t?.startsWith('3-') ? `Tercero (${t.split('-')[1]})` : t) : translateTeam(t)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* PANEL DERECHO: DETALLE DE PUNTOS */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-bold font-title text-white flex items-center gap-2">
                <Award className="text-emerald-primary" />
                Resumen de Puntaje
              </h2>

              <div className="p-6 bg-white/5 border border-emerald-500/20 rounded-2xl text-center shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider block">Puntaje Total Acumulado</span>
                <span className="text-5xl font-black text-emerald-primary mt-2 block font-title">
                  {targetUser.scoreDetails?.total || 0}
                </span>
                <div className="flex justify-between items-center text-[10px] text-gray-400 border-t border-white/5 pt-4 mt-4">
                  <span>Partidos: <strong>{targetUser.scoreDetails?.matchPoints} pts</strong></span>
                  <span className="text-gray-600">|</span>
                  <span>Llaves: <strong>{targetUser.scoreDetails?.bracketPoints} pts</strong></span>
                </div>
              </div>

              {/* Estadísticas de marcadores */}
              <div className="space-y-2 border-t border-white/5 pt-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Estadísticas de Pronósticos</span>
                <div className="space-y-1 text-sm text-gray-300">
                  <div className="flex justify-between">
                    <span>Marcadores Exactos (5 pts):</span>
                    <span className="font-bold text-gold">{targetUser.scoreDetails?.matchStats.exact}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ganador + Diferencia (3 pts):</span>
                    <span className="font-bold text-emerald-primary">{targetUser.scoreDetails?.matchStats.diff}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ganador Simple (2 pts):</span>
                    <span className="font-bold text-sky-400">{targetUser.scoreDetails?.matchStats.simple}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pronósticos Fallados:</span>
                    <span className="font-bold text-rose-500">{targetUser.scoreDetails?.matchStats.failed}</span>
                  </div>
                </div>
              </div>

              {/* Aciertos de llaves */}
              <div className="space-y-3 border-t border-white/5 pt-4">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Aciertos en el Bracket</span>
                <div className="space-y-2 text-xs">
                  {/* Campeón y Subcampeón */}
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 font-semibold">Campeón:</span>
                      <span className={getSinglePredictionStatus('champion', selectedChampion).class}>
                        {getSinglePredictionStatus('champion', selectedChampion).label}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 font-semibold">Subcampeón:</span>
                      <span className={getSinglePredictionStatus('runnerUp', selectedRunnerUp).class}>
                        {getSinglePredictionStatus('runnerUp', selectedRunnerUp).label}
                      </span>
                    </div>
                  </div>

                  {/* Fases (a partir de la fase de 32) */}
                  {['r16', 'qf', 'sf'].map(stageKey => {
                    const list = userBracket?.[stageKey] || [];
                    const label = stageKey === 'r16' ? 'Octavos' : (stageKey === 'qf' ? 'Cuartos' : 'Semifinales');
                    
                    const isPlaceholder = (name) => {
                      if (!name) return true;
                      return name.startsWith('1') || 
                             name.startsWith('2') || 
                             name.startsWith('3-') || 
                             name.includes('Ganador') || 
                             name.includes('Campeón') || 
                             name.includes('Subcampeón') ||
                             name === 'Vacío';
                    };

                    const defined = list.filter(t => !isPlaceholder(t));

                    return (
                      <div key={stageKey} className="space-y-1">
                        <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] block">{label}</span>
                        {defined.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto no-scrollbar py-0.5">
                            {defined.map((team, idx) => {
                              const status = getBracketPredictionStatus(stageKey, team);
                              return (
                                <span 
                                  key={idx} 
                                  className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-[10px] text-gray-300 flex items-center gap-1"
                                  title={status.label}
                                >
                                  {translateTeam(team)}
                                  {status.label.includes('✅') && <span className="text-emerald-primary text-[8px]">●</span>}
                                  {status.label.includes('❌') && <span className="text-rose-500 text-[8px]">●</span>}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-600">Sin selecciones...</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

        </div>
      ) : (
        <div className="glass-panel p-6 text-center text-gray-400">
          No hay perfiles de participantes cargados.
        </div>
      )}

    </div>
  );
}
