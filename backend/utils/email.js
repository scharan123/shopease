const path = require('path');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');

// Initialise SendGrid if key is present
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

function sgFrom(displayName) {
  const from = (process.env.SENDGRID_FROM_EMAIL || '').trim();
  return `"${displayName}" <${from || 'noreply@shopease.com'}>`;
}

async function sgSend(msg) {
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
    console.warn('[SendGrid] SENDGRID_API_KEY or SENDGRID_FROM_EMAIL missing — email skipped.');
    return false;
  }
  try {
    await sgMail.send(msg);
    return true;
  } catch (err) {
    console.error('[SendGrid] Send error:', err.response ? JSON.stringify(err.response.body) : err.message);
    return false;
  }
}

// Ensure backend/.env is loaded before any credential is read. server.js
// already loads it with an explicit path, but requiring dotenv here with the
// same explicit backend path (and only reading values that are still unset)
// also keeps standalone scripts safe and makes this module independent of the
// current working directory - it can never accidentally read frontend/.env or
// miss backend/.env because the process was started from another folder.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ---------------------------------------------------------------------------
// Mail transport configuration
// ---------------------------------------------------------------------------
// Gmail is the PRIMARY configuration for this app and is driven by two env
// vars in backend/.env:
//   GMAIL_USER=<your Gmail address>
//   GMAIL_APP_PASSWORD=<16-char Google App Password>
// An explicit SMTP_* block (SMTP_HOST + SMTP_USER + SMTP_PASS) is still honoured
// as an override, and EMAIL_USER / EMAIL_PASSWORD remain as legacy aliases.
//
// Credentials are only ever read from the environment - never hardcoded - and
// the password is never printed to logs. Placeholder/dummy passwords are never
// sent to Gmail at runtime; they are treated as "not configured" so the only
// error surfaced for them is the instruction to add a real App Password.
const PLACEHOLDER_PASSWORDS = [
  'your-app-password-here',
  'your-app-password',
  'your-email-password',
  'your-smtp-password',
  'changeme',
  'GOOGLE_GENERATED_APP_PASSWORD',
];

// Categorized mail errors so routes can return a precise, user-safe message
// without ever exposing the SMTP credentials.
class MailError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'MailError';
    this.code = code || 'SEND_FAILED';
  }
}

function classifySmtpError(err) {
  const msg = (err && err.message) || '';
  const responseCode = err && err.responseCode;
  const isBadCredentials =
    responseCode === 535 ||
    /invalid login|bad credentials|username and password not accepted|application-specific password/i.test(msg) ||
    /535/i.test(msg);
  if (isBadCredentials) return 'BAD_CREDENTIALS';
  if (responseCode === 421 || /too many concurrent|try again later/i.test(msg)) return 'SEND_FAILED';
  return 'SEND_FAILED';
}

// dotenv keeps values verbatim, so a stray space/newline (or pasting the value
// with surrounding quotes) silently breaks SMTP auth. Always trim.
function env(name) {
  const val = process.env[name];
  return val ? val.trim() : '';
}

// Google shows App Passwords as four groups of four characters
// ("abcd efgh ijkl mnop"). Pasting the value WITH those spaces (or any other
// whitespace/newline) makes Gmail reject the login with 535 BadCredentials,
// which is the most common cause of a "real looking" App Password failing.
// App Passwords never contain spaces, so remove ALL whitespace for Gmail only.
// (Generic SMTP passwords may legitimately contain spaces, so they are left
// untouched.)
function gmailAppPassword() {
  return env('GMAIL_APP_PASSWORD').replace(/\s+/g, '');
}

function isPlaceholderPassword(pass) {
  return !!pass && PLACEHOLDER_PASSWORDS.includes(pass);
}

