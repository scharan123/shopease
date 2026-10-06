const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { authenticateToken, generateToken, JWT_SECRET } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { sendWelcomeEmail, MailError, getMailStatus } = require('../utils/email');
const { sendOtpEmail } = require('../utils/otpEmailService');
const {
  OTP_EXPIRY_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS,
  generateOtp,
  hashOtp,
  isOtpExpired,
  getOtpExpiryDate,
} = require('../utils/otp');

const router = express.Router();
const NODE_ENV = process.env.NODE_ENV || 'development';

async function getLatestOtp(email) {
  const [rows] = await pool.query(
    'SELECT * FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1',
    [email]
  );
  return rows[0];
}

// Remove very old (24h+) rows and rows that are already used/expired so the
// password_resets table never grows without bound.
async function cleanupStaleOtps(email) {
  try {
    await pool.query(
      `DELETE FROM password_resets
       WHERE email = ? AND (status IN ('used','expired') OR expires_at < NOW() - INTERVAL 24 HOUR)`,
      [email]
    );
  } catch (err) {
    console.error('OTP cleanup error:', err && err.message);
  }
}

// Maps a mail failure to a precise, user-safe response. The underlying cause
// is already logged server-side by utils/email.js; credentials are NEVER
// included in the response.
function respondToMailError(res, mailErr) {
  const code = mailErr && mailErr.code;
  if (code === 'MAIL_NOT_CONFIGURED') {
    // GMAIL_APP_PASSWORD is missing/empty OR still a placeholder/dummy value.
    // The exact instruction below is the only guidance given.
    return res.status(503).json({ error: 'Add your Google-generated App Password to backend/.env and restart the backend.' });
  }
  if (code === 'BAD_CREDENTIALS') {
    // Both env vars are present and real, but Gmail rejected the login
    // (535 Username and Password not accepted). This is an auth failure -
    // not a missing-configuration error.
    return res.status(502).json({ error: 'Gmail SMTP authentication failed. Check GMAIL_USER and GMAIL_APP_PASSWORD.' });
  }
  return res.status(500).json({ error: 'Unable to send OTP email.' });
}

// Sends the OTP to the requested address via the existing Nodemailer setup.
// The OTP itself is never printed to server logs; only delivery status is.
// Throws a MailError on any failure so the route can answer with the right
// user-facing message. The caller must NOT claim the OTP was delivered unless
// this function returns. The recipient is always the exact email the customer
// typed into the form.
async function deliverOtp(user, email, otp) {
  console.log(`[Auth] Attempting to send OTP email to ${email} ...`);
  const sent = await sendOtpEmail({
    name: user.name,
    email,
    otp,
    expiresInMinutes: OTP_EXPIRY_MINUTES,
  });
  if (sent) {
    console.log(`[Auth] OTP email sent successfully to ${email}`);
    return true;
  }
  console.error(`[Auth] OTP email sending FAILED for ${email}. See [Mail] error above.`);
  throw new MailError('Failed to send the OTP email. Please try again later.', 'SEND_FAILED');
}

