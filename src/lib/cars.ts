export type Car = {
  id: string; name: string; brand: string; edition: string; category: 'JDM' | 'European' | 'Muscle';
  image: string; color: string; colorName: string; hp: number; accel: string; topSpeed: number;
  handling: number; acceleration: number; speed: number; rating: number; class: string;
  drive: string; filter?: string;
};

export const cars: Car[] = [
  { id: 'gtr', name: 'Nissan GT-R', brand: 'NISSAN', edition: 'R35 · NISMO', category: 'JDM', image: '/images/gtr.jpg', color: '#bc2035', colorName: 'Crimson Red', hp: 570, accel: '3.1', topSpeed: 315, handling: 89, acceleration: 90, speed: 92, rating: 940, class: 'S', drive: 'AWD' },
  { id: 'porsche', name: 'Porsche 911', brand: 'PORSCHE', edition: '992 · GT3 RS', category: 'European', image: '/images/porsche.jpg', color: '#e4e6e3', colorName: 'Chalk White', hp: 518, accel: '3.2', topSpeed: 296, handling: 99, acceleration: 91, speed: 87, rating: 955, class: 'S', drive: 'RWD' },
  { id: 'bmw', name: 'BMW M4', brand: 'BMW', edition: 'G82 · Competition', category: 'European', image: '/images/bmw.jpg', color: '#e8c52c', colorName: 'São Paulo Yellow', hp: 503, accel: '3.5', topSpeed: 290, handling: 87, acceleration: 86, speed: 86, rating: 880, class: 'A', drive: 'RWD' },
  { id: 'supra', name: 'Toyota Supra', brand: 'TOYOTA', edition: 'A90 · GR Supra', category: 'JDM', image: '/images/supra.jpg', color: '#a6adb2', colorName: 'Gunmetal Silver', hp: 382, accel: '4.1', topSpeed: 250, handling: 88, acceleration: 79, speed: 77, rating: 790, class: 'A', drive: 'RWD' },
  { id: 'lamborghini', name: 'Lamborghini Huracán', brand: 'LAMBORGHINI', edition: 'LP 640 · Performante', category: 'European', image: '/images/lamborghini.jpg', color: '#ef701b', colorName: 'Arancio Anthaeus', hp: 631, accel: '2.9', topSpeed: 325, handling: 93, acceleration: 96, speed: 97, rating: 970, class: 'S', drive: 'AWD' },
  { id: 'mustang', name: 'Ford Mustang', brand: 'FORD', edition: 'S650 · GT Fastback', category: 'Muscle', image: '/images/mustang.jpg', color: '#235ca4', colorName: 'Deep Impact Blue', hp: 486, accel: '4.2', topSpeed: 270, handling: 78, acceleration: 83, speed: 82, rating: 840, class: 'A', drive: 'RWD' },
  { id: 'mclaren', name: 'McLaren 720S', brand: 'MCLAREN', edition: 'Performance · Coupé', category: 'European', image: '/images/mclaren.jpg', color: '#f17820', colorName: 'Papaya Spark', hp: 710, accel: '2.9', topSpeed: 341, handling: 95, acceleration: 99, speed: 99, rating: 990, class: 'S', drive: 'RWD' },
  { id: 'audi', name: 'Audi R8', brand: 'AUDI', edition: 'V10 · Performance', category: 'European', image: '/images/audi.jpg', color: '#777e85', colorName: 'Daytona Gray', hp: 602, accel: '3.2', topSpeed: 331, handling: 91, acceleration: 94, speed: 96, rating: 958, class: 'S', drive: 'AWD' },
  { id: 'gtr-midnight', name: 'Nissan GT-R', brand: 'NISSAN', edition: 'Midnight · Track Edition', category: 'JDM', image: '/images/gtr.jpg', color: '#3466b1', colorName: 'Bayside Blue', hp: 600, accel: '2.9', topSpeed: 320, handling: 92, acceleration: 94, speed: 94, rating: 962, class: 'S', drive: 'AWD', filter: 'hue-rotate(205deg) saturate(.75)' },
  { id: 'bmw-csl', name: 'BMW M4', brand: 'BMW', edition: 'CSL · Track Edition', category: 'European', image: '/images/bmw.jpg', color: '#e4e6e3', colorName: 'Alpine White', hp: 543, accel: '3.4', topSpeed: 302, handling: 92, acceleration: 90, speed: 90, rating: 925, class: 'S', drive: 'RWD', filter: 'saturate(.05) brightness(1.2)' },
  { id: 'huracan-verde', name: 'Lamborghini Huracán', brand: 'LAMBORGHINI', edition: 'Verde · Track Edition', category: 'European', image: '/images/lamborghini.jpg', color: '#79ba36', colorName: 'Verde Mantis', hp: 640, accel: '2.8', topSpeed: 328, handling: 95, acceleration: 97, speed: 98, rating: 978, class: 'S', drive: 'AWD', filter: 'hue-rotate(55deg)' },
  { id: 'supra-heritage', name: 'Toyota Supra', brand: 'TOYOTA', edition: 'Heritage · Track Edition', category: 'JDM', image: '/images/supra.jpg', color: '#d93830', colorName: 'Renaissance Red', hp: 420, accel: '3.8', topSpeed: 265, handling: 91, acceleration: 84, speed: 81, rating: 845, class: 'A', drive: 'RWD', filter: 'sepia(1) saturate(5) hue-rotate(315deg)' },
];

export const paintColors = [
  { name: 'Factory finish', value: '' },
  { name: 'Crimson Red', value: '#bc2035' },
  { name: 'Chalk White', value: '#e4e6e3' },
  { name: 'Bayside Blue', value: '#3466b1' },
  { name: 'Papaya Orange', value: '#ef701b' },
  { name: 'Verde Mantis', value: '#79ba36' },
];
export const getCar = (id: string) => cars.find(car => car.id === id) ?? cars[0];