function resolveMailConfig() {
  // PRIMARY configuration for this app: Gmail SMTP via GMAIL_USER +
  // GMAIL_APP_PASSWORD. These are the two vars documented in backend/.env and
  // are used unless a *complete* explicit SMTP_* block is configured.
  //
  // "configured" only becomes true when BOTH values are present AND the
  // password is a real value (not a known placeholder/dummy). A placeholder
  // password is NOT sent to Gmail at runtime: attempting SMTP auth with it
  // always fails with Gmail's "535 Username and Password not accepted" and
  // wastes a /forgot-password round-trip for no information. Only real
  // credentials reach the SMTP layer, so Gmail's genuine 535 result is only
  // ever surfaced for a password that is actually present but wrong.
  const gmailUser = env('GMAIL_USER');
  const gmailPass = gmailAppPassword();
  const gmailPlaceholder = isPlaceholderPassword(gmailPass);

  const gmailUsable = !!(gmailUser && gmailPass && !gmailPlaceholder);
  if (gmailUsable) {
    return {
      method: 'Gmail (smtp.gmail.com:465)',
      user: gmailUser,
      from: env('SMTP_FROM') || gmailUser,
      configured: true,
      placeholder: false,
      init: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: gmailUser, pass: gmailPass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      },
    };
  }

  // Optional override / fallback: a complete SMTP_* (or legacy EMAIL_*) block.
  const smtpHost = env('SMTP_HOST');
  const smtpUser = env('SMTP_USER') || env('EMAIL_USER');
  const smtpPass = env('SMTP_PASS') || env('EMAIL_PASSWORD');
  const smtpPlaceholder = isPlaceholderPassword(smtpPass);

  if (smtpHost && smtpUser && smtpPass && !smtpPlaceholder) {
    const smtpPort = env('SMTP_PORT');
    const smtpSecure = env('SMTP_SECURE').toLowerCase() === 'true';
    return {
      method: `SMTP ${smtpHost}:${smtpPort || 587}`,
      user: smtpUser,
      // SMTP_FROM (when present) is the "From" address shown to recipients;
      // it should match the authenticated account. Fall back to SMTP_USER.
      from: env('SMTP_FROM') || smtpUser,
      configured: true,
      placeholder: false,
      init: {
        host: smtpHost,
        port: parseInt(smtpPort, 10) || 587,
        secure: !!smtpSecure,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      },
    };
  }

  // Nothing usable configured (missing OR placeholder) - report the intended
  // Gmail endpoint so the startup diagnostics still make sense. `placeholder`
  // distinguishes a dummy value (needs replacing) from a genuinely missing one.
  return {
    method: 'Gmail (smtp.gmail.com:465)',
    user: gmailUser,
    from: env('SMTP_FROM') || gmailUser,
    configured: false,
    placeholder: gmailPlaceholder || smtpPlaceholder,
    init: {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    },
  };
}

let transporter = null;
let mailConfig = resolveMailConfig();

// Re-resolves config and rebuilds the transporter if credentials changed since
// last check (e.g. .env was updated without a server restart). This way the
// forgot-password flow works as soon as the App Password is added to .env,
// without requiring a restart.
function getOrRebuildTransporter() {
  // Re-read env each time so a live .env change is picked up automatically
  const freshConfig = resolveMailConfig();

  // If credentials changed (not configured → configured, or user changed), rebuild.
  const credentialChanged = freshConfig.configured !== mailConfig.configured
    || freshConfig.user !== mailConfig.user;

  if (credentialChanged) {
    console.log('[Mail] Credentials changed since last check — rebuilding transporter.');
    mailConfig = freshConfig;
    transporter = null; // force rebuild below
  }

  if (mailConfig.configured && !transporter) {
    transporter = nodemailer.createTransport(mailConfig.init);
    console.log('[Mail] Nodemailer transporter (re)created.');
  }

  return transporter;
}

// Snapshot of whether real SMTP credentials are present. Shared with routes so
// they can return a precise message ("not configured" vs "authentication
// failed") without ever touching the credentials themselves.
function getMailStatus() {
  return {
    configured: mailConfig.configured,
    placeholder: mailConfig.placeholder,
    ready: mailConfig.configured && !!transporter,
    method: mailConfig.method,
    user: mailConfig.user || null,
  };
}

// The From address must match the authenticated SMTP account, so it always
// uses the resolved mailConfig.from / mailConfig.user (never a hardcoded
// literal). SMTP_FROM can override the display address when it differs from
// SMTP_USER.
function fromAddress(displayName) {
  const sender = mailConfig.from || mailConfig.user;
  return `"${displayName}" <${sender || 'noreply@shopease.local'}>`;
}

