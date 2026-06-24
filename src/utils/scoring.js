// import { resolveFullBracket } from './bracketResolver'; // Deshabilitado: cálculo de llaves temporalmente apagado

/**
 * Calcula el puntaje de un usuario en base a sus predicciones y los resultados reales del torneo.
 * 
 * Reglas de Puntuación:
 * 1. Adivinar Marcador Exacto = 5 puntos
 * 2. Adivinar Ganador y diferencia de Goles = 3 puntos (no aplica en empates,
 *    ya que la diferencia de goles siempre es 0)
 * 3. Adivinar Equipo Ganador o empate = 2 puntos
 * 4. Adivinar equipos que avanzan a:
 *    - Dieciseisavos (R32): 6 puntos por equipo
 *    - Octavos (R16): 9 puntos por equipo
 *    - Cuartos (R8): 12 puntos por equipo
 *    - Semifinales (R4): 18 puntos por equipo
 *    - Final (R2): 24 puntos por equipo
 * 5. Adivinar Campeón = 30 puntos
 * 6. Adivinar Subcampeón = 15 puntos
 * * Nota: Los puntos por resultados de partidos solo aplican para la fase de grupos.
 */

// Estructura de detalles de llaves en cero, usada mientras el cálculo de
// llaves está deshabilitado temporalmente.
const EMPTY_BRACKET_DETAILS = {
  r32Points: 0,
  r16Points: 0,
  qfPoints: 0,
  sfPoints: 0,
  finalPoints: 0,
  championPoints: 0,
  runnerUpPoints: 0,
  r32Hits: 0,
  r16Hits: 0,
  qfHits: 0,
  sfHits: 0,
  finalHits: 0,
  championHit: false,
  runnerUpHit: false
};

export function calculateMatchPoints(prediction, actual) {
  // Si el partido no se ha jugado o no hay predicción, 0 puntos
  if (
    actual.homeScore === null || 
    actual.awayScore === null || 
    !prediction || 
    prediction.homeScore === undefined || 
    prediction.awayScore === undefined || 
    prediction.homeScore === null || 
    prediction.awayScore === null
  ) {
    return { points: 0, category: 'Ninguno' };
  }

  const actHome = parseInt(actual.homeScore, 10);
  const actAway = parseInt(actual.awayScore, 10);
  const predHome = parseInt(prediction.homeScore, 10);
  const predAway = parseInt(prediction.awayScore, 10);

  // 1. Marcador Exacto
  if (actHome === predHome && actAway === predAway) {
    return { points: 5, category: 'Marcador Exacto' };
  }

  // Determinar ganadores reales y predichos
  // 1 = Local, -1 = Visitante, 0 = Empate
  const actualResult = actHome > actAway ? 1 : (actHome < actAway ? -1 : 0);
  const predictedResult = predHome > predAway ? 1 : (predHome < predAway ? -1 : 0);

  // Si no acertó el resultado básico (ganador o empate), 0 puntos
  if (actualResult !== predictedResult) {
    return { points: 0, category: 'Ninguno' };
  }

  // 2. Adivinar Ganador y diferencia de Goles
  // En un empate la diferencia de goles siempre es 0, por lo que acertarla es
  // trivial; el punto por diferencia solo aplica cuando hay un ganador. Si el
  // resultado real es empate (y no fue marcador exacto), se otorgan 2 puntos.
  const actualDiff = actHome - actAway;
  const predictedDiff = predHome - predAway;

  if (actualResult !== 0 && actualDiff === predictedDiff) {
    return { points: 3, category: 'Ganador e Igual Diferencia' };
  }

  // 3. Adivinar Ganador o Empate Simple
  return { points: 2, category: 'Ganador/Empate Simple' };
}

function isPlaceholder(name) {
  if (!name) return true;
  return (
    name.startsWith('1') || 
    name.startsWith('2') || 
    name.startsWith('3-') || 
    name.includes('Ganador') || 
    name.includes('Campeón') || 
    name.includes('Subcampeón') ||
    name === 'Vacío'
  );
}

