// api/send-email.js
// Vercel Serverless Function — proxies email sends to Resend
// The RESEND_API_KEY lives in Vercel → Settings → Environment Variables (never in the HTML)

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, name, subject, text } = req.body;

  // Basic validation
  if (!to || !subject || !text) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, text' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY environment variable is not set');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: 'Kam Norwood CRE <kam@knorwoodcre.com>',
        to: [to],
        reply_to: 'kam@knorwoodcre.com',
        subject: subject,
        text: text
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', data);
      return res.status(response.status).json({ error: data.message || 'Failed to send email' });
    }

    return res.status(200).json({ success: true, id: data.id });

  } catch (err) {
    console.error('Send email error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
