/**
 * Deterministic, read-only scoring audit. Run:
 *   npx tsx tools/balance-audit.ts
 *   npx tsx tools/balance-audit.ts --markdown
 *
 * Prints to stdout; does not modify game state outside this process or write files.
 * Bounds deliberately give every strategy perfect catches and instantaneous input.
 * The five trick reward streams are measured from the production Game class.
 */
import { Game, IDEAL_HEAT, ROUND_SECONDS, clamp } from '../src/simulation.ts';

type Trick = { name: string; rotation: number; twist: number; rewards: number[] };
type Scores = { oldTotal: number; proposedTotal: number };
const oldScore = (technique: number, art: number) => Math.round(Math.sqrt(technique * art));
const proposedScore = (technique: number, art: number) => Math.round(technique * (art / 1000) ** 2);
const scores = (technique: number, art: number): Scores => ({ oldTotal: oldScore(technique, art), proposedTotal: proposedScore(technique, art) });
const round = (value: number, digits = 4) => Number(value.toFixed(digits));
const faceQuality = (heat: number) => heat <= IDEAL_HEAT ? clamp(heat / IDEAL_HEAT) : clamp(1 - (heat - IDEAL_HEAT) / 14);
const artistry = (heat: number[], integrity: number) => Math.round(1000 * Math.sqrt(faceQuality(heat[0]) * faceQuality(heat[1])) * integrity);

const tricks: Trick[] = [[0, 0], [.3, 0], [.6, 0], [1, 0], [.6, 1]].map(([rotation, twist]) => {
  const game = new Game();
  game.phase = 'cook'; game.heat = [20, 20]; game.remaining = 10000;
  const rewards: number[] = [];
  let name = '';
  for (let n = 0; n < 30; n++) {
    const before = game.technique;
    game.launch(0, rotation, twist);
    name = game.trickName;
    game.catchAssisted = true;
    game.step(game.duration);
    rewards.push(game.technique - before);
  }
  return { name, rotation, twist, rewards };
});

function bestTechnique(count: number) {
  const counts = tricks.map(() => 0);
  const sequence: number[] = [];
  let technique = 0;
  for (let n = 0; n < count; n++) {
    let selected = 0;
    for (let j = 1; j < tricks.length; j++) {
      if (tricks[j].rewards[counts[j]] > tricks[selected].rewards[counts[selected]]) selected = j;
    }
    technique += tricks[selected].rewards[counts[selected]++];
    sequence.push(selected);
  }
  return { technique, counts, sequence };
}

function bestBake(cooking: number, launches: number) {
  // With no flip, the upward face never heats.
  if (!launches) return { heat: [cooking, 0], integrity: 1, art: 0 };
  const balanced = [cooking / 2, cooking / 2];
  if (cooking >= 6) return { heat: balanced, integrity: 1, art: artistry(balanced, 1) };
  if (cooking < 3) {
    const integrity = Math.max(.2, 1 - launches * .12);
    return { heat: balanced, integrity, art: artistry(balanced, integrity) };
  }
  // Under six cooking seconds, compare setting the first face for three seconds
  // with one early toss followed immediately by enough cooking to set the batter.
  const setFirst = { heat: [3, cooking - 3], integrity: 1, art: artistry([3, cooking - 3], 1) };
  const early = { heat: balanced, integrity: .88, art: artistry(balanced, .88) };
  return setFirst.art >= early.art ? setFirst : early;
}

const profiles = [
  { name: '最短タッチ入力の上界', power: 0 },
  { name: 'モーション最短', power: .2 },
  { name: '中トス', power: .5 },
  { name: '高トス', power: 1 },
];
const models = profiles.map(profile => {
  const duration = 2.1 + profile.power * 1.1;
  const rows = Array.from({ length: Math.floor(ROUND_SECONDS / duration) + 1 }, (_, count) => {
    const cooking = Math.max(0, ROUND_SECONDS - count * duration);
    const technical = bestTechnique(count);
    const bake = bestBake(cooking, count);
    return {
      launches: count, cookingSeconds: round(cooking), heat: bake.heat.map(v => round(v)),
      integrity: round(bake.integrity), technique: technical.technique, art: bake.art,
      ...scores(technical.technique, bake.art),
      trickCounts: Object.fromEntries(tricks.map((trick, i) => [trick.name, technical.counts[i]])),
    };
  });
  return {
    ...profile, duration: round(duration),
    bestOld: [...rows].sort((a, b) => b.oldTotal - a.oldTotal)[0],
    bestProposed: [...rows].sort((a, b) => b.proposedTotal - a.proposedTotal)[0], rows,
  };
});

