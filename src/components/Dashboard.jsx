import React, { useState, useMemo, useRef } from 'react';
import { Trophy, HelpCircle, AlertCircle, DollarSign, Shuffle, RefreshCw, ChevronDown, ListOrdered } from 'lucide-react';
import DailyMatches from './DailyMatches';
import GroupStandings from './GroupStandings';
import BracketView from './BracketView';

export default function Dashboard({ users, matches, currentUser, updateMatchResult, updateUserPredictions, prizePool, updatePrizePool, actualBracket, phaseDeadlines, updatePhaseDeadline }) {
  const totalPrizePool = prizePool ?? 100000; // Bote de apuestas (persistido desde App)
  const [isSpinning, setIsSpinning] = useState(false);
  const [raffleWinner, setRaffleWinner] = useState(null);
  const [raffleRotation, setRaffleRotation] = useState(0);
  const [customRaffleList, setCustomRaffleList] = useState(null);

  // Secciones colapsables (consulta): arrancan cerradas para reducir el scroll.
  const [rankingOpen, setRankingOpen] = useState(false);

  // Salto rápido a la Tabla de posiciones por grupos desde cualquier punto.
  const standingsRef = useRef(null);
  const scrollToStandings = () => {
    standingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Ordenar y calcular posiciones del Leaderboard
  const leaderboard = useMemo(() => {
    return [...users].sort((a, b) => b.scoreDetails.total - a.scoreDetails.total);
  }, [users]);

  // Encontrar candidatos del sorteo de forma reactiva sin generar loops de renders
  const raffleCandidates = useMemo(() => {
    if (customRaffleList) return customRaffleList;

    const scoreGroups = {};
    leaderboard.forEach(user => {
      const key = user.scoreDetails.total;
      if (!scoreGroups[key]) scoreGroups[key] = [];
      scoreGroups[key].push(user);
    });

    // Ordenar puntajes de mayor a menor y buscar el primer grupo empatado
    const sortedScores = Object.keys(scoreGroups).map(Number).sort((a, b) => b - a);
    for (const score of sortedScores) {
      if (scoreGroups[score].length > 1) {
        return scoreGroups[score].map(u => u.name);
      }
    }

    return users.map(u => u.name);
  }, [users, leaderboard, customRaffleList]);

  // Ejecutar el sorteo animado
  const handleSpinRaffle = () => {
    if (raffleCandidates.length < 2) return;
    setIsSpinning(true);
    setRaffleWinner(null);
    
    const degrees = 1440 + Math.random() * 360;
    setRaffleRotation(prev => prev + degrees);

    setTimeout(() => {
      setIsSpinning(false);
      const randomIndex = Math.floor(Math.random() * raffleCandidates.length);
      setRaffleWinner(raffleCandidates[randomIndex]);
    }, 2500);
  };

  // Calcular premios según el porcentaje acordado
  const calculatePrize = (positionIndex) => {
    let percentage = 0;
    if (positionIndex === 0) percentage = 0.70; // 1er puesto
    else if (positionIndex === 1) percentage = 0.15; // 2do puesto
    else if (positionIndex === 2) percentage = 0.10; // 3er puesto
    else if (positionIndex === leaderboard.length - 1 && leaderboard.length > 3) percentage = 0.05; // Último puesto (Petardo)
    
    return percentage > 0 
      ? (totalPrizePool * percentage).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }) 
      : null;
  };

  // Obtener los datos del Podio (Top 3)
  const podium = useMemo(() => {
    const p = { first: null, second: null, third: null };
    if (leaderboard[0]) p.first = leaderboard[0];
    if (leaderboard[1]) p.second = leaderboard[1];
    if (leaderboard[2]) p.third = leaderboard[2];
    return p;
  }, [leaderboard]);

  return (
    <div className="space-y-6">

      {/* PARTIDOS DEL DÍA — PRIORIDAD: primero y siempre visible */}
      <DailyMatches
        matches={matches}
        currentUser={currentUser}
        users={users}
        updateMatchResult={updateMatchResult}
        updateUserPredictions={updateUserPredictions}
        phaseDeadlines={phaseDeadlines}
      />

      {/* SECCIÓN PODIO VISUAL (TOP RANKING) */}
      {leaderboard.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl" style={{ contentVisibility: 'auto' }}>
          <h2 className="text-2xl font-bold font-title text-center text-white mb-8">
            🏆 Podio de la Polla Mundialista 🏆
          </h2>
          
          <div className="flex flex-col sm:flex-row items-end justify-center gap-4 sm:gap-2 max-w-2xl mx-auto min-h-[300px] pt-8">
            
            {/* 2do Puesto */}
            {podium.second && (
              <div className="w-full sm:w-1/3 flex flex-col items-center order-2 sm:order-1">
                <div className="text-center mb-2">
                  <span className="font-bold text-gray-200 block text-sm">{podium.second.name}</span>
                  <span className="text-xs text-gray-400">{podium.second.scoreDetails.total} Ptos</span>
                </div>
                <div className="w-full h-32 bg-gradient-to-t from-gray-500/20 to-gray-500/40 border-t border-x border-gray-400/30 rounded-t-2xl flex items-center justify-center shadow-[0_-5px_15px_rgba(255,255,255,0.02)]">
                  <div className="flex flex-col items-center">
                    <span className="w-10 h-10 rounded-full bg-gray-400/20 border border-gray-400/50 flex items-center justify-center text-gray-300 font-black text-lg shadow-[0_0_8px_rgba(156,163,175,0.2)]">
                      2
                    </span>
                    <span className="text-xs text-gray-400 mt-2 font-bold uppercase tracking-wider">Plata</span>
                    {calculatePrize(1) && (
                      <span className="text-xs text-emerald-primary mt-1 font-semibold">{calculatePrize(1)}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 1er Puesto */}
            {podium.first && (
              <div className="w-full sm:w-1/3 flex flex-col items-center order-1 sm:order-2">
                <div className="text-center mb-2 animate-bounce">
                  <span className="font-black text-white block text-base flex items-center justify-center gap-1">
                    <Trophy size={14} className="text-gold" /> {podium.first.name}
                  </span>
                  <span className="text-xs text-gold font-bold">{podium.first.scoreDetails.total} Ptos</span>
                </div>
                <div className="w-full h-44 bg-gradient-to-t from-gold/15 to-gold/30 border-t border-x border-gold/40 rounded-t-2xl flex items-center justify-center shadow-[0_-5px_25px_var(--color-gold-glow)] relative">
                  <div className="absolute -top-4 w-8 h-8 bg-gold rounded-full flex items-center justify-center text-black font-black text-sm shadow-[0_0_12px_var(--color-gold)]">
                    👑
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="w-12 h-12 rounded-full bg-gold/20 border border-gold flex items-center justify-center text-gold font-black text-xl shadow-[0_0_12px_var(--color-gold-glow)]">
                      1
                    </span>
                    <span className="text-xs text-gold mt-2 font-bold uppercase tracking-wider">Oro</span>
                    {calculatePrize(0) && (
                      <span className="text-sm text-gold font-black mt-1">{calculatePrize(0)}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 3er Puesto */}
            {podium.third && (
              <div className="w-full sm:w-1/3 flex flex-col items-center order-3">
                <div className="text-center mb-2">
                  <span className="font-bold text-gray-200 block text-sm">{podium.third.name}</span>
                  <span className="text-xs text-amber-600">{podium.third.scoreDetails.total} Ptos</span>
                </div>
                <div className="w-full h-24 bg-gradient-to-t from-amber-800/20 to-amber-800/40 border-t border-x border-amber-800/30 rounded-t-2xl flex items-center justify-center shadow-[0_-5px_15px_rgba(180,83,9,0.02)]">
                  <div className="flex flex-col items-center">
                    <span className="w-8 h-8 rounded-full bg-amber-800/20 border border-amber-800/50 flex items-center justify-center text-amber-600 font-black text-sm">
                      3
                    </span>
                    <span className="text-xs text-amber-600 mt-2 font-bold uppercase tracking-wider">Bronce</span>
                    {calculatePrize(2) && (
                      <span className="text-xs text-emerald-primary mt-1 font-semibold">{calculatePrize(2)}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* TABLA DE POSICIONES DE LOS EQUIPOS POR GRUPO (objetivo del botón flotante) */}
      <div ref={standingsRef} className="scroll-mt-24">
        <GroupStandings matches={matches} />
      </div>

      {/* METRICAS DE RESUMEN Y BOTE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Líder Actual</p>
            <h3 className="text-2xl font-bold font-title text-white mt-1">
              {leaderboard[0]?.name || 'N/A'}
            </h3>
            <p className="text-xs text-gray-500 mt-1">Con {leaderboard[0]?.scoreDetails.total || 0} puntos totales</p>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-2xl text-gold shadow-[0_0_12px_var(--color-gold-glow)]">
            <Trophy size={28} />
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Bote de Apuestas</p>
            <div className="flex items-center mt-1">
              <DollarSign size={20} className="text-emerald-primary" />
              <input
                type="number"
                value={totalPrizePool}
                onChange={(e) => updatePrizePool(Number(e.target.value))}
                className="w-32 bg-transparent focus:outline-none text-2xl font-bold font-title text-white p-0"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Modificar bote para calcular premios</p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-primary">
            <DollarSign size={28} />
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Partidos Jugados</p>
            <h3 className="text-2xl font-bold font-title text-white mt-1">
              {matches.filter(m => m.homeScore !== null).length} / {matches.length}
            </h3>
            <p className="text-xs text-gray-500 mt-1">Actualizado en vivo por Admin</p>
          </div>
          <div className="p-3 bg-sky-500/10 rounded-2xl text-sky-400">
            <RefreshCw size={28} />
          </div>
        </div>
      </div>

      {/* RANKING GENERAL + RULETA (colapsable, cerrado por defecto) */}
      <button
        onClick={() => setRankingOpen(o => !o)}
        className="w-full glass-panel p-5 rounded-2xl flex items-center justify-between gap-3 hover:bg-white/2.5 transition-colors"
      >
        <span className="flex items-center gap-2 text-xl font-bold font-title text-white">
          <Trophy size={20} className="text-gold" /> Ranking General y Sorteo
        </span>
        <span className="flex items-center gap-2 text-xs text-gray-400">
          {rankingOpen ? 'Ocultar' : 'Ver tabla completa'}
          <ChevronDown size={18} className={`transition-transform ${rankingOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {rankingOpen && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* TABLA DE POSICIONES COMPLETA */}
        <div className="glass-panel p-6 rounded-2xl lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h2 className="text-xl font-bold font-title text-white">Ranking General</h2>
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <AlertCircle size={14} className="text-emerald-primary" />
              Criterio: Puntos (Empates definidos por Sorteo)
            </div>
          </div>

          <div className="overflow-x-auto border border-white/10 rounded-xl">
            <table className="w-full border-collapse text-left text-sm text-gray-300">
              <thead>
                <tr className="bg-white/5 border-b border-white/10 font-title font-semibold text-gray-400 uppercase tracking-wider text-xs">
                  <th className="p-4">Pos</th>
                  <th className="p-4">Participante</th>
                  <th className="p-4 text-center">Ptos</th>
                  <th className="p-4 text-center">Partidos</th>
                  <th className="p-4 text-center">Llaves</th>
                  <th className="p-4 text-right">Premio Est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((user, index) => {
                  const isGold = index === 0;
                  const isSilver = index === 1;
                  const isBronze = index === 2;
                  const isLast = index === leaderboard.length - 1 && leaderboard.length > 3;

                  return (
                    <tr 
                      key={user.id} 
                      className={`hover:bg-white/2.5 transition-colors ${isGold ? 'bg-gold/5' : ''}`}
                    >
                      <td className="p-4 font-bold">
                        {isGold && <span className="text-gold">🥇</span>}
                        {isSilver && <span className="text-gray-400">🥈</span>}
                        {isBronze && <span className="text-amber-600">🥉</span>}
                        {isLast && <span>💩</span>}
                        {!isGold && !isSilver && !isBronze && !isLast && `#${index + 1}`}
                      </td>
                      <td className="p-4 font-bold text-white">
                        {user.name} 
                        {isLast && <span className="text-xs font-semibold text-rose-500 block">El Petardo</span>}
                      </td>
                      <td className="p-4 text-center text-lg font-bold text-emerald-primary">
                        {user.scoreDetails.total}
                      </td>
                      <td className="p-4 text-center text-xs">
                        <span className="block font-semibold text-gold">⭐ {user.scoreDetails.matchStats.exact} exactos</span>
                        <span className="block text-emerald-primary">✓ {user.scoreDetails.matchStats.diff} diferencia</span>
                        <span className="block text-sky-400">▲ {user.scoreDetails.matchStats.simple} ganador</span>
                        <span className="text-gray-500 font-semibold">{user.scoreDetails.matchPoints} pts</span>
                      </td>
                      <td className="p-4 text-center text-xs">
                        <span className="block font-semibold text-white">
                          Aciertos: {
                            user.scoreDetails.bracketDetails.r16Hits +
                            user.scoreDetails.bracketDetails.qfHits +
                            user.scoreDetails.bracketDetails.sfHits +
                            (user.scoreDetails.bracketDetails.championHit ? 1 : 0) +
                            (user.scoreDetails.bracketDetails.runnerUpHit ? 1 : 0)
                          }
                        </span>
                        <span className="text-gray-500">Puntos: {user.scoreDetails.bracketPoints}</span>
                      </td>
                      <td className="p-4 text-right font-bold text-white">
                        {calculatePrize(index) || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* SORTEO TIE-BREAKER */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-bold font-title text-white flex items-center gap-2">
              <Shuffle className="text-emerald-primary" /> Ruleta de Sorteo
            </h2>
            <p className="text-xs text-gray-400">
              Usa este simulador para desempatar puestos familiares de forma justa y transparente.
            </p>
          </div>

          <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
              Candidatos ({raffleCandidates.length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {raffleCandidates.map((c, idx) => (
                <span key={idx} className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-primary px-2.5 py-1 rounded-lg text-xs font-semibold">
                  {c}
                </span>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setCustomRaffleList(users.map(u => u.name))}
                className="text-[10px] text-emerald-primary hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer"
              >
                <RefreshCw size={10} /> Todos los usuarios
              </button>
              {customRaffleList && (
                <button 
                  onClick={() => setCustomRaffleList(null)}
                  className="text-[10px] text-rose-500 hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer"
                >
                  Restaurar empates
                </button>
              )}
            </div>
          </div>

          {/* Animación Visual de la Ruleta */}
          <div className="flex flex-col items-center py-4 my-auto relative">
            <div 
              style={{
                width: '140px',
                height: '140px',
                borderRadius: '50%',
                border: '4px dashed #10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `rotate(${raffleRotation}deg)`,
                transition: isSpinning ? 'transform 2.5s cubic-bezier(0.1, 0.8, 0.1, 1)' : 'none',
                background: 'radial-gradient(circle, rgba(12, 22, 17, 0.9) 30%, rgba(16, 185, 129, 0.05) 100%)'
              }}
              className={`relative ${isSpinning ? 'shadow-[0_0_25px_var(--color-emerald-glow)]' : ''}`}
            >
              <Shuffle size={32} style={{ transform: `rotate(${-raffleRotation}deg)`, transition: isSpinning ? 'transform 2.5s cubic-bezier(0.1, 0.8, 0.1, 1)' : 'none' }} className="text-emerald-primary" />
              
              {/* Flecha indicadora superior */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] border-t-amber-500 z-10"></div>
            </div>

            <button
              onClick={handleSpinRaffle}
              disabled={isSpinning || raffleCandidates.length < 2}
              className="w-full max-w-[200px] mt-6 bg-emerald-primary hover:bg-emerald-600 disabled:bg-white/10 disabled:text-gray-500 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-[0_4px_12px_rgba(16,185,129,0.25)] hover:translate-y-[-1px]"
            >
              {isSpinning ? 'Sorteando...' : 'Girar Ruleta'}
            </button>

            {raffleWinner && (
              <div className="mt-6 text-center animate-fade-in space-y-1">
                <p className="text-xs text-gray-500 font-medium">¡Ganador elegido!</p>
                <h3 className="text-xl font-black text-gold uppercase tracking-wider">
                  🎉 {raffleWinner} 🎉
                </h3>
              </div>
            )}
          </div>

        </div>

      </div>
      )}

      {/* LLAVES DEL MUNDIAL (consulta, colapsable y cerrado por defecto, al final) */}
      <BracketView
        matches={matches}
        actualBracket={actualBracket}
        currentUser={currentUser}
        users={users}
        updateUserPredictions={updateUserPredictions}
        updateMatchResult={updateMatchResult}
        phaseDeadlines={phaseDeadlines}
        updatePhaseDeadline={updatePhaseDeadline}
        collapsible
        defaultOpen={false}
      />

      {/* BOTÓN FLOTANTE: salto rápido a la Tabla de posiciones por grupos */}
      <button
        onClick={scrollToStandings}
        title="Ir a la Tabla de posiciones"
        className="fixed right-4 bottom-20 md:bottom-6 z-40 flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white px-4 py-3 rounded-full shadow-[0_4px_16px_rgba(14,165,233,0.4)] transition-all hover:translate-y-[-2px]"
      >
        <ListOrdered size={18} />
        <span className="hidden sm:inline text-xs font-bold">Tabla de grupos</span>
      </button>

    </div>
  );
}
