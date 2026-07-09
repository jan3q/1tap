import { getSurvey, getSurveyResponses } from '@/app/actions';
import { notFound } from 'next/navigation';
import EditorClient from './EditorClient';
import { SurveySchema } from '@/types';
import { headers } from 'next/headers';

export default async function EditorPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const survey = await getSurvey(id);
  
  if (!survey) {
    notFound();
  }

  const schema = JSON.parse(survey.schema_json) as SurveySchema;
  const responses = await getSurveyResponses(id);

  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3001';
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  const actualAppUrl = `${protocol}://${host}`;
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  return (
    <div className="container">
      <EditorClient 
        initialSurvey={{...survey, schema}} 
        initialResponses={responses}
        initialTab={tab === 'results' ? 'results' : tab === 'settings' ? 'settings' : 'editor'}
        actualAppUrl={actualAppUrl}
        configuredAppUrl={configuredAppUrl}
      />
    </div>
  );
}
