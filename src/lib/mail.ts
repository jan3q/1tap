import tls from 'tls';

export function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const host = process.env.SMTP_HOST || '';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';

  if (!host || !user || !pass) {
    console.warn('[SMTP] Brak skonfigurowanych zmiennych SMTP w .env. Wysyłanie e-maili pominięte.');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    // Timeout zabezpieczający połączenie przed zawieszeniem
    const socket = tls.connect({ host, port, rejectUnauthorized: false }, () => {
      // Połączenie nawiązane
    });

    socket.setTimeout(10000); // 10s timeout

    let step = 0;
    const send = (data: string) => {
      socket.write(data + '\r\n');
    };

    socket.on('data', (chunk) => {
      const response = chunk.toString();
      
      try {
        if (response.startsWith('220') && step === 0) {
          send(`EHLO ${host}`);
          step = 1;
        } else if (response.startsWith('250') && step === 1) {
          send('AUTH LOGIN');
          step = 2;
        } else if (response.startsWith('334') && step === 2) {
          send(Buffer.from(user).toString('base64'));
          step = 3;
        } else if (response.startsWith('334') && step === 3) {
          send(Buffer.from(pass).toString('base64'));
          step = 4;
        } else if (response.startsWith('235') && step === 4) {
          send(`MAIL FROM:<${user}>`);
          step = 5;
        } else if (response.startsWith('250') && step === 5) {
          send(`RCPT TO:<${to}>`);
          step = 6;
        } else if (response.startsWith('250') && step === 6) {
          send('DATA');
          step = 7;
        } else if (response.startsWith('354') && step === 7) {
          const body = [
            `From: <${user}>`,
            `To: <${to}>`,
            `Subject: ${subject}`,
            'Content-Type: text/plain; charset="utf-8"',
            '',
            text,
            '.',
          ].join('\r\n');
          send(body);
          step = 8;
        } else if (response.startsWith('250') && step === 8) {
          send('QUIT');
          step = 9;
        } else if (response.startsWith('221') && step === 9) {
          socket.end();
          resolve();
        }
      } catch (err) {
        socket.end();
        reject(err);
      }
    });

    socket.on('timeout', () => {
      socket.end();
      reject(new Error('SMTP Connection Timeout'));
    });

    socket.on('error', (err) => {
      socket.end();
      reject(err);
    });
  });
}
