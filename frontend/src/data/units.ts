export type UnitConfig = {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  primaryColor: string;
  accentColor: string;
  commanderImage?: string;
  commanderMessage: string;
  values: string[];
  officeCards: string[];
  knowledgeCards: string[];
  contacts: string[];
};

export const units: UnitConfig[] = [
  { id: 'command-school', slug: 'command-school', title: 'בית הספר לפיקוד', shortTitle: 'בית הספר לפיקוד', primaryColor: 'var(--command-red)', accentColor: '#f4e6e8', commanderMessage: 'הובלה מקצועית, אחריות ודוגמה אישית.', values: ['מקצועיות', 'אחריות', 'יוזמה', 'דוגמה אישית'], officeCards: ['לשכת מפקדת', 'תכנון והכשרות'], knowledgeCards: ['פקודות', 'מערכי שיעור', 'סיכומי תרגיל', 'תוצרים'], contacts: ['ק׳ צפ״ה -', 'ע׳ מד״ר -', 'מד״ר -', 'קה״ד -'] },
  { id: 'nitzanim', slug: 'nitzanim', title: 'בט״ר ניצנים', shortTitle: 'ניצנים', primaryColor: 'var(--nitzanim-yellow)', accentColor: '#fff6d8', commanderMessage: 'מפתחים דור לוחמים איכותי עם בסיס ערכי איתן.', values: ['אומץ', 'חוסן', 'שותפות', 'מצוינות'], officeCards: ['לשכת מפקדת', 'מדור הכשרה'], knowledgeCards: ['נהלים', 'מצגות', 'אירועי למידה', 'ידע מקצועי'], contacts: ['ק׳ צפ״ה -', 'ע׳ מד״ר -', 'מד״ר -', 'קה״ד -'] },
  { id: 'dotan', slug: 'dotan', title: 'בט״ר דותן', shortTitle: 'דותן', primaryColor: 'var(--dotan-green)', accentColor: '#e8f4ec', commanderMessage: 'למידה רציפה ושיפור מתמיד בכל רמות ההדרכה.', values: ['חדשנות', 'דיוק', 'שותפות', 'למידה'], officeCards: ['לשכת מפקדת', 'ניהול אימונים'], knowledgeCards: ['פק"לים', 'תכניות אימון', 'חומרי הדרכה', 'לקחים'], contacts: ['ק׳ צפ״ה -', 'ע׳ מד״ר -', 'מד״ר -', 'קה״ד -'] },
  { id: 'authorities', slug: 'authorities', title: 'סמכויות', shortTitle: 'סמכויות', primaryColor: 'var(--authority-blue)', accentColor: '#eaf5fb', commanderMessage: 'מובילים סטנדרט מקצועי ואחיד לכלל המערך.', values: ['סמכות', 'שקיפות', 'מקצוענות', 'מחויבות'], officeCards: ['לשכת מפקדת', 'ניהול תחום'], knowledgeCards: ['נהלים', 'תבניות', 'סיכומי דיון', 'מענה מקצועי'], contacts: ['ק׳ צפ״ה -', 'ע׳ מד״ר -', 'מד״ר -', 'קה״ד -'] },
  { id: 'headquarters', slug: 'headquarters', title: 'מטה מגל', shortTitle: 'מטה', primaryColor: '#1f2f3f', accentColor: '#e9eef3', commanderMessage: 'מטה מגל מוביל אינטגרציה בין כלל יחידות המערך.', values: ['תכלול', 'שירותיות', 'אמינות', 'שיתוף פעולה'], officeCards: ['לשכת מפקדת', 'ניהול ידע'], knowledgeCards: ['נהלים', 'פרויקטים', 'תוצרים', 'משאבים'], contacts: ['ק׳ צפ״ה -', 'ע׳ מד״ר -', 'מד״ר -', 'קה״ד -'] },
];

export const getUnitById = (id: string) => units.find((u) => u.id === id || u.slug === id);
