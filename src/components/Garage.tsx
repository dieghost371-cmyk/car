'use client';
import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, Heart, CarFront } from 'lucide-react';
import { cars, type Car } from '@/lib/cars';
import CarCard from '@/components/CarCard';
export default function Garage({ selectedId, favorites, onSelect, onDetails, onFavorite }: { selectedId: string; favorites: string[]; onSelect: (car: Car) => void; onDetails: (car: Car) => void; onFavorite: (id: string) => void }) {
  const [category, setCategory] = useState('All cars');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('featured');
  const filtered = useMemo(() => {
    const list = cars.filter(car => (category === 'All cars' || (category === 'Favorites' ? favorites.includes(car.id) : car.category === category)) && `${car.name} ${car.edition}`.toLowerCase().includes(search.toLowerCase()));
    if (sort === 'power') list.sort((a,b) => b.hp - a.hp);
    if (sort === 'speed') list.sort((a,b) => b.topSpeed - a.topSpeed);
    if (sort === 'name') list.sort((a,b) => a.name.localeCompare(b.name));
    return list;
  }, [category, search, sort, favorites]);
  return <div className="garage-page page-enter">
    <div className="section-page-heading"><div><p className="eyebrow orange">THE KEYS ARE ALREADY YOURS</p><h1>Good taste. Great horsepower.</h1><p>Every car unlocked. Every road waiting. Find the one that feels like you.</p></div><span className="count-label"><CarFront size={16} /> 12 cars in your garage</span></div>
    <div className="garage-toolbar"><div className="filter-tabs">{['All cars', 'JDM', 'European', 'Muscle', 'Favorites'].map(item => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item === 'Favorites' && <Heart size={13} />}{item}<span>{item === 'All cars' ? cars.length : item === 'Favorites' ? favorites.length : cars.filter(car => car.category === item).length}</span></button>)}</div><div className="garage-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find your dream car…" aria-label="Search cars" /></div></div>
    <div className="garage-result-line"><span>{filtered.length} machines. Zero compromises.</span><label><SlidersHorizontal size={13} /><select aria-label="Sort cars" value={sort} onChange={event => setSort(event.target.value)}><option value="featured">Featured first</option><option value="power">Most power</option><option value="speed">Highest top speed</option><option value="name">Name: A–Z</option></select></label></div>
    {filtered.length ? <div className="garage-grid">{filtered.map(car => <CarCard key={car.id} car={car} selected={selectedId === car.id} favorite={favorites.includes(car.id)} onSelect={() => onSelect(car)} onDetails={() => onDetails(car)} onFavorite={() => onFavorite(car.id)} />)}</div> : <div className="empty-state"><Search size={34} /><h3>{category === 'Favorites' ? 'Keep your favorites close.' : 'No cars in this lane.'}</h3><p>{category === 'Favorites' ? 'Tap the heart on a car to add it to your collection.' : 'Try a different model name or clear your filters.'}</p><button className="button secondary" onClick={() => { setSearch(''); setCategory('All cars'); }}>Show all cars</button></div>}
    <p className="garage-disclaimer">Independent racing experience. Vehicle names belong to their respective manufacturers. In-game performance is balanced for play.</p>
  </div>;
}
