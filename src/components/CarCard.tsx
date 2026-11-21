import { ArrowUpRight, Check, Gauge, Heart, Timer, Zap } from 'lucide-react';
import type { Car } from '@/lib/cars';
export default function CarCard({ car, selected, favorite, onSelect, onDetails, onFavorite }: { car: Car; selected: boolean; favorite: boolean; onSelect: () => void; onDetails: () => void; onFavorite: () => void }) {
  return <article className={`car-card ${selected ? 'is-selected' : ''}`}>
    <div className="car-card-visual">
      <button className="car-image-button" onClick={onDetails} aria-label={`View ${car.name} ${car.edition}`}>
        <img src={car.image} alt={`${car.name} ${car.edition}`} loading="lazy" style={{ filter: car.filter }} />
        <span className="car-view-link">Explore car <ArrowUpRight size={13} /></span>
      </button>
      <span className={`class-badge class-${car.class.toLowerCase()}`}><b>{car.class}</b><span>{car.rating}</span></span>
      <button className={`favorite-button ${favorite ? 'favorited' : ''}`} aria-label={favorite ? `Remove ${car.name} from favorites` : `Favorite ${car.name}`} aria-pressed={favorite} onClick={onFavorite}><Heart size={15} fill={favorite ? 'currentColor' : 'none'} /></button>
      {selected && <span className="selected-image-tag"><Check size={10} /> YOUR RIDE</span>}
    </div>
    <div className="car-card-body"><p className="car-brand">{car.brand}<span>{car.drive}</span></p><button className="car-name" onClick={onDetails}>{car.name}</button><p className="car-edition">{car.edition}</p>
      <div className="car-specs"><span><Zap size={12} /><b>{car.hp}</b> hp</span><span><Gauge size={12} /><b>{car.topSpeed}</b> km/h</span><span><Timer size={12} /><b>{car.accel}</b> s</span></div>
      <button className={`car-select ${selected ? 'selected' : ''}`} onClick={onSelect}>{selected ? <><Check size={13} /> Selected ride</> : <>Select this car <ArrowUpRight size={14} /></>}</button>
    </div>
  </article>;
}
