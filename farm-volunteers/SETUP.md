# Farm Volunteer Portal — Setup Guide

## What you need accounts for (all free to start)

| Service | Cost | Sign up at |
|---------|------|-----------|
| Supabase | Free | supabase.com |
| Resend | Free (3,000 emails/mo) | resend.com |
| Twilio | ~$0.01/text | twilio.com |

---

## Step 1 — Supabase

1. Go to supabase.com → New Project → give it any name.
2. Once created, go to **SQL Editor** and paste + run the entire contents of `supabase-schema.sql`.
3. Go to **Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ keep this secret

---

## Step 2 — Resend

1. Go to resend.com → create account → **API Keys → Create Key**.
2. Copy the key → `RESEND_API_KEY`.
3. Add and verify your sending domain (e.g. yourfarm.com) in **Domains**.
4. Set `RESEND_FROM_EMAIL` to something like `volunteers@yourfarm.com`.

---

## Step 3 — Twilio

1. Go to twilio.com → create account → verify your personal number.
2. From the Console dashboard copy:
   - Account SID → `TWILIO_ACCOUNT_SID`
   - Auth Token → `TWILIO_AUTH_TOKEN`
3. Go to **Phone Numbers → Get a Number** (costs ~$1/mo) → `TWILIO_PHONE_NUMBER` (format: +15550001234).

---

## Step 4 — Deploy to Vercel

1. Push this folder to a GitHub repo.
2. Go to vercel.com → **Add New Project** → import that repo.
3. In the Vercel project **Settings → Environment Variables**, add all the variables from `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
NEXT_PUBLIC_APP_URL       ← set to your Vercel URL, e.g. https://farm-volunteers.vercel.app
CRON_SECRET               ← any long random string, e.g. from passwordsgenerator.net
```

4. Click **Deploy**.

---

## Step 5 — Create your first admin

1. Go to your live site and register a normal account.
2. In Supabase → **Authentication → Users** → copy your User UUID.
3. Go to **SQL Editor** and run:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = 'paste-your-uuid-here';
   ```
4. Sign out and sign back in — you'll land on the admin dashboard.

---

## Daily Reminders

`vercel.json` configures a daily cron at 2:00 PM UTC that calls `/api/send-reminders`.
Volunteers with approved shifts the next day get an email and/or text reminder automatically.
(Vercel Cron is free on the Hobby plan for up to 2 jobs.)

---

## Running locally

```bash
cd farm-volunteers
npm install
cp .env.local.example .env.local
# fill in your real values in .env.local
npm run dev
```
