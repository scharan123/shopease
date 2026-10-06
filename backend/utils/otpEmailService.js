const sgMail = require("@sendgrid/mail");

const APP_NAME = "ShopEase";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const sendOtpEmail = async ({ name, email, otp, expiresInMinutes = 2 }) => {
  try {
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    if (!fromEmail) {
      console.error("❌ SENDGRID_FROM_EMAIL is missing in .env");
      return false;
    }
    if (!process.env.SENDGRID_API_KEY) {
      console.error("❌ SENDGRID_API_KEY is missing in .env");
      return false;
    }

    const msg = {
      to: email,
      from: `"${APP_NAME}" <${fromEmail}>`,
      subject: `Your OTP for ${APP_NAME}`,
      text: `Your OTP is ${otp}. It is valid for ${expiresInMinutes} minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <p>Hello ${name || ''},</p>

          <p>You requested a one-time password (OTP) to continue on <b>${APP_NAME}</b>.</p>

          <p><b>Your OTP:</b></p>
          <h2 style="letter-spacing:3px;">${otp}</h2>

          <p>This code is valid for <b>${expiresInMinutes} minutes</b>.</p>

          <p>If you did not request this, please ignore this email.</p>

          <p>Thanks,<br/>${APP_NAME} Team</p>
        </div>
      `,
    };

    await sgMail.send(msg);
    console.log("✅ OTP sent via Twilio SendGrid");

    return true; // Returning true is required by auth.js logic
  } catch (error) {
    console.error("❌ SendGrid Error:", error.response ? error.response.body : error.message);
    return false;
  }
};

module.exports = { sendOtpEmail };
