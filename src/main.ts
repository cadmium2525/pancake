import './style.css';
import { Game, clamp } from './simulation';
import { Kitchen } from './render';
import { platedPancake, bakeLabel } from './plating';
import { MotionController, type OrientationSample } from './motion';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main id="game"><canvas id="scene" aria-label="フライパンとパンケーキの3Dキッチン"></canvas>
<div class="hud"><div class="top"><div><div class="brand">PANCAKE AXEL<span>THE BREAKFAST CHAMPIONSHIP</span></div><div class="scoreline"><div class="metric accent"><small>TECHNIQUE / 技術</small><strong id="tech">000</strong></div><div class="metric"><small>ARTISTRY / 芸術</small><strong id="art">000</strong></div></div></div><div class="timer" id="timer"><small>TIME LEFT</small><strong id="time">60</strong></div></div>
<div class="tools"><button class="icon" id="sound" aria-label="音をオンにする" title="サウンド">♪</button><button class="icon" id="pause" aria-label="一時停止" title="一時停止">Ⅱ</button></div>
<div class="bottom"><section class="bake"><div class="eyebrow">MAKE IT GOLDEN</div><h3>両面、こんがり。</h3><div class="heatrow active" id="row0"><span>表</span><div class="track"><i class="sweet"></i><i class="needle" id="heat0"></i></div><span id="label0">生地</span></div><div class="heatrow" id="row1"><span>裏</span><div class="track"><i class="sweet"></i><i class="needle" id="heat1"></i></div><span id="label1">生地</span></div><p>緑の枠が食べごろ。色が濃くなる前に返そう。</p></section>
<div class="actions"><p id="hint" class="hint">焼いて、飛ばして、金メダル。</p><div class="charge" id="charge"><i id="chargefill"></i></div><div class="buttonrow"><button class="primary" id="toss" disabled>長押し → トス ↑</button><button class="secondary" id="flip" hidden>縦回転 ↻</button><button class="secondary" id="spin" hidden>ひねり ⟳</button><button class="secondary" id="assist" hidden>キャッチ</button></div><div class="move"><button id="left" aria-label="フライパンを左へ">←</button><button id="right" aria-label="フライパンを右へ">→</button></div><div class="keys">SPACE：ためてトス / J：縦回転 / K：ひねり / ← →：移動</div></div>
<div class="rightnote"><span>YOUR PERSONAL BEST</span><strong id="best">—</strong><span>60 SECONDS. ONE PANCAKE.</span></div></div></div>
<div id="cutin" class="cutin" aria-live="polite"><small id="cutlabel">ON THE AIR</small><strong id="cutname"></strong><em id="cutpoints"></em></div><div id="toast" class="toast" role="status"></div>
<section class="modal" id="intro"><div class="card"><div class="label">THE BREAKFAST CHAMPIONSHIP</div><h1>PANCAKE<br><span>AXEL.</span></h1><p>焼いて、飛ばして、金メダル。<br>キッチンが、あなたの競技場になる。</p><div class="intro-points"><div><b>01</b>両面を焼く</div><div><b>02</b>空中で回す</div><div><b>03</b>おいしく着地</div></div><p>制限時間は60秒。トスは何回でも。<br>技だけでも、焼くだけでも、金メダルはとれない。</p><button class="primary" id="start">生地を注いで、スタート →</button><button class="sensor" id="sensor">スマホのモーション操作を使う</button><p class="small" id="sensorstatus">タッチだけでも遊べます。スマホは手から離さずに。</p></div></section>
<section class="modal paused" id="pausemodal" hidden><div class="card"><div class="label">TAKE A BREATHER</div><h2>ひと休み。</h2><p>時間も、焼き加減も止まっています。</p><button class="primary" id="resume">競技に戻る</button><button class="sensor" id="calibrate">モーションの水平を合わせる</button><button class="sensor" id="touchmode">タッチ操作に切り替える</button><div class="motionrow"><label for="hand">持つ手</label><select id="hand"><option value="1">右手</option><option value="-1">左手</option></select></div><div class="motionrow"><label for="sensitivity">感度</label><input id="sensitivity" type="range" min="0.5" max="2" step="0.1" value="1"></div></div></section>
<section class="modal" id="result" hidden><div class="card"><div class="label">FINAL RESULT</div><h2 id="rank">おいしい演技でした！</h2><figure class="finished-pancake"><div id="plated"></div><figcaption id="bakecaption"></figcaption><button id="turnplate" class="sensor">裏面を見る ↻</button></figure><div class="finalscore" id="total">0</div><div class="eyebrow">TOTAL SCORE / 1000</div><div class="resultgrid"><div><small>技術点</small><strong id="finaltech"></strong></div><div><small>芸術点</small><strong id="finalart"></strong></div></div><p id="review"></p><p class="small">総合点 = √（技術点 × 芸術点）<br>両面の焼き色と着地の丁寧さが、芸術点に。</p><div class="share"><button id="share">スコアを共有 ↗</button><a id="sharex" target="_blank" rel="noopener noreferrer">X に投稿</a></div><p class="small" id="sharestatus" role="status"></p><button class="primary" id="retry">もう一枚、焼こう ↻</button></div></section></main>`;
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const button = (id: string) => el<HTMLButtonElement>(id);
let game = new Game();
let kitchen: Kitchen;
let paused = false, charging = false, charge = 0, last = performance.now(), ended = false;
let muted = true, audio: AudioContext | undefined;
let toastUntil = 0, cutUntil = 0, left = false, right = false;
let motion = false, sensorPending = false, latestOrientation: OrientationSample | undefined, latestAcceleration = -Infinity;
const motionInput = new MotionController();
let best = 0;
try { best = Number(localStorage.getItem('pancake-axel-best')) || 0; } catch { /* Private mode can disable persistence. */ }
el('best').textContent = best ? best.toLocaleString() + ' pts' : '—';
try { kitchen = new Kitchen(el<HTMLCanvasElement>('scene')); }
catch { el('game').innerHTML = '<div class="loaderror"><h2>3D画面を起動できませんでした</h2><p>WebGL対応のブラウザで、ハードウェアアクセラレーションを有効にしてください。</p><button onclick="location.reload()">もう一度試す</button></div>'; throw new Error('WebGL initialization failed'); }
function tone(freq: number, duration = .13, type: OscillatorType = 'sine') {
  if (muted) return;
  try { audio ??= new AudioContext(); void audio.resume(); const osc=audio.createOscillator(), gain=audio.createGain(); osc.type=type; osc.frequency.setValueAtTime(freq,audio.currentTime); osc.frequency.exponentialRampToValueAtTime(freq*.65,audio.currentTime+duration); gain.gain.setValueAtTime(.06,audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration); osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime+duration); } catch { /* Audio is optional. */ }
}
function toast(text: string) { el('toast').textContent=text; el('toast').classList.add('show'); toastUntil=performance.now()+2300; }
function cut(name: string, detail: string, label='ON THE AIR') { toastUntil=0;el('toast').classList.remove('show');el('cutname').textContent=name; el('cutpoints').textContent=detail; el('cutlabel').textContent=label; el('cutin').classList.remove('show'); void el('cutin').offsetWidth; el('cutin').classList.add('show'); cutUntil=performance.now()+1700; }
function attachLanding() { game.onLanding = l => {
  cut(l.quality<.35?'あっ、とっと…！':l.golden?'ゴールデン ランディング':l.name, l.quality<.35?'姿勢が乱れた！ 焼き上がり −':`+${l.points} TECHNIQUE`,l.quality>=.9?'PERFECT CATCH':l.quality>=.7?'NICE CATCH':'SHAKY CATCH');
  tone(l.quality>.7?880:180,.2); if (l.quality>.9 && motion) navigator.vibrate?.(20);
}; }
attachLanding();
function start() { game=new Game(); game.motionControlled=motion; if(motion&&latestOrientation)motionInput.calibrate(latestOrientation);attachLanding(); ended=false; paused=false; charging=false; charge=0; left=right=false; game.start(); el('intro').hidden=true; el('result').hidden=true; tone(440); toast('とろ〜り、生地を注いでいます'); }
button('start').onclick=start; button('retry').onclick=start;
button('assist').onclick=()=>{if(!paused){game.assist();toast('キャッチをアシスト！');}};
button('touchmode').onclick=()=>{disableMotion();toast('タッチ操作に切り替えました');};
el<HTMLSelectElement>('hand').onchange=e=>{motionInput.handedness=Number((e.target as HTMLSelectElement).value);};
function beginCharge() { if (paused || game.phase!=='cook') return; charging=true; charge=0; }
function releaseCharge() { if (!charging) return; charging=false; if (!paused && game.launch(charge)) { tone(560,.2); toast('空中で回転！ 着地前にフライパンを合わせよう'); } charge=0; }
button('toss').onpointerdown=e=>{ e.preventDefault(); button('toss').setPointerCapture(e.pointerId); beginCharge(); };
button('toss').onpointerup=releaseCharge;
button('toss').onpointercancel=()=>{ charging=false; charge=0; };
function flip(direction=1) { if(paused || game.phase!=='air')return; const before=game.extraTarget; game.flip(direction); if(game.extraTarget===before)return; const turns=Math.abs(game.extraTarget)/(Math.PI*2); cut(turns>=3?'トリプル アクセル':turns>=2?'ダブル フリップ':'シングル フリップ',`${turns+.5} ROTATIONS`); tone(650+turns*80); }
function spin(direction=1) { if(paused || game.phase!=='air')return; const before=game.twistTarget; game.spin(direction); if(before===game.twistTarget)return; cut(Math.abs(game.extraTarget)>0?'トルネード フリップ':'スピン！',direction<0?'左ひねり！':'右ひねり！'); tone(730); }
button('flip').onclick=()=>flip(); button('spin').onclick=()=>spin();
for (const id of ['left','right']) { button(id).onpointerdown=e=>{ e.preventDefault(); button(id).setPointerCapture(e.pointerId); if(id==='left')left=true;else right=true; }; button(id).onpointerup=button(id).onpointercancel=()=>{if(id==='left')left=false;else right=false;}; }
function setPause(value: boolean) { if(game.phase==='ready'||game.phase==='finished')return; paused=value; charging=false; charge=0; left=right=false; el('pausemodal').hidden=!value; }
button('pause').onclick=()=>setPause(!paused); button('resume').onclick=()=>setPause(false);
button('sound').onclick=()=>{ muted=!muted; button('sound').textContent=muted?'♪':'♫'; button('sound').setAttribute('aria-label',muted?'音をオンにする':'音をオフにする'); tone(550); };
window.addEventListener('keydown',e=>{ if((e.target as HTMLElement).matches('input') || game.phase==='ready' || game.phase==='finished')return; if(['Space','ArrowLeft','ArrowRight','KeyJ','KeyK','Escape'].includes(e.code))e.preventDefault(); if(e.repeat)return; if(e.code==='Escape')setPause(!paused); if(e.code==='Space')beginCharge(); if(e.code==='KeyJ')flip(); if(e.code==='KeyK')spin(); if(e.code==='ArrowLeft')left=true; if(e.code==='ArrowRight')right=true; });
window.addEventListener('keyup',e=>{ if(e.code==='Space')releaseCharge(); if(e.code==='ArrowLeft')left=false; if(e.code==='ArrowRight')right=false; });
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPause(true);});
window.addEventListener('blur',()=>setPause(true));
el('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();setPause(true);toast('描画を復旧中です');});
el('scene').addEventListener('webglcontextrestored',()=>toast('描画が戻りました。競技を再開できます'));
let dragging=false;
el('scene').onpointerdown=e=>{dragging=true;el('scene').setPointerCapture(e.pointerId);};
el('scene').onpointermove=e=>{if(dragging&&!paused)game.panTarget=clamp((e.clientX/innerWidth-.5)*4,-1.4,1.4);};
el('scene').onpointerup=el('scene').onpointercancel=()=>{dragging=false;};
type PermissionEvent = { requestPermission?: () => Promise<string> };
button('sensor').onclick=async()=>{
  try {
    if(sensorPending)return;
    if(!window.DeviceOrientationEvent || !window.DeviceMotionEvent)throw new Error('unsupported');
    sensorPending=true;button('sensor').disabled=true;el('sensorstatus').textContent='スマホを楽な角度で持ってください。センサーを確認中…';
    const orientation=DeviceOrientationEvent as unknown as PermissionEvent, movement=DeviceMotionEvent as unknown as PermissionEvent;
    const asks=[orientation.requestPermission?.(),movement.requestPermission?.()].filter(Boolean);
    const result=await Promise.all(asks); if(result.some(v=>v!=='granted'))throw new Error('denied');
    const started=performance.now();
    await new Promise<void>((resolve,reject)=>{const check=()=>{if(latestOrientation&&performance.now()-latestOrientation.time<800&&performance.now()-latestAcceleration<800)resolve();else if(performance.now()-started>3000)reject(new Error('no sensor data'));else setTimeout(check,100);};check();});
    motion=true; game.motionControlled=true; motionInput.calibrate(latestOrientation!);
    el('sensorstatus').textContent='傾けて移動、手首を返してトス、ひねって回転、水平に戻してキャッチ。';
    button('sensor').textContent='モーション ON ・水平を再校正'; toast('今の持ち方を水平に設定しました');
  } catch { disableMotion(); el('sensorstatus').textContent='センサーを利用できません。タッチ操作で遊べます。'; }
  finally {sensorPending=false;button('sensor').disabled=false;}
};
function disableMotion(){motion=false;game.motionControlled=false;game.panRoll=game.panPitch=0;button('sensor').textContent='スマホのモーション操作を使う';}
button('calibrate').onclick=()=>{if(!motion||!latestOrientation){toast('現在はタッチ操作です');return;}motionInput.calibrate(latestOrientation);toast('この持ち方を水平に設定しました');};
el<HTMLInputElement>('sensitivity').oninput=e=>{motionInput.sensitivity=Number((e.target as HTMLInputElement).value);};
window.addEventListener('deviceorientation',e=>{
  if(e.beta===null||e.gamma===null)return;
  latestOrientation={beta:e.beta,gamma:e.gamma,alpha:e.alpha,screen:screen.orientation?.angle??Number((window as unknown as {orientation?:number}).orientation??0),time:performance.now()};
  if(!motion)return;
  const input=motionInput.orientation(latestOrientation,!paused&&game.phase==='air');
  if(motionInput.needsCalibration&&!paused){setPause(true);toast('画面の向きが変わりました。水平を合わせ直してください');return;}
  if(paused)return;
  game.panRoll=input.roll;game.panPitch=input.pitch;
  // Returning to neutral engages a modest catch assist; leaning still moves the pan.
  if(game.phase==='air'&&input.level)game.panTarget=game.cakeX;
  else game.panTarget=clamp(input.roll/22*motionInput.sensitivity,-1.4,1.4);
  if(input.flip)flip(input.flip);if(input.spin)spin(input.spin);
});
window.addEventListener('devicemotion',e=>{
  const raw=e.acceleration;
  const hasAcceleration=raw&&[raw.x,raw.y,raw.z].every(v=>v!==null&&Number.isFinite(v));
  const a=hasAcceleration?raw:e.accelerationIncludingGravity;
  if(!a||[a.x,a.y,a.z].some(v=>v===null||!Number.isFinite(v)))return;
  latestAcceleration=performance.now();if(!motion||paused)return;
  const rate=e.rotationRate;const speed=rate?Math.hypot(rate.beta??0,rate.gamma??0):0;
  const power=motionInput.acceleration({x:a.x!,y:a.y!,z:a.z!},!hasAcceleration,speed,latestAcceleration,game.phase==='cook');
  if(power!==null&&game.launch(power))tone(560,.2);
});
let platedSide=0;
function showPlate(){el('plated').innerHTML=platedPancake(game.heat[platedSide],game.integrity,platedSide);el('bakecaption').textContent=(platedSide===0?'表':'裏')+'：'+bakeLabel(game.heat[platedSide]);button('turnplate').textContent=(platedSide===0?'裏面':'表面')+'を見る ↻';}
button('turnplate').onclick=()=>{platedSide=1-platedSide;showPlate();};
function finish() {
  platedSide=0;showPlate();
  ended=true; charging=false; charge=0; el('cutin').classList.remove('show'); el('result').hidden=false;
  el('total').textContent=String(game.total); el('finaltech').textContent=String(game.technique);el('finalart').textContent=String(game.art);
  el('rank').textContent=game.total>=800?'金メダルの朝ごはん！':game.total>=600?'見事なパンケーキ演技！':game.total>=350?'おいしさ、上昇中。':'次の一枚で、リベンジ！';
  el('review').textContent=game.art<350?'焼き加減が惜しい！ 両面のメーターを緑の枠に近づけよう。':game.technique<400?'いい焼き色！ 次は空中で縦回転やひねりに挑戦。':`${game.launches}回のトス、${game.catches}回の安定着地。いい香りの演技でした。`;
  if(game.total>best){best=game.total;try{localStorage.setItem('pancake-axel-best',String(best));}catch{}el('best').textContent=best+' pts';}
  const text=shareText(); el<HTMLAnchorElement>('sharex').href=`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(publicUrl())}`;
  el('sharestatus').textContent='';tone(1046,.4);
}
function publicUrl(){return location.href.split('?')[0].split('#')[0];}
function shareText(){return `PANCAKE AXEL で ${game.total}点！ 技術 ${game.technique} / 芸術 ${game.art} 🥞 #PANCAKEAXEL`;}
button('share').onclick=async()=>{try{if(navigator.share){await navigator.share({title:'PANCAKE AXEL',text:shareText(),url:publicUrl()});el('sharestatus').textContent='共有しました';}else{await navigator.clipboard.writeText(`${shareText()}\n${publicUrl()}`);el('sharestatus').textContent='スコアとURLをコピーしました';}}catch(e){el('sharestatus').textContent=(e as Error).name==='AbortError'?'共有をキャンセルしました':'コピーできませんでした。「X に投稿」から共有できます。';}};
function frame(now: number){
  const dt=Math.min((now-last)/1000,.05);last=now;
  if(!paused){if(charging)charge=clamp(charge+dt/.9);if(left||right)game.panTarget=clamp(game.panTarget+((right?1:0)-(left?1:0))*dt*1.8,-1.4,1.4);game.step(dt);}
  if(motion&&!paused&&latestOrientation&&now-latestOrientation.time>2500){disableMotion();toast('センサーが途切れました。タッチ操作に切り替えました');}
  kitchen.update(game,paused?0:dt,charge);
  el('tech').textContent=String(game.technique).padStart(3,'0');el('art').textContent=String(game.art).padStart(3,'0');el('time').textContent=String(Math.ceil(game.remaining)).padStart(2,'0');el('timer').classList.toggle('urgent',game.remaining<=10);
  game.heat.forEach((h,i)=>{el('heat'+i).style.left=`${clamp(h/36)*100}%`;el('label'+i).textContent=h<5?'生地':h<17?'焼き中':h<=23?'食べ頃':h<29?'焼きすぎ':'焦げ';el('row'+i).classList.toggle('active',game.side===i);});
  const air=game.phase==='air';button('toss').hidden=air;button('toss').disabled=game.phase!=='cook'||paused;button('flip').hidden=button('spin').hidden=button('assist').hidden=!air;
  el('charge').classList.toggle('visible',charging);el('chargefill').style.width=charge*100+'%';
  el('hint').textContent=game.phase==='pour'?'とろ〜り。おいしい演技のはじまり。':air?(game.airTime/game.duration>.73?(motion?(motionInput.level?'水平 OK！ そのままキャッチ':'水平に戻してキャッチ！'):'着地！ 中央へ合わせるかキャッチをタップ'):'回転を追加して、大技を決めよう！'):game.phase==='cook'?(game.heat[game.side]>23?'焦げちゃう！ 今すぐひっくり返そう':game.heat[game.side]<3?'まずは生地を落ち着かせよう':'長押しでためて、離してトス！'):'焼いて、飛ばして、金メダル。';
  if(now>toastUntil)el('toast').classList.remove('show');if(now>cutUntil)el('cutin').classList.remove('show');
  if(game.phase==='finished'&&!ended)finish();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);



