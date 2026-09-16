import { Link, useParams } from 'react-router-dom';
import { categories } from '../data/categories';
import { resources } from '../data/resources';
import ResourceCard from '../components/ResourceCard';

export default function CategoryPage() {
  const { categoryId = '' } = useParams();
  const category = categories.find((c) => c.id === categoryId);
  const items = resources.filter((r) => r.category === categoryId);
  if (!category) return <main className="section"><h1>הקטגוריה לא נמצאה</h1></main>;
  return <main className="section"><h1>{category.title}</h1><p>{category.description}</p><Link to="/" className="back">חזרה</Link><div className="grid">{items.length ? items.map((r) => <ResourceCard key={r.id} id={r.id} title={r.title} description={r.description} />) : <div className="empty">בקרוב יתווספו תכנים</div>}</div></main>;
}
