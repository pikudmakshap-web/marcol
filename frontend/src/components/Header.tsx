import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { navItems, type NavChild } from '../data/nav';
import { searchIndex } from '../data/searchIndex';

function NavDropdown({ item }: { item: { label: string; children?: NavChild[]; to?: string } }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (!item.children?.length) {
    return <Link to={item.to || '/'} className="nav-link">{item.label}</Link>;
  }

  return (
    <div ref={ref} className="nav-dd" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="nav-link" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{item.label}</button>
      {open && <div className="dropdown">{item.children.map((child) => <Link key={child.id} to={child.to} className="dropdown-item">{child.label}</Link>)}</div>}
    </div>
  );
}

function SearchBar() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const results = useMemo(() => searchIndex.filter((i) => i.label.includes(q)).slice(0, 8), [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  return (
    <div className="search" ref={ref}>
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} placeholder="היי מיזי סויסה אלימלך, מה תרצי לחפש כאן?" aria-label="חיפוש" />
      {open && q && <div className="search-results">{results.length ? results.map((r) => <button key={r.id} onClick={() => { navigate(r.to); setOpen(false); }}>{r.label} <small>{r.type}</small></button>) : <div className="empty">לא נמצאו תוצאות</div>}</div>}
    </div>
  );
}

export default function Header() {
  const [mobile, setMobile] = useState(false);
  return (
    <header className="top-header">
      <div className="header-row">
        <div className="logo">מערך מגל</div>
        <button className="mobile-toggle" onClick={() => setMobile((v) => !v)}>תפריט</button>
      </div>
      <SearchBar />
      <nav className={`nav ${mobile ? 'open' : ''}`}>{navItems.map((item) => <NavDropdown key={item.id} item={item} />)}</nav>
    </header>
  );
}
