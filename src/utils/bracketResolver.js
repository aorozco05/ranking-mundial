import teamsMetadata from './teamsMetadata.json';
import assignThirdData from './assignThirdData.json';

/**
 * Obtiene la lista de nombres de equipos en un grupo específico.
 */
export function getTeamsForGroup(groupLetter) {
  return Object.entries(teamsMetadata)
    .filter(([_, meta]) => meta.group === groupLetter)
    .map(([teamName]) => teamName);
}

/**
 * Calcula la tabla de posiciones de un grupo ordenado por coeficiente.
 */
export function calculateGroupStandings(matches, groupLetter) {
  const teams = getTeamsForGroup(groupLetter);
  const standings = teams.reduce((acc, team) => {
    acc[team] = {
      name: team,
      pts: 0,
      gd: 0,
      gf: 0,
      ga: 0,
      fifaRank: teamsMetadata[team]?.fifaRank || 999,
      fairPlay: 0 // Valor base, se puede ajustar o dejar en 0
    };
    return acc;
  }, {});

  // Filtrar partidos del grupo
  const groupMatches = matches.filter(m => m.stage === 'groups' && m.group === groupLetter);

  groupMatches.forEach(match => {
    const { homeTeam, awayTeam, homeScore, awayScore } = match;
    if (homeScore !== null && awayScore !== null && standings[homeTeam] && standings[awayTeam]) {
      const hs = parseInt(homeScore, 10);
      const as = parseInt(awayScore, 10);

      standings[homeTeam].gf += hs;
      standings[homeTeam].ga += as;
      standings[homeTeam].gd += (hs - as);

      standings[awayTeam].gf += as;
      standings[awayTeam].ga += hs;
      standings[awayTeam].gd += (as - hs);

      if (hs > as) {
        standings[homeTeam].pts += 3;
      } else if (hs < as) {
        standings[awayTeam].pts += 3;
      } else {
        standings[homeTeam].pts += 1;
        standings[awayTeam].pts += 1;
      }
    }
  });

  // Calcular coeficientes de clasificación
  return Object.values(standings).map(team => {
    // Coeficiente = (Pts * 1,000,000) + (GD * 1,000) + (GF * 1) + (FairPlay * 0.001) + (FIFA_Rank * 0.000001) + 500,000
    // Un FIFA_Rank mayor aporta positivamente para romper empates
    const coef = (team.pts * 1000000) + (team.gd * 1000) + (team.gf * 1) + (team.fairPlay * 0.001) + (team.fifaRank * 0.000001) + 500000;
    return {
      ...team,
      coefficient: coef
    };
  }).sort((a, b) => b.coefficient - a.coefficient);
}

/**
 * Determina cuáles son los 8 mejores terceros clasificados de los 12 grupos.
 */
export function getBestThirdPlacedTeams(matches) {
  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const thirds = [];

  groups.forEach(groupLetter => {
    const standings = calculateGroupStandings(matches, groupLetter);
    if (standings.length >= 3) {
      const third = standings[2]; // Tercer lugar en el grupo (índice 2)
      thirds.push({
        ...third,
        group: groupLetter
      });
    }
  });

  // Ordenar terceros por coeficiente (mayor a menor)
  thirds.sort((a, b) => b.coefficient - a.coefficient);

  // Los 8 primeros clasifican
  return thirds.slice(0, 8);
}

/**
 * Asigna los terceros puestos a los partidos correspondientes de la Ronda de 32 usando assignThirdData.
 */
export function getThirdPlacedAssignment(best8) {
  const qualifiedGroups = best8.map(t => t.group).sort().join('');
  const mapping = assignThirdData.find(row => row.C === qualifiedGroups);
  
  if (!mapping) {
    console.warn("No se encontró asignación de terceros para la combinación:", qualifiedGroups);
    return {};
  }

  const getThirdTeamOfGroup = (groupLetter) => {
    return best8.find(t => t.group === groupLetter)?.name || `Tercero ${groupLetter}`;
  };

  return {
    '3-CEFHI': getThirdTeamOfGroup(mapping.D),
    '3-EFGIJ': getThirdTeamOfGroup(mapping.E),
    '3-BEFIJ': getThirdTeamOfGroup(mapping.F),
    '3-ABCDF': getThirdTeamOfGroup(mapping.G),
    '3-AEHIJ': getThirdTeamOfGroup(mapping.H),
    '3-CDFGH': getThirdTeamOfGroup(mapping.I),
    '3-DEIJL': getThirdTeamOfGroup(mapping.J),
    '3-EHIJK': getThirdTeamOfGroup(mapping.K),
  };
}

/**
 * Resuelve y calcula la estructura completa del bracket (R32, R16, QF, SF, Final, Campeón).
 */
