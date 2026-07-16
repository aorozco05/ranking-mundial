/**
 * Calcula el puntaje de un usuario en base a sus predicciones y los resultados reales del torneo.
 *
 * Reglas de Puntuación:
 * 1. Adivinar Marcador Exacto = 5 puntos
 * 2. Adivinar Ganador y diferencia de Goles = 3 puntos (no aplica en empates,
 *    ya que la diferencia de goles siempre es 0)
 * 3. Adivinar Equipo Ganador o empate = 2 puntos
 *    (Estos puntos por resultado aplican a TODOS los partidos, incluida la
 *     eliminación directa.)
 * 4. Llaves (puntos de avance, ADICIONALES a los del resultado): por cada
 *    enfrentamiento real de eliminación directa, acertar el ganador que avanza:
 *    - 2ª Fase → avanza a Octavos: 9 puntos
 *    - Octavos → avanza a Cuartos: 12 puntos
 *    - Cuartos → avanza a Semis: 18 puntos
 * 5. Campeón y Subcampeón: selección directa del usuario.
 *    - Adivinar Campeón = 30 puntos
 *    - Adivinar Subcampeón = 20 puntos
 */

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
    name.includes('Perdedor') ||
    name.includes('Campeón') ||
    name.includes('Subcampeón') ||
    name === 'Vacío'
  );
}

// Puntos de avance por fase: acertar el GANADOR del enfrentamiento real otorga
// los puntos de la fase a la que ese equipo avanza.
//   - Ganar en 2ª Fase (r32) → avanza a Octavos  → 9
//   - Ganar en Octavos (r16)  → avanza a Cuartos  → 12
//   - Ganar en Cuartos (qf)   → avanza a Semis    → 18
// Semis y Final no otorgan puntos por avance: los finalistas se puntúan con la
// selección directa de campeón (30) y subcampeón (20).
const KO_ADVANCE_POINTS = { r32: 9, r16: 12, qf: 18 };

export function getAdvancePointsForStage(stage) {
  return KO_ADVANCE_POINTS[stage] || 0;
}

// Lado ganador de un partido (1=local, según marcador; empate definido por penales).
export function winnerSideOf(homeScore, awayScore, penaltyWinner) {
  if (homeScore === null || homeScore === undefined || homeScore === ''
    || awayScore === null || awayScore === undefined || awayScore === '') return null;
  const hs = parseInt(homeScore, 10);
  const as = parseInt(awayScore, 10);
  if (hs > as) return 'home';
  if (as > hs) return 'away';
  return penaltyWinner === 'away' ? 'away' : 'home';
}

/**
 * Puntos de llaves calculados sobre los ENFRENTAMIENTOS REALES: por cada partido
 * de eliminación directa ya jugado, si el usuario acertó qué equipo avanza
 * (ganador del enfrentamiento real), recibe los puntos de avance de esa fase.
 * Campeón y subcampeón se puntúan por selección directa del usuario.
 *
 * @param matchPredictions  predictions.matches del usuario (por id de partido)
 * @param directBracket     predictions.bracket del usuario (champion/runnerUp)
 * @param actualMatches     partidos reales (con equipos resueltos y resultados)
 * @param actualBracket     bracket real (para campeón/subcampeón oficiales)
 */
export function calculateBracketPoints(matchPredictions, directBracket, actualMatches, actualBracket) {
  let points = 0;
  const details = {
    r16Points: 0,
    qfPoints: 0,
    sfPoints: 0,
    championPoints: 0,
    runnerUpPoints: 0,
    r16Hits: 0,
    qfHits: 0,
    sfHits: 0,
    championHit: false,
    runnerUpHit: false
  };

  const preds = matchPredictions || {};

  (actualMatches || []).forEach(match => {
    const pts = KO_ADVANCE_POINTS[match.stage];
    if (!pts) return;
    if (match.homeScore === null || match.homeScore === undefined
      || match.awayScore === null || match.awayScore === undefined) return; // real sin jugar
    const pred = preds[match.id];
    if (!pred) return;
    const realSide = winnerSideOf(match.homeScore, match.awayScore, match.penaltyWinner);
    const predSide = winnerSideOf(pred.homeScore, pred.awayScore, pred.penaltyWinner);
    if (!realSide || !predSide || realSide !== predSide) return;
    points += pts;
    // Mapear a la fase a la que avanza (octavos→r16, cuartos→qf, semis→sf)
    if (match.stage === 'r32') { details.r16Hits++; details.r16Points += pts; }
    else if (match.stage === 'r16') { details.qfHits++; details.qfPoints += pts; }
    else if (match.stage === 'qf') { details.sfHits++; details.sfPoints += pts; }
  });

  // Campeón - 30 pts (selección directa del usuario)
  if (
    directBracket?.champion &&
    actualBracket?.champion &&
    !isPlaceholder(actualBracket.champion) &&
    directBracket.champion === actualBracket.champion
  ) {
    details.championHit = true;
    details.championPoints = 30;
    points += 30;
  }

  // Subcampeón - 20 pts (selección directa del usuario)
  if (
    directBracket?.runnerUp &&
    actualBracket?.runnerUp &&
    !isPlaceholder(actualBracket.runnerUp) &&
    directBracket.runnerUp === actualBracket.runnerUp
  ) {
    details.runnerUpHit = true;
    details.runnerUpPoints = 20;
    points += 20;
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
      // Los puntos por resultado del partido (exacto/diferencia/ganador/empate)
      // aplican a TODOS los partidos, incluida la eliminación directa. En las
      // llaves se suman además los puntos de avance (ver calculateBracketPoints).
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
  });

  // Llaves: a partir de la fase de 32. Octavos, cuartos y semifinales se calculan
  // sobre los ENFRENTAMIENTOS REALES (acertar el ganador que avanza). El campeón
  // y el subcampeón se toman de la selección directa del usuario.
  const directBracket = userPredictions.bracket || {};
  const bracketRes = calculateBracketPoints(matchPredictions, directBracket, actualMatches, actualBracket);
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
