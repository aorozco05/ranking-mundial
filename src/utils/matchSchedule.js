// Utilidades para el horario de inicio (kickoff) de los partidos.

/**
 * Devuelve la fecha-hora de inicio del partido como objeto Date,
 * o null si no tiene fecha u hora válidas.
 */
export function getMatchKickoff(match) {
  if (!match || !match.date || !match.time) return null;
  const dt = new Date(`${match.date}T${match.time}:00`);
  return isNaN(dt.getTime()) ? null : dt;
}

/**
 * Indica si el partido ya comenzó (la hora de inicio es anterior o igual a ahora).
 * Si el partido no tiene hora definida, se considera que aún no ha comenzado.
 */
export function hasMatchStarted(match, now = new Date()) {
  const kickoff = getMatchKickoff(match);
  if (!kickoff) return false;
  return kickoff.getTime() <= now.getTime();
}
