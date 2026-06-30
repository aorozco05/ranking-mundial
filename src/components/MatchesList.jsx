import React, { useState } from 'react';
import { Save, Calendar, Clock, ShieldAlert, CheckCircle2, ChevronLeft, ChevronRight, Plus, Minus, Users, ChevronDown, Trash2 } from 'lucide-react';
import { TEAMS } from '../utils/mockData';
import { calculateMatchPoints } from '../utils/scoring';
import { translateTeam } from '../utils/teamNames';

export default function MatchesList({ matches, updateMatchResult, updateMatchDate, updateMatchTime, actualBracket, currentUserRole, users = [] }) {
  // Fase activa: 'groups' o una fase de eliminación ('r32','r16','qf','sf','final').
  const [activeStage, setActiveStage] = useState('groups');
  const [selectedGroup, setSelectedGroup] = useState('A');
  const [editingScores, setEditingScores] = useState({});
  const [openPredictions, setOpenPredictions] = useState(null); // matchId con el panel de pronósticos abierto

  const groupsList = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  // Pestañas principales: la fase de grupos y cada fase de eliminación al mismo nivel.
  const stageTabs = [
    { key: 'groups', label: 'Fase de Grupos' },
    { key: 'r32', label: '2ª Fase' },
    { key: 'r16', label: 'Octavos' },
    { key: 'qf', label: 'Cuartos' },
    { key: 'sf', label: 'Semis' },
    { key: 'final', label: 'Final' }
  ];
  const isAdmin = currentUserRole === 'admin';
  const isKnockout = activeStage !== 'groups';

  // Filtrar partidos
  const filteredMatches = matches.filter(match => {
    if (activeStage === 'groups') {
      return match.stage === 'groups' && match.group === selectedGroup;
    }
    return match.stage === activeStage;
  });

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

  // Controles de ajuste rápido (+ / -) para móvil
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

  const getStageLabel = (stage) => {
    switch(stage) {
      case 'r32': return 'Dieciseisavos de Final';
      case 'r16': return 'Octavos de Final';
      case 'qf': return 'Cuartos de Final';
      case 'sf': return 'Semifinales';
      case 'final': return 'Final';
      default: return 'Fase de Grupos';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Selector de Fases */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/10">
        <div className="grid grid-cols-3 sm:flex gap-1">
          {stageTabs.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveStage(s.key)}
              className={`px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all text-center ${activeStage === s.key ? 'bg-emerald-primary text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Notificación de Modo Admin */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs justify-center">
          <ShieldAlert size={14} className={isAdmin ? 'text-emerald-primary' : 'text-amber-500'} />
          <span className="text-gray-300">
            {isAdmin ? 'Modo Admin: Registra Marcadores Oficiales' : 'Modo Lector: Resultados del Mundial'}
          </span>
        </div>
      </div>

      {/* Navegador de Grupos en Carrusel Responsivo */}
      {activeStage === 'groups' && (
        <div className="glass-panel p-3 rounded-2xl flex items-center justify-between gap-2">
          <button 
            onClick={() => {
              const idx = groupsList.indexOf(selectedGroup);
              if (idx > 0) setSelectedGroup(groupsList[idx - 1]);
            }}
            disabled={selectedGroup === 'A'}
            className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 disabled:opacity-20 disabled:pointer-events-none hover:text-white"
          >
            <ChevronLeft size={16} />
          </button>
          
          <div className="flex gap-1 overflow-x-auto no-scrollbar py-1">
            {groupsList.map(g => (
              <button
                key={g}
                onClick={() => setSelectedGroup(g)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all min-w-[70px] ${selectedGroup === g ? 'bg-white/15 text-white border border-white/20' : 'text-gray-400 hover:text-white border border-transparent'}`}
              >
                Grupo {g}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              const idx = groupsList.indexOf(selectedGroup);
              if (idx < groupsList.length - 1) setSelectedGroup(groupsList[idx + 1]);
            }}
            disabled={selectedGroup === 'L'}
            className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 disabled:opacity-20 disabled:pointer-events-none hover:text-white"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Grid Principal */}
      <div className={isKnockout ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'max-w-3xl mx-auto'}>

        {/* LISTADO DE PARTIDOS */}
        <div className="glass-panel p-6 rounded-2xl space-y-4 min-w-0 overflow-hidden">
          <h2 className="text-xl font-bold font-title text-white flex items-center gap-2">
            ⚽ {activeStage === 'groups'
              ? `Partidos del Grupo ${selectedGroup}`
              : getStageLabel(activeStage)}
          </h2>

          <div className="space-y-3">
            {filteredMatches.map(match => {
              const currentEdit = editingScores[match.id] || {};
              
              // Cargar valores de inputs (Prioriza edición local, luego marcador oficial, por último vacío)
              const homeVal = currentEdit.homeScore !== undefined ? currentEdit.homeScore : (match.homeScore ?? '');
              const awayVal = currentEdit.awayScore !== undefined ? currentEdit.awayScore : (match.awayScore ?? '');
              
              const isEdited = currentEdit.homeScore !== undefined || currentEdit.awayScore !== undefined;
              const hasScore = match.homeScore !== null && match.awayScore !== null;

              const isKnockout = match.stage !== 'groups';
              const homeScoreNum = homeVal !== '' ? parseInt(homeVal, 10) : null;
              const awayScoreNum = awayVal !== '' ? parseInt(awayVal, 10) : null;
              const isTie = isKnockout && homeScoreNum !== null && awayScoreNum !== null && homeScoreNum === awayScoreNum;

              // Pronósticos de todos los participantes para este partido (vista admin)
              const matchPredictions = users.map(u => ({ user: u, pred: u.predictions?.matches?.[match.id] }));
              const predictionCount = matchPredictions.filter(mp =>
                mp.pred && mp.pred.homeScore !== null && mp.pred.homeScore !== undefined && mp.pred.awayScore !== null && mp.pred.awayScore !== undefined
              ).length;

              return (
                <div
                  key={match.id}
                  className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-4 transition-all hover:bg-white/7.5"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-wrap min-w-0">
                  {/* Fecha y Fase */}
                  <div className="flex md:flex-col justify-between items-center md:items-start gap-1">
                    {isAdmin ? (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400 flex items-center gap-1" title="Editar fecha del partido">
                          <Calendar size={12} className="text-emerald-primary" />
                          <input
                            type="date"
                            value={match.date || ''}
                            onChange={(e) => updateMatchDate(match.id, e.target.value)}
                            className="bg-white/5 border border-white/15 focus:border-emerald-500 focus:outline-none rounded-lg px-2 py-1 text-xs text-gray-200 [color-scheme:dark]"
                          />
                        </label>
                        <label className="text-xs text-gray-400 flex items-center gap-1" title="Editar hora de inicio del partido">
                          <Clock size={12} className="text-emerald-primary" />
                          <input
                            type="time"
                            value={match.time || ''}
                            onChange={(e) => updateMatchTime(match.id, e.target.value)}
                            className="bg-white/5 border border-white/15 focus:border-emerald-500 focus:outline-none rounded-lg px-2 py-1 text-xs text-gray-200 [color-scheme:dark]"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar size={12} /> {match.date}
                        </span>
                        {match.time && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock size={12} /> {match.time}
                          </span>
                        )}
                      </div>
                    )}
                    <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-primary px-2 py-0.5 rounded-md text-[10px] font-bold">
                      {match.stage === 'groups' ? `Grupo ${match.group}` : getStageLabel(match.stage)}
                    </span>
                  </div>

                  {/* Marcadores e Inputs */}
                  <div className="flex flex-col flex-grow items-center justify-center min-w-0">
                    <div className="flex items-center justify-center gap-3 select-none w-full">
                      {/* Local */}
                      <div className="w-24 sm:w-28 text-right font-bold text-gray-200 text-sm break-words leading-tight">{translateTeam(match.homeTeam)}</div>

                      {/* Inputs de marcador (Con botones stepper para móviles) */}
                      <div className="flex items-center gap-1">
                        {isAdmin ? (
                          <div className="flex items-center gap-1 bg-white/5 border border-white/15 p-1 rounded-xl">
                            <button 
                              type="button"
                              onClick={() => adjustScore(match, 'homeScore', -1)}
                              className="w-7 h-7 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-gray-300"
                            >
                              <Minus size={12} />
                            </button>
                            
                            <input
                              type="number"
                              placeholder="-"
                              value={homeVal}
                              onChange={(e) => handleScoreChange(match.id, 'homeScore', e.target.value)}
                              className="w-9 bg-transparent text-center font-bold text-white text-base focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            
                            <span className="text-gray-500 text-xs">:</span>
                            
                            <input
                              type="number"
                              placeholder="-"
                              value={awayVal}
                              onChange={(e) => handleScoreChange(match.id, 'awayScore', e.target.value)}
                              className="w-9 bg-transparent text-center font-bold text-white text-base focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />

                            <button 
                              type="button"
                              onClick={() => adjustScore(match, 'awayScore', 1)}
                              className="w-7 h-7 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-gray-300"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="font-black text-xl text-emerald-primary px-3 bg-white/5 py-1.5 rounded-xl border border-white/10 tracking-widest min-w-[70px] text-center">
                            {hasScore ? `${match.homeScore}:${match.awayScore}` : '-:-'}
                          </div>
                        )}
                      </div>

                      {/* Visitante */}
                      <div className="w-24 sm:w-28 text-left font-bold text-gray-200 text-sm break-words leading-tight">{translateTeam(match.awayTeam)}</div>
                    </div>

                    {/* Selector de Penaltis (si hay empate en eliminatorias) */}
                    {isTie && (
                      <div className="flex flex-col items-center mt-2.5">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                          Avanza por Penaltis:
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingScores(prev => ({
                                ...prev,
                                [match.id]: {
                                  ...prev[match.id],
                                  homeScore: homeVal,
                                  awayScore: awayVal,
                                  penaltyWinner: 'home'
                                }
                              }));
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                              (currentEdit.penaltyWinner || match.penaltyWinner) === 'home'
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-primary'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                            }`}
                          >
                            {translateTeam(match.homeTeam)}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingScores(prev => ({
                                ...prev,
                                [match.id]: {
                                  ...prev[match.id],
                                  homeScore: homeVal,
                                  awayScore: awayVal,
                                  penaltyWinner: 'away'
                                }
                              }));
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                              (currentEdit.penaltyWinner || match.penaltyWinner) === 'away'
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-primary'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                            }`}
                          >
                            {translateTeam(match.awayTeam)}
                          </button>
                        </div>
                      </div>
                    )}

                    {!isAdmin && hasScore && parseInt(match.homeScore, 10) === parseInt(match.awayScore, 10) && (
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1.5 text-center">
                        Avanza penaltis: <span className="text-emerald-primary font-bold">{translateTeam(match.penaltyWinner === 'away' ? match.awayTeam : match.homeTeam)}</span>
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  {isAdmin && (
                    <div className="flex flex-col items-stretch md:items-end gap-2">
                      {hasScore && !isEdited ? (
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-primary text-xs font-semibold flex items-center justify-center gap-1 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20">
                            <CheckCircle2 size={13} /> Oficial
                          </span>
                          <button
                            onClick={() => {
                              if (window.confirm('¿Seguro que deseas borrar el resultado de este partido?')) {
                                updateMatchResult(match.id, null, null, 'scheduled', null);
                              }
                            }}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 rounded-xl transition-all"
                            title="Borrar resultado"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSaveResult(match)}
                          disabled={homeVal === '' || awayVal === ''}
                          className="w-full md:w-auto bg-emerald-primary hover:bg-emerald-600 disabled:bg-white/10 disabled:text-gray-500 px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-1"
                        >
                          <Save size={14} /> Guardar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenPredictions(prev => prev === match.id ? null : match.id)}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-300 transition-all flex items-center justify-center gap-1"
                      >
                        <Users size={13} /> Pronósticos ({predictionCount})
                        <ChevronDown size={13} className={`transition-transform ${openPredictions === match.id ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  )}
                  </div>

                  {/* Panel con los pronósticos de todos los participantes */}
                  {isAdmin && openPredictions === match.id && (
                    <div className="border-t border-white/10 pt-3 space-y-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Users size={13} className="text-emerald-primary" /> Pronósticos de los participantes
                      </span>
                      {matchPredictions.length === 0 ? (
                        <p className="text-xs text-gray-500">No hay participantes registrados.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {matchPredictions.map(({ user, pred }) => {
                            const hasPred = pred && pred.homeScore !== null && pred.homeScore !== undefined && pred.awayScore !== null && pred.awayScore !== undefined;
                            let pointsLabel = null;
                            if (hasPred && hasScore && match.stage === 'groups') {
                              const { points } = calculateMatchPoints(pred, match);
                              pointsLabel = points;
                            }
                            return (
                              <div key={user.id} className="flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
                                <span className="text-xs font-bold text-gray-200 truncate">{user.name}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {hasPred ? (
                                    <span className="font-black text-sm text-white tracking-widest">{pred.homeScore}:{pred.awayScore}</span>
                                  ) : (
                                    <span className="text-[10px] text-gray-500 italic">Sin pronóstico</span>
                                  )}
                                  {pointsLabel !== null && (
                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                      pointsLabel === 5 ? 'bg-amber-500/10 border-gold text-gold'
                                        : pointsLabel === 3 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-primary'
                                        : pointsLabel === 2 ? 'bg-sky-500/10 border-sky-500/20 text-sky-400'
                                        : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                                    }`}>
                                      +{pointsLabel}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* BRACKET REAL (MANDATORIO PARA CALCULAR PUNTOS DE LLAVES) */}
        {isKnockout && (
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold font-title text-white">🏆 Bracket Real del Mundial</h2>
              <p className="text-xs text-gray-400">
                Calculado automáticamente en tiempo real a partir de los marcadores guardados arriba.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-400 block font-semibold">CAMPEÓN OFICIAL</span>
                  <span className="text-lg font-black text-gold mt-1 block">
                    {actualBracket.champion && !actualBracket.champion.includes('Campeón') && !actualBracket.champion.includes('Ganador')
                      ? `🏆 ${translateTeam(actualBracket.champion)}`
                      : 'Pendiente'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400 block font-semibold">SUBCAMPEÓN</span>
                  <span className="text-sm font-bold text-gray-200 mt-1 block">
                    {actualBracket.runnerUp && !actualBracket.runnerUp.includes('Subcampeón') && !actualBracket.runnerUp.includes('Ganador')
                      ? `🥈 ${translateTeam(actualBracket.runnerUp)}`
                      : 'Pendiente'}
                  </span>
                </div>
              </div>

              {['final', 'sf', 'qf', 'r16', 'r32'].map(stageKey => {
                const list = actualBracket[stageKey] || [];
                const count = stageKey === 'final' ? 2 : (stageKey === 'sf' ? 4 : (stageKey === 'qf' ? 8 : (stageKey === 'r16' ? 16 : 32)));
                
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

                return (
                  <div key={stageKey} className="border-t border-white/5 pt-3 space-y-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                      {getStageLabel(stageKey)} ({definedCount} / {count} clasificados)
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
                            {pending ? (t?.startsWith('3-') ? `Tercero (${t.split('-')[1]})` : t) : t}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
