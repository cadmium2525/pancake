export const ROUND_SECONDS = 60;
export const IDEAL_HEAT = 20;
export const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
export type Phase = 'ready' | 'pour' | 'cook' | 'air' | 'finished';
export type Landing = { name: string; points: number; quality: number; turns: number; golden: boolean };
export class Game {
  phase: Phase = 'ready';
  remaining = ROUND_SECONDS;
  pour = 0;
  heat = [0, 0];
  side = 0;
  technique = 0;
  integrity = 1;
  launches = 0;
  catches = 0;
  panX = 0;
  panTarget = 0;
  panRoll = 0;
  panPitch = 0;
  motionControlled = false;
  catchAssisted = false;
  cakeX = 0;
  airTime = 0;
  duration = 2.4;
  height = 0;
  angle = 0;
  twist = 0;
  extra = 0;
  twistTarget = 0;
  extraTarget = 0;
  flipDirection = 1;
  spinDirection = 1;
  repeats: Record<string, number> = {};
  onLanding?: (landing: Landing) => void;
  start() { this.phase = 'pour'; }
  launch(power: number, rotation = power, twist = 0) {
    if (this.phase !== 'cook' || this.remaining <= 0) return false;
    this.phase = 'air'; this.launches++; this.airTime = 0;
    this.duration = 2.1 + clamp(power) * 1.1;
    this.cakeX = this.panX;
    this.extra = this.extraTarget = this.twist = this.twistTarget = 0;
    this.flipDirection = rotation < 0 ? -1 : 1;
    this.spinDirection = twist < 0 ? -1 : 1;
    const strength = clamp(Math.abs(rotation));
    const turns = strength < .25 ? 0 : strength < .5 ? 1 : strength < .8 ? 2 : 3;
    this.extraTarget = turns * Math.PI * 2 * this.flipDirection;
    this.twistTarget = Math.abs(twist) >= .35 ? Math.PI * 2 * this.spinDirection : 0;
    this.catchAssisted = false;
    if (this.heat[0] + this.heat[1] < 3) this.integrity = Math.max(.2, this.integrity - .12);
    return true;
  }
  get trickName() {
    const turns=Math.round(Math.abs(this.extraTarget)/(Math.PI*2));
    return this.twistTarget!==0 && turns>0 ? 'トルネード フリップ' : turns>=3 ? 'トリプル アクセル' : turns>=2 ? 'ダブル フリップ' : turns>=1 ? 'シングル フリップ' : 'ハーフ フリップ';
  }
  step(dt: number) {
    this.panX += (this.panTarget - this.panX) * (1 - Math.exp(-dt * 10));
    if (this.phase === 'pour') { this.pour += dt; if (this.pour >= 2.6) this.phase = 'cook'; return; }
    if (this.phase !== 'cook' && this.phase !== 'air') return;
    const actual = Math.min(dt, this.remaining);
    this.remaining = Math.max(0, this.remaining - actual);
    if (this.phase === 'cook') { this.heat[this.side] += actual; this.cakeX = this.panX; }
    else {
      this.airTime += actual;
      const p = clamp(this.airTime / this.duration);
      this.height = 4 * p * (1 - p) * (2.4 + (this.duration - 2.1));
      this.extra = this.extraTarget * p;
      this.twist = this.twistTarget * p;
      this.angle = this.side * Math.PI + p * Math.PI * this.flipDirection + this.extra;
      this.cakeX += Math.sin(this.launches * 2.4) * actual * (.14 + Math.abs(this.extraTarget)/(Math.PI*2)*.06);
      if (p >= 1) this.land();
    }
    if (this.remaining <= 0) { if (this.phase === 'air') { this.integrity *= .65; this.height = 0; } this.phase = 'finished'; }
  }
  private land() {
    const error = Math.abs(Math.sin(this.extra / 2));
    const distance = this.catchAssisted ? 0 : Math.abs(this.cakeX - this.panX);
    const tilt = this.motionControlled && !this.catchAssisted ? clamp((Math.hypot(this.panRoll,this.panPitch)-14)/30)*.6 : 0;
    const quality = clamp(1 - distance * .65 - error * .85 - tilt);
    const turns = Math.floor((Math.abs(this.extra) + .05) / (Math.PI * 2));
    const spins = Math.floor((Math.abs(this.twist) + .05) / (Math.PI * 2));
    const name = spins > 0 && turns > 0 ? 'トルネード フリップ' : turns >= 3 ? 'トリプル アクセル' : turns >= 2 ? 'ダブル フリップ' : turns >= 1 ? 'シングル フリップ' : 'ハーフ フリップ';
    const count = this.repeats[name] || 0; this.repeats[name] = count + 1;
    const base = spins > 0 && turns > 0 ? 270 : turns >= 3 ? 310 : turns >= 2 ? 210 : turns >= 1 ? 140 : 65;
    const points = quality < .35 ? 0 : Math.round(base * quality / (1 + count * .45));
    this.technique += points;
    if (quality >= .7) this.catches++;
    this.integrity = Math.max(.15, this.integrity - (1 - quality) * .2);
    this.side = 1 - this.side;
    this.angle = this.side * Math.PI; this.twist = 0; this.height = 0; this.phase = 'cook';
    this.onLanding?.({ name, points, quality, turns, golden: quality >= .9 && this.heat.some(h => h >= 17 && h <= 23) });
  }
  get art() {
    const quality = this.heat.map(h => h <= IDEAL_HEAT ? clamp(h / IDEAL_HEAT) : clamp(1 - (h - IDEAL_HEAT) / 14));
    return Math.round(1000 * Math.sqrt(quality[0] * quality[1]) * this.integrity);
  }
  get total() { return Math.round(Math.sqrt(this.technique * this.art)); }
}
