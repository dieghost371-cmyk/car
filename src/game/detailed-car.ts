import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import type { CarModel } from './car-model';

// CC-BY assets are credited in public/models/CREDITS.md. Geometry is cached locally.
const cache = new Map<string, Promise<THREE.Group>>();
function loadBase(kind: 'sports' | 'porsche'): Promise<THREE.Group> {
  const cached=cache.get(kind);if(cached)return cached;
  const draco=new DRACOLoader();draco.setDecoderPath('/draco/');draco.setWorkerLimit(2);
  const loader=new GLTFLoader();loader.setDRACOLoader(draco);
  const promise=loader.loadAsync(kind==='porsche'?'/models/porsche.glb':'/models/sports-car.glb').then(gltf=>{
    const source=gltf.scene;
    if(kind==='porsche'){const ground=source.getObjectByName('Plane');ground?.removeFromParent();}
    else source.rotation.y=Math.PI;
    source.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(source);const center=bounds.getCenter(new THREE.Vector3());const size=bounds.getSize(new THREE.Vector3());
    source.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));
    const normalized=new THREE.Group();normalized.add(source);normalized.scale.setScalar(4.6/size.z);
    source.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>{if(material instanceof THREE.MeshStandardMaterial)material.envMapIntensity=1.15;});}});
    draco.dispose();return normalized;
  }).catch(error=>{cache.delete(kind);draco.dispose();throw error;});
  cache.set(kind,promise);return promise;
}
export async function upgradeCar(model: CarModel,id: string): Promise<void> {
  const kind=id.includes('porsche')?'porsche':'sports';
  const base=await loadBase(kind);
  if(!model.group.parent||model.group.userData.disposed)return;
  const detailed=base.clone(true);
  const glass=new THREE.MeshPhysicalMaterial({color:'#172832',metalness:.65,roughness:.12,clearcoat:1,envMapIntensity:1.5});
  const wheels:THREE.Group[]=[];
  detailed.traverse(object=>{
    if(object instanceof THREE.Mesh){
      object.userData.sharedGeometry=true;
      const material=Array.isArray(object.material)?object.material[0]:object.material;
      if(object.name==='body'||material.name==='paint')object.material=model.paint;
      if(object.name==='glass'||material.name==='window'||material.name==='Glass_Gray')object.material=glass;
      if(material.name==='coat')object.visible=false;
      if(object.name==='lights_red'&&material instanceof THREE.MeshStandardMaterial){object.material=material.clone();model.tailMaterial=object.material as THREE.MeshStandardMaterial;model.tailMaterial.emissive.set('#ff1727');model.tailMaterial.emissiveIntensity=1.2;}
    }
    if(kind==='sports'&&/^wheel_(fl|fr|rl|rr)$/.test(object.name)){object.userData.spin=object;object.userData.front=object.name.includes('f');wheels.push(object as THREE.Group);}
  });
  if(id.includes('gtr')){
    const carbon=new THREE.MeshStandardMaterial({color:'#171a1d',metalness:.4,roughness:.45});
    const wing=new THREE.Mesh(new THREE.BoxGeometry(1.96,.065,.34),carbon);wing.position.set(0,1.13,-1.81);detailed.add(wing);
    [-1,1].forEach(side=>{const stand=new THREE.Mesh(new THREE.BoxGeometry(.055,.32,.12),carbon);stand.position.set(side*.62,.96,-1.8);detailed.add(stand);});
  }
  const shadowTexture=new THREE.TextureLoader().load('/models/sports-car-ao.png');
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.7,5.3),new THREE.MeshBasicMaterial({map:shadowTexture,blending:THREE.MultiplyBlending,toneMapped:false,transparent:true,premultipliedAlpha:true,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.016;shadow.renderOrder=2;detailed.add(shadow);
  const fallback=new THREE.Group();[...model.group.children].forEach(child=>fallback.add(child));fallback.visible=false;model.group.add(fallback);model.group.add(detailed);model.wheels=wheels;model.flames=[];
}