export function resolveFullBracket(matches, matchPredictions = null) {
  const groupStandings = {};
  const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  
  // Unificar marcadores con predicciones si se proveen
  const unifiedMatches = matches.map(match => {
    if (matchPredictions) {
      const pred = matchPredictions[match.id];
      if (
        pred && 
        pred.homeScore !== undefined && 
        pred.awayScore !== undefined && 
        pred.homeScore !== null && 
        pred.awayScore !== null
      ) {
        return {
          ...match,
          homeScore: pred.homeScore,
          awayScore: pred.awayScore,
          penaltyWinner: pred.penaltyWinner
        };
      } else {
        // Si el usuario no ha llenado el pronóstico para este partido, en su simulación tiene marcador nulo
        return {
          ...match,
          homeScore: null,
          awayScore: null,
          penaltyWinner: null
        };
      }
    }
    return match;
  });

  // Helper para verificar si un grupo está completamente jugado
  const isGroupFullyPlayed = (groupLetter) => {
    const groupMatches = unifiedMatches.filter(m => m.stage === 'groups' && m.group === groupLetter);
    return groupMatches.length > 0 && groupMatches.every(m => m.homeScore !== null && m.awayScore !== null);
  };

  // Calcular standings
  groups.forEach(g => {
    groupStandings[g] = calculateGroupStandings(unifiedMatches, g);
  });

  // Clasificados directos (solo si el grupo está completamente jugado)
  const groupWinners = {};
  groups.forEach(g => {
    if (isGroupFullyPlayed(g)) {
      const standings = groupStandings[g];
      groupWinners[`1${g}`] = standings[0]?.name || `1${g}`;
      groupWinners[`2${g}`] = standings[1]?.name || `2${g}`;
    } else {
      groupWinners[`1${g}`] = `1${g}`;
      groupWinners[`2${g}`] = `2${g}`;
    }
  });

  // Clasificación de terceros (solo si todos los grupos están completamente jugados)
  const allGroupsPlayed = groups.every(g => isGroupFullyPlayed(g));
  let best8 = [];
  let thirdAssignments = {};

  if (allGroupsPlayed) {
    best8 = getBestThirdPlacedTeams(unifiedMatches);
    thirdAssignments = getThirdPlacedAssignment(best8);
  }

  const matchWinners = {};

  const getMatchWinner = (matchId, defaultLabel) => {
    if (matchWinners[matchId]) return matchWinners[matchId];
    const match = unifiedMatches.find(m => m.id === matchId);
    if (!match || match.homeScore === null || match.awayScore === null) {
      return defaultLabel;
    }
    const hs = parseInt(match.homeScore, 10);
    const as = parseInt(match.awayScore, 10);
    if (hs > as) return match.homeTeam;
    if (hs < as) return match.awayTeam;
    
    // Si hay empate, se define por penaltis
    if (match.penaltyWinner === 'away') return match.awayTeam;
    return match.homeTeam;
  };

  const resolvedKnockout = {};

  // Ronda de 32 (Partido 73 al 88)
  const r32Pairings = [
    { id: 'k32-1', home: '2A', away: '2B' },
    { id: 'k32-2', home: '1E', away: '3-ABCDF' },
    { id: 'k32-3', home: '1F', away: '2C' },
    { id: 'k32-4', home: '1C', away: '2F' },
    { id: 'k32-5', home: '1I', away: '3-CDFGH' },
    { id: 'k32-6', home: '2E', away: '2I' },
    { id: 'k32-7', home: '1A', away: '3-CEFHI' },
    { id: 'k32-8', home: '1L', away: '3-EHIJK' },
    { id: 'k32-9', home: '1D', away: '3-BEFIJ' },
    { id: 'k32-10', home: '1G', away: '3-AEHIJ' },
    { id: 'k32-11', home: '2K', away: '2L' },
    { id: 'k32-12', home: '1H', away: '2J' },
    { id: 'k32-13', home: '1B', away: '3-EFGIJ' },
    { id: 'k32-14', home: '1J', away: '2H' },
    { id: 'k32-15', home: '1K', away: '3-DEIJL' },
    { id: 'k32-16', home: '2D', away: '2G' }
  ];

  r32Pairings.forEach(p => {
    const resolveTeam = (code) => {
      if (code.startsWith('1') || code.startsWith('2')) return groupWinners[code];
      if (code.startsWith('3-')) return thirdAssignments[code] || code;
      return code;
    };
    resolvedKnockout[p.id] = {
      homeTeam: resolveTeam(p.home),
      awayTeam: resolveTeam(p.away)
    };
  });

  // Asignar equipos en unifiedMatches de R32 para calcular ganadores
  unifiedMatches.forEach(m => {
    if (resolvedKnockout[m.id]) {
      m.homeTeam = resolvedKnockout[m.id].homeTeam;
      m.awayTeam = resolvedKnockout[m.id].awayTeam;
    }
  });

  // Registrar ganadores R32
  r32Pairings.forEach(p => {
    matchWinners[p.id] = getMatchWinner(p.id, `Ganador ${p.id.toUpperCase()}`);
  });

  // Octavos de Final (Partidos 89 al 96)
  const r16Pairings = [
    { id: 'k16-1', home: 'k32-2', away: 'k32-5' },
    { id: 'k16-2', home: 'k32-1', away: 'k32-3' },
    { id: 'k16-3', home: 'k32-4', away: 'k32-6' },
    { id: 'k16-4', home: 'k32-7', away: 'k32-8' },
    { id: 'k16-5', home: 'k32-11', away: 'k32-12' },
    { id: 'k16-6', home: 'k32-9', away: 'k32-10' },
    { id: 'k16-7', home: 'k32-14', away: 'k32-16' },
    { id: 'k16-8', home: 'k32-13', away: 'k32-15' }
  ];

  r16Pairings.forEach(p => {
    resolvedKnockout[p.id] = {
      homeTeam: matchWinners[p.home],
      awayTeam: matchWinners[p.away]
    };
  });

  // Asignar equipos de R16
  unifiedMatches.forEach(m => {
    if (resolvedKnockout[m.id]) {
      m.homeTeam = resolvedKnockout[m.id].homeTeam;
      m.awayTeam = resolvedKnockout[m.id].awayTeam;
    }
  });

  // Ganadores R16
  r16Pairings.forEach(p => {
    matchWinners[p.id] = getMatchWinner(p.id, `Ganador ${p.id.toUpperCase()}`);
  });

  // Cuartos de Final (Partidos 97 al 100)
  const qfPairings = [
    { id: 'k8-1', home: 'k16-1', away: 'k16-2' },
    { id: 'k8-2', home: 'k16-5', away: 'k16-6' },
    { id: 'k8-3', home: 'k16-3', away: 'k16-4' },
    { id: 'k8-4', home: 'k16-7', away: 'k16-8' }
  ];

  qfPairings.forEach(p => {
    resolvedKnockout[p.id] = {
      homeTeam: matchWinners[p.home],
      awayTeam: matchWinners[p.away]
    };
  });

  // Asignar QF
  unifiedMatches.forEach(m => {
    if (resolvedKnockout[m.id]) {
      m.homeTeam = resolvedKnockout[m.id].homeTeam;
      m.awayTeam = resolvedKnockout[m.id].awayTeam;
    }
  });

  // Ganadores QF
  qfPairings.forEach(p => {
    matchWinners[p.id] = getMatchWinner(p.id, `Ganador ${p.id.toUpperCase()}`);
  });

  // Semifinales (Partidos 101 al 102)
  const sfPairings = [
    { id: 'k4-1', home: 'k8-1', away: 'k8-2' },
    { id: 'k4-2', home: 'k8-3', away: 'k8-4' }
  ];

  sfPairings.forEach(p => {
    resolvedKnockout[p.id] = {
      homeTeam: matchWinners[p.home],
      awayTeam: matchWinners[p.away]
    };
  });

  // Asignar SF
  unifiedMatches.forEach(m => {
    if (resolvedKnockout[m.id]) {
      m.homeTeam = resolvedKnockout[m.id].homeTeam;
      m.awayTeam = resolvedKnockout[m.id].awayTeam;
    }
  });

  // Ganadores SF
  sfPairings.forEach(p => {
    matchWinners[p.id] = getMatchWinner(p.id, `Ganador ${p.id.toUpperCase()}`);
  });

  // Final (Partido 104)
  const finalPairing = { id: 'k2-1', home: 'k4-1', away: 'k4-2' };
  resolvedKnockout[finalPairing.id] = {
    homeTeam: matchWinners[finalPairing.home],
    awayTeam: matchWinners[finalPairing.away]
  };

  // Asignar Final
  unifiedMatches.forEach(m => {
    if (m.id === finalPairing.id) {
      m.homeTeam = resolvedKnockout[finalPairing.id].homeTeam;
      m.awayTeam = resolvedKnockout[finalPairing.id].awayTeam;
    }
  });

  const champion = getMatchWinner(finalPairing.id, 'Campeón');
  let runnerUp = 'Subcampeón';
  const finalMatch = unifiedMatches.find(m => m.id === finalPairing.id);
  if (finalMatch && finalMatch.homeScore !== null && finalMatch.awayScore !== null) {
    if (champion === finalMatch.homeTeam) runnerUp = finalMatch.awayTeam;
    else if (champion === finalMatch.awayTeam) runnerUp = finalMatch.homeTeam;
  }

  // Estructurar el bracket
  const getBracketTeams = (stagePairings) => {
    const list = [];
    stagePairings.forEach(p => {
      list.push(resolvedKnockout[p.id].homeTeam);
      list.push(resolvedKnockout[p.id].awayTeam);
    });
    return list;
  };

  const bracket = {
    r32: getBracketTeams(r32Pairings),
    r16: getBracketTeams(r16Pairings),
    qf: getBracketTeams(qfPairings),
    sf: getBracketTeams(sfPairings),
    final: [resolvedKnockout['k2-1'].homeTeam, resolvedKnockout['k2-1'].awayTeam],
    champion,
    runnerUp
  };

  return {
    groupStandings,
    best8,
    resolvedKnockout,
    bracket,
    unifiedMatches
  };
}
