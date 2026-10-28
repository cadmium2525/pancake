import { clamp } from './simulation';

/** A fresh, code-drawn illustration of the actual bake, with no external assets. */
export function platedPancake(heat: number, integrity: number, side: number): string {
  const damage = 1 - clamp(integrity);
  const raw = heat < 8;
  const colors = heat < 8 ? ['#fff2c0','#eacb82','#fff7dc'] : heat < 17 ? ['#f4cf7c','#c58a3b','#ffe6a2'] : heat <= 23 ? ['#e3a448','#a95b24','#ffd980'] : heat < 29 ? ['#a9652e','#63351e','#d58a3d'] : ['#53372b','#291c19','#866044'];
  let seed=41;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  const outline=(dy=0)=> Array.from({length:80},(_,i)=>{
    const a=i/80*Math.PI*2;
    const radius=1 + Math.sin(a*5+.7)*(.008+damage*.06)+Math.cos(a*9)*damage*.025;
    return `${i?'L':'M'}${(210+Math.cos(a)*126*radius).toFixed(2)},${(130+dy+Math.sin(a)*73*radius).toFixed(2)}`;
  }).join(' ')+'Z';
  let pores='';
  for(let i=0;i<180;i++){
    const a=random()*Math.PI*2,r=Math.sqrt(random())*.94;
    pores+=`<ellipse cx="${210+Math.cos(a)*122*r}" cy="${130+Math.sin(a)*69*r}" rx="${.6+random()*2}" ry="${.4+random()*1.1}" fill="${i%3===0?colors[2]:colors[1]}" opacity="${.13+random()*.22}"/>`;
  }
  const cracks=damage>.12?`<path d="M 108 93 l 24 16 -9 10 26 10 M 301 169 l -24 -13 6 -12 -22 -9" stroke="${colors[1]}" stroke-width="${1+damage*5}" stroke-linecap="round" fill="none" opacity=".65"/>`:'';
  const crumbs=damage>.3?`<g fill="${colors[1]}"><ellipse cx="73" cy="166" rx="5" ry="3"/><ellipse cx="332" cy="181" rx="7" ry="4"/><ellipse cx="321" cy="193" rx="3" ry="2"/></g>`:'';
  return `<svg viewBox="0 0 420 270" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${side===0?'表':'裏'}面：${bakeLabel(heat)}のパンケーキ${damage>.3?'。形が少し崩れています':''}">
  <defs><linearGradient id="plate" x2="0" y2="1"><stop stop-color="#fffefa"/><stop offset="1" stop-color="#e4e9dc"/></linearGradient><radialGradient id="bake"><stop stop-color="${colors[0]}"/><stop offset=".78" stop-color="${colors[0]}"/><stop offset=".94" stop-color="${colors[2]}"/><stop offset="1" stop-color="${colors[1]}"/></radialGradient><clipPath id="cakeclip"><path d="${outline()}"/></clipPath></defs>
  <ellipse cx="212" cy="218" rx="153" ry="23" fill="#9b7651" opacity=".12"/>
  <ellipse cx="210" cy="158" rx="180" ry="98" fill="#c5d5c9"/>
  <ellipse cx="210" cy="151" rx="180" ry="98" fill="url(#plate)"/>
  <ellipse cx="210" cy="151" rx="161" ry="83" fill="none" stroke="#99b7a6" stroke-width="3"/>
  <ellipse cx="210" cy="153" rx="144" ry="74" fill="#f0ecdd"/>
  <ellipse cx="213" cy="167" rx="128" ry="66" fill="#8a612f" opacity=".13"/>
  <path d="${outline(raw?6:17)}" fill="${colors[1]}"/>
  <path d="${outline(raw?3:11)}" fill="${colors[2]}"/>
  <path d="${outline()}" fill="url(#bake)"/>
  <g clip-path="url(#cakeclip)">${pores}${cracks}</g>${crumbs}
  ${heat>=8&&heat<29?'<path d="M190 115 l28 -7 18 13 -28 8Z" fill="#b78028" opacity=".22"/><path d="M190 104 l28 -7 18 13 v10 l-28 8 -18 -14Z" fill="#edbd4a"/><path d="M190 104 l28 -7 18 13 -28 8Z" fill="#ffe895"/>':''}
  <path d="M 170 52 q -8 -12 0 -22 M 211 45 q -8 -12 0 -22 M 252 52 q -8 -12 0 -22" fill="none" stroke="#bc9b70" opacity="${heat>8&&heat<29?'.32':'0'}" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}
export function bakeLabel(heat: number) { return heat<8?'まだとろとろ':heat<17?'ほんのりきつね色':heat<=23?'こんがり黄金色':heat<29?'ちょっぴり焼きすぎ':'こんがり…焦げちゃった'; }
