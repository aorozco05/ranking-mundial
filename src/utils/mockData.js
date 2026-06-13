import teamsMetadata from './teamsMetadata.json';
import realMatches from './realMatches.json';

// Construir los grupos dinámicamente a partir de teamsMetadata.json
export const GROUPS = Object.entries(teamsMetadata).reduce((acc, [teamName, meta]) => {
  const groupLetter = meta.group;
  if (!acc[groupLetter]) acc[groupLetter] = [];
  acc[groupLetter].push({ name: teamName, code: meta.code });
  return acc;
}, {});

// Ordenar los equipos dentro de cada grupo según su código (A1, A2, etc.) y mapear a solo nombres
Object.keys(GROUPS).forEach(groupLetter => {
  GROUPS[groupLetter] = GROUPS[groupLetter]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(item => item.name);
});

export const TEAMS = Object.values(GROUPS).flat();

// Cargar partidos iniciales de fase de grupos
export const INITIAL_MATCHES = realMatches.filter(m => m.stage === 'groups');

// Cargar partidos iniciales de fase de eliminación directa
export const INITIAL_KNOCKOUT_MATCHES = realMatches.filter(m => m.stage !== 'groups');

export const INITIAL_ACTUAL_TOURNAMENT = {
  bracket: {
    r32: [],
    r16: [],
    qf: [],
    sf: [],
    final: [],
    champion: null,
    runnerUp: null
  }
};

export const INITIAL_USERS = [];
export const DEMO_REAL_MATCHES_UPDATES = {};


