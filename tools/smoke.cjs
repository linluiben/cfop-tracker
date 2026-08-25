/*
 * Loads the page in a real browser, walks the three views and the timer, and
 * fails on any console error. Writes screenshots to docs/ when SHOTS=1.
 *
 *   node tools/smoke.cjs
 */
const path = require('path');
// Works with a local devDependency or a globally installed playwright.
function loadPlaywright() {
  try { return require('playwright'); }
  catch (e) { return require('/opt/node22/lib/node_modules/playwright'); }
}
const { chromium } = loadPlaywright();

const url = 'file://' + path.resolve(__dirname, '..', 'index.html');
const shots = process.env.SHOTS === '1';
const outDir = path.resolve(__dirname, '..', 'screenshots');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  // Google Fonts is a progressive enhancement; offline runs must still pass.
  const ignorable = (t) => /ERR_(CONNECTION|NAME_NOT_RESOLVED|INTERNET)/.test(t) || t.includes('fonts.g');
  page.on('console', (m) => { if (m.type() === 'error' && !ignorable(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(url);
  await page.waitForSelector('.card');

  const cards = await page.locator('.card').count();
  const diagrams = await page.locator('.card .diagram').count();
  console.log(`cards: ${cards}, diagrams: ${diagrams}`);
  if (cards !== 78) throw new Error('expected 78 cases, got ' + cards);
  if (diagrams !== cards) throw new Error('some cards are missing a diagram');

  // Marking a case sticks.
  await page.locator('.card').first().click();
  await page.locator('.card').first().click();
  if (!(await page.locator('.card').first().getAttribute('class')).includes('known')) {
    throw new Error('two clicks should mark a case known');
  }
  if (shots) await page.screenshot({ path: path.join(outDir, 'algorithms.png') });

  // Detail modal: diagram + net + 3D cube.
  await page.locator('.card .thumb').nth(60).click();
  await page.waitForSelector('.modal .net');
  await page.waitForSelector('.cube3d-face i');
  if (shots) await page.screenshot({ path: path.join(outDir, 'case-detail.png') });
  await page.keyboard.press('Escape');

  // Alg trainer: hold space, release, wait, stop.
  await page.locator('.viewtab[data-view="trainer"]').click();
  await page.waitForSelector('#trainerDiagram .diagram');
  await page.keyboard.down('Space');
  await page.waitForTimeout(500);
  if (!(await page.locator('#trainerDisplay').getAttribute('class')).includes('ready')) {
    throw new Error('timer did not arm after holding space');
  }
  await page.keyboard.up('Space');
  await page.waitForTimeout(700);
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await page.waitForTimeout(100);
  const attempts = await page.locator('#trainerStats .stat').last().locator('.num').textContent();
  if (attempts !== '1') throw new Error('alg time was not recorded, attempts=' + attempts);
  if (shots) await page.screenshot({ path: path.join(outDir, 'trainer.png') });

  // Full solves.
  await page.locator('.viewtab[data-view="solves"]').click();
  const scramble = await page.locator('#scramble').textContent();
  if (scramble.trim().split(/\s+/).length !== 20) throw new Error('bad scramble: ' + scramble);
  await page.keyboard.down('Space');
  await page.waitForTimeout(500);
  await page.keyboard.up('Space');
  await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  if ((await page.locator('#solveTimes .time-row').count()) !== 1) throw new Error('solve was not recorded');
  await page.locator('#plus2').click();
  if (!(await page.locator('#solveTimes .time-row').first().getAttribute('class')).includes('plus2')) {
    throw new Error('+2 penalty did not apply');
  }
  await page.locator('#plus2').click();
  if (shots) await page.screenshot({ path: path.join(outDir, 'solves.png') });

  // Progress survives a reload.
  await page.reload();
  await page.waitForSelector('.card');
  if (!(await page.locator('.card').first().getAttribute('class')).includes('known')) {
    throw new Error('progress did not persist across reload');
  }

  await browser.close();
  if (errors.length) {
    console.error('console errors:\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log('smoke test passed');
})().catch((e) => { console.error(e); process.exit(1); });
