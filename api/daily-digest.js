// api/daily-digest.js
// Vercel Cron Job — runs every day at 5am Arizona time (MST = UTC-7, MDT = UTC-6)
// Schedule set in vercel.json: "0 12 * * *" (noon UTC = 5am MST)

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Get all active consented clients with their search params
    const { data: clients, error: clientErr } = await sb
      .from('clients')
      .select(`
        id, name, email,
        client_search_params (
          property_type, listing_type,
          price_min, price_max,
          size_min, size_max,
          cap_rate_min, opportunity_zone
        ),
        email_consent (
          consented
        )
      `)
      .eq('status', 'active');

    if (clientErr) throw clientErr;

    // 2. Get all active properties
    const { data: properties, error: propErr } = await sb
      .from('properties')
      .select('*')
      .eq('status', 'active');

    if (propErr) throw propErr;

    let sent = 0, skipped = 0;

    for (const client of clients) {
      // Skip clients who haven't confirmed opt-in
      const consented = client.email_consent?.[0]?.consented;
      if (!consented) {
        skipped++;
        continue;
      }

      const params = client.client_search_params?.[0];

      // Try to find matching properties
      let matches = matchProperties(properties, params);

      // If no matches, send ALL properties so client always gets something
      const isFallback = matches.length === 0;
      if (isFallback) {
        matches = properties;
      }

      // If still no properties at all, skip
      if (matches.length === 0) {
        skipped++;
        continue;
      }

      const emailBody = buildEmailBody(client.name, matches, isFallback);

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: 'Kam Norwood CRE <kam@knorwoodcre.com>',
          to: [client.email],
          reply_to: 'kam@knorwoodcre.com',
          subject: `Your Daily Property Update – ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
          text: emailBody
        })
      });

      const status = emailRes.ok ? 'sent' : 'failed';

      await sb.from('email_log').insert({
        client_id: client.id,
        subject: 'Daily Property Update',
        listing_ids: matches.map(p => p.id.toString()),
        status
      });

      if (emailRes.ok) sent++;
      else skipped++;
    }

    return res.status(200).json({
      success: true,
      sent,
      skipped,
      total: clients.length
    });

  } catch (err) {
    console.error('Daily digest error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── MATCHING LOGIC ──────────────────────────────────────────
function matchProperties(properties, params) {
  if (!params) return properties;

  return properties.filter(p => {
    if (params.property_type && params.property_type !== '') {
      const clientType = params.property_type.toLowerCase();
      const propType = (p.property_type || '').toLowerCase();
      if (!propType.includes(clientType) && !clientType.includes(propType)) {
        const clientWords = clientType.split(/[\s\/]+/);
        const propWords = propType.split(/[\s\/]+/);
        const overlap = clientWords.some(w => propWords.includes(w));
        if (!overlap) return false;
      }
    }

    if (params.listing_type && params.listing_type !== '') {
      if (p.listing_type !== params.listing_type &&
          p.listing_type !== 'For Sale or Lease') return false;
    }

    if (params.price_min && p.price !== null) {
      const min = parsePrice(params.price_min);
      if (min && p.price < min) return false;
    }
    if (params.price_max && p.price !== null) {
      const max = parsePrice(params.price_max);
      if (max && p.price > max) return false;
    }

    if (params.size_min && p.sqft !== null) {
      const min = parseInt(params.size_min.replace(/,/g, ''));
      if (!isNaN(min) && p.sqft < min) return false;
    }
    if (params.size_max && p.sqft !== null) {
      const max = parseInt(params.size_max.replace(/,/g, ''));
      if (!isNaN(max) && p.sqft > max) return false;
    }

    if (params.cap_rate_min && p.cap_rate !== null) {
      const min = parseFloat(params.cap_rate_min);
      if (!isNaN(min) && p.cap_rate < min) return false;
    }

    if (params.opportunity_zone && !p.opportunity_zone) return false;

    return true;
  });
}

function parsePrice(val) {
  if (!val) return null;
  const s = val.replace(/[$,\s]/g, '').toLowerCase();
  if (s.endsWith('m')) return parseFloat(s) * 1_000_000;
  if (s.endsWith('k')) return parseFloat(s) * 1_000;
  return parseInt(s) || null;
}

// ── EMAIL TEMPLATE ──────────────────────────────────────────
function buildEmailBody(clientName, properties, isFallback) {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  const listings = properties.map(p => {
    const price = p.price ? `$${p.price.toLocaleString()}` : 'Price Not Disclosed';
    const sqft = p.sqft ? `${p.sqft.toLocaleString()} SF` : '';
    const cap = p.cap_rate ? ` · ${p.cap_rate}% CAP` : '';
    const oz = p.opportunity_zone ? ' · ★ Opportunity Zone' : '';
    const kam = p.kam_listing ? " [KAM'S LISTING]" : '';

    return [
      `${p.address1} – ${p.address2}${kam}`,
      `${p.property_type} · ${p.listing_type}`,
      `${price}${sqft ? ' · ' + sqft : ''}${cap}${oz}`,
      p.notes ? `Notes: ${p.notes}` : '',
      p.crexi_url ? `View on Crexi: ${p.crexi_url}` : '',
      ''
    ].filter(Boolean).join('\n');
  }).join('\n---\n\n');

  const intro = isFallback
    ? `Here are today's available commercial listings from Kam Norwood CRE for ${date}.\n\nNo properties exactly matched your saved search criteria today, but here's everything currently available — something here may interest you:`
    : `Here is your daily property update from Kam Norwood CRE for ${date}.\n\nI've matched ${properties.length} propert${properties.length === 1 ? 'y' : 'ies'} to your search criteria:`;

  return `Hi ${clientName},

${intro}

${listings}

To view all listings or update your search preferences, visit:
https://www.knorwoodcre.com

Best regards,
Kam Norwood
Commercial Real Estate Broker
(520) 360-8510
kam@knorwoodcre.com
knorwoodcre.com

---
You're receiving this because you opted in to daily property updates.
Reply to this email to unsubscribe.`;
}