export function calculateBracketPoints(userBracket, actualBracket) {
  let points = 0;
  const details = {
    r32Points: 0,
    r16Points: 0,
    qfPoints: 0,
    sfPoints: 0,
    finalPoints: 0,
    championPoints: 0,
    runnerUpPoints: 0,
    r32Hits: 0,
    r16Hits: 0,
    qfHits: 0,
    sfHits: 0,
    finalHits: 0,
    championHit: false,
    runnerUpHit: false
  };

  if (!userBracket || !actualBracket) return { total: 0, details };

  // Dieciseisavos (Round of 32) - 6 pts por equipo
  if (userBracket.r32 && actualBracket.r32) {
    const hits = userBracket.r32.filter(team => team && !isPlaceholder(team) && actualBracket.r32.includes(team));
    details.r32Hits = hits.length;
    details.r32Points = hits.length * 6;
    points += details.r32Points;
  }

  // Octavos (Round of 16) - 9 pts por equipo
  if (userBracket.r16 && actualBracket.r16) {
    const hits = userBracket.r16.filter(team => team && !isPlaceholder(team) && actualBracket.r16.includes(team));
    details.r16Hits = hits.length;
    details.r16Points = hits.length * 9;
    points += details.r16Points;
  }

  // Cuartos (Quarterfinals) - 12 pts por equipo
  if (userBracket.qf && actualBracket.qf) {
    const hits = userBracket.qf.filter(team => team && !isPlaceholder(team) && actualBracket.qf.includes(team));
    details.qfHits = hits.length;
    details.qfPoints = hits.length * 12;
    points += details.qfPoints;
  }

  // Semifinales - 18 pts por equipo
  if (userBracket.sf && actualBracket.sf) {
    const hits = userBracket.sf.filter(team => team && !isPlaceholder(team) && actualBracket.sf.includes(team));
    details.sfHits = hits.length;
    details.sfPoints = hits.length * 18;
    points += details.sfPoints;
  }

  // Final - 24 pts por equipo
  if (userBracket.final && actualBracket.final) {
    const hits = userBracket.final.filter(team => team && !isPlaceholder(team) && actualBracket.final.includes(team));
    details.finalHits = hits.length;
    details.finalPoints = hits.length * 24;
    points += details.finalPoints;
  }

  // Campeón - 30 pts
  if (
    userBracket.champion && 
    actualBracket.champion && 
    !isPlaceholder(userBracket.champion) && 
    userBracket.champion === actualBracket.champion
  ) {
    details.championHit = true;
    details.championPoints = 30;
    points += 30;
  }

  // Subcampeón - 15 pts
  if (
    userBracket.runnerUp && 
    actualBracket.runnerUp && 
    !isPlaceholder(userBracket.runnerUp) && 
    userBracket.runnerUp === actualBracket.runnerUp
  ) {
    details.runnerUpHit = true;
    details.runnerUpPoints = 15;
    points += 15;
  }

  return { total: points, details };
}

export function calculateUserTotalScore(userPredictions, actualMatches, actualBracket) {
  let matchPoints = 0;
  let exactHits = 0;
  let winnerHits = 0;

  const matchStats = {
    exact: 0,
    diff: 0,
    simple: 0,
    failed: 0
  };

  const matchPredictions = userPredictions.matches || {};

  actualMatches.forEach(match => {
    const pred = matchPredictions[match.id];
    if (pred && match.homeScore !== null && match.awayScore !== null) {
      // Los puntos de resultados de partidos solo aplican para la fase de grupos
      if (match.stage === 'groups') {
        const res = calculateMatchPoints(pred, match);
        matchPoints += res.points;
        
        if (res.points === 5) {
          matchStats.exact++;
          exactHits++;
        } else if (res.points === 3) {
          matchStats.diff++;
        } else if (res.points === 2) {
          matchStats.simple++;
          winnerHits++; // Considerado acierto de ganador
        } else {
          matchStats.failed++;
        }
      }
    }
  });

  // NOTA TEMPORAL: El sistema de llaves (bracket) está deshabilitado por ahora.
  // Los puntos de llaves se fuerzan a 0 hasta que se reactive el cálculo.
  // Para reactivarlo: descomentar el import de resolveFullBracket arriba,
  // descomentar las dos líneas siguientes y usar bracketRes.total.
  // const { bracket: userComputedBracket } = resolveFullBracket(actualMatches, userPredictions.matches || {});
  // const bracketRes = calculateBracketPoints(userComputedBracket, actualBracket);
  const bracketRes = { total: 0, details: EMPTY_BRACKET_DETAILS };
  const total = matchPoints + bracketRes.total;

  return {
    total,
    matchPoints,
    bracketPoints: bracketRes.total,
    matchStats,
    bracketDetails: bracketRes.details,
    exactHits,
    winnerHits
  };
}
