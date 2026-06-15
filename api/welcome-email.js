// api/welcome-email.js
// Called by the portal immediately after a new client is saved to Supabase.
// Sends a branded welcome email with a one-click opt-in confirmation link.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clientId, clientName, clientEmail, consentToken } = req.body;

  if (!clientId || !clientName || !clientEmail || !consentToken) {
    return res.status(400).json({ error: 'Missing required fields: clientId, clientName, clientEmail, consentToken' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  // The confirmation link calls /api/confirm-consent with the token
  const confirmUrl = `https://www.knorwoodcre.com/api/confirm-consent?token=${consentToken}`;
  const unsubUrl   = `https://www.knorwoodcre.com/api/confirm-consent?token=${consentToken}&unsubscribe=true`;

  const emailText = `Hi ${clientName},

Kam Norwood with Knorwood Commercial Real Estate has added you to his property update list.

Every morning, you'll receive a personalized email with commercial properties that match your search criteria — no spam, just relevant listings.

To confirm you'd like to receive these updates, click the link below:

✅ CONFIRM MY SUBSCRIPTION
${confirmUrl}

If you did NOT request this or don't want to receive updates, you can ignore this email or click here to opt out:
${unsubUrl}

—
Kam Norwood
Commercial Real Estate Broker
(520) 360-8510
kam@knorwoodcre.com
knorwoodcre.com`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: 'Kam Norwood CRE <kam@knorwoodcre.com>',
        to: [clientEmail],
        reply_to: 'kam@knorwoodcre.com',
        subject: 'Confirm your property update subscription – Knorwood CRE',
        text: emailText
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend error:', data);
      return res.status(response.status).json({ error: data.message || 'Failed to send welcome email' });
    }

    return res.status(200).json({ success: true, id: data.id });

  } catch (err) {
    console.error('Welcome email error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
