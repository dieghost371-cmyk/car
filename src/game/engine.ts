import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCar, type CarModel } from './car-model';
import { upgradeCar } from './detailed-car';
import { getCar } from '@/lib/cars';
import { getTrack } from '@/lib/tracks';
import { trackDistance } from '@/lib/track-distance';
import type { RaceConfig, RoomPlayer } from '@/lib/multiplayer';

export type Control = 'left' | 'right' | 'gas' | 'brake' | 'nitro' | 'handbrake';
export type Standing = { id: string; name: string; carId: string; color: string; ai: boolean; timeMs: number | null; progress: number };
export type Telemetry = { speed: number; progress: number; lane: number; lap: number; position: number; elapsed: number; nitro: number; countdown: number; finished: boolean; offroad: boolean; boosting: boolean; gear: number; standings: Standing[]; mapPosition: [number,number] };
export type RaceResult = { timeMs: number; position: number; standings: Standing[] };
type Rival = { id: string; name: string; carId: string; color: string; ai: boolean; model: CarModel; progress: number; lane: number; targetProgress: number; targetLane: number; speed: number; finishTime: number | null };
const zeroTelemetry: Telemetry = { speed:0,progress:0,lane:0,lap:1,position:1,elapsed:0,nitro:100,countdown:3,finished:false,offroad:false,boosting:false,gear:1,standings:[],mapPosition:[0,0] };
export { zeroTelemetry };

