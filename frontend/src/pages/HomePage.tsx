import { Link } from 'react-router-dom';
import { units } from '../data/units';
import GalleryStrip from '../components/GalleryStrip';
import GuidedTour from '../components/GuidedTour';

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="overlay" />
        <div className="hero-content"><h1>מערך מגל</h1><p>מערך מגל יהווה שער כניסה איכותי לצה״ל ומודל למצוינות.</p><GuidedTour /></div>
      </section>
      <section className="section"><h2>אודות המערך</h2><p>פורטל ידע מערכתי עבור יחידות מגל והכשרות.</p></section>
      <section className="section"><h2>ערכי המערך</h2><div className="chips"><span>האדם במרכז</span><span>מקצועיות</span><span>אחריות</span><span>דוגמה אישית</span></div></section>
      <GalleryStrip />
      <section className="section"><h2>מטה מפקדת מגל</h2><div className="chips">{['רס״ר','תוה״ד','חינוך','לוגיסטיקה','סמכויות'].map((i) => <span key={i}>{i}</span>)}</div></section>
      <section className="section"><h2>יחידות המערך</h2><div className="grid">{units.map((u) => <Link key={u.id} className="card" to={`/units/${u.slug}`}>{u.title}</Link>)}</div></section>
    </main>
  );
}
