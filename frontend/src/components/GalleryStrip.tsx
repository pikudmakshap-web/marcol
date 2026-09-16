import { Link } from 'react-router-dom';
import { gallery } from '../data/gallery';

export default function GalleryStrip() {
  return (
    <section className="section">
      <h2>גלריה</h2>
      <div className="gallery-strip">{gallery.slice(0, 6).map((g, i) => <Link key={g.id} to="/gallery" className="tile" style={{ transform: `rotate(${(i % 2 === 0 ? -2 : 2)}deg)` }}>{g.title}</Link>)}</div>
    </section>
  );
}
