'use server'
  
import db from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';
import { Survey, SurveySchema, SurveyResponse } from '@/types';
import { cookies } from 'next/headers';

export async function createSurvey(title: string, description?: string) {
  if (!title) return { error: 'Tytuł jest wymagany' };
  
  const id = uuidv4();
  const defaultSchema: SurveySchema = { questions: [] };
  const desc = description || '';
  
  db.prepare(`
    INSERT INTO surveys (id, title, description, schema_json) 
    VALUES (?, ?, ?, ?)
  `).run(id, title, desc, JSON.stringify(defaultSchema));
  
  revalidatePath('/');
  return { id };
}

export async function getSurveys(): Promise<Survey[]> {
  return db.prepare('SELECT * FROM surveys ORDER BY created_at DESC').all() as Survey[];
}

export async function getSurvey(id: string): Promise<Survey | undefined> {
  return db.prepare('SELECT * FROM surveys WHERE id = ?').get(id) as Survey | undefined;
}

export async function updateSurveySchema(
  id: string, 
  schema: SurveySchema, 
  title: string,
  redirectUrl: string | null = null,
  webhookUrl: string | null = null,
  description: string | null = null
) {
  db.prepare(`
    UPDATE surveys 
    SET schema_json = ?, title = ?, redirect_url = ?, webhook_url = ?, description = ? 
    WHERE id = ?
  `).run(JSON.stringify(schema), title, redirectUrl, webhookUrl, description, id);
  revalidatePath(`/editor/${id}`);
}

export async function incrementViews(id: string) {
  db.prepare('UPDATE surveys SET views = views + 1 WHERE id = ?').run(id);
}

function sanitizeKey(title: string): string {
  if (!title) return 'pytanie';
  return title
    .replace(/<[^>]*>/g, '') // Usuwamy HTML z Rich Text
    .normalize("NFD") // Dekompozycja znaków diakrytycznych (np. ą -> a, ł -> l)
    .replace(/[\u0300-\u036f]/g, "") // Usunięcie diakrytyków
    .replace(/[łŁ]/g, 'l') // Bezpośrednie zastąpienie ł i Ł
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, '') // Usuwamy znaki specjalne
    .trim()
    .replace(/[\s-]+/g, '_'); // Zamiana spacji i myślników na _
}

export async function submitSurveyResponse(surveyId: string, answers: Record<string, any>) {
  const responseId = uuidv4();
  
  const survey = db.prepare('SELECT redirect_url, webhook_url, schema_json FROM surveys WHERE id = ?').get(surveyId) as { redirect_url: string | null, webhook_url: string | null, schema_json: string | null } | undefined;

  db.transaction(() => {
    db.prepare(`
       INSERT INTO survey_responses (id, survey_id, answers_json) 
       VALUES (?, ?, ?)
    `).run(responseId, surveyId, JSON.stringify(answers));
    
    db.prepare('UPDATE surveys SET submissions = submissions + 1 WHERE id = ?').run(surveyId);
  })();

  // Blokada wielokrotnego wypełniania (ciasteczka)
  const cookieStore = await cookies();
  cookieStore.set(`survey_completed_${surveyId}`, 'true', {
    maxAge: 60 * 60 * 24 * 365, // 1 rok
    path: '/'
  });

  // Webhook
  if (survey?.webhook_url) {
    let readableAnswers: Record<string, any> = {};
    try {
      if (survey.schema_json) {
        const schema = JSON.parse(survey.schema_json);
        const questions = schema.questions || [];
        
        const mapType = (type: string) => {
          switch (type) {
            case 'short-text': return 'SHORT_TEXT';
            case 'long-text': return 'LONG_TEXT';
            case 'number': return 'NUMBER';
            case 'checkbox': return 'MULTIPLE_CHOICE';
            case 'radio': return 'SINGLE_CHOICE';
            case 'scale': return 'SCALE';
            default: return type.toUpperCase();
          }
        };

        questions.forEach((q: any) => {
          if (q.type === 'header') return; // Pomijamy nagłówki sekcji
          
          let val = answers[q.id];
          if (val === undefined || val === '') {
            val = null;
          }
          
          const customValue = answers[`${q.id}_custom`] || null;
          
          readableAnswers[q.id] = {
            label: q.title || '',
            value: val,
            type: mapType(q.type),
            ...(q.customAnswer ? { custom_value: customValue } : {})
          };
        });
      } else {
        readableAnswers = answers;
      }
    } catch (err) {
      console.error('[Webhook] Błąd podczas parsowania schematu ankiety:', err);
      readableAnswers = answers;
    }

    console.log(`[Webhook] Wysyłanie danych pod URL: ${survey.webhook_url}`);
    fetch(survey.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        survey_id: surveyId,
        response_id: responseId,
        answers: readableAnswers,
        submitted_at: new Date().toISOString()
      }),
      cache: 'no-store' // Zapobiega keszowaniu requestu przez Next.js
    })
    .then((res) => {
      console.log(`[Webhook] Sukces! Serwer odpowiedział statusem: ${res.status}`);
    })
    .catch(err => {
      console.error('[Webhook] Błąd podczas wysyłania:', err);
    });
  }

  return {
    redirectUrl: survey?.redirect_url || null
  };
}

export async function getSurveyResponses(surveyId: string): Promise<SurveyResponse[]> {
  return db.prepare('SELECT * FROM survey_responses WHERE survey_id = ? ORDER BY created_at DESC').all(surveyId) as SurveyResponse[];
}

export async function deleteSurvey(id: string) {
  db.prepare('DELETE FROM surveys WHERE id = ?').run(id);
  revalidatePath('/');
}

export async function loginAdmin(password: string) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return { success: true };
  }
  
  if (password === adminPassword) {
    const cookieStore = await cookies();
    cookieStore.set('auth_token', adminPassword, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 dni
    });
    return { success: true };
  }
  
  return { success: false, error: 'Nieprawidłowe hasło.' };
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
  return { success: true };
}
