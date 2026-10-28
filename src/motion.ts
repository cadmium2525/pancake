import { clamp } from './simulation';

export const angleDifference = (a: number, b: number) => ((a - b + 540) % 360) - 180;
export type OrientationSample = { beta: number; gamma: number; alpha: number | null; screen: number; time: number };
export type MotionResult = { roll: number; pitch: number; level: boolean; flip: number; spin: number };

/** Device input is normalized independently of rendering and game rules. */
export class MotionController {
  sensitivity = 1;
  handedness = 1;
  roll = 0;
  pitch = 0;
  yaw = 0;
  level = true;
  calibrated = false;
  needsCalibration = false;
  lastOrientation = -Infinity;
  private base?: OrientationSample;
  private previous?: OrientationSample;
  private flipArmed = true;
  private spinArmed = true;
  private tossArmed = true;
  private lastToss = -Infinity;
  private lastFlip = -Infinity;
  private lastSpin = -Infinity;
  private turnTime = -Infinity;
  private turnSpeed = 0;
  private gravity = { x: 0, y: 0, z: 0 };
  private hasGravity = false;
  calibrate(sample: OrientationSample) {
    this.base = { ...sample }; this.previous = { ...sample }; this.calibrated = true;
    this.needsCalibration = false; this.roll = this.pitch = this.yaw = 0; this.level = true;
    this.flipArmed = this.spinArmed = this.tossArmed = true;
    this.turnTime = -Infinity; this.turnSpeed = 0;
  }
  orientation(s: OrientationSample, airborne: boolean): MotionResult {
    this.lastOrientation = s.time;
    const result = { roll: this.roll, pitch: this.pitch, level: this.level, flip: 0, spin: 0 };
    if (!this.base || !this.previous) return result;
    if (s.screen !== this.base.screen) { this.needsCalibration = true; return result; }
    const radians = s.screen * Math.PI / 180;
    const db = angleDifference(s.beta, this.base.beta), dg = angleDifference(s.gamma, this.base.gamma);
    const roll = dg * Math.cos(radians) + db * Math.sin(radians);
    const pitch = db * Math.cos(radians) - dg * Math.sin(radians);
    const seconds = clamp((s.time - this.previous.time) / 1000, .001, .1);
    const smooth = 1 - Math.exp(-seconds * 12);
    this.roll += (roll - this.roll) * smooth;
    this.pitch += (pitch - this.pitch) * smooth;
    if(s.alpha !== null && this.base.alpha !== null) this.yaw += (angleDifference(s.alpha, this.base.alpha) - this.yaw) * smooth;
    const rate = Math.abs(angleDifference(s.beta,this.previous.beta)*Math.cos(radians)-angleDifference(s.gamma,this.previous.gamma)*Math.sin(radians))/seconds;
    if(rate>45) { this.turnTime=s.time; this.turnSpeed=rate; }
    this.previous={...s};
    // A generous neutral cone, relative to the user's comfortable grip.
    this.level = Math.hypot(this.roll, this.pitch) <= 14;
    if(Math.abs(this.pitch)<8/this.sensitivity) this.flipArmed=true;
    if(Math.abs(this.yaw)<9/this.sensitivity) this.spinArmed=true;
    if(airborne && this.flipArmed && Math.abs(this.pitch)>19/this.sensitivity && s.time-this.lastFlip>450) {
      result.flip=Math.sign(this.pitch); this.flipArmed=false; this.lastFlip=s.time;
    }
    if(airborne && this.spinArmed && Math.abs(this.yaw)>22/this.sensitivity && s.time-this.lastSpin>450) {
      result.spin=Math.sign(this.yaw)*this.handedness; this.spinArmed=false; this.lastSpin=s.time;
    }
    return {...result,roll:this.roll*this.handedness,pitch:this.pitch,level:this.level};
  }
  acceleration(a: { x: number; y: number; z: number }, includesGravity: boolean, rotationSpeed: number, time: number, cooking: boolean) {
    let force = a;
    if(includesGravity) {
      if(!this.hasGravity) { this.gravity={...a}; this.hasGravity=true; return null; }
      this.gravity.x += (a.x-this.gravity.x)*.12; this.gravity.y += (a.y-this.gravity.y)*.12; this.gravity.z += (a.z-this.gravity.z)*.12;
      force={x:a.x-this.gravity.x,y:a.y-this.gravity.y,z:a.z-this.gravity.z};
    }
    const strength=Math.hypot(force.x,force.y,force.z);
    if(strength<2.5/this.sensitivity) this.tossArmed=true;
    const wristTurn=rotationSpeed>55/this.sensitivity || (time-this.turnTime<180 && this.turnSpeed>55/this.sensitivity);
    if(cooking && this.calibrated && !this.needsCalibration && this.tossArmed && wristTurn && strength>5.5/this.sensitivity && time-this.lastToss>1000) {
      this.lastToss=time; this.tossArmed=false;
      // Do not misread the tail of the toss as an airborne flip.
      this.flipArmed=false; this.lastFlip=time;
      return clamp((strength*this.sensitivity-4)/10,.2,1);
    }
    return null;
  }
}
