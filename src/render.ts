import * as THREE from 'three';
import { Game, clamp } from './simulation';

const mat = (color: string, roughness = .65, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
export class Kitchen {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, .1, 70);
  pan = new THREE.Group();
  cake = new THREE.Group();
  jug = new THREE.Group();
  stream: THREE.Mesh;
  top: THREE.MeshStandardMaterial;
  bottom: THREE.MeshStandardMaterial;
  target = new THREE.Vector3(0, .7, 0);
  clock = 0;
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  steam: THREE.Mesh[] = [];
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.setClearColor('#f7edce');
    this.scene.fog = new THREE.Fog('#f7edce', 16, 35);
    this.scene.add(new THREE.HemisphereLight('#fff8e6', '#bfb99c', 3));
    const sun = new THREE.DirectionalLight('#fff6dc', 4.2);
    sun.position.set(-3, 9, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -9; sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9; sun.shadow.normalBias = .035;
    this.scene.add(sun);
    this.box(0, -.75, 0, 30, .35, 24, '#f2dfb7').receiveShadow = true;
    // Handmade tiled kitchen, with warm grout and mint cabinetry.
    for (let x = -9; x <= 9; x++) for (let y = 0; y < 5; y++)
      this.box(x * 1.1, y * 1.1 - .15, -4.6, 1.07, 1.07, .13, (x + y) % 4 === 0 ? '#d6e5d2' : '#edf0da');
    this.box(0, -.5, -3.4, 18, .3, 2.2, '#fff7e0');
    this.box(0, -1.6, -3.5, 18, 2, 2, '#78afa0');
    const stove = this.box(0, -.46, .2, 3.9, .26, 3.4, '#faf6e9'); stove.receiveShadow = true;
    this.cylinder(0, -.29, 0, 1.45, .12, '#c4c7b7');
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, .08, 12, 64), mat('#db8e4d'));
    ring.rotation.x = Math.PI / 2; ring.position.y = -.17; this.scene.add(ring);
    this.scene.add(this.pan);
    this.pan.rotation.y = -.6;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.3, .24, 64), mat('#333e43', .4, .35));
    bowl.position.y = .02; bowl.castShadow = bowl.receiveShadow = true; this.pan.add(bowl);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.42, .075, 12, 80), mat('#657476', .25, .65));
    rim.rotation.x = Math.PI / 2; rim.position.y = .16; this.pan.add(rim);
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(.16, 1.7, 6, 16), mat('#bd6544'));
    handle.rotation.x = Math.PI / 2; handle.position.set(.08, .06, 2.14); handle.castShadow = true; this.pan.add(handle);
    this.top = mat('#fff2bb'); this.bottom = mat('#fff2bb');
    const texture = this.pancakeTexture(); this.top.map = this.bottom.map = texture;
    const bread = new THREE.Mesh(new THREE.CylinderGeometry(.92, .94, .19, 80, 1), [mat('#f5cd81'), this.top, this.bottom]);
    bread.castShadow = bread.receiveShadow = true; this.cake.add(bread); this.scene.add(this.cake);
    // Small air bubbles on the edge, deterministic and texture-free assets.
    for (let i = 0; i < 36; i++) {
      const a = i * 2.399; const crumb = new THREE.Mesh(new THREE.SphereGeometry(.016 + (i % 3) * .005, 5, 4), mat('#c99353'));
      crumb.position.set(Math.cos(a) * .935, (i % 4 - 1.5) * .035, Math.sin(a) * .935); this.cake.add(crumb);
    }
    this.scene.add(this.jug);
    const jugBody = new THREE.Mesh(new THREE.CylinderGeometry(.4, .3, .65, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#b5d9d4', side: THREE.DoubleSide, roughness: .3 }));
    this.jug.add(jugBody);
    const batter = new THREE.Mesh(new THREE.CircleGeometry(.36, 32), mat('#fff0b7')); batter.rotation.x = -Math.PI / 2; batter.position.y = .17; this.jug.add(batter);
    this.stream = new THREE.Mesh(new THREE.CylinderGeometry(.055, .1, 1.1, 14), mat('#ffedb3')); this.scene.add(this.stream);
    // Counter props frame the playing field instead of competing with it.
    this.cylinder(-3.4, -.27, -.7, .8, .1, '#fffaf0');
    for (let i = 0; i < 3; i++) this.cylinder(-3.4, -.15 + i * .15, -.7, .56, .15, '#dca25a');
    const butter = this.box(-3.4, .31, -.7, .24, .09, .23, '#ffe482'); butter.rotation.y = .3;
    this.cylinder(3.2, -.12, -1.8, .4, .9, '#d08a41');
    this.cylinder(3.2, .38, -1.8, .24, .16, '#fff1ce');
    this.box(3.2, -.1, -1.37, .5, .35, .03, '#faf2d4');
    this.cylinder(-3.3, -.05, -3.5, .38, .8, '#c58b68');
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 8), mat('#6c9a64'));
      leaf.scale.set(.5, 2.5, 1); leaf.position.set(-3.3 + Math.sin(i) * .22, .6, -3.5 + Math.cos(i) * .2); leaf.rotation.z = Math.sin(i) * .6; this.scene.add(leaf);
    }
    for (let i = 0; i < 12; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#fffdf0', transparent: true, opacity: .3, depthWrite: false }));
      this.scene.add(puff); this.steam.push(puff);
    }
    this.camera.position.set(0, 6.5, 9.5);
    this.resize(); window.addEventListener('resize', () => this.resize());
  }
  box(x: number,y: number,z: number,w: number,h: number,d: number,color: string) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat(color)); mesh.position.set(x,y,z); mesh.castShadow = true; this.scene.add(mesh); return mesh;
  }
  cylinder(x: number,y: number,z: number,r: number,h: number,color: string) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,48),mat(color)); m.position.set(x,y,z); m.castShadow = m.receiveShadow = true; this.scene.add(m); return m;
  }
  pancakeTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 512; const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff1d0'; ctx.fillRect(0,0,512,512);
    let seed = 231; const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 4800; i++) { const x = random()*512, y=random()*512; ctx.fillStyle = `rgba(123,70,25,${random()*.14})`; ctx.beginPath(); ctx.arc(x,y,random()*4+.6,0,Math.PI*2); ctx.fill(); }
    const gradient=ctx.createRadialGradient(256,256,130,256,256,257); gradient.addColorStop(0,'#ffffff00'); gradient.addColorStop(.83,'#fff6d226'); gradient.addColorStop(1,'#fff3c9'); ctx.fillStyle=gradient; ctx.fillRect(0,0,512,512);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; return texture;
  }
  resize() { const w=innerWidth,h=innerHeight; this.renderer.setSize(w,h); this.camera.aspect=w/h; this.camera.updateProjectionMatrix(); }
  update(g: Game, dt: number, charge: number) {
    this.clock += dt;
    this.pan.position.x = g.panX;
    this.pan.rotation.z = g.motionControlled ? -clamp(g.panRoll/90,-.3,.3) : -(g.panTarget-g.panX)*.1;
    this.pan.rotation.x = -charge * .14 + (g.motionControlled ? clamp(g.panPitch/90,-.2,.2) : 0);
    const pouring = g.phase === 'pour';
    this.jug.visible = this.stream.visible = pouring && g.pour < 2.1;
    this.jug.position.set(-.4, 2.1, 0); this.jug.rotation.z = -.85;
    this.stream.position.set(-.08, .95, 0); this.stream.scale.y = .9 + Math.sin(g.pour*10)*.07;
    this.cake.visible = g.phase !== 'ready';
    const spread= pouring ? clamp(g.pour / 1.9, .02, 1) : 1;
    this.cake.scale.set(Math.sqrt(spread), pouring ? .25 + spread*.75 : 1, Math.sqrt(spread));
    this.cake.position.set(g.cakeX,.28 + g.height,0);
    this.cake.rotation.set(g.angle,g.twist,0,'XYZ');
    const color = (heat: number) => new THREE.Color('#fff1b9').lerp(new THREE.Color('#bd661f'),clamp(heat/22)).lerp(new THREE.Color('#35201c'),clamp((heat-24)/14));
    // Material 1 is the initially upward face, material 2 the initially heated face.
    this.top.color.copy(color(g.heat[1])); this.bottom.color.copy(color(g.heat[0]));
    const p = g.airTime/g.duration;
    const focus = g.phase === 'air' && !this.reduced ? Math.sin(clamp(p/.78)*Math.PI) : 0;
    const portrait = this.camera.aspect < .8;
    const cameraGoal = new THREE.Vector3(.5 * focus,6.5 - focus*2.2, (portrait ? 13 : 9.5)-focus*4.5);
    this.camera.position.lerp(cameraGoal,1-Math.exp(-dt*6));
    const aim = new THREE.Vector3(g.cakeX*.3,.6+g.height*focus*.85,0);
    this.target.lerp(aim,1-Math.exp(-dt*7)); this.camera.lookAt(this.target);
    this.steam.forEach((puff,i) => {
      const age=(this.clock*.55+i/12)%1;
      puff.visible=g.phase==='cook'; puff.position.set(g.panX+Math.sin(i*7+age)*.65,.4+age*1.4,Math.cos(i*3)*.5);
      puff.scale.setScalar(.5+age*2); (puff.material as THREE.MeshBasicMaterial).opacity=(1-age)*.25;
    });
    this.renderer.render(this.scene,this.camera);
  }
}
