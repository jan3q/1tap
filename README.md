# 1tap
Banalnie proste w obsłudze ankiety, które stworzysz jednym kliknięciem.

Główne funkcje:
- Banalnie prosta obsługa
- Różne pola (długie/krótkie pytanie, checkbox, radio)
- Warunki IF (i / lub)
- Formatowanie tekstu (kolory, zakreślanie b/i/u)
- Statystyki (wizyty / wypełnienia / konwersje)
- Udostępnianie (link / iframe / plik)
- Webhook
- Dostosowanie do urządzeń mobilnych

## ZMIENNE ŚRODOWISKOWE

- `ADMIN_USERNAME` - login administratora (adres e-mail).
- `ADMIN_PASSWORD` - hasło administratora (jeśli brak, logowanie jest wyłączone).
- `DATABASE_PATH` - ścieżka do pliku bazy danych SQLite.
- `NEXT_PUBLIC_APP_URL` - bazowy adres URL aplikacji.

### Konfiguracja SMTP
- `SMTP_HOST` - host serwera pocztowego.
- `SMTP_PORT` - port serwera pocztowego (SSL/TLS, domyślnie 465).
- `SMTP_USER` - login SMTP.
- `SMTP_PASS` - hasło SMTP.

## FUNKCJE BEZPIECZEŃSTWA

- **Weryfikacja dwuskładnikowa (2FA):** Obsługa kodów czasowych TOTP (Google Authenticator).
- **Ochrona przed botami:** Blokada logowania na 15 minut po 5 nieudanych próbach oraz opóźnienie błędnych żądań o 1 sekundę.
- **Alerty logowania:** Wysyłanie e-maili o logowaniach i błędach (wraz z lokalizacją IP i przeglądarką).
- **Powiadomienia o wypełnieniu ankiet:** Możliwość wysyłania odpowiedzi na e-mail administratora.
