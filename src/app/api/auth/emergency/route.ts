import { NextRequest, NextResponse } from 'next/server';
import { getSystemSetting, setSystemSetting } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new NextResponse('Brak tokena', { status: 400 });
  }

  const savedToken = getSystemSetting('emergency_token');

  if (!savedToken || savedToken !== token) {
    return new NextResponse('Nieprawidłowy lub wygasły token', { status: 401 });
  }

  // Generate a new random password
  const newPassword = uuidv4().substring(0, 8);
  
  // Clear the emergency token so it can't be reused
  setSystemSetting('emergency_token', null);
  
  // Clear the active session, logging everyone out immediately
  setSystemSetting('session_token', null);
  process.env.ADMIN_SESSION_TOKEN = undefined;

  // Set the new password
  setSystemSetting('admin_password', newPassword);

  const html = `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Konto zabezpieczone</title>
      <style>
        body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .card { background: #1a1a1a; padding: 2rem; border-radius: 12px; border: 1px solid #333; max-width: 400px; text-align: center; }
        .password { font-size: 2rem; font-weight: bold; letter-spacing: 2px; margin: 1.5rem 0; padding: 1rem; background: #000; border-radius: 8px; border: 1px dashed #555; }
        a { display: inline-block; padding: 0.75rem 1.5rem; background: #fff; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 1rem; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1 style="margin-top: 0">Konto zabezpieczone</h1>
        <p>Wszystkie aktywne sesje zostały wylogowane. Twoje hasło zostało zresetowane.</p>
        <p>Twoje nowe tymczasowe hasło to:</p>
        <div class="password">${newPassword}</div>
        <p style="color: #a3a3a3; font-size: 0.9rem">Zapisz to hasło! Będziesz go potrzebować, aby się zalogować. Po zalogowaniu zmień je na własne w zakładce Ustawienia.</p>
        <a href="/login">Przejdź do logowania</a>
      </div>
    </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
