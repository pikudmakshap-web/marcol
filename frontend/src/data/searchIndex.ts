import { navItems } from './nav';
import { units } from './units';
import { categories } from './categories';
import { resources } from './resources';

export type SearchItem = { id: string; label: string; to: string; type: string };

export const searchIndex: SearchItem[] = [
  ...units.map((u) => ({ id: `u-${u.id}`, label: u.title, to: `/units/${u.slug}`, type: 'יחידה' })),
  ...categories.map((c) => ({ id: `c-${c.id}`, label: c.title, to: `/category/${c.id}`, type: 'קטגוריה' })),
  ...resources.map((r) => ({ id: `r-${r.id}`, label: r.title, to: `/resource/${r.id}`, type: r.type })),
  ...navItems.filter((n) => n.to).map((n) => ({ id: `n-${n.id}`, label: n.label, to: n.to || '/', type: 'ניווט' })),
];