function play(name: string, count: number, duration: number, cooking: number[]) {
  const game = new Game(); game.phase = 'cook';
  const { sequence } = bestTechnique(count);
  for (let n = 0; n < count && game.phase !== 'finished'; n++) {
    if (cooking[n]) game.step(cooking[n]);
    const trick = tricks[sequence[n]];
    if (!game.launch((duration - 2.1) / 1.1, trick.rotation, trick.twist)) break;
    game.catchAssisted = true;
    game.step(game.duration);
  }
  // Remaining time is spent cooking on the face currently touching the pan.
  if (game.phase !== 'finished') game.step(game.remaining);
  return {
    name, launches: game.launches, catches: game.catches, heat: game.heat.map(v => round(v)),
    integrity: round(game.integrity), technique: game.technique, art: game.art,
    ...scores(game.technique, game.art), remaining: game.remaining, phase: game.phase,
  };
}

const strategies = [
  play('開始直後から連投・焼成を待たない', 25, 2.32, []),
  play('生焼けを残して20回連投', 20, 2.32, [6.79, 6.79]),
  play('各面10秒だけ焼いて17回', 17, 40 / 17, [9.99, 9.99]),
  play('片面偏重・20秒と4秒で15回', 15, 2.4, [19.99, 3.99]),
  play('適正焼成・各面20秒で8回', 8, 2.5, [19.999, 19.999]),
  play('両面焼きすぎ・各面26秒で3回', 3, 8 / 3, [25.99, 25.99]),
  play('片面は完全に生・20秒と0秒で16回', 16, 2.5, [19.98]),
  play('最初に生地を飛ばしてから各面20秒', 8, 2.5, [0, 20]),
  play('各面20秒だが8回目の飛行中に時間切れ', 8, 2.65, [20, 20]),
];

const report = {
  roundSeconds: ROUND_SECONDS,
  formula: { old: 'round(sqrt(technique * art))', proposed: 'round(technique * (art / 1000)^2)' },
  assumptions: [
    'Perfect catches, no tilt penalty, instantaneous input, and optimal trick variety: optimistic upper bounds rather than typical player scores.',
    'Fixed flight duration within each profile. Every completed toss switches the cooking face. All 60 seconds are consumed.',
    'For any fixed toss count, descending marginal rewards make greedy trick allocation optimal.',
    'For fixed total cooking time, log-concave face quality makes balanced faces optimal unless the initial three-second batter-setting rule favors an uneven split.',
    'Initial batter damage, repeat deductions, uncooked faces, overcooking, and unfinished final flights remain production Game rules.',
    'Touch-input charge/swipe preparation and human reaction time are omitted, so short-flight triple turns are a permissive upper bound.',
  ],
  trickRewards: tricks.map(trick => ({ name: trick.name, rewards: trick.rewards })),
  models, strategies,
};

if (process.argv.includes('--markdown')) {
  const lines = [
    '# PANCAKE AXEL scoring audit', '',
    `Round: ${ROUND_SECONDS} seconds. Perfect catches and instantaneous input are assumed.`, '',
    'Old: √(technique × art). Proposed: technique × (art / 1000)².', '',
    '| Strategy | Tosses / catches | Face seconds | Integrity | Technique | Art | Old | Proposed |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...strategies.map(s => `| ${s.name} | ${s.launches} / ${s.catches} | ${s.heat.join(' / ')} | ${s.integrity} | ${s.technique} | ${s.art} | ${s.oldTotal} | ${s.proposedTotal} |`),
  ];
  for (const model of models) {
    lines.push('', `## ${model.name} (${model.duration} seconds)`, '',
      '| Tosses | Face seconds | Integrity | Technique | Art | Old | Proposed |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      ...model.rows.map(s => `| ${s.launches} | ${s.heat.join(' / ')} | ${s.integrity} | ${s.technique} | ${s.art} | ${s.oldTotal} | ${s.proposedTotal} |`));
  }
  lines.push('', 'Assumptions:', ...report.assumptions.map(value => `- ${value}`));
  console.log(lines.join('\n'));
} else console.log(JSON.stringify(report, null, 2));
