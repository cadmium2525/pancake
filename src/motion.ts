import { clamp } from './simulation';

export const angleDifference = (a: number, b: number) => ((a - b + 540) % 360) - 180;
export type OrientationSample = { beta: number; gamma: number; alpha: number | null; screen: number; time: number };
export type MotionResult = { roll: number; pitch: number; level: boolean };
export type Toss = { power: number; rotation: number; twist: number };

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
  private tossArmed = true;
  private lastToss = -Infinity;
  private turnTime = -Infinity;
  private turnSpeed = 0;
  private signedTurn = 0;
  private twistSpeed = 0;
  private gravity = { x: 0, y: 0, z: 0 };
  private hasGravity = false;
  calibrate(sample: OrientationSample) {
    this.base = { ...sample }; this.previous = { ...sample }; this.calibrated = true;
    this.needsCalibration = false; this.roll = this.pitch = this.yaw = 0; this.level = true;
    this.tossArmed = true;
    this.turnTime = -Infinity; this.turnSpeed = this.signedTurn = this.twistSpeed = 0;
  }
  orientation(s: OrientationSample): MotionResult {
    this.lastOrientation = s.time;
    const result = { roll: this.roll, pitch: this.pitch, level: this.level };
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
    this.signedTurn = (angleDifference(s.beta,this.previous.beta)*Math.cos(radians)-angleDifference(s.gamma,this.previous.gamma)*Math.sin(radians))/seconds;
    this.twistSpeed = s.alpha!==null && this.previous.alpha!==null ? angleDifference(s.alpha,this.previous.alpha)/seconds : 0;
    const rate = Math.abs(this.signedTurn);
    if(rate>45) { this.turnTime=s.time; this.turnSpeed=rate; }
    this.previous={...s};
    // A generous neutral cone, relative to the user's comfortable grip.
    this.level = Math.hypot(this.roll, this.pitch) <= 14;
    return {...result,roll:this.roll*this.handedness,pitch:this.pitch,level:this.level};
  }
  acceleration(a: { x: number; y: number; z: number }, includesGravity: boolean, rotationSpeed: number, time: number, cooking: boolean, twistRate = 0, signedRate = rotationSpeed): Toss | null {
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
      const recent = time-this.lastOrientation < 180;
      const turn = Math.abs(signedRate)>1 ? signedRate : recent ? this.signedTurn : rotationSpeed;
      const twist = Math.abs(twistRate)>1 ? twistRate : recent ? this.twistSpeed : 0;
      return {power:clamp((strength*this.sensitivity-4)/10,.2,1),rotation:clamp(turn*this.sensitivity/240,-1,1),twist:clamp(twist*this.sensitivity/180,-1,1)*this.handedness};
    }
    return null;
  }
}