function missingCredentialNames() {
  const missing = [];
  if (!(env('SMTP_USER') || env('EMAIL_USER') || env('GMAIL_USER'))) missing.push('GMAIL_USER');
  const gmailPass = gmailAppPassword();
  const smtpPass = env('SMTP_PASS') || env('EMAIL_PASSWORD');
  const pass = gmailPass || smtpPass;
  if (!pass) {
    missing.push('GMAIL_APP_PASSWORD');
  } else if (isPlaceholderPassword(pass)) {
    missing.push('GMAIL_APP_PASSWORD (set to placeholder/dummy value)');
  }
  return missing;
}

function initMailer() {
  if (transporter) return true;

  // Safe startup diagnostics: report presence/absence of the credential env
  // vars and the exact SMTP endpoint, WITHOUT ever printing the password.
  const gmailUser = env('GMAIL_USER');
  const gmailPass = gmailAppPassword();
  const pwdIsPlaceholder = isPlaceholderPassword(gmailPass);

  console.log(`[Mail] GMAIL_USER configured: ${gmailUser ? 'true' : 'false'}`);
  console.log(`[Mail] GMAIL_APP_PASSWORD configured: ${gmailPass ? 'true' : 'false'}`);
  if (gmailPass && pwdIsPlaceholder) {
    console.log('[Mail] GMAIL_APP_PASSWORD is set to a PLACEHOLDER/dummy value - it will NOT be sent to Gmail or used at runtime.');
  }
  console.log(`[Mail] Transport: ${mailConfig.method} (user: ${mailConfig.user || 'NOT SET'})`);
  console.log(`[Mail] SMTP host/port/secure -> ${mailConfig.init.host}:${mailConfig.init.port} secure=${mailConfig.init.secure}`);

  if (!mailConfig.configured) {
    // Password is genuinely missing/empty OR still a placeholder/dummy value.
    // Do NOT create the transporter and do NOT attempt SMTP auth with it.
    // The exact one-line instruction below is the only guidance given.
    console.log('[Mail] Add your Google-generated App Password to backend/.env and restart the backend.');
    return false;
  }

  // Real credentials are present. Create the transporter and let the live SMTP
  // check report Gmail's REAL result: a genuine wrong/revoked password surfaces
  // Gmail's "535-5.7.8 Username and Password not accepted" instead of a generic
  // "not configured" message.
  transporter = nodemailer.createTransport(mailConfig.init);
  console.log('[Mail] Nodemailer transporter created.');
  return true;
}

// Verify the SMTP connection once at startup and log the result. Never blocks
// the HTTP server from starting; it only reports connectivity. The raw
// Nodemailer error (e.g. Gmail "Invalid login: 535-5.7.8 ...") is logged.
async function checkMailConnection() {
  if (!transporter) return false;
  try {
    console.log(`[Mail] Running transporter.verify() against ${mailConfig.init.host}:${mailConfig.init.port} ...`);
    const ok = await transporter.verify();
    console.log(`[Mail] SMTP connection OK (${mailConfig.method})`);
    return ok;
  } catch (err) {
    if (classifySmtpError(err) === 'BAD_CREDENTIALS') {
      // Credentials were present and real-looking, but Gmail rejected them.
      // Report the clear, actionable message. The password itself is never
      // printed (Gmail 535 messages contain the username, not the password).
      console.error('[Mail] Gmail SMTP authentication failed. Check GMAIL_USER and GMAIL_APP_PASSWORD.');
    }
    console.error(`[Mail] SMTP connection verification FAILED (${mailConfig.method}). Reason: ${err.message}`);
    return false;
  }
}

const mailReady = initMailer();

if (mailReady) {
  // Fire-and-forget startup connectivity check.
  checkMailConnection();
}

