const express = require('express');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Generate a unique referral code (e.g., CHARAN123)
function generateReferralCode(name) {
  const base = name.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 6) || 'USER';
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${base}${random}`;
}

// Check if referral code exists and is unique
async function isReferralCodeUnique(code) {
  const [rows] = await pool.query('SELECT id FROM referral_codes WHERE code = ?', [code]);
  return rows.length === 0;
}

// Get or create referral code for current user
router.get('/my-code', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user already has a referral code
    let [codes] = await pool.query('SELECT code FROM referral_codes WHERE user_id = ?', [userId]);

    if (codes.length === 0) {
      // Generate unique code
      let code;
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        code = generateReferralCode(req.user.name);
        isUnique = await isReferralCodeUnique(code);
        attempts++;
      }

      if (!isUnique) {
        return res.status(500).json({ error: 'Failed to generate unique referral code' });
      }

      await pool.query('INSERT INTO referral_codes (user_id, code) VALUES (?, ?)', [userId, code]);
      codes = [{ code }];
    }

    const referralLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/?ref=${codes[0].code}#auth`;

    res.json({
      referral_code: codes[0].code,
      referral_link: referralLink,
    });
  } catch (error) {
    console.error('Get referral code error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get referral statistics for current user
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [[totalReferrals]] = await pool.query(
      'SELECT COUNT(*) as count FROM referrals WHERE referrer_user_id = ?',
      [userId]
    );

    const [[successfulReferrals]] = await pool.query(
      'SELECT COUNT(*) as count FROM referrals WHERE referrer_user_id = ? AND status = "successful"',
      [userId]
    );

    const [[pendingReferrals]] = await pool.query(
      'SELECT COUNT(*) as count FROM referrals WHERE referrer_user_id = ? AND status = "pending"',
      [userId]
    );

    const [[totalRewards]] = await pool.query(
      'SELECT COALESCE(SUM(reward_amount), 0) as total FROM referrals WHERE referrer_user_id = ? AND status = "successful"',
      [userId]
    );

    res.json({
      total_referrals: totalReferrals.count,
      successful_referrals: successfulReferrals.count,
      pending_referrals: pendingReferrals.count,
      total_rewards_earned: totalRewards.total,
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get referral history for current user
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    const [referrals] = await pool.query(`
      SELECT r.*, u.name as referred_name, u.email as referred_email
      FROM referrals r
      JOIN users u ON r.referred_user_id = u.id
      WHERE r.referrer_user_id = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limitNum, offset]);

    const [[totalResult]] = await pool.query(
      'SELECT COUNT(*) as total FROM referrals WHERE referrer_user_id = ?',
      [userId]
    );

    res.json({
      data: referrals,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get referral history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Validate a referral code (used during registration)
router.get('/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const [codes] = await pool.query(
      'SELECT rc.code, u.id as referrer_id, u.name as referrer_name FROM referral_codes rc JOIN users u ON rc.user_id = u.id WHERE rc.code = ?',
      [code.toUpperCase()]
    );

    if (codes.length === 0) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    res.json({
      valid: true,
      referral_code: codes[0].code,
      referrer_name: codes[0].referrer_name,
    });
  } catch (error) {
    console.error('Validate referral code error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Apply referral code during registration (associates new user with referrer)
router.post('/apply', async (req, res) => {
  try {
    const { referral_code, new_user_id } = req.body;

    if (!referral_code || !new_user_id) {
      return res.status(400).json({ error: 'Referral code and new user ID required' });
    }

    // Find the referrer by referral code
    const [codes] = await pool.query(
      'SELECT user_id FROM referral_codes WHERE code = ?',
      [referral_code.toUpperCase()]
    );

    if (codes.length === 0) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    const referrerId = codes[0].user_id;

    // Prevent self-referral
    if (referrerId === new_user_id) {
      return res.status(400).json({ error: 'Self-referral is not allowed' });
    }

    // Check if referral already exists
    const [existing] = await pool.query(
      'SELECT id FROM referrals WHERE referrer_user_id = ? AND referred_user_id = ?',
      [referrerId, new_user_id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Referral already exists' });
    }

    // Create referral record
    const [result] = await pool.query(
      'INSERT INTO referrals (referrer_user_id, referred_user_id, referral_code, status) VALUES (?, ?, ?, "pending")',
      [referrerId, new_user_id, referral_code.toUpperCase()]
    );

    // Update user's referred_by field
    await pool.query('UPDATE users SET referred_by = ? WHERE id = ?', [referrerId, new_user_id]);

    res.status(201).json({
      message: 'Referral applied successfully',
      referral_id: result.insertId,
    });
  } catch (error) {
    console.error('Apply referral error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Referral already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Complete a referral (called when referred user completes first eligible order)
async function completeReferral(referredUserId, orderId, connection = pool) {
  try {
    // Find pending referrals for this user
    const [referrals] = await connection.query(
      'SELECT * FROM referrals WHERE referred_user_id = ? AND status = "pending" ORDER BY created_at ASC',
      [referredUserId]
    );

    for (const referral of referrals) {
      // Calculate reward amount (configurable - for now use a fixed amount or percentage)
      // You can adjust this logic based on your reward structure
      const rewardAmount = 100.00; // Fixed ₹100 reward per successful referral

      // Update referral to successful
      await connection.query(
        'UPDATE referrals SET status = "successful", reward_amount = ?, completed_at = NOW() WHERE id = ?',
        [rewardAmount, referral.id]
      );

      // Update referrer's total earned rewards
      await connection.query(
        'UPDATE users SET referral_reward_earned = referral_reward_earned + ? WHERE id = ?',
        [rewardAmount, referral.referrer_user_id]
      );

      // Create notification for referrer (optional - if notifications table exists)
      try {
        await connection.query(
          `INSERT INTO notifications (user_id, type, title, message, link, data_json)
           VALUES (?, 'referral_reward', 'Referral Reward Earned!', ?, ?, ?)`,
          [
            referral.referrer_user_id,
            `Your referral earned you ₹${rewardAmount.toFixed(2)}!`,
            '/dashboard/referrals',
            JSON.stringify({ referral_id: referral.id, reward_amount: rewardAmount })
          ]
        );
      } catch (notifError) {
        // Notifications table might not exist, ignore
        console.warn('Could not create referral notification:', notifError.message);
      }
    }

    return { success: true, completed_count: referrals.length };
  } catch (error) {
    console.error('Complete referral error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = router;
module.exports.completeReferral = completeReferral;
module.exports.generateReferralCode = generateReferralCode;