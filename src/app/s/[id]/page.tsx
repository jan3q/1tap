import { getSurvey, incrementViews } from '@/app/actions';
import { notFound } from 'next/navigation';
import SurveyClient from './SurveyClient';
import { SurveySchema } from '@/types';

export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';

export default async function SurveyPage({ 
  params,
  searchParams
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const isPreview = resolvedSearchParams.preview === 'true';
  
  const survey = await getSurvey(id);
  
  if (!survey) {
    notFound();
  }

  // Zwiększ licznik wyświetleń (tylko jeśli to nie jest podgląd autora)
  if (!isPreview) {
    await incrementViews(id);
  }

  const schema = JSON.parse(survey.schema_json) as SurveySchema;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '3rem 1rem' }}>
      {isPreview && (
        <div style={{ padding: '0.5rem 1rem', backgroundColor: '#fef08a', color: '#854d0e', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 500, textAlign: 'center' }}>
          To jest podgląd ankiety. Twoje odpowiedzi nie zostaną zapisane, a ciasteczka blokujące są ignorowane.
        </div>
      )}
      <SurveyClient 
        surveyId={survey.id} 
        title={survey.title}
        schema={schema}
        isPreview={isPreview}
      />
    </div>
  );
}