export class RaceEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62,1,.1,1600);
  private curve: THREE.CatmullRomCurve3;
  private length: number;
  private total: number;
  private model: CarModel;
  private rivals: Rival[] = [];
  private keys: Record<Control,boolean> = {left:false,right:false,gas:false,brake:false,nitro:false,handbrake:false};
  private resizeObserver: ResizeObserver;
  private progress = 0;
  private lane = 0;
  private speed = 0;
  private nitro = 100;
  private elapsed = 0;
  private countdown = 3;
  private paused = false;
  private finished = false;
  private boosting = false;
  private offroad = false;
  private cameraMode = 0;
  private lastTime = 0;
  private updateTime = 0;
  private tick = 0;
  private timeOffset = 0;
  private startAt: number;
  private environment: THREE.WebGLRenderTarget;
  private audio?: AudioContext;
  private oscillator?: OscillatorNode;
  private audioGain?: GainNode;
  private cameraInitialized = false;
  private playerLane: number;
  private backgroundTexture?: THREE.Texture;
  private config: RaceConfig;
  private callbacks: { onUpdate: (data: Telemetry) => void; onFinish: (result: RaceResult) => void };

  constructor(container: HTMLElement, config: RaceConfig, callbacks: RaceEngine['callbacks']) {
    this.config=config; this.callbacks=callbacks; this.length=trackDistance(config.track); this.total=this.length*config.laps;
    const track=getTrack(config.track);
    const initialCurve=new THREE.CatmullRomCurve3(track.points.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'catmullrom',.35);
    const scale=this.length/initialCurve.getLength();
    this.curve=new THREE.CatmullRomCurve3(track.points.map(([x,z])=>new THREE.Vector3(x*scale,0,z*scale)),true,'catmullrom',.35); this.curve.arcLengthDivisions=2000; this.curve.updateArcLengths();
    const me=config.initialRoom?.players.find(player=>player.id===config.membership?.playerId);
    this.progress=me?.progress??0; this.speed=me?.speed??0;
    this.playerLane=config.mode==='solo'?0:((config.initialRoom?.players.findIndex(player=>player.id===config.membership?.playerId)??0)-1)*2.8;
    this.lane=me?.lane??this.playerLane;
    this.timeOffset=config.initialRoom?config.initialRoom.serverTime-Date.now():0;
    this.startAt=config.initialRoom?.room.startAt??Date.now()+3500;
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,config.quality==='balanced'?1:1.6));
    this.renderer.shadowMap.enabled=config.quality!=='balanced'; this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=config.track==='neon'?1.25:1.05;
    this.renderer.domElement.setAttribute('aria-label','3D racing circuit. Use arrow keys or WASD to drive.');
    container.appendChild(this.renderer.domElement);
    const pmrem=new THREE.PMREMGenerator(this.renderer); const room=new RoomEnvironment(); this.environment=pmrem.fromScene(room,.04); this.scene.environment=this.environment.texture; room.dispose(); pmrem.dispose();
    this.buildWorld();
    this.model=createCar(config.color,config.carId); this.scene.add(this.model.group);
    void upgradeCar(this.model,config.carId).catch(()=>{ /* Keep the lightweight chassis if decoding is unavailable. */ });
    if(config.mode==='solo'&&config.ai) {
      [{name:'K. Sato',carId:'supra',color:'#e4e6e3',lane:-3.2,progress:-7},{name:'R. Miller',carId:'mustang',color:'#3466b1',lane:3.2,progress:-14},{name:'A. Costa',carId:'bmw',color:'#e8c52c',lane:0,progress:-21}].forEach((item,index)=>{
        const model=createCar(item.color,item.carId); this.scene.add(model.group);
        void upgradeCar(model,item.carId).catch(()=>{});
        this.rivals.push({id:`ai-${index}`,...item,ai:true,model,targetProgress:item.progress,targetLane:item.lane,speed:0,finishTime:null});
      });
    }
    this.resizeObserver=new ResizeObserver(()=>{const width=container.clientWidth,height=container.clientHeight; if(!width||!height)return; this.renderer.setSize(width,height); this.camera.aspect=width/height; this.camera.updateProjectionMatrix();}); this.resizeObserver.observe(container);
    this.renderer.setSize(container.clientWidth,container.clientHeight); this.camera.aspect=container.clientWidth/container.clientHeight; this.camera.updateProjectionMatrix();
    if(config.sound) this.initAudio();
    this.updateModels(0); this.updateCamera(1);
    this.renderer.setAnimationLoop((time)=>this.frame(time));
  }
  private point(progress: number, lane=0) { const t=((progress/this.length)%1+1)%1; const p=this.curve.getPointAt(t); const tangent=this.curve.getTangentAt(t).normalize(); p.add(new THREE.Vector3(tangent.z,0,-tangent.x).multiplyScalar(lane)); return {p,tangent,yaw:Math.atan2(tangent.x,tangent.z)}; }
  private buildWorld() {
    const night=this.config.track==='neon', alpine=this.config.track==='alpine';
    const canvas=document.createElement('canvas'); canvas.width=4; canvas.height=256; const ctx=canvas.getContext('2d')!;
    const gradient=ctx.createLinearGradient(0,0,0,256); gradient.addColorStop(0,night?'#060b1c':alpine?'#6087ac':'#536c85'); gradient.addColorStop(.6,night?'#18243d':alpine?'#b6cbd9':'#b7b5af'); gradient.addColorStop(1,night?'#35344b':alpine?'#dce5e7':'#ebc4a0'); ctx.fillStyle=gradient;ctx.fillRect(0,0,4,256);
    this.backgroundTexture=new THREE.CanvasTexture(canvas); this.backgroundTexture.colorSpace=THREE.SRGBColorSpace; this.scene.background=this.backgroundTexture;
    this.scene.fog=new THREE.Fog(night?'#242b40':alpine?'#b8cbd7':'#c2b7a8',150,950);
    this.scene.environmentIntensity=.7;
    this.scene.add(new THREE.HemisphereLight(night?'#889dcc':'#dce9ff',night?'#20202d':'#514d3b',night?1.25:1.35));
    const sun=new THREE.DirectionalLight(night?'#a5bcff':'#ffe3bc',night?1.35:2.35); sun.position.set(150,160,-120); sun.castShadow=this.config.quality!=='balanced'; sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-300;sun.shadow.camera.right=300;sun.shadow.camera.top=300;sun.shadow.camera.bottom=-300;sun.shadow.camera.far=650;sun.shadow.normalBias=.04; this.scene.add(sun);
    const grassCanvas=document.createElement('canvas');grassCanvas.width=64;grassCanvas.height=64;const gc=grassCanvas.getContext('2d')!;const gi=gc.createImageData(64,64);
    for(let i=0;i<gi.data.length;i+=4){const n=Math.random()*24;gi.data[i]=(alpine?83:66)+n;gi.data[i+1]=(alpine?101:78)+n;gi.data[i+2]=(alpine?91:47)+n;gi.data[i+3]=255;}gc.putImageData(gi,0,0);
    const grassTexture=new THREE.CanvasTexture(grassCanvas);grassTexture.wrapS=grassTexture.wrapT=THREE.RepeatWrapping;grassTexture.repeat.set(220,220);grassTexture.colorSpace=THREE.SRGBColorSpace;grassTexture.anisotropy=4;
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(2600,2600),new THREE.MeshStandardMaterial({map:night?null:grassTexture,color:night?'#202630':'#ffffff',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(0,-.13,-200);ground.receiveShadow=true;this.scene.add(ground);
    if(!night&&!alpine){const sea=new THREE.Mesh(new THREE.PlaneGeometry(1200,2400),new THREE.MeshPhysicalMaterial({color:'#426d80',metalness:.45,roughness:.24,clearcoat:.7}));sea.rotation.x=-Math.PI/2;sea.position.set(900,-.07,-250);this.scene.add(sea);}
    const asphaltCanvas=document.createElement('canvas');asphaltCanvas.width=128;asphaltCanvas.height=128;const ac=asphaltCanvas.getContext('2d')!;const image=ac.createImageData(128,128);let seed=42;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<image.data.length;i+=4){const shade=55+random()*22;image.data[i]=shade;image.data[i+1]=shade+1;image.data[i+2]=shade+3;image.data[i+3]=255;}ac.putImageData(image,0,0);
    const asphalt=new THREE.CanvasTexture(asphaltCanvas);asphalt.wrapS=asphalt.wrapT=THREE.RepeatWrapping;asphalt.repeat.set(3,1);asphalt.colorSpace=THREE.SRGBColorSpace;asphalt.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
    this.ribbon(-8.4,8.4,.005,new THREE.MeshStandardMaterial({color:night?'#383b47':'#99958b',roughness:1}));
    this.ribbon(-7.2,7.2,.035,new THREE.MeshStandardMaterial({map:asphalt,roughness:.94,color:night?'#8893aa':'#ffffff'}));
    const lineMaterial=new THREE.MeshStandardMaterial({color:'#e5e2d7',roughness:.85});this.ribbon(-6.83,-6.7,.047,lineMaterial);this.ribbon(6.7,6.83,.047,lineMaterial);
    const segments=500;const curb=new THREE.InstancedMesh(new THREE.BoxGeometry(.5,.1,this.length/segments+.05),new THREE.MeshStandardMaterial({roughness:.8}),segments*2);const dummy=new THREE.Object3D();
    for(let i=0;i<segments;i++){const {p,yaw}=this.point(i/segments*this.length);[-1,1].forEach((side,j)=>{const q=this.point(i/segments*this.length,side*7.25);dummy.position.copy(q.p);dummy.position.y=.07;dummy.rotation.set(0,yaw,0);dummy.updateMatrix();curb.setMatrixAt(i*2+j,dummy.matrix);curb.setColorAt(i*2+j,new THREE.Color(Math.floor(i/2)%2?'#dfddd3':'#b94137'));});void p;}
    curb.receiveShadow=true;this.scene.add(curb);
    const dashes=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.012,3.2),lineMaterial,Math.floor(this.length/12));
    for(let i=0;i<dashes.count;i++){const {p,yaw}=this.point(i*12);dummy.position.copy(p);dummy.position.y=.052;dummy.rotation.set(0,yaw,0);dummy.updateMatrix();dashes.setMatrixAt(i,dummy.matrix);}this.scene.add(dashes);
    [-1,1].forEach(side=>{this.guardRail(side*8.5);});
    const posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.85,.14),new THREE.MeshStandardMaterial({color:'#858b8e',metalness:.6,roughness:.55}),160);
    for(let i=0;i<160;i++){const {p,yaw}=this.point(i/160*this.length,i<80?-8.5:8.5);dummy.position.copy(p);dummy.position.y=.45;dummy.rotation.set(0,yaw,0);dummy.updateMatrix();posts.setMatrixAt(i,dummy.matrix);}this.scene.add(posts);
    const start=new THREE.Group();const startLocation=this.point(0);start.position.copy(startLocation.p);start.rotation.y=startLocation.yaw;this.scene.add(start);
    const checker=document.createElement('canvas');checker.width=128;checker.height=32;const cc=checker.getContext('2d')!;for(let x=0;x<16;x++)for(let y=0;y<4;y++){cc.fillStyle=(x+y)%2?'#ecece7':'#22252a';cc.fillRect(x*8,y*8,8,8);}const checkTexture=new THREE.CanvasTexture(checker);const finishLine=new THREE.Mesh(new THREE.PlaneGeometry(13.5,2),new THREE.MeshStandardMaterial({map:checkTexture,roughness:.8}));finishLine.rotation.x=-Math.PI/2;finishLine.position.y=.065;start.add(finishLine);
    const structureMaterial=new THREE.MeshStandardMaterial({color:'#20252b',metalness:.6,roughness:.45});
    [-1,1].forEach(side=>{const pole=new THREE.Mesh(new THREE.BoxGeometry(.35,7,.4),structureMaterial);pole.position.set(side*8,3.5,0);start.add(pole);});
    const beam=new THREE.Mesh(new THREE.BoxGeometry(16.5,1.35,.4),structureMaterial);beam.position.y=7;start.add(beam);
    const banner=document.createElement('canvas');banner.width=1024;banner.height=96;const bc=banner.getContext('2d')!;bc.fillStyle='#181c22';bc.fillRect(0,0,1024,96);bc.fillStyle='#f47b36';bc.fillRect(0,82,1024,14);bc.font='italic 900 58px sans-serif';bc.textAlign='center';bc.fillText('APEX',250,65);bc.fillStyle='#e9eceb';bc.font='500 24px sans-serif';bc.fillText('EVERY CORNER COUNTS.',675,57);const bannerTexture=new THREE.CanvasTexture(banner);bannerTexture.colorSpace=THREE.SRGBColorSpace;const bannerMesh=new THREE.Mesh(new THREE.PlaneGeometry(16.4,1.3),new THREE.MeshBasicMaterial({map:bannerTexture,side:THREE.DoubleSide}));bannerMesh.position.set(0,7,-.211);start.add(bannerMesh);
    const treeCount=210;const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.13,.24,5,7),new THREE.MeshStandardMaterial({color:'#554737',roughness:1}),treeCount);
    const crownGeometry=alpine?new THREE.ConeGeometry(2.7,8.5,12,5):new THREE.SphereGeometry(3,12,9);
    const crownPositions=crownGeometry.attributes.position;
    for(let i=0;i<crownPositions.count;i++){const x=crownPositions.getX(i),y=crownPositions.getY(i),z=crownPositions.getZ(i);const variation=1+.11*Math.sin(x*3.7+y*2.1)*Math.cos(z*3.2);crownPositions.setXYZ(i,x*variation,y*(alpine?1:variation),z*variation);}crownGeometry.computeVertexNormals();
    const foliage=new THREE.InstancedMesh(crownGeometry,new THREE.MeshStandardMaterial({color:alpine?'#304b3c':'#3b5737',roughness:1}),treeCount);
    for(let i=0;i<treeCount;i++){const side=i%2?1:-1;const {p}=this.point(random()*this.length,side*(17+random()*65));const size=.8+random()*.65;dummy.rotation.set(0,random()*6,0);dummy.scale.set(size,size,size);dummy.position.set(p.x,2.5*size,p.z);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);dummy.position.y=alpine?6*size:5.1*size;dummy.scale.set(size*(.9+random()*.3),size*(.85+random()*.4),size);dummy.updateMatrix();foliage.setMatrixAt(i,dummy.matrix);foliage.setColorAt(i,new THREE.Color().setHSL(alpine?.36:.27,.2+random()*.15,.52+random()*.16));}
    if(!night){this.scene.add(trunks,foliage);}else{trunks.geometry.dispose();(trunks.material as THREE.Material).dispose();foliage.geometry.dispose();(foliage.material as THREE.Material).dispose();}
    if(night){const buildings=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#273247',metalness:.35,roughness:.65}),110);const windows=new THREE.InstancedMesh(new THREE.BoxGeometry(.13,1,.15),new THREE.MeshStandardMaterial({color:'#a4d8ef',emissive:'#5cbce6',emissiveIntensity:2}),110);
      for(let i=0;i<110;i++){const {p}=this.point(random()*this.length,(i%2?1:-1)*(32+random()*80));const height=15+random()*80;dummy.position.set(p.x,height/2,p.z);dummy.rotation.set(0,Math.floor(random()*4)*Math.PI/2,0);dummy.scale.set(8+random()*12,height,8+random()*12);dummy.updateMatrix();buildings.setMatrixAt(i,dummy.matrix);dummy.position.x+=6;dummy.position.z+=6;dummy.scale.set(1,height*.8,1);dummy.updateMatrix();windows.setMatrixAt(i,dummy.matrix);}this.scene.add(buildings,windows);
      const lampMaterial=new THREE.MeshStandardMaterial({color:'#cfedff',emissive:'#9fd9ff',emissiveIntensity:3});for(let i=0;i<35;i++){const {p,yaw}=this.point(i/35*this.length,8.9);const lamp=new THREE.Group();lamp.position.copy(p);lamp.rotation.y=yaw;const pole=new THREE.Mesh(new THREE.BoxGeometry(.13,8,.13),structureMaterial);pole.position.y=4;lamp.add(pole);const light=new THREE.Mesh(new THREE.BoxGeometry(2,.1,.3),lampMaterial);light.position.set(-.9,8,0);lamp.add(light);this.scene.add(lamp);}
    }
    if(!night){
      for(let i=0;i<14;i++){
        const angle=i/14*Math.PI*2, distance=690+random()*150, height=155+random()*165, radius=225+random()*100, seed=random()*12;
        const geometry=new THREE.PlaneGeometry(radius*2,radius*2,32,32);geometry.rotateX(-Math.PI/2);
        const positions=geometry.attributes.position,colors:number[]=[];
        const low=new THREE.Color(alpine?'#5e746b':'#53664f'),high=new THREE.Color(alpine?'#8c9c9d':'#8b8c7e'),snow=new THREE.Color('#e0e7e5');
        for(let v=0;v<positions.count;v++){
          const x=positions.getX(v),z=positions.getZ(v),r=Math.sqrt(x*x+z*z)/radius,a=Math.atan2(z,x);
          const falloff=Math.pow(Math.max(0,1-r),1.35);const ridge=1+.2*Math.sin(a*5+seed)+.12*Math.sin(x*.035+seed)*Math.cos(z*.029);
          const y=Math.max(0,height*falloff*ridge+falloff*17*Math.sin(x*.057)*Math.sin(z*.049));positions.setY(v,y);
          const altitude=Math.min(1,y/height);const color=low.clone().lerp(high,Math.min(1,altitude*1.6));if(alpine&&altitude>.61)color.lerp(snow,Math.min(1,(altitude-.61)*3.4));color.multiplyScalar(.93+random()*.12);colors.push(color.r,color.g,color.b);
        }
        geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
        const mountain=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));mountain.position.set(Math.cos(angle)*distance,-3,-220+Math.sin(angle)*distance);mountain.rotation.y=seed;this.scene.add(mountain);
      }
    }
  }
  private ribbon(left: number,right: number,height: number,material: THREE.Material) {
    const positions:number[]=[],uvs:number[]=[],indices:number[]=[];const segments=640;
    for(let i=0;i<=segments;i++){const distance=i/segments*this.length;for(const lane of [left,right]){const {p}=this.point(distance,lane);positions.push(p.x,height,p.z);uvs.push(lane===left?0:1,distance/12);}if(i<segments){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;this.scene.add(mesh);
  }
  private guardRail(lane: number) {
    const positions:number[]=[],indices:number[]=[];const segments=640;
    for(let i=0;i<=segments;i++){const {p}=this.point(i/segments*this.length,lane);positions.push(p.x,.5,p.z,p.x,.83,p.z);if(i<segments){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:'#a2a7a5',metalness:.7,roughness:.48,side:THREE.DoubleSide}));this.scene.add(mesh);
  }
  private initAudio() { try { this.audio=new AudioContext();this.oscillator=this.audio.createOscillator();this.oscillator.type='sawtooth';const filter=this.audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=320;this.audioGain=this.audio.createGain();this.audioGain.gain.value=0;this.oscillator.connect(filter);filter.connect(this.audioGain);this.audioGain.connect(this.audio.destination);this.oscillator.start();void this.audio.resume().catch(()=>{}); } catch { /* Audio is optional. */ } }
  setControl(control: Control,pressed: boolean) { this.keys[control]=pressed; if(pressed&&this.audio?.state==='suspended')void this.audio.resume().catch(()=>{}); }
  releaseControls() { Object.keys(this.keys).forEach(key=>this.keys[key as Control]=false); }
  setPaused(value: boolean) { this.paused=value;this.releaseControls(); }
  toggleCamera() { this.cameraMode=(this.cameraMode+1)%3;this.cameraInitialized=false;return ['Chase','Hood','Wide'][this.cameraMode]; }
  resetCar() { if(this.finished)return;this.lane=0;this.speed*=.3;this.nitro=Math.max(0,this.nitro-10); }
  setRemotePlayers(players: RoomPlayer[],serverTime: number) {
    if(this.config.mode!=='multiplayer')return;this.timeOffset=serverTime-Date.now();
    const other=players.filter(player=>player.id!==this.config.membership?.playerId);
    this.rivals=this.rivals.filter(rival=>{if(!other.some(player=>player.id===rival.id)){this.scene.remove(rival.model.group);this.disposeObject(rival.model.group);return false;}return true;});
    other.forEach(player=>{let rival=this.rivals.find(item=>item.id===player.id);if(!rival){const model=createCar(player.color,player.carId);this.scene.add(model.group);void upgradeCar(model,player.carId).catch(()=>{});rival={id:player.id,name:player.name,carId:player.carId,color:player.color,ai:false,model,progress:player.progress,lane:player.lane,targetProgress:player.progress,targetLane:player.lane,speed:player.speed,finishTime:player.finishTime};this.rivals.push(rival);}
      rival.targetProgress=player.finishTime?player.progress:Math.min(this.total,player.progress+player.speed*Math.min(.5,Math.max(0,(Date.now()+this.timeOffset-serverTime)/1000)));rival.targetLane=player.lane;rival.speed=player.speed;rival.finishTime=player.finishTime;
    });
  }
  private frame(time: number) {
    const dt=this.lastTime?Math.min((time-this.lastTime)/1000,.25):.016;this.lastTime=time;this.tick++;
    if(!this.paused&&!this.finished){
      if(this.config.mode==='multiplayer')this.elapsed=(Date.now()+this.timeOffset-this.startAt)/1000;else if(this.countdown>0)this.countdown=Math.max(0,this.countdown-dt);else this.elapsed+=dt;
      this.countdown=Math.max(0,-this.elapsed);
      if(this.countdown<=0){let remaining=dt;while(remaining>0){const step=Math.min(remaining,1/60);this.physics(step);this.updateRivals(step);remaining-=step;}}
    }
    this.updateModels(dt);this.updateCamera(dt);
    if(this.audio&&this.oscillator&&this.audioGain){this.oscillator.frequency.setTargetAtTime(38+this.speed*3.4,this.audio.currentTime,.08);this.audioGain.gain.setTargetAtTime(this.paused||this.finished||this.countdown>0?0:.014+(this.keys.gas||this.config.autoThrottle?.008:0),this.audio.currentTime,.1);}
    this.renderer.render(this.scene,this.camera);
    if(time-this.updateTime>85){this.updateTime=time;this.callbacks.onUpdate(this.getTelemetry());}
    if(this.progress>=this.total&&!this.finished){this.finished=true;this.callbacks.onFinish({timeMs:Math.round(this.elapsed*1000),position:this.standings().findIndex(item=>item.id==='you')+1,standings:this.standings()});}
  }
  private physics(dt: number) {
    const car=getCar(this.config.carId);const steering=(this.keys.right?1:0)-(this.keys.left?1:0);const gas=this.keys.gas||this.config.autoThrottle;const braking=this.keys.brake||this.keys.handbrake;
    this.boosting=this.keys.nitro&&this.nitro>0&&gas&&!braking;const maxSpeed=car.topSpeed/3.6*(this.boosting?1.12:1);
    const power=27.78/Number(car.accel)*(this.boosting?1.8:1.2);
    if(braking)this.speed-=dt*(this.keys.handbrake?30:21);else if(gas)this.speed+=power*(1-.38*this.speed/maxSpeed)*dt;else this.speed-=4*dt;
    this.speed-= (.35+this.speed*.009)*dt;this.speed=Math.max(0,Math.min(maxSpeed,this.speed));
    this.nitro=Math.max(0,Math.min(100,this.nitro+(this.boosting?-28:8)*dt));
    this.offroad=Math.abs(this.lane)>6.05;if(this.offroad)this.speed=Math.max(0,this.speed-19*dt);
    this.lane+=steering*(1.7+this.speed*.065)*(this.keys.handbrake?1.5:1)*dt;
    const a=this.point(this.progress).tangent,b=this.point(this.progress+12).tangent;const bend=a.x*b.z-a.z*b.x;
    this.lane+=bend*this.speed*.035*dt;
    if(Math.abs(this.lane)>6.45){this.lane=Math.sign(this.lane)*6.45;this.speed*=Math.exp(-1.2*dt);}
    this.progress=Math.min(this.total,this.progress+this.speed*dt);
    this.model.tailMaterial.emissiveIntensity=braking?5:1.1;
    this.model.flames.forEach(flame=>{flame.visible=this.boosting;flame.scale.y=.7+Math.random()*.7;});
    this.model.group.userData.steering=steering;
  }
  private updateRivals(dt: number) {
    const max=getCar(this.config.carId).topSpeed/3.6;
    this.rivals.forEach((rival,index)=>{
      if(rival.ai){if(rival.progress<this.total){const target=max*(.72+index*.055)+Math.sin(this.elapsed*.18+index)*3;rival.speed=Math.min(target,rival.speed+dt*8.5);rival.progress=Math.min(this.total,rival.progress+rival.speed*dt);rival.lane=[-3.2,3.2,0][index]+Math.sin(rival.progress*.013+index)*.65;if(rival.progress>=this.total)rival.finishTime=this.elapsed*1000;}}
      else{rival.progress=THREE.MathUtils.lerp(rival.progress,rival.targetProgress,Math.min(1,dt*9));rival.lane=THREE.MathUtils.lerp(rival.lane,rival.targetLane,Math.min(1,dt*9));}
    });
  }
  private updateModels(dt: number) {
    const place=(model: CarModel,progress: number,lane: number,isPlayer=false)=>{const {p,yaw}=this.point(progress,lane);model.group.position.copy(p);model.group.position.y=.045;model.group.rotation.y=yaw+(isPlayer?(this.model?.group.userData.steering??0)*.11:0);model.group.rotation.z=isPlayer?-(this.model?.group.userData.steering??0)*Math.min(this.speed/80,1)*.035:0;model.wheels.forEach(wheel=>{const spin=wheel.userData.spin as THREE.Group;spin.rotation.x+=this.speed*dt/.425;if(wheel.userData.front ?? wheel.position.z>0)wheel.rotation.y=isPlayer?(this.model?.group.userData.steering??0)*.28:0;});};
    place(this.model,this.progress,this.lane,true);this.rivals.forEach(rival=>place(rival.model,rival.progress,rival.lane));
  }
  private updateCamera(dt: number) {
    const {p,tangent}=this.point(this.progress,this.lane);const right=new THREE.Vector3(tangent.z,0,-tangent.x);const target=p.clone();
    let position: THREE.Vector3,look: THREE.Vector3;
    if(this.cameraMode===1){position=p.clone().addScaledVector(tangent,.85);position.y=1.32;look=p.clone().addScaledVector(tangent,35);look.y=1.15;}
    else{position=p.clone().addScaledVector(tangent,this.cameraMode===2?-15:-9.4);position.y=this.cameraMode===2?7.5:4.4;position.addScaledVector(right,-(this.model?.group.userData.steering??0)*.35);look=p.clone().addScaledVector(tangent,14);look.y=1.1;}
    if(!this.cameraInitialized){this.camera.position.copy(position);this.cameraInitialized=true;}else this.camera.position.lerp(position,1-Math.exp(-dt*(this.cameraMode===1?25:7)));
    target.copy(look);this.camera.lookAt(target);const fov=this.cameraMode===1?72:62+Math.min(this.speed/100,1)*7+(this.boosting?5:0);this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,fov,.06);this.camera.updateProjectionMatrix();
  }
  private standings(): Standing[] {
    const all:Standing[]=[{id:'you',name:this.config.playerName,carId:this.config.carId,color:this.config.color,ai:false,timeMs:this.finished?Math.round(this.elapsed*1000):null,progress:this.progress},...this.rivals.map(rival=>({id:rival.id,name:rival.name,carId:rival.carId,color:rival.color,ai:rival.ai,timeMs:rival.finishTime,progress:rival.progress}))];
    return all.sort((a,b)=>{if(a.timeMs!==null&&b.timeMs!==null)return a.timeMs-b.timeMs;if(a.timeMs!==null)return -1;if(b.timeMs!==null)return 1;return b.progress-a.progress;});
  }
  getTelemetry(): Telemetry { const standings=this.standings();const {p}=this.point(this.progress);return {speed:Math.round(this.speed*3.6),progress:this.progress,lane:Math.abs(this.lane),lap:Math.min(this.config.laps,Math.floor(this.progress/this.length)+1),position:standings.findIndex(item=>item.id==='you')+1,elapsed:Math.max(0,this.elapsed)*1000,nitro:this.nitro,countdown:Math.ceil(this.countdown),finished:this.finished,offroad:this.offroad,boosting:this.boosting,gear:Math.min(7,Math.max(1,Math.floor(this.speed/14)+1)),standings,mapPosition:[p.x,p.z]}; }
  private disposeObject(object: THREE.Object3D) {
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    object.traverse(child=>{if(child instanceof THREE.Mesh){if(!child.userData.sharedGeometry)geometries.add(child.geometry);const list=Array.isArray(child.material)?child.material:[child.material];list.forEach(material=>{materials.add(material);Object.values(material).forEach(value=>{if(value instanceof THREE.Texture)textures.add(value);});});}});
    geometries.forEach(item=>item.dispose());materials.forEach(item=>item.dispose());textures.forEach(item=>item.dispose());
  }
  dispose() {
    this.renderer.setAnimationLoop(null);this.resizeObserver.disconnect();this.releaseControls();
    this.model.group.userData.disposed=true;this.rivals.forEach(rival=>rival.model.group.userData.disposed=true);
    if(this.oscillator)this.oscillator.stop();if(this.audio)void this.audio.close().catch(()=>{});
    this.disposeObject(this.scene);this.environment.dispose();this.backgroundTexture?.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();
  }
}
