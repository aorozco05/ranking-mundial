import { calculateMatchPoints } from './src/utils/scoring.js';

console.log('--- Probando Lógica de Puntuación ---');

const testCases = [
  { actual: { homeScore: 2, awayScore: 0 }, pred: { homeScore: 2, awayScore: 0 }, expected: 5, label: 'Marcador Exacto (2-0 vs 2-0)' },
  { actual: { homeScore: 2, awayScore: 0 }, pred: { homeScore: 3, awayScore: 1 }, expected: 3, label: 'Ganador e Igual Diferencia (2-0 vs 3-1)' },
  { actual: { homeScore: 2, awayScore: 0 }, pred: { homeScore: 1, awayScore: 0 }, expected: 2, label: 'Ganador Simple (2-0 vs 1-0)' },
  { actual: { homeScore: 2, awayScore: 0 }, pred: { homeScore: 0, awayScore: 1 }, expected: 0, label: 'Perdedor (2-0 vs 0-1)' },
  { actual: { homeScore: 1, awayScore: 1 }, pred: { homeScore: 1, awayScore: 1 }, expected: 5, label: 'Empate Exacto (1-1 vs 1-1)' },
  { actual: { homeScore: 1, awayScore: 1 }, pred: { homeScore: 2, awayScore: 2 }, expected: 2, label: 'Empate Simple sin bono por diferencia (1-1 vs 2-2)' },
  { actual: { homeScore: 0, awayScore: 0 }, pred: { homeScore: 3, awayScore: 3 }, expected: 2, label: 'Empate Simple sin bono por diferencia (0-0 vs 3-3)' },
  { actual: { homeScore: 1, awayScore: 1 }, pred: { homeScore: 1, awayScore: 0 }, expected: 0, label: 'Empate vs Ganador (1-1 vs 1-0)' }
];

let successCount = 0;

testCases.forEach((tc, idx) => {
  const result = calculateMatchPoints(tc.pred, tc.actual);
  const passed = result.points === tc.expected;
  if (passed) {
    successCount++;
    console.log(`✅ TEST ${idx + 1} PASADO: ${tc.label} => Obtuvo ${result.points} pts (Categoría: ${result.category})`);
  } else {
    console.log(`❌ TEST ${idx + 1} FALLADO: ${tc.label} => Obtuvo ${result.points} pts, esperado ${tc.expected} pts`);
  }
});

console.log(`\nResultado: ${successCount} de ${testCases.length} pruebas pasadas.`);
if (successCount === testCases.length) {
  console.log('🎉 ¡Lógica de puntuación verificada correctamente!');
  process.exit(0);
} else {
  console.error('⚠️ ¡Algunas pruebas fallaron!');
  process.exit(1);
}
