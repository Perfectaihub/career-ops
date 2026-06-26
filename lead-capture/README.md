# PerfectAI — Conference Lead Capture

A mobile-first form that conference contacts use to hand **us** their details
(name, email, company, phone, interest). Submissions save to **Airtable**.
Branded to match Ash's PerfectAI digital business card and deployed to
**Cloudflare Pages** with a serverless function so the Airtable token never
reaches the browser.

> **vCard vs. this app.** The vCard business card hands out *Ash's* info (a
> self-contained QR that works offline). **This app captures the *visitor's*
> info**, so its QR points at a live URL and the visitor needs connectivity to
> load it. That's expected.

## Stack

- **Astro 5** (static output) + **Tailwind v4** (`@tailwindcss/vite`) + **TypeScript**
- **Cloudflare Pages** (static hosting) + **Pages Functions** (`functions/api/lead.ts`)
- **Airtable** REST API as the datastore

The form is a single static screen, so the site ships as static HTML/CSS for a
fast first paint. The only server-side code is the `functions/api/lead.ts`
Pages Function, which holds the Airtable token in Cloudflare secrets and writes
the row server-side — the token is never in the client bundle or any response.

## Layout

```
lead-capture/
├── functions/api/lead.ts      # POST handler → validates, honeypot, writes Airtable
├── public/
│   ├── logo.png               # Ash drops PerfectAILogo-Teal.png here (see public/README.md)
│   ├── favicon.svg            # placeholder mark
│   └── qr/                    # generated QR (connect.png + connect.svg)
├── scripts/gen-qr.mjs         # branded QR generator
├── src/
│   ├── components/LeadForm.astro
│   ├── layouts/Layout.astro
│   ├── pages/{index,connect}.astro   # form served at / and /connect
│   └── styles/global.css      # Tailwind v4 + brand tokens
├── astro.config.mjs
└── wrangler.toml
```

## Develop

```bash
cd lead-capture
npm install

# Astro dev server (form UI only — /api/lead is a Pages Function, see below)
npm run dev

# Full local run WITH the Pages Function (Airtable write):
echo 'AIRTABLE_TOKEN="..."'   >  .dev.vars
echo 'AIRTABLE_BASE_ID="..."' >> .dev.vars
echo 'AIRTABLE_TABLE="Leads"' >> .dev.vars
npm run build
npm run preview     # wrangler pages dev ./dist — serves static + functions
```

`.dev.vars` is gitignored. Never commit secrets.

## Airtable setup

Create a base with a table named **`Leads`** (or set `AIRTABLE_TABLE` to your name):

| Field        | Type                                                        |
|--------------|-------------------------------------------------------------|
| Name         | Single line text                                            |
| Email        | Email                                                       |
| Company      | Single line text                                            |
| Phone        | Phone                                                       |
| Interest     | Long text                                                   |
| Source       | Single line text                                            |
| Event        | Single line text                                            |
| Status       | Single select: New / Contacted / Qualified / Dropped (default New) |
| Captured At  | Created time                                                |

The function writes `Name, Email, Company, Phone, Interest, Source, Event`.
`Status` (default **New**) and `Captured At` are filled by Airtable. The write
uses `typecast: true` so single-select/typed fields are tolerant.

Personal access token scopes: **`data.records:write`** (add
**`data.records:read`** to enable the dedupe-by-email lookup).

## Deploy (Cloudflare Pages)

```bash
npm run build          # → dist/
wrangler pages deploy ./dist
```

Then in **CF Pages → Settings → Environment variables (Production)** set:

| Variable          | Value                          |
|-------------------|--------------------------------|
| `AIRTABLE_TOKEN`  | your Airtable PAT (secret)     |
| `AIRTABLE_BASE_ID`| `appXXXXXXXXXXXXXX`            |
| `AIRTABLE_TABLE`  | `Leads` (optional; default)    |

Optional custom domain: `connect.perfectaihub.com` via Cloudflare DNS.

## QR code

After the live URL is known:

```bash
npm run qr -- https://connect.perfectaihub.com
# → public/qr/connect.png (1024px, print)  +  public/qr/connect.svg
```

Modules are ink `#0D2626` on white, error-correction **H**.

## Behavior notes

- **Form fields:** Full name (required), Email (required, validated), Company,
  Phone, Interest (optional). Hidden `source="Conference Card"` and
  `event="Conference 2026"`. Hidden honeypot `website2`.
- **Honeypot:** if `website2` is filled, the function returns `{ok:true}` and
  silently drops the submission — bots think they succeeded.
- **Dedupe:** best-effort by email — an existing row with the same email is
  updated rather than duplicated (requires `data.records:read`).
- **Accessibility:** real labels, visible focus rings, inline validation,
  keyboard-friendly, `prefers-reduced-motion` respected.
- **Success-screen "Save Ash's contact" button:** set `VCARD_URL` in
  `src/components/LeadForm.astro` to the hosted vCard card URL to show it.
