import * as THREE from 'three';

export type CarModel = { group: THREE.Group; wheels: THREE.Group[]; paint: THREE.MeshPhysicalMaterial; tailMaterial: THREE.MeshStandardMaterial; flames: THREE.Mesh[] };
export function createCar(color: string, modelId = 'gtr'): CarModel {
  const group = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: .72, roughness: .24, clearcoat: 1, clearcoatRoughness: .13, envMapIntensity: 1.6 });
  const carbon = new THREE.MeshStandardMaterial({ color: '#111419', roughness: .52, metalness: .35 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#182b3a', metalness: .72, roughness: .08, clearcoat: 1, envMapIntensity: 2 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#adb5bd', metalness: .95, roughness: .22 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#131416', roughness: .93 });
  const rim = new THREE.MeshStandardMaterial({ color: '#454b52', metalness: .95, roughness: .25 });
  const headMaterial = new THREE.MeshStandardMaterial({ color: '#e7f5ff', emissive: '#cce8ff', emissiveIntensity: 2.5 });
  const tailMaterial = new THREE.MeshStandardMaterial({ color: '#ef2030', emissive: '#ff1020', emissiveIntensity: 1.2 });
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material); mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const sections = [ [-2.24,.88,.64],[-2.04,1.02,.77],[-1.35,1.055,.84],[-.45,1.02,.82],[.7,1.025,.79],[1.45,1.04,.75],[2.1,1,.66],[2.27,.88,.57] ];
  const vertices: number[] = [], indices: number[] = [];
  sections.forEach(([z,w,top]) => {
    const ring = [[-w*.92,.34],[-w,.49],[-w,top-.13],[-w*.83,top],[w*.83,top],[w,top-.13],[w,.49],[w*.92,.34]];
    ring.forEach(([x,y]) => vertices.push(x,y,z));
  });
  for (let s=0;s<sections.length-1;s++) for (let j=0;j<8;j++) { const a=s*8+j,b=s*8+(j+1)%8,c=(s+1)*8+j,d=(s+1)*8+(j+1)%8; indices.push(a,c,b,b,c,d); }
  for (let j=1;j<7;j++) { indices.push(0,j,j+1); const o=(sections.length-1)*8; indices.push(o,o+j+1,o+j); }
  const bodyGeometry = new THREE.BufferGeometry(); bodyGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)); bodyGeometry.setIndex(indices); bodyGeometry.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeometry,paint); body.castShadow=true; body.receiveShadow=true; group.add(body);
  const cabinVertices = [ -.83,.8,-1.43, .83,.8,-1.43, .83,.8,.97, -.83,.8,.97, -.67,1.37,-.77, .67,1.37,-.77, .67,1.37,.17, -.67,1.37,.17 ];
  const cabinGeometry = new THREE.BufferGeometry(); cabinGeometry.setAttribute('position',new THREE.Float32BufferAttribute(cabinVertices,3)); cabinGeometry.setIndex([0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7,4,5,6,4,6,7]); cabinGeometry.computeVertexNormals();
  const cabin = new THREE.Mesh(cabinGeometry,glass); cabin.castShadow=true; group.add(cabin);
  box(1.36,.055,.97,paint,0,1.39,-.3);
  const strut = (a: THREE.Vector3,b: THREE.Vector3,radius: number,material: THREE.Material) => { const direction=b.clone().sub(a); const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,direction.length(),6),material); mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()); group.add(mesh); };
  [-1,1].forEach(side => {
    strut(new THREE.Vector3(side*.83,.81,.98),new THREE.Vector3(side*.67,1.38,.17),.035,paint);
    strut(new THREE.Vector3(side*.83,.81,-1.43),new THREE.Vector3(side*.67,1.38,-.77),.055,paint);
    strut(new THREE.Vector3(side*.82,.82,-.4),new THREE.Vector3(side*.68,1.37,-.4),.028,carbon);
    box(.07,.07,2.85,paint,side*.83,.82,-.23);
    box(.12,.12,3.1,carbon,side*1.025,.35,-.05);
    box(.26,.13,.3,carbon,side*1.1,1.01,.53);
    box(.025,.035,.18,chrome,side*1.032,.75,-.35);
    box(.32,.035,.38,carbon,side*.43,.775,1.22).rotation.x=-.055;
  });
  box(1.52,.25,.075,carbon,0,.49,2.25);
  box(2.1,.065,.47,carbon,0,.315,2.04);
  box(1.8,.18,.1,carbon,0,.43,-2.24);
  const headlights = [-1,1].map(side => box(.43,.105,.11,headMaterial,side*.67,.665,2.16));
  headlights.forEach((light,index) => light.rotation.y=index ? -.18:.18);
  [-1,1].forEach(side => {
    box(.45,.035,.08,headMaterial,side*.69,.52,2.2);
    box(.55,.1,.055,tailMaterial,side*.61,.68,-2.225);
    const exhaust=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,.22,10),chrome); exhaust.rotation.x=Math.PI/2; exhaust.position.set(side*.72,.36,-2.3); group.add(exhaust);
  });
  if (modelId.includes('gtr') || modelId.includes('porsche') || modelId.includes('lamborghini') || modelId.includes('huracan')) {
    [-1,1].forEach(side=>box(.065,.36,.13,carbon,side*.65,.98,-1.8));
    box(2.04,.075,.4,carbon,0,1.17,-1.83);
    [-1,1].forEach(side=>box(.045,.18,.47,paint,side*1.01,1.2,-1.83));
  } else box(1.75,.07,.22,paint,0,.82,-2.02);
  const wheels: THREE.Group[]=[];
  [-1,1].forEach(side => [-1.37,1.36].forEach(z => {
    const wheel=new THREE.Group(); wheel.position.set(side*1.035,.43,z); group.add(wheel); wheels.push(wheel);
    const spin=new THREE.Group(); wheel.add(spin); wheel.userData.spin=spin;
    const tire=new THREE.Mesh(new THREE.CylinderGeometry(.425,.425,.3,24),rubber); tire.rotation.z=Math.PI/2; tire.castShadow=true; spin.add(tire);
    const outside=side*.158;
    const disc=new THREE.Mesh(new THREE.CylinderGeometry(.305,.305,.018,20),carbon); disc.rotation.z=Math.PI/2; disc.position.x=outside; spin.add(disc);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.295,.022,6,24),chrome); ring.rotation.y=Math.PI/2; ring.position.x=outside+side*.013; spin.add(ring);
    for(let i=0;i<5;i++) { const spoke=new THREE.Mesh(new THREE.BoxGeometry(.025,.52,.038),rim); spoke.position.x=outside+side*.018; spoke.rotation.x=i*Math.PI/5; spin.add(spoke); }
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.072,.072,.045,10),chrome); hub.rotation.z=Math.PI/2; hub.position.x=outside+side*.025; spin.add(hub);
  }));
  const flames: THREE.Mesh[]=[];
  [-1,1].forEach(side=>{ const flame=new THREE.Mesh(new THREE.ConeGeometry(.11,.6,8),new THREE.MeshBasicMaterial({color:'#75c9ff',transparent:true,opacity:.85})); flame.rotation.x=-Math.PI/2; flame.position.set(side*.72,.36,-2.65); flame.visible=false; group.add(flame); flames.push(flame); });
  if (/mclaren|lamborghini|huracan|audi/.test(modelId)) group.scale.set(1.05,.9,1.03);
  if (modelId.includes('mustang')) group.scale.set(1.01,1.06,1.08);
  return { group, wheels, paint, tailMaterial, flames };
}