// Constant-time comparison so OTP guesses cannot leak information via timing.
function otpHashesMatch(inputOtp, storedOtpHash) {
  try {
    const a = Buffer.from(hashOtp(inputOtp), 'hex');
    const b = Buffer.from(String(storedOtpHash), 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function cooldownRemaining(createdAt) {
  const sentAgo = (Date.now() - new Date(createdAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - sentAgo));
}

router.post('/register', validate('register'), async (req, res) => {
  try {
    const { name, email: rawEmail, password, referral_code } = req.validated;

    // Normalize the email so a user who registers with "Test@Example.com"
    // can always log in with "test@example.com".
    const email = rawEmail.trim().toLowerCase();

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        'INSERT INTO users (name, email, password, referred_by) VALUES (?, ?, ?, ?)',
        [name, email, hashedPassword, null]
      );

      const userId = result.insertId;
      const user = { id: userId, name, email };

      // Handle referral code if provided
      if (referral_code) {
        // Find the referrer by referral code
        const [codes] = await connection.query(
          'SELECT user_id FROM referral_codes WHERE code = ?',
          [referral_code.toUpperCase()]
        );

        if (codes.length > 0) {
          const referrerId = codes[0].user_id;

          // Prevent self-referral
          if (referrerId !== userId) {
            // Check if referral already exists
            const [existing] = await connection.query(
              'SELECT id FROM referrals WHERE referrer_user_id = ? AND referred_user_id = ?',
              [referrerId, userId]
            );

            if (existing.length === 0) {
              // Create referral record
              await connection.query(
                'INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status) VALUES (?, ?, ?, "pending")',
                [referrerId, userId, referral_code.toUpperCase()]
              );

              // Update user's referred_by field
              await connection.query('UPDATE users SET referred_by = ? WHERE id = ?', [referrerId, userId]);
            }
          }
        }
      }

      await connection.commit();

      const token = generateToken(user);

      // Send the confirmation email in the background so registration never
      // blocks on SMTP (a slow or unreachable mail server can stall the
      // response for seconds and make "Create Account" appear frozen).
      sendWelcomeEmail({
        name: user.name,
        email: user.email,
        created_at: new Date(),
      }).catch((err) => console.error('Background welcome email failed:', err && err.message));

      res.status(201).json({
        user,
        token,
        message: `Account created. Welcome to ShopEase, ${name}!`,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', validate('login'), async (req, res) => {
  try {
    const { email: rawEmail, password } = req.validated;

    // Normalize the email the same way registration does, so mixed-case
    // email addresses always resolve to the registered account.
    const email = rawEmail.trim().toLowerCase();

    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      console.log(`[Auth] Login failed - email not found: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log(`[Auth] Login failed - invalid password for: ${email}`);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userData = { id: user.id, name: user.name, email: user.email };
    const token = generateToken(userData);
    console.log(`[Auth] Login success: ${userData.email} (id=${userData.id})`);

    res.json({ user: userData, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(users[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// Forgot Password flow
// ---------------------------------------------------------------------------

// Step 1: request an OTP for the exact email address the user typed in.
router.post('/forgot-password', validate('forgotPassword'), async (req, res) => {
  try {
    const email = req.validated.email.trim().toLowerCase();
    console.log(`[Auth] Forgot-password request received for ${email}`);

    const [users] = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      console.log(`[Auth] Email not found: ${email}`);
      return res.status(404).json({ error: 'No account found with this email address.' });
    }
    const user = users[0];
    console.log(`[Auth] Email found: ${user.email}`);

    await cleanupStaleOtps(email);

    // Respect the resend cooldown so OTP emails cannot be spammed.
    const latest = await getLatestOtp(email);
    if (latest && latest.status === 'pending' && !isOtpExpired(latest.expires_at)) {
      const wait = cooldownRemaining(latest.created_at);
      if (wait > 0) {
        console.log(`[Auth] OTP resend blocked for ${email} (cooldown ${wait}s)`);
        return res.status(429).json({
          error: `Please wait ${wait} second${wait === 1 ? '' : 's'} before requesting a new OTP`,
          resend_after: wait,
        });
      }
    }

    const otp = generateOtp();
    console.log(`[Auth] OTP generated for ${email} (expires in ${OTP_EXPIRY_MINUTES} min)`);
    // A new OTP invalidates EVERY previously issued OTP for this email,
    // including ones that were already verified - so an old reset session can
    // never be replayed after a newer OTP is generated.
    await pool.query(
      "UPDATE password_resets SET status = 'expired' WHERE email = ? AND status IN ('pending','verified')",
      [email]
    );
    const [insertResult] = await pool.query(
      'INSERT INTO password_resets (user_id, email, otp_hash, expires_at) VALUES (?, ?, ?, ?)',
      [user.id, email, hashOtp(otp), getOtpExpiryDate()]
    );
    const otpRowId = insertResult.insertId;

    try {
      await deliverOtp(user, email, otp);
    } catch (mailErr) {
      // The OTP row exists but no email was actually delivered. Expire it so
      // no unused OTP stays active and a retry always issues a fresh code.
      await pool.query("UPDATE password_resets SET status = 'expired' WHERE id = ?", [otpRowId]);
      if (mailErr instanceof MailError) {
        // The real reason (missing credentials, rejected login, host timeout,
        // ...) is already logged server-side by utils/email.js and is never
        // sent to the browser. respondToMailError picks the precise, safe
        // message for the condition that actually occurred.
        return respondToMailError(res, mailErr);
      }
      throw mailErr;
    }

    res.json({
      message: 'OTP sent successfully to your email.',
      resend_after: OTP_RESEND_COOLDOWN_SECONDS,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Step 2: verify the OTP. On success a short-lived reset token is returned so
// the password can only be changed after a successful server-side check.
router.post('/verify-otp', validate('verifyOtp'), async (req, res) => {
  try {
    const email = req.validated.email.trim().toLowerCase();
    const otp = req.validated.otp.trim();

    const row = await getLatestOtp(email);
    if (!row || row.status === 'used') {
      return res.status(400).json({ error: 'No OTP found for this email. Please request a new OTP.' });
    }
    if (row.status === 'expired' || isOtpExpired(row.expires_at)) {
      await pool.query("UPDATE password_resets SET status = 'expired' WHERE id = ?", [row.id]);
      return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
    }
    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      await pool.query("UPDATE password_resets SET status = 'expired' WHERE id = ?", [row.id]);
      return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    const valid = otpHashesMatch(otp, row.otp_hash);
    if (!valid) {
      const attempts = row.attempts + 1;
      await pool.query('UPDATE password_resets SET attempts = ? WHERE id = ?', [attempts, row.id]);
      if (attempts >= OTP_MAX_ATTEMPTS) {
        await pool.query("UPDATE password_resets SET status = 'expired' WHERE id = ?", [row.id]);
        return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
      }
      return res.status(400).json({
        error: 'Invalid OTP. Please try again.',
        attempts_left: OTP_MAX_ATTEMPTS - attempts,
      });
    }

    await pool.query(
      "UPDATE password_resets SET status = 'verified', verified_at = NOW() WHERE id = ? AND status = 'pending'",
      [row.id]
    );

    const resetToken = jwt.sign(
      { purpose: 'password_reset', email, otp_id: row.id },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    res.json({ message: 'OTP verified successfully', reset_token: resetToken });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Resend OTP (with cooldown). Rate-limited by the auth limiter in server.js.
router.post('/resend-otp', validate('forgotPassword'), async (req, res) => {
  try {
    const email = req.validated.email.trim().toLowerCase();
    console.log(`[Auth] Resend-OTP request received for ${email}`);

    const [users] = await pool.query('SELECT id, name, email FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      console.log(`[Auth] Email not found: ${email}`);
      return res.status(404).json({ error: 'No account found with this email address.' });
    }
    const user = users[0];

    await cleanupStaleOtps(email);

    const latest = await getLatestOtp(email);
    if (latest && latest.status === 'pending' && !isOtpExpired(latest.expires_at)) {
      const wait = cooldownRemaining(latest.created_at);
      if (wait > 0) {
        console.log(`[Auth] OTP resend blocked for ${email} (cooldown ${wait}s)`);
        return res.status(429).json({
          error: `Please wait ${wait} second${wait === 1 ? '' : 's'} before resending`,
          resend_after: wait,
        });
      }
    }

    const otp = generateOtp();
    console.log(`[Auth] New OTP generated for ${email} (expires in ${OTP_EXPIRY_MINUTES} min)`);
    await pool.query(
      "UPDATE password_resets SET status = 'expired' WHERE email = ? AND status IN ('pending','verified')",
      [email]
    );
    const [insertResult] = await pool.query(
      'INSERT INTO password_resets (user_id, email, otp_hash, expires_at) VALUES (?, ?, ?, ?)',
      [user.id, email, hashOtp(otp), getOtpExpiryDate()]
    );
    const otpRowId = insertResult.insertId;

    try {
      await deliverOtp(user, email, otp);
    } catch (mailErr) {
      // The OTP row exists but no email was actually delivered. Expire it so
      // no unused OTP stays active and a retry always issues a fresh code.
      await pool.query("UPDATE password_resets SET status = 'expired' WHERE id = ?", [otpRowId]);
      if (mailErr instanceof MailError) {
        // Precise, user-safe message; the real cause is logged server-side.
        return respondToMailError(res, mailErr);
      }
      throw mailErr;
    }

    res.json({
      message: `New OTP sent successfully to your email.`,
      resend_after: OTP_RESEND_COOLDOWN_SECONDS,
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Step 3: set the new password. Requires the reset token issued after the OTP
// was verified, so only fully-verified flows can change the password.
router.post('/reset-password', validate('resetPassword'), async (req, res) => {
  let conn;
  try {
    const { reset_token, new_password } = req.validated;

    let payload;
    try {
      payload = jwt.verify(reset_token, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: 'Reset session expired. Please start the process again.' });
    }
    if (!payload || payload.purpose !== 'password_reset' || !payload.email || !payload.otp_id) {
      return res.status(400).json({ error: 'Invalid reset session. Please start the process again.' });
    }

    const email = payload.email;
    const [rows] = await pool.query(
      'SELECT id, status, expires_at FROM password_resets WHERE id = ? AND email = ?',
      [payload.otp_id, email]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Reset session not found. Please start the process again.' });
    }

    const row = rows[0];
    if (row.status !== 'verified') {
      return res.status(400).json({ error: 'OTP has not been verified. Please start the process again.' });
    }
    if (isOtpExpired(row.expires_at)) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new OTP.' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    conn = await pool.getConnection();
    await conn.beginTransaction();
    await conn.query('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email]);
    await conn.query("UPDATE password_resets SET status = 'used' WHERE id = ? AND status = 'verified'", [row.id]);
    await conn.commit();

    res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch (e) { /* ignore */ }
    }
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;