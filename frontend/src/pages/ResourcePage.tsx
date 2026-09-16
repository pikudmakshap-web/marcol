import { useParams } from 'react-router-dom';
import { resources } from '../data/resources';

export default function ResourcePage() {
  const { resourceId = '' } = useParams();
  const resource = resources.find((r) => r.id === resourceId);
  if (!resource) return <main className="section"><h1>התוכן לא נמצא</h1></main>;
  return <main className="section"><h1>{resource.title}</h1><p>{resource.description}</p><p>קטגוריה: {resource.category} | סוג: {resource.type}</p></main>;
}
