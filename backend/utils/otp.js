const crypto = require('crypto');

// OTP lifetime and resend throttling. Configurable via env so staging/CI can
// shorten them, defaults match the product requirement (10 min expiry).
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10;
// Cooldown between OTP sends. Short by default so a user requesting a reset
// again for the same email gets a new OTP almost immediately (requirement:
// repeated attempts must keep working), while still blocking mail-bombing.
// Set OTP_RESEND_COOLDOWN_SECONDS=0 in .env to disable it completely.
const OTP_RESEND_COOLDOWN_SECONDS = Math.max(0, parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 10) || 15);
const OTP_MAX_ATTEMPTS = 5;

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function isOtpExpired(expiresAt) {
  return new Date(expiresAt).getTime() <= Date.now();
}

function getOtpExpiryDate() {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

module.exports = {
  OTP_EXPIRY_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS,
  generateOtp,
  hashOtp,
  isOtpExpired,
  getOtpExpiryDate,
};