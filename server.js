import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3017;

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.jsonl');
fs.mkdirSync(DATA_DIR, { recursive: true });

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const NOTIFY_TO = process.env.NOTIFY_TO || 'Josh@OffenhartzLaw.Com';
const NOTIFY_FROM = process.env.NOTIFY_FROM || 'Offenhartz Law Site <onboarding@resend.dev>';
const ADMIN_KEY = process.env.ADMIN_KEY || ''; // set in prod to view submissions

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));

// Static assets
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (/\.(svg|png|jpe?g|webp|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    }
  },
}));

// Health
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// Crude per-IP rate limit (memory; resets on restart). 6 submissions / hour / IP.
const submissions = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (submissions.get(ip) || []).filter(t => now - t < 3600_000);
  if (arr.length >= 6) return true;
  arr.push(now);
  submissions.set(ip, arr);
  return false;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendViaResend({ name, email, phone, company, message, ip, source }) {
  if (!RESEND_API_KEY) return { sent: false, reason: 'no_api_key' };
  const subject = `New inquiry from ${name}`;
  const lines = [
    `From: ${name} <${email}>`,
    phone ? `Phone: ${phone}` : null,
    company ? `Company: ${company}` : null,
    source ? `Source: ${source}` : null,
    `IP: ${ip}`,
    `Received: ${new Date().toISOString()}`,
    '',
    'Message:',
    message || '(no message provided)',
  ].filter(Boolean).join('\n');
  const html = `
    <table style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;border-collapse:collapse;width:100%;max-width:600px">
      <tr><td style="padding:16px 0;border-bottom:2px solid #c7a400">
        <h2 style="color:#1c3154;margin:0;font-family:Georgia,serif">New matter inquiry</h2>
        <p style="color:#666;margin:6px 0 0;font-size:13px">Submitted via offenhartzlaw.com</p>
      </td></tr>
      <tr><td style="padding:20px 0">
        <table style="border-collapse:collapse">
          <tr><td style="padding:6px 12px 6px 0;color:#666;font-size:13px">Name</td><td style="padding:6px 0;font-weight:600">${escapeHtml(name)}</td></tr>
          <tr><td style="padding:6px 12px 6px 0;color:#666;font-size:13px">Email</td><td style="padding:6px 0"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
          ${phone ? `<tr><td style="padding:6px 12px 6px 0;color:#666;font-size:13px">Phone</td><td style="padding:6px 0"><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></td></tr>` : ''}
          ${company ? `<tr><td style="padding:6px 12px 6px 0;color:#666;font-size:13px">Company / matter</td><td style="padding:6px 0">${escapeHtml(company)}</td></tr>` : ''}
        </table>
      </td></tr>
      <tr><td style="padding:0 0 20px">
        <div style="background:#fbfaf7;border-left:3px solid #c7a400;padding:14px 16px;white-space:pre-wrap;font-size:14px;color:#15182a">${escapeHtml(message)}</div>
      </td></tr>
      <tr><td style="padding:14px 0;border-top:1px solid #eee;color:#999;font-size:12px">
        Reply directly to this email to respond to ${escapeHtml(name)}. IP: ${escapeHtml(ip)} &middot; ${new Date().toISOString()}
      </td></tr>
    </table>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: NOTIFY_FROM,
        to: [NOTIFY_TO],
        reply_to: email,
        subject,
        text: lines,
        html,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { sent: false, reason: `resend_${r.status}`, detail: data };
    return { sent: true, id: data.id };
  } catch (err) {
    return { sent: false, reason: 'fetch_error', detail: err?.message };
  }
}

app.post('/api/contact', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown';
    if (rateLimited(ip)) return res.status(429).json({ ok: false, error: 'Too many requests' });

    const { name, email, phone, company, message, source } = req.body || {};
    if (typeof name !== 'string' || typeof email !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing fields' });
    }
    const cleanName = name.trim().slice(0, 200);
    const cleanEmail = email.trim().slice(0, 200);
    const cleanPhone = (phone || '').trim().slice(0, 80);
    const cleanCompany = (company || '').trim().slice(0, 300);
    const cleanMessage = (message || '').trim().slice(0, 8000);
    const cleanSource = (source || '').trim().slice(0, 60);

    if (!cleanName || !cleanEmail || !cleanPhone) {
      return res.status(400).json({ ok: false, error: 'Name, email, and phone are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ ok: false, error: 'Invalid email' });
    }

    const record = {
      ts: new Date().toISOString(),
      ip,
      ua: (req.headers['user-agent'] || '').slice(0, 240),
      source: cleanSource || 'unknown',
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      company: cleanCompany,
      message: cleanMessage,
    };

    // Always log to disk so nothing is lost even if email fails.
    fs.appendFileSync(SUBMISSIONS_FILE, JSON.stringify(record) + '\n');

    const emailResult = await sendViaResend(record);
    console.log(JSON.stringify({ event: 'contact_submitted', email: cleanEmail, name: cleanName, ...emailResult }));

    res.json({ ok: true });
  } catch (err) {
    console.error('contact error', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Admin-only retrieval endpoint
app.get('/api/admin/submissions', (req, res) => {
  if (!ADMIN_KEY || req.headers['x-admin-key'] !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (!fs.existsSync(SUBMISSIONS_FILE)) return res.json({ ok: true, submissions: [] });
  const lines = fs.readFileSync(SUBMISSIONS_FILE, 'utf8').split('\n').filter(Boolean);
  const submissions = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  res.json({ ok: true, count: submissions.length, submissions });
});

// SPA-style fallback to index for any GET that isn't a file
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(JSON.stringify({
    event: 'server_started',
    port: PORT,
    resend_configured: Boolean(RESEND_API_KEY),
    admin_key_configured: Boolean(ADMIN_KEY),
    notify_to: NOTIFY_TO,
  }));
});
