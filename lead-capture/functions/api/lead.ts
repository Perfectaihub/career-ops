/**
 * POST /api/lead — Cloudflare Pages Function.
 *
 * Receives a lead from the conference form and writes it to Airtable.
 * The Airtable token lives only in Cloudflare Pages secrets and never leaves
 * this Worker — it is not in the client bundle and never appears in a response.
 */

interface Env {
  AIRTABLE_TOKEN: string;
  AIRTABLE_BASE_ID: string;
  AIRTABLE_TABLE?: string;
}

interface LeadPayload {
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
  interest?: string;
  source?: string;
  event?: string;
  website2?: string; // honeypot
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = 2000; // hard cap on any single field, defensive

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });

const clean = (v: unknown): string =>
  typeof v === 'string' ? v.trim().slice(0, MAX) : '';

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  // Only POST is allowed.
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed.' }, 405);
  }

  // Parse body
  let data: LeadPayload;
  try {
    data = (await request.json()) as LeadPayload;
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }

  // Honeypot: a filled `website2` means a bot. Pretend success, drop silently.
  if (clean(data.website2)) {
    return json({ ok: true });
  }

  // Validate required fields
  const name = clean(data.name);
  const email = clean(data.email);
  if (!name) {
    return json({ ok: false, error: 'Name is required.' }, 400);
  }
  if (!email || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'A valid email is required.' }, 400);
  }

  // Server misconfiguration — never echo secrets, just a generic message.
  if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) {
    return json({ ok: false, error: 'Server not configured.' }, 500);
  }

  const company = clean(data.company);
  const phone = clean(data.phone);
  const interest = clean(data.interest);
  const source = clean(data.source) || 'Conference Card';
  const event = clean(data.event) || 'Conference 2026';

  const table = encodeURIComponent(env.AIRTABLE_TABLE || 'Leads');
  const base = encodeURIComponent(env.AIRTABLE_BASE_ID);
  const endpoint = `https://api.airtable.com/v0/${base}/${table}`;

  const authHeaders = {
    Authorization: `Bearer ${env.AIRTABLE_TOKEN}`,
    'Content-Type': 'application/json',
  };

  try {
    // Best-effort dedupe by email: if this email already exists, update the
    // existing row instead of creating a duplicate. Failures here are non-fatal.
    let existingId: string | null = null;
    try {
      const escaped = email.replace(/'/g, "\\'");
      const filter = encodeURIComponent(`LOWER({Email}) = '${escaped.toLowerCase()}'`);
      const lookup = await fetch(`${endpoint}?filterByFormula=${filter}&maxRecords=1`, {
        headers: authHeaders,
      });
      if (lookup.ok) {
        const found = (await lookup.json()) as { records?: Array<{ id: string }> };
        existingId = found.records?.[0]?.id ?? null;
      }
    } catch {
      // ignore — fall through to create
    }

    const fields: Record<string, string> = {
      Name: name,
      Email: email,
      Company: company,
      Phone: phone,
      Interest: interest,
      Source: source,
      Event: event,
    };

    const airtableRes = existingId
      ? await fetch(endpoint, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ records: [{ id: existingId, fields }] }),
        })
      : await fetch(endpoint, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ fields, typecast: true }),
        });

    if (!airtableRes.ok) {
      // Log server-side for debugging; do NOT surface Airtable internals/token.
      const detail = await airtableRes.text().catch(() => '');
      console.error('Airtable write failed', airtableRes.status, detail);
      return json({ ok: false, error: 'Could not save right now.' }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    console.error('Lead handler error', err);
    return json({ ok: false, error: 'Could not save right now.' }, 500);
  }
};
