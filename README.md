# Offenhartz Law landing page

Static landing page for [OffenhartzLaw.com](https://offenhartzlaw.com) plus a small Express server that handles the contact form.

## Quickstart

```bash
npm install
npm start
# -> http://localhost:3017
```

## Environment

| Variable | Required | Notes |
|---|---|---|
| `PORT` | no | Default 3017. Railway provides automatically. |
| `RESEND_API_KEY` | yes for production | If unset, submissions are logged to disk only. |
| `NOTIFY_TO` | no | Where contact form submissions are emailed. Default `Josh@OffenhartzLaw.Com`. |
| `NOTIFY_FROM` | no | Sender. Default uses Resend's `onboarding@resend.dev` until offenhartzlaw.com is verified in Resend. |
| `ADMIN_KEY` | no | Required to retrieve submissions via `GET /api/admin/submissions` with `x-admin-key` header. |

## Submissions

Every contact form submission is appended to `data/submissions.jsonl` (one JSON object per line) before the email send is attempted, so no inquiry is lost even if email is misconfigured.

## Deployment

GitHub auto-deploy to Railway, per the project convention. Push to `main` and Railway redeploys.

## DNS / custom domain

Domain is registered at Porkbun. To cut OffenhartzLaw.com over to this Railway service:
1. Add custom domain in Railway dashboard for this service.
2. Copy the CNAME target Railway provides.
3. In Porkbun, set `offenhartzlaw.com` A/ALIAS record (apex) and `www.offenhartzlaw.com` CNAME to the Railway target.
4. **Do not touch the MX records** &mdash; they point to Microsoft 365 and must stay.

## Brand

Source files in `/brand/` (gitignored). Web-ready logos and the headshot live in `/public/assets/`.
