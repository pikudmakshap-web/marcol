import { useParams } from 'react-router-dom';
import UnitSubsiteLayout from '../layouts/UnitSubsiteLayout';
import { getUnitById } from '../data/units';

export default function UnitSubsitePage() {
  const { unitId = '' } = useParams();
  const unit = getUnitById(unitId);
  if (!unit) return <main className="section"><h1>היחידה לא נמצאה</h1></main>;
  return <UnitSubsiteLayout unit={unit} />;
}
