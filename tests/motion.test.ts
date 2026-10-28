import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MotionController, angleDifference, wristRates} from '../src/motion';
import {Game} from '../src/simulation';
const neutral={beta:40,gamma:0,alpha:180,screen:0,time:0};
test('comfortable grip and noise stay neutral without airborne trick commands',()=>{const m=new MotionController();m.calibrate(neutral);const r=m.orientation({...neutral,beta:41,gamma:1,time:20});assert.equal(r.level,true);assert.equal('flip' in r,false);assert.equal('spin' in r,false);});
test('wrapped compass readings stay continuous',()=>assert.equal(angleDifference(2,358),4));
test('acceleration requires pitch and cooldown, and cannot launch in air',()=>{
  const m=new MotionController();m.calibrate(neutral);const a={x:0,y:8,z:0};
  const pitch=wristRates({alpha:-150,beta:0,gamma:90},0);
  assert.equal(m.acceleration(a,false,100,true,{pitch:0,twist:0}),null);
  const toss=m.acceleration(a,false,200,true,pitch)!;assert.ok(toss.power>0);assert.ok(toss.rotation<0);assert.ok(toss.twist>0);
  assert.equal(m.acceleration(a,false,300,true,pitch),null);
  assert.equal(m.acceleration(a,false,1500,true,pitch),null);
  m.acceleration({x:0,y:0,z:0},false,1600,true,pitch);
  assert.ok(m.acceleration(a,false,1700,true,pitch));
  assert.equal(m.acceleration(a,false,3000,false,pitch),null);
});
test('constant gravity never triggers a toss',()=>{const m=new MotionController();m.calibrate(neutral);for(let t=0;t<1000;t+=20)assert.equal(m.acceleration({x:0,y:0,z:9.81},true,t,true,{pitch:90,twist:0}),null);});
test('landscape coordinates and recalibration',()=>{const m=new MotionController();m.calibrate({...neutral,screen:90});let r;for(let time=20;time<500;time+=20)r=m.orientation({...neutral,screen:90,beta:60,time});assert.ok(r!.roll>19);assert.ok(Math.abs(r!.pitch)<.1);m.orientation({...neutral,time:600});assert.equal(m.needsCalibration,true);m.calibrate(neutral);assert.equal(m.needsCalibration,false);});
test('trick and direction are locked at takeoff, and rotation continues through the flight',()=>{const g=new Game();g.phase='cook';g.heat=[10,10];assert.ok(g.launch(1,-1,-1));assert.equal(g.trickName,'トルネード フリップ');const target=g.extraTarget;g.step(.8);const angle=g.angle;assert.equal(g.launch(0,0,0),false);assert.equal(g.extraTarget,target);g.panTarget=1;g.step(.8);assert.ok(g.angle<angle);assert.equal('flip' in g,false);assert.equal('spin' in g,false);assert.equal('assist' in g,false);});
test('launch strength determines half, single, double and triple flips',()=>{for(const [rotation,name] of [[0,'ハーフ フリップ'],[.3,'シングル フリップ'],[.6,'ダブル フリップ'],[1,'トリプル アクセル']] as const){const g=new Game();g.phase='cook';g.launch(.5,rotation);assert.equal(g.trickName,name);}});
test('neutral catches outperform tilted ones, without a catch button',()=>{function land(tilt:number){const g=new Game();g.phase='cook';g.heat=[10,10];g.motionControlled=true;g.launch(0);g.panRoll=tilt;let q=0;g.onLanding=l=>q=l.quality;for(let t=0;t<2.2;t+=.01){g.panTarget=g.cakeX;g.step(.01);}return q;}assert.ok(land(0)>land(40)+.4);});

// Regression: the previous adapter read portrait roll (beta) as pitch and
// allowed combined-axis speed to turn a sideways shake into a high flip.
test('portrait forward wrist flip uses alpha; lateral beta and twist gamma cannot toss',()=>{
  for(const rate of [{alpha:0,beta:400,gamma:0},{alpha:0,beta:0,gamma:400}]){
    const m=new MotionController();m.calibrate(neutral);
    assert.equal(m.acceleration({x:0,y:9,z:0},false,100,true,wristRates(rate,0)),null);
  }
  const m=new MotionController();m.calibrate(neutral);
  const toss=m.acceleration({x:0,y:9,z:0},false,100,true,wristRates({alpha:200,beta:0,gamma:0},0))!;
  assert.ok(toss);assert.ok(toss.rotation>.8);assert.equal(toss.twist,0);
});
test('adding lateral motion cannot increase vertical flip count or height',()=>{
  const toss=(lateral:number)=>{const m=new MotionController();m.calibrate(neutral);return m.acceleration({x:lateral,y:8,z:0},false,100,true,wristRates({alpha:100,beta:lateral*10,gamma:0},0))!;};
  assert.deepEqual(toss(0),toss(100));
  const m=new MotionController();m.calibrate(neutral);
  assert.equal(m.acceleration({x:20,y:0,z:0},false,100,true,{pitch:200,twist:0}),null);
});
test('twist changes combination direction without adding vertical turns',()=>{
  const toss=(gamma:number)=>{const m=new MotionController();m.calibrate(neutral);return m.acceleration({x:0,y:8,z:0},false,100,true,wristRates({alpha:150,beta:0,gamma},0))!;};
  assert.equal(toss(0).rotation,toss(200).rotation);
  assert.ok(toss(-100).twist<0);assert.ok(toss(100).twist>0);
});
test('forward flip is equivalent in portrait, landscape and upside down screens',()=>{
  const results=[0,90,180,270].map(screen=>{
    const r=screen*Math.PI/180;
    const m=new MotionController();m.calibrate({...neutral,screen});
    const rate=wristRates({alpha:150*Math.cos(r),beta:-150*Math.sin(r),gamma:90},screen);
    return m.acceleration({x:-8*Math.sin(r),y:8*Math.cos(r),z:0},false,100,true,rate)!;
  });
  for(const toss of results){assert.ok(toss);assert.ok(Math.abs(toss.rotation-results[0].rotation)<1e-8);assert.ok(Math.abs(toss.power-results[0].power)<1e-8);}
});
test('real zero pitch does not reuse an earlier orientation flip',()=>{
  const m=new MotionController();m.calibrate(neutral);
  m.orientation({...neutral,beta:60,time:100});
  assert.equal(m.acceleration({x:0,y:8,z:0},false,110,true,wristRates({alpha:0,beta:400,gamma:0},0)),null);
});
test('missing pitch sensor falls back to fresh orientation pitch only',()=>{
  const m=new MotionController();m.calibrate(neutral);
  m.orientation({...neutral,beta:50,time:100});
  assert.ok(m.acceleration({x:0,y:8,z:0},false,110,true,wristRates(null,0)));
  const side=new MotionController();side.calibrate(neutral);
  side.orientation({...neutral,gamma:40,time:100});
  assert.equal(side.acceleration({x:0,y:8,z:0},false,110,true,wristRates(null,0)),null);
});
