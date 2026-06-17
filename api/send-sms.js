// api/send-sms.js
// Sends an SMS via Twilio — notifies Kam instantly when someone clicks "I Want This"

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Missing required fields: to, message' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.error('Twilio env vars not set');
    return res.status(500).json({ error: 'SMS service not configured' });
  }

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: to,
          Body: message
        }).toString()
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Twilio error:', data);
      return res.status(response.status).json({ error: data.message || 'Failed to send SMS' });
    }

    return res.status(200).json({ success: true, sid: data.sid });

  } catch (err) {
    console.error('SMS error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
