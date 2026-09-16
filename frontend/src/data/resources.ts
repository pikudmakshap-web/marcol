export type Resource = { id: string; title: string; category: string; type: string; description: string; unitId?: string; tags: string[] };

export const resources: Resource[] = [
  { id: 'design-1', title: 'תעודת הוקרה', category: 'design', type: 'template', description: 'תבנית עיצוב להורדה.', tags: ['עיצוב', 'תעודה'] },
  { id: 'k-command-1', title: 'מערך שיעור פיקוד', category: 'knowledge', type: 'doc', description: 'חומר ידע ראשוני.', unitId: 'command-school', tags: ['פיקוד'] },
  { id: 'k-nitzanim-1', title: 'סיכום תרגיל ניצנים', category: 'knowledge', type: 'pdf', description: 'סיכום ותובנות.', unitId: 'nitzanim', tags: ['תרגיל'] }
];
