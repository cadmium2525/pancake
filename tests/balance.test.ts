import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runStrategy } from './strategy-runner';
import { clamp } from '../src/simulation';

test('all 60-second toss-count strategies prefer properly cooked faces at every height', () => {
  for (const power of [0, .2, .5, 1]) {
    const duration = 2.1 + power * 1.1;
    const strategies = Array.from({ length: Math.floor(60 / duration) }, (_, i) => runStrategy(i + 1, power));
    const best = strategies.reduce((a, b) => a.total > b.total ? a : b);
    assert.equal(best.phase, 'finished'); assert.equal(best.remaining, 0);
    assert.ok(best.heat.every(h => h >= 17 && h <= 23), JSON.stringify({power, score:best.total, heat:best.heat}));
    const rawSpam = strategies.filter(g => g.heat.some(h => h < 12));
    assert.ok(rawSpam.every(g => best.total > g.total * 1.7), `power ${power}: balanced ${best.total}, raw ${rawSpam.map(g=>g.total)}`);
    assert.ok(rawSpam.every(g => g.medal !== 'gold'));
  }
});

test('baking both faces beats one-sided cooking, even with the same perfect tricks', () => {
  const balanced = runStrategy(10, 0, .5);
  for (const fraction of [0, .1, .2, .8, .9, 1]) {
    const uneven = runStrategy(10, 0, fraction);
    assert.ok(balanced.total > uneven.total * 1.5, `${fraction}: ${balanced.total} vs ${uneven.total}`);
    assert.notEqual(uneven.medal, 'gold');
  }
});

test('searching all toss counts and 21 face allocations still puts the best score in the golden zone', () => {
  for (const power of [0, .2, .5, 1]) {
    const strategies = [];
    for (let tosses = 1; tosses <= Math.floor(60 / (2.1 + power * 1.1)); tosses++) {
      for (let split = 0; split <= 20; split++) strategies.push(runStrategy(tosses, power, split / 20));
    }
    const best = strategies.reduce((a, b) => a.total > b.total ? a : b);
    assert.ok(best.heat.every(h => h >= 17 && h <= 23), JSON.stringify({power, score:best.total, heat:best.heat}));
    assert.ok(strategies.filter(g => g.heat.some(h => h < 12 || h > 27)).every(g => g.total < best.total));
  }
});

test('constant tossing from raw batter and leaving it in the pan cannot beat balanced cooking', () => {
  const balanced = runStrategy(10, 0);
  const almostNoBaking = runStrategy(28, 0);
  const burnt = runStrategy(1, 0);
  const idle = runStrategy(0, 0);
  assert.ok(balanced.total > 1000);
  assert.ok(almostNoBaking.launches > balanced.launches * 2);
  assert.ok(almostNoBaking.total < balanced.total * .05);
  assert.ok(burnt.total < balanced.total * .05); assert.equal(idle.total, 0);
});

test('more tricks still reward skill when both faces stay in the golden zone', () => {
  const eight = runStrategy(8, .5);
  const nine = runStrategy(9, .2);
  const ten = runStrategy(10, 0);
  assert.ok([eight, nine, ten].every(g => g.heat.every(h => h >= 17 && h <= 23)));
  assert.ok(ten.technique > nine.technique && nine.technique > eight.technique);
  assert.ok(ten.total > nine.total && nine.total > eight.total);
});

test('even the optimal total flight time for every toss count favors a golden pancake', () => {
  // Any mixture of flight heights has the same heat budget as its average.
  // Move that average as close as allowed to 40 seconds of total cooking.
  const candidates = Array.from({length:28},(_,i)=>{
    const count=i+1;
    const duration=clamp(20/count,2.1,3.2);
    return runStrategy(count,(duration-2.1)/1.1);
  });
  const best=candidates.reduce((a,b)=>a.total>b.total?a:b);
  assert.ok(best.heat.every(h=>h>=17&&h<=23));
  assert.equal(best.launches,10);
  assert.ok(best.total>1700);
});
