/*
 * Verifies every algorithm actually solves the case it claims to.
 *
 *   node tools/verify-algs.cjs
 *
 * For each alg we build the case (solved cube + inverse alg), then run the alg
 * and check the result. OLL must leave the cube with an oriented last layer and
 * an intact F2L; PLL must leave it fully solved. Anything else is a bad alg —
 * and would render a bad diagram, since the diagrams come from the same code.
 */
const Cube = require('../js/cube.js');
const Algs = require('../js/algs.js');

let bad = 0;
const rows = [];

for (const item of Algs.all()) {
  const state = Cube.caseState(item.alg);
  const before = Cube.inspect(state);
  Cube.apply(state, item.alg);
  Cube.normalize(state);
  const after = Cube.inspect(state);

  const problems = [];
  if (!before.f2lIntact) problems.push('case has a broken F2L');
  if (item.set === 'oll') {
    if (!after.oriented || !after.f2lIntact) problems.push('alg does not orient the last layer');
    if (before.oriented) problems.push('case is already oriented (alg is a no-op for OLL)');
  } else {
    if (!after.solved) problems.push('alg does not solve the cube');
    if (!before.oriented) problems.push('case is not a PLL (last layer unoriented)');
    if (before.permuted) problems.push('case is already permuted');
  }

  if (problems.length) {
    bad++;
    rows.push(`✗ ${item.name.padEnd(9)} ${problems.join('; ')}\n    ${item.alg}`);
  }
}

// Two entries resolving to the same case means the list is mislabelled.
const seen = new Map();
for (const item of Algs.all()) {
  const f = Cube.facelets(Cube.caseState(item.alg));
  const key = item.set + ':' + (item.set === 'oll'
    ? [f.U, f.F.slice(0, 3), f.R.slice(0, 3), f.B.slice(0, 3), f.L.slice(0, 3)]
        .flat().map((c) => (c === 'U' ? 1 : 0)).join('')
    : ['F', 'R', 'B', 'L'].map((face) => f[face].slice(0, 3).join('')).join(''));
  if (seen.has(key)) {
    bad++;
    rows.push(`✗ ${item.name.padEnd(9)} same case as ${seen.get(key)}`);
  } else {
    seen.set(key, item.name);
  }
}

console.log(rows.join('\n') || 'all clear');
console.log(`\n${Algs.all().length - bad}/${Algs.all().length} algorithms verified`);
process.exit(bad ? 1 : 0);
