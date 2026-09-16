import { gallery } from '../data/gallery';

export default function GalleryPage() {
  return <main className="section"><h1>גלריה</h1><div className="grid">{gallery.map((g) => <div className="card" key={g.id}>{g.title}</div>)}</div></main>;
}
