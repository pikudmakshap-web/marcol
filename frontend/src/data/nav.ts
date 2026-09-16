export type NavChild = { id: string; label: string; to: string; children?: NavChild[] };
export type NavItem = { id: string; label: string; to?: string; children?: NavChild[] };

export const navItems: NavItem[] = [
  {
    id: 'units',
    label: 'יחידות המערך',
    children: [
      { id: 'command-school', label: 'בית הספר לפיקוד', to: '/units/command-school' },
      { id: 'nitzanim', label: 'בט״ר ניצנים', to: '/units/nitzanim' },
      { id: 'dotan', label: 'בט״ר דותן', to: '/units/dotan' },
      { id: 'authorities', label: 'סמכויות', to: '/units/authorities' },
      { id: 'headquarters', label: 'מטה מגל', to: '/units/headquarters' },
    ],
  },
  {
    id: 'trainings',
    label: 'הכשרות',
    children: [
      { id: 'combat-fitness', label: 'כושר לחימה אישי-עורפי', to: '/category/combat-fitness' },
      { id: 'differential-kadatz', label: 'דיפרנציאלית - קד״צ', to: '/category/differential-kadatz' },
      { id: 'command', label: 'פיקוד', to: '/category/command', children: [{ id: 'hybrid', label: 'היברידית', to: '/category/hybrid' }, { id: 'eitan', label: 'איתן', to: '/category/eitan' }, { id: 'dvir', label: 'דביר', to: '/category/dvir' }] },
      { id: 'ops', label: 'מבצעים', to: '/category/operations' },
      { id: 'guide', label: 'הדרכה', to: '/category/guidance-core' },
    ],
  },
  { id: 'tlb', label: 'תל״ב', to: '/category/tlb' },
  {
    id: 'guidance',
    label: 'תוה״ד מגל / הדרכה',
    children: [
      { id: 'tools', label: 'עזרים הדרכתיים', to: '/category/guidance-tools' },
      { id: 'appendix', label: 'נספחים', to: '/category/appendix' },
      { id: 'emergency', label: 'חירום', to: '/category/emergency' },
    ],
  },
  { id: 'design', label: 'עצב בעצמך', to: '/design' },
  { id: 'blog', label: 'בלוג', to: '/blog' },
  { id: 'gallery', label: 'גלריה', to: '/gallery' },
];
