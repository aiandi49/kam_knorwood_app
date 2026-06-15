// api/confirm-consent.js
// Handles the confirmation link clicked from the welcome email.
// Updates email_consent in Supabase and returns a simple HTML confirmation page.

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const { token, unsubscribe } = req.query;

  if (!token) {
    return res.status(400).send(renderPage(
      'Invalid Link',
      'This confirmation link is invalid or has already been used.',
      '#c0392b'
    ));
  }

  try {
    if (unsubscribe === 'true') {
      // Opt OUT
      const { error } = await sb
        .from('email_consent')
        .update({
          consented: false,
          unsubscribed_at: new Date().toISOString()
        })
        .eq('consent_token', token);

      if (error) throw error;

      return res.status(200).send(renderPage(
        'You\'ve been unsubscribed',
        'You will no longer receive property updates from Knorwood CRE. If this was a mistake, please contact Kam directly at kam@knorwoodcre.com.',
        '#7f8c8d'
      ));

    } else {
      // Opt IN
      const { error } = await sb
        .from('email_consent')
        .update({
          consented: true,
          consented_at: new Date().toISOString()
        })
        .eq('consent_token', token);

      if (error) throw error;

      return res.status(200).send(renderPage(
        'You\'re confirmed! ✅',
        'Thank you! You\'ll now receive daily property updates from Kam Norwood CRE matching your search criteria. You can unsubscribe at any time by replying to any email.',
        '#c9a84c'
      ));
    }

  } catch (err) {
    console.error('Consent update error:', err);
    return res.status(500).send(renderPage(
      'Something went wrong',
      'We couldn\'t update your preferences. Please contact Kam directly at kam@knorwoodcre.com.',
      '#c0392b'
    ));
  }
}

function renderPage(title, message, accentColor) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} – Knorwood CRE</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Georgia', serif;
      background: #f5f2ec;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      padding: 48px 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .logo {
      font-size: 1.1rem;
      letter-spacing: 0.12em;
      color: #888;
      text-transform: uppercase;
      margin-bottom: 32px;
    }
    .accent-bar {
      width: 48px;
      height: 3px;
      background: ${accentColor};
      margin: 0 auto 28px;
      border-radius: 2px;
    }
    h1 {
      font-size: 1.6rem;
      color: #1a1a1a;
      margin-bottom: 16px;
      font-weight: normal;
    }
    p {
      font-size: 0.95rem;
      color: #555;
      line-height: 1.7;
      margin-bottom: 32px;
    }
    a.btn {
      display: inline-block;
      background: #1a1a1a;
      color: #fff;
      text-decoration: none;
      padding: 12px 28px;
      border-radius: 6px;
      font-size: 0.85rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .footer {
      margin-top: 40px;
      font-size: 0.78rem;
      color: #aaa;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Knorwood CRE</div>
    <div class="accent-bar"></div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a class="btn" href="https://www.knorwoodcre.com">View Properties</a>
    <div class="footer">
      Kam Norwood · Commercial Real Estate Broker · (520) 360-8510
    </div>
  </div>
</body>
</html>`;
}
