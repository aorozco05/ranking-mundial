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

/**
 * Indica si una fecha límite (deshabilitadora) ya pasó.
 * El valor se almacena como cadena 'YYYY-MM-DDTHH:mm' (input datetime-local).
 * Si no hay fecha límite definida, nunca está cerrada por este criterio.
 */
export function isDeadlinePassed(deadline, now = new Date()) {
  if (!deadline) return false;
  const dt = new Date(deadline);
  if (isNaN(dt.getTime())) return false;
  return dt.getTime() <= now.getTime();
}

/**
 * Indica si los pronósticos de un partido de eliminación directa están cerrados
 * por la fecha deshabilitadora que el administrador definió para esa fase.
 * Las fases de grupos no se ven afectadas por este criterio.
 *
 * Nota: esto solo bloquea la EDICIÓN; nunca borra los pronósticos ya guardados.
 */
export function isPhaseDeadlinePassed(stage, phaseDeadlines, now = new Date()) {
  if (!stage || stage === 'groups' || !phaseDeadlines) return false;
  return isDeadlinePassed(phaseDeadlines[stage], now);
}

/**
 * Estado de bloqueo de edición de un pronóstico para un partido dado.
 * Un pronóstico está cerrado (no editable) si: ya se oficializó el resultado,
 * el partido ya comenzó, o pasó la fecha deshabilitadora de su fase.
 * En todos los casos el pronóstico guardado se conserva.
 */
export function isPredictionLocked(match, phaseDeadlines, now = new Date()) {
  if (!match) return false;
  const officialized = match.homeScore !== null && match.homeScore !== undefined
    && match.awayScore !== null && match.awayScore !== undefined;
  return officialized || hasMatchStarted(match, now) || isPhaseDeadlinePassed(match.stage, phaseDeadlines, now);
}
