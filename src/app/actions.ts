'use server'
  
import db, { getSystemSetting, setSystemSetting } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';
import { Survey, SurveySchema, SurveyResponse } from '@/types';
import { cookies, headers } from 'next/headers';
import { verifyTOTP, generateSecret, getOTPAuthURI } from '@/lib/totp';
import { sendEmail } from '@/lib/mail';

async function authCheck() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const customUser = getSystemSetting('admin_username');
  const customPass = getSystemSetting('admin_password');
  const isAuthRequired = !!process.env.ADMIN_PASSWORD || !!customUser || !!customPass;
  const activeToken = getSystemSetting('session_token') || process.env.ADMIN_PASSWORD;

  if (isAuthRequired && (!activeToken || token !== activeToken)) {
    throw new Error('Brak autoryzacji');
  }
}

export async function createSurvey(title: string, description?: string) {
  await authCheck();
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
  await authCheck();
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
  await authCheck();
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
  
  const survey = db.prepare('SELECT title, redirect_url, webhook_url, schema_json FROM surveys WHERE id = ?').get(surveyId) as { title: string, redirect_url: string | null, webhook_url: string | null, schema_json: string | null } | undefined;

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
          
          const customValue = answers[`${q.id}_custom`];
          if (customValue && customValue.trim()) {
            if (Array.isArray(val)) {
              // Dla checkboxów (tablic) filtrujemy ewentualne placeholdery i dodajemy własną odpowiedź
              val = [...val.filter(v => v !== '__custom__'), customValue.trim()];
            } else {
              val = customValue.trim();
            }
          }
          
          const cleanLabel = (q.title || '')
            .replace(/<[^>]*>/g, '') // Usuwa tagi HTML
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim();

          const shortId = q.id.replace(/-/g, '').slice(0, 10);
          const questionKey = `question_${shortId}`;

          readableAnswers[questionKey] = {
            label: cleanLabel,
            value: val,
            type: mapType(q.type)
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

  // Powiadomienia e-mail o nowym wypełnieniu
  try {
    if (survey?.schema_json) {
      const schema = JSON.parse(survey.schema_json) as SurveySchema;
      if (schema.emailNotifications) {
        const adminEmail = getAdminCredentials().username;
        let emailText = `Otrzymano nowe wypełnienie ankiety: "${survey.title || 'Ankieta'}"\n\n`;
        emailText += `Data przesłania: ${new Date().toLocaleString('pl-PL')}\n`;
        emailText += `ID odpowiedzi: ${responseId}\n\n`;
        emailText += `Odpowiedzi:\n`;

        schema.questions.forEach((q: any) => {
          if (q.type === 'header') return;
          
          let ans = answers[q.id];
          if (ans === undefined || ans === '') {
            ans = null;
          }
          
          const customValue = answers[`${q.id}_custom`];
          if (customValue && customValue.trim()) {
            if (Array.isArray(ans)) {
              ans = [...ans.filter(v => v !== '__custom__'), customValue.trim()];
            } else {
              ans = customValue.trim();
            }
          }

          const label = (q.title || q.id)
            .replace(/<[^>]*>/g, '') // Usuwa tagi HTML
            .replace(/&nbsp;/g, ' ')
            .trim();

          let valText = '';
          if (ans === undefined || ans === '' || ans === null) {
            valText = '(brak odpowiedzi)';
          } else if (Array.isArray(ans)) {
            valText = ans.join(', ');
          } else {
            valText = String(ans);
          }

          emailText += `- ${label}: ${valText}\n`;
        });

        sendEmail({
          to: adminEmail,
          subject: `[1tap] Nowe wypełnienie ankiety: ${survey.title || 'Ankieta'}`,
          text: emailText
        }).catch(err => {
          console.error('[SMTP Notification Error]:', err);
        });
      }
    }
  } catch (err) {
    console.error('[Email Notification] Błąd:', err);
  }

  return {
    redirectUrl: survey?.redirect_url || null
  };
}

export async function getSurveyResponses(surveyId: string): Promise<SurveyResponse[]> {
  await authCheck();
  return db.prepare('SELECT * FROM survey_responses WHERE survey_id = ? ORDER BY created_at DESC').all(surveyId) as SurveyResponse[];
}

export async function deleteSurvey(id: string) {
  await authCheck();
  db.prepare('DELETE FROM surveys WHERE id = ?').run(id);
  revalidatePath('/');
}

function getAdminCredentials() {
  const customUser = getSystemSetting('admin_username');
  const customPass = getSystemSetting('admin_password');
  
  const username = customUser || process.env.ADMIN_USERNAME || 'admin@1tap.pl';
  const password = customPass || process.env.ADMIN_PASSWORD || 'admin';
  const isRequired = !!process.env.ADMIN_PASSWORD || !!customUser || !!customPass;
  
  return { username, password, isRequired };
}

async function getGeoIPLocation(ip: string): Promise<string> {
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return 'Lokalna sieć (Dev)';
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,isp`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        return `${data.city}, ${data.regionName}, ${data.country} (ISP: ${data.isp})`;
      }
    }
  } catch (e) {
    // ignorujemy
  }
  return 'Nieznana lokalizacja';
}

export async function loginAdmin(usernameInput: string, passwordInput: string, totpCode?: string) {
  const { username, password, isRequired } = getAdminCredentials();
  if (!isRequired) {
    return { success: true };
  }

  const headersList = await headers();
  const rawIp = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || '127.0.0.1';
  const ip = rawIp.split(',')[0].trim();
  const userAgent = headersList.get('user-agent') || 'Nieznana przeglądarka';

  // 1. Sprawdzenie blokady czasowej (lockout)
  const lockoutUntilStr = getSystemSetting('lockout_until');
  if (lockoutUntilStr) {
    const lockoutUntil = new Date(lockoutUntilStr);
    if (lockoutUntil > new Date()) {
      const diffMs = lockoutUntil.getTime() - Date.now();
      const diffMins = Math.ceil(diffMs / 1000 / 60);
      return { 
        success: false, 
        error: `Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za ${diffMins} min.` 
      };
    } else {
      // Blokada wygasła - resetujemy status
      setSystemSetting('lockout_until', null);
      setSystemSetting('failed_login_attempts', '0');
    }
  }

  // 2. Weryfikacja loginu i hasła
  if (usernameInput !== username || passwordInput !== password) {
    const failedAttemptsStr = getSystemSetting('failed_login_attempts') || '0';
    const failedAttempts = parseInt(failedAttemptsStr, 10) + 1;
    
    // Spowalnianie botów (1s sztucznego opóźnienia przy błędnym logowaniu)
    await new Promise(resolve => setTimeout(resolve, 1000));

    const location = await getGeoIPLocation(ip);

    if (failedAttempts >= 5) {
      const lockoutTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      setSystemSetting('lockout_until', lockoutTime);
      setSystemSetting('failed_login_attempts', '0');

      // Wyślij e-mail z alertem o blokadzie
      const alertSubject = `[1tap] ALERT: Zablokowano próby logowania (lockout)`;
      const alertText = [
        `Zarejestrowano 5 nieudanych prób logowania. System zablokował logowanie na 15 minut.`,
        ``,
        `Szczegóły zdarzenia:`,
        `- Próba logowania na konto: ${usernameInput}`,
        `- Data: ${new Date().toLocaleString('pl-PL')}`,
        `- Adres IP: ${ip}`,
        `- Lokalizacja: ${location}`,
        `- Przeglądarka: ${userAgent}`,
      ].join('\n');
      sendEmail({ to: username, subject: alertSubject, text: alertText }).catch(err => console.error('[SMTP Alert Error]:', err));

      return { 
        success: false, 
        error: 'Zbyt wiele nieudanych prób. Logowanie zablokowane na 15 minut.' 
      };
    } else {
      setSystemSetting('failed_login_attempts', failedAttempts.toString());
      
      // Wyślij e-mail z alertem o błędzie logowania (po każdej próbie dla czujności)
      const alertSubject = `[1tap] Ostrzeżenie: Nieudana próba logowania`;
      const alertText = [
        `Wykryto nieudaną próbę logowania do panelu 1tap.`,
        ``,
        `Szczegóły:`,
        `- Podany login: ${usernameInput}`,
        `- Próba: ${failedAttempts} z 5`,
        `- Data: ${new Date().toLocaleString('pl-PL')}`,
        `- Adres IP: ${ip}`,
        `- Lokalizacja: ${location}`,
        `- Przeglądarka: ${userAgent}`,
      ].join('\n');
      sendEmail({ to: username, subject: alertSubject, text: alertText }).catch(err => console.error('[SMTP Alert Error]:', err));

      const remaining = 5 - failedAttempts;
      return { 
        success: false, 
        error: `Nieprawidłowy login lub hasło. Pozostało prób: ${remaining}.` 
      };
    }
  }

  // 3. Sprawdzenie 2FA
  const is2faEnabled = getSystemSetting('2fa_enabled') === 'true';
  const secret2fa = getSystemSetting('2fa_secret');
  
  if (is2faEnabled && secret2fa) {
    if (!totpCode) {
      return { success: false, requires2fa: true };
    }
    
    const isTotpValid = verifyTOTP(totpCode, secret2fa);
    if (!isTotpValid) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: false, requires2fa: true, error: 'Nieprawidłowy kod 2FA.' };
    }
  }

  // Logowanie udane - resetujemy liczniki nieudanych prób i wysyłamy alert o nowym zalogowaniu
  setSystemSetting('failed_login_attempts', '0');
  setSystemSetting('lockout_until', null);

  const location = await getGeoIPLocation(ip);
  const loginSubject = `[1tap] Informacja: Udane logowanie do panelu administratora`;
  const loginText = [
    `Wykryto nowe udane logowanie do Twojego panelu administratora.`,
    ``,
    `Szczegóły sesji:`,
    `- Zalogowany login: ${username}`,
    `- Data: ${new Date().toLocaleString('pl-PL')}`,
    `- Adres IP: ${ip}`,
    `- Lokalizacja: ${location}`,
    `- Przeglądarka: ${userAgent}`,
    ``,
    `Jeśli to nie Ty, zmień natychmiast hasło w zakładce Bezpieczeństwo.`,
  ].join('\n');
  sendEmail({ to: username, subject: loginSubject, text: loginText }).catch(err => console.error('[SMTP Alert Error]:', err));

  // Generujemy nowy token sesyjny
  const sessionToken = uuidv4();
  setSystemSetting('session_token', sessionToken);
  process.env.ADMIN_SESSION_TOKEN = sessionToken;

  const cookieStore = await cookies();
  cookieStore.set('auth_token', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30 // 30 dni
  });
  return { success: true };
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
  return { success: true };
}

export async function get2FAStatus() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const activeToken = process.env.ADMIN_SESSION_TOKEN;
  
  if (activeToken && token !== activeToken) {
    throw new Error('Brak autoryzacji.');
  }

  const enabled = getSystemSetting('2fa_enabled') === 'true';
  const { username } = getAdminCredentials();
  return { enabled, username };
}

export async function prepare2FA() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const activeToken = process.env.ADMIN_SESSION_TOKEN;
  
  if (activeToken && token !== activeToken) {
    throw new Error('Brak autoryzacji.');
  }

  const secret = generateSecret();
  const { username } = getAdminCredentials();
  const otpauthUrl = getOTPAuthURI(secret, username, '1tap');
  return { secret, otpauthUrl };
}

export async function enable2FA(secret: string, code: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const activeToken = process.env.ADMIN_SESSION_TOKEN;
  
  if (activeToken && token !== activeToken) {
    throw new Error('Brak autoryzacji.');
  }

  const isValid = verifyTOTP(code, secret);
  if (!isValid) {
    return { success: false, error: 'Nieprawidłowy kod weryfikacyjny.' };
  }

  setSystemSetting('2fa_secret', secret);
  setSystemSetting('2fa_enabled', 'true');
  return { success: true };
}

export async function disable2FA(code: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const activeToken = process.env.ADMIN_SESSION_TOKEN;
  
  if (activeToken && token !== activeToken) {
    throw new Error('Brak autoryzacji.');
  }

  const secret = getSystemSetting('2fa_secret');
  if (!secret) {
    return { success: false, error: '2FA nie jest skonfigurowane.' };
  }

  const isValid = verifyTOTP(code, secret);
  if (!isValid) {
    return { success: false, error: 'Nieprawidłowy kod weryfikacyjny. Wyłączenie 2FA zablokowane.' };
  }

  setSystemSetting('2fa_enabled', 'false');
  setSystemSetting('2fa_secret', null);
  return { success: true };
}

export async function updateAdminCredentials(newUsername: string, newPassword?: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const activeToken = process.env.ADMIN_SESSION_TOKEN;
  
  if (activeToken && token !== activeToken) {
    throw new Error('Brak autoryzacji.');
  }

  if (!newUsername.trim() || !newUsername.includes('@')) {
    return { success: false, error: 'Podaj poprawny adres e-mail jako login.' };
  }

  // Zapisujemy nowy login
  setSystemSetting('admin_username', newUsername.trim());

  if (newPassword && newPassword.trim()) {
    if (newPassword.length < 5) {
      return { success: false, error: 'Hasło musi mieć co najmniej 5 znaków.' };
    }
    // Zapisujemy nowe hasło
    setSystemSetting('admin_password', newPassword.trim());
    
    // Generujemy nowy session token po zmianie hasła, aby wylogować inne sesje
    const sessionToken = uuidv4();
    setSystemSetting('session_token', sessionToken);
    process.env.ADMIN_SESSION_TOKEN = sessionToken;
    
    cookieStore.set('auth_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30
    });
  }

  return { success: true };
}
