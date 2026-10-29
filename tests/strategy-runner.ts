import { Game, ROUND_SECONDS, clamp } from '../src/simulation';

const families = [
  { rotation: 1, twist: 0, base: 310 },
  { rotation: .6, twist: 1, base: 270 },
  { rotation: .6, twist: 0, base: 210 },
  { rotation: .3, twist: 0, base: 140 },
  { rotation: 0, twist: 0, base: 65 },
];

/** An adversarial upper bound: always choose the largest next award. */
export function strongestTricks(count: number) {
  const repeats = families.map(() => 0);
  return Array.from({ length: count }, () => {
    let best = 0;
    families.forEach((f, i) => { if (f.base / (1 + .45 * repeats[i]) > families[best].base / (1 + .45 * repeats[best])) best = i; });
    repeats[best]++;
    return families[best];
  });
}

/** Play through the actual pouring, timer, flips, heating and landing rules.
 * Perfect steering gives repeated-toss strategies every possible advantage.
 * The two waits can be split arbitrarily; all remaining time is spent flying.
 */
export function runStrategy(tosses: number, power: number, firstFaceFraction = .5) {
  const g = new Game(); g.start();
  const step = (dt: number) => {
    if (g.phase === 'air') {
      const speed = Math.sin(g.launches * 2.4) * (.14 + Math.abs(g.extraTarget) / (Math.PI * 2) * .06);
      const nextCake = g.cakeX + speed * dt;
      const gain = 1 - Math.exp(-dt * 10);
      g.panTarget = clamp(g.panX + (nextCake - g.panX) / gain, -1.4, 1.4);
    }
    g.step(dt);
  };
  const wait = (seconds: number) => {
    let elapsed = 0;
    while (seconds - elapsed > 1e-8 && g.phase !== 'finished') {
      const dt = Math.min(.01, seconds - elapsed, g.remaining); step(dt); elapsed += dt;
    }
  };
  while (g.phase === 'pour') step(Math.min(.01, 2.6 - g.pour));
  const cooking = Math.max(0, ROUND_SECONDS - tosses * (2.1 + clamp(power) * 1.1));
  wait(tosses ? cooking * firstFaceFraction : ROUND_SECONDS);
  const tricks = strongestTricks(tosses);
  for (const [index, trick] of tricks.entries()) {
    if (!g.launch(power, trick.rotation, trick.twist)) break;
    while (g.phase === 'air') step(Math.min(.01, g.duration - g.airTime, g.remaining));
    if (index === 0) wait(cooking * (1 - firstFaceFraction));
  }
  wait(g.remaining);
  // Finish the sub-nanosecond remainder left by floating-point subtraction.
  if (g.remaining > 0) step(g.remaining);
  return g;
}