function buildOrderEmail({ orderId, items, total, subtotal, discount, couponCode, shippingAddress, paymentMethod, status, createdAt }) {
  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const paymentLabel = { cod: 'Cash on Delivery', card: 'Credit / Debit Card', upi: 'UPI Payment', netbanking: 'Net Banking' }[paymentMethod] || paymentMethod.toUpperCase();
  const statusColor = status === 'delivered' ? '#10b981' : status === 'cancelled' ? '#ef4444' : '#f59e0b';
  const statusBg   = status === 'delivered' ? '#ecfdf5'  : status === 'cancelled' ? '#fef2f2'  : '#fffbeb';

  const itemRows = items.map((it) => `
    <tr>
      <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:600;color:#0f172a;">${it.name}<br><span style="font-size:12px;color:#64748b;font-weight:400;">Qty: ${it.quantity} &times; &#8377;${parseFloat(it.price).toFixed(2)}</span></td>
      <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:14px;font-weight:700;color:#1e3a8a;white-space:nowrap;">&#8377;${(parseFloat(it.price) * it.quantity).toFixed(2)}</td>
    </tr>`).join('');

  const estimatedDelivery = (() => {
    const d = new Date(createdAt); d.setDate(d.getDate() + 5);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  })();

  const subtotalNum = Number(subtotal) || 0;
  const discountNum = Number(discount) || 0;
  const totalNum = Number(total) || 0;
  const deliveryCharge = 0; // Free shipping
  const hasDiscount = discountNum > 0;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Order Confirmed - ShopEase</title></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,-apple-system,sans-serif;">
<div style="max-width:620px;margin:32px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.12);">

  <!-- HEADER -->
  <div style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 60%,#3b82f6 100%);padding:40px 48px;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.07);"></div>
    <div style="position:absolute;bottom:-40px;left:-20px;width:100px;height:100px;border-radius:50%;background:rgba(255,255,255,0.05);"></div>
    <div style="position:relative;z-index:1;">
      <div style="display:inline-block;background:rgba(255,255,255,0.15);padding:5px 14px;border-radius:50px;font-size:12px;font-weight:700;color:#bfdbfe;letter-spacing:0.07em;margin-bottom:18px;border:1px solid rgba(255,255,255,0.2);">&#10003; ORDER CONFIRMED</div>
      <h1 style="margin:0 0 10px;font-size:30px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">Your order is placed!</h1>
      <p style="margin:0;font-size:15px;color:#bfdbfe;line-height:1.5;">Thank you for shopping with <strong style="color:#fff;">ShopEase</strong>. We're getting your items ready.</p>
    </div>
  </div>

  <!-- ORDER META -->
  <div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:20px 48px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:6px 0;"><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:700;">Order No.</span><br><span style="font-size:20px;font-weight:800;color:#1e3a8a;">#${orderId}</span></td>
        <td style="padding:6px 0;text-align:center;"><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:700;">Date</span><br><span style="font-size:13px;font-weight:600;color:#1e293b;">${formatDate(createdAt)}</span></td>
        <td style="padding:6px 0;text-align:right;"><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:700;">Status</span><br><span style="display:inline-block;margin-top:4px;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;background:${statusBg};color:${statusColor};text-transform:capitalize;">${status}</span></td>
      </tr>
    </table>
  </div>

  <!-- BODY -->
  <div style="padding:36px 48px;">

    <!-- Items -->
    <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Items Ordered</p>
    <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#f8fafc;">
          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Product</th>
          <th style="padding:10px 16px;text-align:right;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Amount</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
    </div>

    <!-- Order Summary -->
    <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Order Summary</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:28px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#374151;">Subtotal</td>
          <td style="padding:8px 0;text-align:right;font-size:14px;font-weight:600;color:#1e293b;">&#8377;${subtotalNum.toFixed(2)}</td>
        </tr>
        ${hasDiscount ? `
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#059669;">Discount${couponCode ? ` (${couponCode})` : ''}</td>
          <td style="padding:8px 0;text-align:right;font-size:14px;font-weight:600;color:#059669;">-&#8377;${discountNum.toFixed(2)}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#374151;">Delivery Charge</td>
          <td style="padding:8px 0;text-align:right;font-size:14px;font-weight:600;color:#059669;">Free</td>
        </tr>
        <tr style="border-top:2px solid #e2e8f0;">
          <td style="padding:12px 0 8px 0;font-size:16px;font-weight:700;color:#1e3a8a;">Total</td>
          <td style="padding:12px 0 8px 0;text-align:right;font-size:20px;font-weight:800;color:#1e3a8a;">&#8377;${totalNum.toFixed(2)}</td>
        </tr>
      </table>
    </div>

    <!-- Shipping & Payment -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
      <tr>
        <td style="width:50%;padding-right:8px;vertical-align:top;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">&#128205; Shipping To</div>
            <div style="font-size:13px;color:#374151;line-height:1.7;white-space:pre-line;">${shippingAddress}</div>
          </div>
        </td>
        <td style="width:50%;padding-left:8px;vertical-align:top;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">&#128179; Payment</div>
            <div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:8px;">${paymentLabel}</div>
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">&#128666; Est. Delivery</div>
            <div style="font-size:14px;font-weight:700;color:#2563eb;">${estimatedDelivery}</div>
          </div>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;box-shadow:0 4px 20px rgba(37,99,235,0.35);letter-spacing:0.02em;">Continue Shopping &#8594;</a>
    </div>

    <p style="margin:0;font-size:13px;color:#94a3b8;text-align:center;line-height:1.6;">Questions? Reply to this email or contact <a href="mailto:support@shopease.com" style="color:#2563eb;text-decoration:none;">support@shopease.com</a></p>
  </div>

  <!-- FOOTER -->
  <div style="background:#0f172a;padding:24px 48px;text-align:center;">
    <div style="margin-bottom:10px;"><span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">ShopEase</span></div>
    <p style="margin:0 0 10px;color:#64748b;font-size:12px;">Premium quality products delivered to your door</p>
    <div style="margin-bottom:12px;">
      <a href="#" style="color:#64748b;font-size:12px;text-decoration:none;margin:0 8px;">Privacy Policy</a>
      <a href="#" style="color:#64748b;font-size:12px;text-decoration:none;margin:0 8px;">Terms</a>
      <a href="mailto:support@shopease.com" style="color:#64748b;font-size:12px;text-decoration:none;margin:0 8px;">Support</a>
    </div>
    <p style="margin:0;color:#475569;font-size:11px;">&#169; 2026 ShopEase. All rights reserved.</p>
  </div>
</div>
</body>
</html>`;
}


function buildSupportReplyEmail({ supportId, customerName, supportType, originalMessage, adminReply, status, createdAt }) {
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:640px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:40px 48px;color:#fff;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-50px;right:-50px;width:120px;height:120px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#3b82f6);opacity:0.15;"></div>
        <div style="position:absolute;bottom:-30px;left:-30px;width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#10b981,#34d399);opacity:0.1;"></div>
        <div style="position:relative;z-index:1;">
          <div style="display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,0.1);padding:8px 16px;border-radius:50px;font-size:13px;font-weight:600;margin-bottom:16px;backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,0.2);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h8"/><path d="M8 14h5"/></svg>
            Support Response
          </div>
          <h1 style="margin:0;font-size:28px;font-weight:800;letter-spacing:-0.02em;">We've responded to your request</h1>
          <p style="margin:12px 0 0;opacity:0.85;font-size:16px;line-height:1.5;">Support ID: <strong style="color:#60a5fa;">${supportId}</strong></p>
        </div>
      </div>

      <!-- Body -->
      <div style="padding:40px 48px;">
        <!-- Greeting -->
        <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#0f172a;">Hello <strong style="color:#1e293b;">${customerName}</strong>,</p>
        <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">Our support team has reviewed your inquiry and provided a response below.</p>

        <!-- Request Summary Card -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:32px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#2563eb,#3b82f6);display:flex;align-items:center;justify-content:center;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <div>
              <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Request Type</p>
              <p style="margin:2px 0 0;font-size:15px;font-weight:600;color:#1e293b;">${supportType.charAt(0).toUpperCase() + supportType.slice(1).replace('_', ' ')}</p>
            </div>
          </div>
          <div style="display:flex;gap:24px;flex-wrap:wrap;">
            <div>
              <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Submitted</p>
              <p style="margin:2px 0 0;font-size:14px;font-weight:500;color:#1e293b;">${formatDate(createdAt)}</p>
            </div>
            <div>
              <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Status</p>
              <span style="display:inline-block;margin-top:2px;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:${status === 'closed' ? '#dcfce7' : '#dbeafe'};color:${status === 'closed' ? '#166534' : '#1e40af'};">
                ${status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
          </div>
        </div>

        <!-- Your Original Message -->
        <div style="margin-bottom:32px;">
          <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#374151;">Your Original Message</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;position:relative;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" style="position:absolute;top:16px;left:16px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;white-space:pre-wrap;padding-left:36px;">${originalMessage}</p>
          </div>
        </div>

        <!-- Admin Reply - Premium Highlighted -->
        <div style="margin-bottom:32px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
            <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#10b981,#34d399);display:flex;align-items:center;justify-content:center;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;">Admin Response</p>
          </div>
          <div style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);border:1px solid #bbf7d0;border-radius:12px;padding:24px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#10b981,#34d399);"></div>
            <p style="margin:0;color:#166534;font-size:15px;line-height:1.7;white-space:pre-wrap;">${adminReply}</p>
          </div>
        </div>

        <!-- Next Steps / CTA -->
        <div style="background:#fefce8;border:1px solid #fde047;border-radius:12px;padding:24px;margin-bottom:32px;text-align:center;">
          <div style="width:48px;height:48px;border-radius:12px;background:#fef08a;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#854d0e;">Need further assistance?</p>
          <p style="margin:0 0 16px;color:#a16207;font-size:14px;">Simply reply to this email or visit our support center. We're here to help!</p>
          <a href="mailto:support@shopease.com?subject=Re:%20Support%20${supportId}&body=Hi%20Team%2C%0A%0AI%20need%20further%20help%20with%20${supportId}%3A%0A%0A" 
             style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#ca8a04,#eab308);color:#fff;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;box-shadow:0 4px 14px rgba(202,138,4,0.3);transition:all 0.2s;">
            Reply to Support Team
          </a>
        </div>

        <!-- Divider -->
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

        <!-- Footer Info -->
        <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;text-align:center;">This is an automated response from ShopEase Support System</p>
        <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">If you didn't submit this request, please contact us immediately at security@shopease.com</p>
      </div>

      <!-- Footer -->
      <div style="background:#0f172a;padding:24px 48px;text-align:center;border-top:1px solid #1e293b;">
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 6H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/><path d="M3.5 12h17"/><path d="M12 8v8"/></svg>
          <span style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.02em;">ShopEase</span>
        </div>
        <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Premium quality products delivered to your door</p>
        <div style="display:flex;justify-content:center;gap:16px;margin-bottom:16px;">
          <a href="#" style="color:#64748b;font-size:13px;text-decoration:none;transition:color 0.2s;">Privacy Policy</a>
          <a href="#" style="color:#64748b;font-size:13px;text-decoration:none;transition:color 0.2s;">Terms of Service</a>
          <a href="#" style="color:#64748b;font-size:13px;text-decoration:none;transition:color 0.2s;">Contact Us</a>
        </div>
        <p style="margin:0;color:#475569;font-size:12px;">© 2026 ShopEase. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>`;
}

function buildWelcomeEmail({ name, email, createdAt }) {
  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
    <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.1);">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:40px 48px;color:#fff;text-align:center;">
        <div style="display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,0.12);padding:8px 20px;border-radius:50px;font-size:13px;font-weight:600;margin-bottom:18px;border:1px solid rgba(255,255,255,0.25);">
          Welcome to ShopEase
        </div>
        <h1 style="margin:0;font-size:28px;font-weight:800;letter-spacing:-0.02em;">Account Confirmed!</h1>
        <p style="margin:12px 0 0;opacity:0.9;font-size:15px;">Your registration was successful.</p>
      </div>

      <!-- Body -->
      <div style="padding:40px 48px;">
        <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#0f172a;">Hello <strong style="color:#2563eb;">${name}</strong>,</p>
        <p style="margin:0 0 8px;color:#64748b;font-size:15px;line-height:1.6;">
          Your ShopEase account has been created successfully with the email address
          <strong style="color:#1e293b;">${email}</strong>.
        </p>
        <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.6;">
          Thank you for joining us. You can now browse our products, add items to your cart, and place orders.
        </p>

        <!-- Account Details Card -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:28px;">
          <p style="margin:0 0 16px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Account Details</p>
          <div style="display:flex;justify-content:space-between;font-size:14px;padding:6px 0;">
            <span style="color:#64748b;">Registered Email</span>
            <span style="color:#1e293b;font-weight:600;">${email}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:14px;padding:6px 0;">
            <span style="color:#64748b;">Date Registered</span>
            <span style="color:#1e293b;font-weight:600;">${formatDate(createdAt) || 'Today'}</span>
          </div>
        </div>

        <a href="${process.env.FRONTEND_URL || 'http://localhost:5000'}"
           style="display:block;text-align:center;padding:14px 28px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;box-shadow:0 4px 14px rgba(37,99,235,0.3);">
          Start Shopping
        </a>

        <p style="margin:28px 0 0;color:#94a3b8;font-size:13px;text-align:center;">
          If you did not create this account, please contact us immediately at security@shopease.com
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#0f172a;padding:24px 48px;text-align:center;border-top:1px solid #1e293b;">
        <span style="font-size:18px;font-weight:800;color:#fff;letter-spacing:-0.02em;">ShopEase</span>
        <p style="margin:12px 0 0;color:#64748b;font-size:12px;">© 2026 ShopEase. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>`;
}

function canSendMail() {
  // Always re-check from current env so an App Password added after server start
  // is picked up immediately without requiring a restart.
  const t = getOrRebuildTransporter();
  return mailConfig.configured && !!t;
}

async function sendWelcomeEmail(user) {
  if (!user || !user.email) {
    console.warn('No email provided for welcome email, skipping.');
    return false;
  }
  if (!canSendMail()) {
    console.warn(`[Mail] Welcome email to ${user.email} skipped - SMTP not configured (see backend/.env).`);
    return false;
  }

  const html = buildWelcomeEmail({
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
  });

  const mailOptions = {
    from: fromAddress('ShopEase'),
    to: user.email,
    subject: 'Account Confirmed - Welcome to ShopEase',
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent to', user.email, '| Message ID:', info.messageId);
    return true;
  } catch (err) {
    console.error('Failed to send welcome email to', user.email, ':', err.message);
    return false;
  }
}

async function sendOrderConfirmation(order) {
  if (!order.email) {
    console.warn('No email provided for order #' + order.id + ', skipping email.');
    return;
  }

  const html = buildOrderEmail({
    orderId: order.id,
    items: order.items,
    total: order.total,
    subtotal: order.subtotal,
    discount: order.discount,
    couponCode: order.coupon_code,
    shippingAddress: order.shipping_address,
    paymentMethod: order.payment_method,
    status: order.status,
    createdAt: order.created_at,
  });

  const sent = await sgSend({
    to: order.email,
    from: sgFrom('ShopEase'),
    subject: `Order Confirmed - ShopEase`,
    html,
  });

  if (sent) {
    console.log('✅ Order confirmation email sent to', order.email);
  } else {
    console.error('❌ Failed to send order email to', order.email);
  }
}

async function sendSupportReplyEmail(supportRequest, adminReply) {
  if (!supportRequest.email) {
    console.warn('No email provided for support request #' + supportRequest.support_id + ', skipping email.');
    return false;
  }

  const html = buildSupportReplyEmail({
    supportId: supportRequest.support_id,
    customerName: supportRequest.name,
    supportType: supportRequest.support_type,
    originalMessage: supportRequest.description,
    adminReply: adminReply,
    status: supportRequest.status,
    createdAt: supportRequest.created_at,
  });

  const sent = await sgSend({
    to: supportRequest.email,
    from: sgFrom('ShopEase Support'),
    subject: `Re: Your Support Request ${supportRequest.support_id} - ${supportRequest.support_type.replace('_', ' ')}`,
    html,
  });

  if (sent) {
    console.log('✅ Support reply email sent to', supportRequest.email);
  } else {
    console.error('❌ Failed to send support reply email to', supportRequest.email);
  }
  return sent;
}

function buildOtpEmail({ name, email, otp, expiresInMinutes }) {
  const formatOtp = (otp) => {
    return String(otp).split('').map(d => `<span style="display:inline-block;width:40px;padding:12px 0;margin:0 4px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:6px;font-size:20px;font-weight:600;color:#111827;text-align:center;letter-spacing:2px;font-family:monospace;">${d}</span>`).join('');
  };

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <div style="max-width:600px;margin:40px auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <!-- Header -->
      <div style="background:#111827;padding:24px 32px;border-bottom:1px solid #e5e7eb;">
        <h1 style="margin:0;font-size:20px;font-weight:600;color:#ffffff;letter-spacing:-0.02em;">Password Reset</h1>
        <p style="margin:8px 0 0;font-size:14px;color:#9ca3af;">One-Time Password (OTP)</p>
      </div>

      <!-- Body -->
      <div style="padding:32px;">
        <p style="margin:0 0 8px;font-size:16px;font-weight:500;color:#111827;">Hello ${name},</p>
        <p style="margin:0 0 24px;color:#4b5563;font-size:14px;line-height:1.6;">
          We received a request to reset the password for your ShopEase account using <strong>${email}</strong>. Use the OTP below to continue.
        </p>

        <!-- OTP Box -->
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:24px;margin-bottom:24px;text-align:center;">
          <p style="margin:0 0 16px;font-size:12px;font-weight:500;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Your OTP</p>
          <div style="user-select:all;letter-spacing:4px;">${formatOtp(otp)}</div>
          <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">This code is valid for <strong>${expiresInMinutes} minutes</strong> and can be used only once.</p>
        </div>

        <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:16px;margin-bottom:24px;">
          <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
            <strong>Security note:</strong> If you did not request a password reset, please ignore this email. Do not share this OTP with anyone. Our team will never ask you for it.
          </p>
        </div>

        <p style="margin:0;color:#9ca3af;font-size:13px;text-align:center;line-height:1.5;">
          If you have any questions, contact us at security@shopease.com
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="margin:0;color:#9ca3af;font-size:12px;">© 2026 ShopEase. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>`;
}

async function sendOtpEmail({ name, email, otp, expiresInMinutes = 10 }) {
  if (!email) {
    console.warn('No email provided for OTP email, skipping.');
    throw new MailError('No recipient email provided.', 'SEND_FAILED');
  }
  if (!canSendMail()) {
    // Reached only when the credential env vars are missing/empty OR the
    // password is still a placeholder/dummy value (placeholders are never sent
    // to Gmail, see resolveMailConfig). The public MailError message is the
    // exact instruction; the route maps it to the same user-facing text.
    const missing = missingCredentialNames();
    console.warn(`[Mail] OTP email to ${email} skipped - SMTP not usable (missing: ${missing.join(' , ') || 'credentials'}, see backend/.env).`);
    throw new MailError('Add your Google-generated App Password to backend/.env and restart the backend.', 'MAIL_NOT_CONFIGURED');
  }

  const html = buildOtpEmail({ name, email, otp, expiresInMinutes });

  const mailOptions = {
    from: fromAddress('ShopEase'),
    to: email,
    subject: 'ShopEase Password Reset OTP',
    text: [
      'Hello,',
      '',
      `Your ShopEase password reset OTP is: ${otp}`,
      '',
      `This OTP is valid for ${expiresInMinutes} minutes.`,
      '',
      'If you did not request a password reset, please ignore this email.',
      '',
      'Regards,',
      'ShopEase Team',
    ].join('\n'),
    html,
  };

  try {
    const t = getOrRebuildTransporter();
    const info = await t.sendMail(mailOptions);
    console.log('OTP email sent to', email, '| Message ID:', info.messageId);
    return true;
  } catch (err) {
    const code = classifySmtpError(err);
    // Full technical detail is logged SERVER-SIDE only. The password is never
    // printed (Gmail 535 messages contain the username, not the password).
    console.error(`[Mail] OTP EMAIL ERROR (${code}) for ${email}`);
    console.error(`[Mail] message: ${(err && err.message) || err}`);
    if (err && err.code) console.error(`[Mail] SMTP ERROR CODE: ${err.code}`);
    if (err && err.responseCode) console.error(`[Mail] SMTP ERROR RESPONSE CODE: ${err.responseCode}`);
    if (err && err.response) console.error(`[Mail] SMTP ERROR RESPONSE: ${err.response}`);
    if (err && err.command) console.error(`[Mail] SMTP COMMAND: ${err.command}`);
    const userMessage =
      code === 'BAD_CREDENTIALS'
        ? 'Gmail SMTP authentication failed. Check GMAIL_USER and GMAIL_APP_PASSWORD.'
        : 'Unable to send OTP email.';
    throw new MailError(userMessage, code);
  }
}

module.exports = {
  sendWelcomeEmail,
  sendOrderConfirmation,
  sendSupportReplyEmail,
  sendOtpEmail,
  MailError,
  canSendMail,
  getMailStatus,
  buildOrderEmail,
  buildOtpEmail,
  buildWelcomeEmail,
  buildSupportReplyEmail,
};
