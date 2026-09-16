export type Category = { id: string; title: string; description: string; group: 'training' | 'guidance' | 'other' };
export const categories: Category[] = [
  { id: 'combat-fitness', title: 'כושר לחימה אישי-עורפי', description: 'תכנים מקצועיים בקרוב', group: 'training' },
  { id: 'differential-kadatz', title: 'דיפרנציאלית - קד״צ', description: 'תכנים מקצועיים בקרוב', group: 'training' },
  { id: 'g1', title: 'עתודאים', description: 'תכנים מקצועיים בקרוב', group: 'training' },
  { id: 'guidance-tools', title: 'עזרים הדרכתיים', description: 'עזרים לשדה ההדרכה', group: 'guidance' },
  { id: 'appendix', title: 'נספחים', description: 'מסמכי עזר ותבניות', group: 'guidance' },
  { id: 'emergency', title: 'חירום', description: 'נהלים ותכנים לחירום', group: 'guidance' },
  { id: 'tlb', title: 'תל״ב', description: 'מרחב תל״ב', group: 'other' }
];
