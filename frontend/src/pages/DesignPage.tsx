import ResourceCard from '../components/ResourceCard';
import { resources } from '../data/resources';

export default function DesignPage() {
  const design = resources.filter((r) => r.category === 'design');
  return <main className="section"><h1>עצב בעצמך</h1><div className="grid">{design.map((r) => <ResourceCard key={r.id} id={r.id} title={r.title} description={r.description} />)}</div></main>;
}
