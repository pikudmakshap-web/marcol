import { Link } from 'react-router-dom';

export default function ResourceCard({ id, title, description }: { id: string; title: string; description: string }) {
  return <Link to={`/resource/${id}`} className="card"><h3>{title}</h3><p>{description}</p></Link>;
}
