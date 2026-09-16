import type { UnitConfig } from '../data/units';
import { Link } from 'react-router-dom';

export default function UnitSubsiteLayout({ unit }: { unit: UnitConfig }) {
  return (
    <main>
      <section className="unit-hero" style={{ background: unit.primaryColor }}><h1>{unit.title}</h1><Link to="/" className="back">חזרה למערך מגל</Link></section>
      <section className="section"><h2>דבר מפקדת היחידה</h2><p>{unit.commanderMessage}</p></section>
      <section className="section"><h2>ערכי היחידה</h2><div className="chips">{unit.values.map((v) => <span key={v}>{v}</span>)}</div></section>
      <section className="section"><h2>לשכת המפקדת</h2><div className="grid two">{unit.officeCards.map((c) => <div key={c} className="card">{c}</div>)}</div></section>
      <section className="section"><h2>שימור ידע</h2><div className="grid">{unit.knowledgeCards.map((c) => <div key={c} className="card">{c}</div>)}</div></section>
      <footer className="unit-footer" style={{ background: unit.primaryColor }}><h3>יצירת קשר</h3><div>{unit.contacts.join(' ')}</div></footer>
    </main>
  );
}
