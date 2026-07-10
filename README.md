# 1tap
Banalnie proste w obsłudze ankiety, które stworzysz **1 tap**nięciem.

Główne funkcje to:
- Banalnie prosta obsługa
- Różne pola (długie/krótkie pytanie, checkbox, radio)
- Warunki IF (i / lub)
- formatowanie tekstu (kolory, zakreślanie b/i/u)
- Statystyki (wizyty / wypełnienia / konwersje)
- Udostępnianie (link / iframe / plik)
- Webhook
- Mobile friendly

## ZMIENNE ŚRODOWISKOWE
Jeśli dodasz zmienną:
- `ADMIN_USERNAME` - domyślny login administratora (adres e-mail, np. `admin@1tap.pl`). Na ten adres wysyłane są alerty i powiadomienia.
- `ADMIN_PASSWORD` - domyślne hasło administratora (jeśli brak tej zmiennej oraz konfiguracji w bazie, logowanie jest wyłączone).
- `DATABASE_PATH` - ścieżka do pliku bazy danych SQLite (np. `data/db.sqlite`).
- `NEXT_PUBLIC_APP_URL` - domyślny bazowy adres URL aplikacji używany do generowania linków udostępniania i kodów iframe.

### Konfiguracja SMTP (do wysyłania alertów i powiadomień e-mail)
Aplikacja posiada wbudowanego klienta SMTP pracującego bezpośrednio na protokole SSL (port 465):
- `SMTP_HOST` - host serwera pocztowego (np. `smtp.gmail.com`).
- `SMTP_PORT` - port serwera pocztowego (domyślnie `465` dla połączenia SSL/TLS).
- `SMTP_USER` - login SMTP (zazwyczaj adres e-mail nadawcy).
- `SMTP_PASS` - hasło SMTP (np. hasło aplikacji wygenerowane w ustawieniach konta Google).

---

## NOWE FUNKCJE BEZPIECZEŃSTWA I POWIADOMIENIA

### 🔑 Weryfikacja dwuskładnikowa (2FA / MFA)
Wdrożona została weryfikacja czasowa TOTP (Time-Based One-Time Password) kompatybilna z aplikacją Google Authenticator, Authy itp.
- Aktywacja odbywa się w panelu głównym administratora w zakładce **"Bezpieczeństwo i 2FA"**.
- Po poprawnym podaniu hasła na ekranie logowania, system poprosi o podanie 6-cyfrowego kodu wygenerowanego na telefonie.

### 🛡️ Ochrona przed botami i próby logowania (Lockout)
- **Limit prób:** Maksymalnie 5 błędnych prób logowania pod rząd blokuje możliwość autoryzacji na 15 minut.
- **Wymuszone opóźnienie:** Każde błędne logowanie wywołuje 1-sekundowe sztuczne opóźnienie odpowiedzi, co drastycznie spowalnia boty brute-force.

### 📧 Alerty bezpieczeństwa (Geo-IP)
Przy każdym logowaniu (zarówno udanym, jak i przy błędnych próbach) na adres e-mail administratora wysyłany jest alert bezpieczeństwa zawierający:
- Adres IP,
- Zlokalizowaną geograficznie lokalizację logowania (Miasto, Region, Kraj, ISP) przy użyciu publicznego Geo-IP API,
- Dokładną przeglądarkę i system (User-Agent).

### 👤 Zarządzanie danymi z panelu
Możliwość wygodnej zmiany loginu (adresu e-mail) oraz hasła administratora bezpośrednio w zakładce **"Bezpieczeństwo"**.

### ✉️ Powiadomienia e-mail o nowym wypełnieniu ankiety
W ustawieniach konkretnej ankiety w edytorze można aktywować przesyłanie pełnych odpowiedzi z ankiety bezpośrednio na adres e-mail administratora.
