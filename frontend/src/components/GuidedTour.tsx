import { useState } from 'react';
const steps = ['חיפוש', 'סרגל ניווט', 'יחידות המערך', 'הכשרות', 'ספריית עיצוב', 'שימור ידע'];

export default function GuidedTour() {
  const [idx, setIdx] = useState(-1);
  if (idx < 0) return <button className="cta" onClick={() => setIdx(0)}>התחל בסיור</button>;
  return (
    <div className="tour">
      <div className="tour-box"><h3>{steps[idx]}</h3><p>סיור קצר במערכת.</p><div className="tour-actions"><button onClick={() => setIdx((v) => Math.max(0, v - 1))}>הקודם</button><button onClick={() => setIdx((v) => v + 1 >= steps.length ? -1 : v + 1)}>{idx + 1 === steps.length ? 'סיום' : 'הבא'}</button></div></div>
    </div>
  );
}
