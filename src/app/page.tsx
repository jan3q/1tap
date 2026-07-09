import { getSurveys, createSurvey } from './actions';
import DeleteSurveyButton from './DeleteSurveyButton';
import Link from 'next/link';
import { Plus, Eye, CheckSquare, BarChart, Pencil } from 'lucide-react';

export const dynamic = 'force-dynamic'; // Wyłącz caching żeby zawsze widzieć nowe ankiety

export default async function DashboardPage() {
  const surveys = await getSurveys();

  return (
    <div className="container animate-fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="h1" style={{ margin: 0 }}>Moje Ankiety</h1>
        
        <form action={createSurvey} style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="text" 
            name="title" 
            placeholder="Nazwa nowej ankiety..." 
            className="input" 
            required 
            style={{ width: '250px' }}
          />
          <button type="submit" className="btn btn-primary">
            <Plus size={18} />
            Utwórz
          </button>
        </form>
      </header>

      {surveys.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <p className="p-muted" style={{ marginBottom: '1rem' }}>Nie masz jeszcze żadnych ankiet.</p>
          <p>Stwórz swoją pierwszą ankietę powyżej!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {surveys.map((survey) => (
            <div key={survey.id} className="card animate-slide-down" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="h2" style={{ margin: 0, fontSize: '1.2rem' }}>{survey.title}</h3>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Eye size={16} /> {survey.views} wyświetleń
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckSquare size={16} /> {survey.submissions} wypełnień
                  </span>
                  {survey.views > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <BarChart size={16} /> {Math.round((survey.submissions / survey.views) * 100)}% konwersji
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Link href={`/editor/${survey.id}?tab=results`} className="btn btn-secondary" style={{ display: 'flex', gap: '0.35rem' }}>
                  <BarChart size={16} /> Wyniki
                </Link>
                <Link href={`/s/${survey.id}`} className="btn btn-secondary" target="_blank" style={{ display: 'flex', gap: '0.35rem' }}>
                  <Eye size={16} /> Podgląd
                </Link>
                <Link href={`/editor/${survey.id}`} className="btn btn-primary" style={{ display: 'flex', gap: '0.35rem' }}>
                  <Pencil size={16} /> Edytuj
                </Link>
                <DeleteSurveyButton surveyId={survey.id} surveyTitle={survey.title} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
