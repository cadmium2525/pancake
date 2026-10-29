import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/simulation';
import { runStrategy } from './strategy-runner';
const advance=(g:Game,seconds:number)=>{for(let t=0;t<seconds;t+=.01)g.step(Math.min(.01,seconds-t));};
test('round begins with pouring and timer only starts after pouring',()=>{const g=new Game();g.start();advance(g,2);assert.equal(g.phase,'pour');assert.equal(g.remaining,60);advance(g,.7);assert.equal(g.phase,'cook');});
test('only touching face heats; no heat accumulates in flight',()=>{const g=new Game();g.phase='cook';advance(g,8);const heat=[...g.heat];g.launch(1);advance(g,1);assert.deepEqual(g.heat,heat);advance(g,2.3);assert.equal(g.side,1);advance(g,3);assert.ok(g.heat[1]>2.9);});
test('balanced cooking and technique beats raw trick spam',()=>{const balanced=new Game();balanced.heat=[20,20];balanced.technique=650;const spam=new Game();spam.heat=[3,3];spam.technique=1000;assert.ok(balanced.total>spam.total*2);assert.equal(balanced.art,1000);});
test('one raw face or charred face cannot give a winning art score',()=>{const g=new Game();g.technique=1000;g.heat=[20,0];assert.equal(g.total,0);g.heat=[20,38];assert.equal(g.art,0);});
test('repeated tricks yield diminishing returns and misses award no points',()=>{const g=new Game();g.phase='cook';g.heat=[10,10];g.launch(.5);advance(g,3);const first=g.technique;g.launch(.5);advance(g,3);assert.ok(g.technique-first<first);const before=g.technique;g.launch(.5);g.panTarget=-1.4;g.cakeX=1.4;advance(g,3);assert.equal(g.technique,before);});
test('time expires during flight without awarding an unfinished trick',()=>{const g=new Game();g.phase='cook';g.remaining=.5;g.launch(1);advance(g,1);assert.equal(g.phase,'finished');assert.equal(g.remaining,0);assert.equal(g.technique,0);assert.ok(g.integrity<1);});
test('a complete balanced round with centered catches can reach gold',()=>{const g=runStrategy(9,.2);assert.equal(g.phase,'finished');assert.ok(g.technique>1200);assert.ok(g.art>=900);assert.ok(g.total>=1200);assert.equal(g.medal,'gold');});

test('successful landings keep adding points beyond 1000 and total can exceed 1000',()=>{
  const g=new Game();g.phase='cook';g.heat=[20,20];g.technique=990;
  const land=()=>{g.launch(.5,.6);for(let t=0;t<2.65;t+=.01){g.panTarget=g.cakeX;g.step(.01);}};
  land();assert.ok(g.technique>1000);assert.ok(g.total>1000);
  const before=g.technique;land();assert.ok(g.technique>before);assert.ok(g.total>1000);
});

test('removing the cap still makes baking quality matter above 1000',()=>{
  const golden=new Game();golden.technique=2500;golden.heat=[20,20];
  const raw=new Game();raw.technique=2500;raw.heat=[3,3];
  assert.ok(golden.total>1000);assert.ok(golden.total>raw.total*2);
});

test('an enormous technique score cannot award gold to raw or burnt pancakes',()=>{
  const g=new Game();g.technique=100000;
  for(const heat of [[10,10],[10,20],[25,25],[20,29]]){g.heat=heat;assert.notEqual(g.medal,'gold');}
});
