const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken, generateToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Validate and calculate coupon discount (used at checkout)
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const { code, cart_subtotal } = req.body;
    const userId = req.user.id;

    if (!code) {
      return res.status(400).json({ error: 'Coupon code required' });
    }

    const subtotal = parseFloat(cart_subtotal) || 0;

    // Find coupon
    const [coupons] = await pool.query(
      `SELECT * FROM coupons WHERE code = ? AND is_active = 1`,
      [code.toUpperCase()]
    );

    if (coupons.length === 0) {
      return res.status(404).json({ error: 'Invalid coupon code' });
    }

    const coupon = coupons[0];

    // Check expiry
    const now = new Date();
    if (new Date(coupon.expiry_date) < now) {
      return res.status(400).json({ error: 'Coupon expired' });
    }

    // Check start date
    if (new Date(coupon.start_date) > now) {
      return res.status(400).json({ error: 'Coupon not yet valid' });
    }

    // Check minimum order amount
    if (subtotal < parseFloat(coupon.min_order_amount)) {
      return res.status(400).json({
        error: `Minimum order value is ₹${parseFloat(coupon.min_order_amount).toFixed(2)}`
      });
    }

    // Check usage limit
    if (coupon.usage_limit > 0) {
      const [[usageCount]] = await pool.query(
        'SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = ?',
        [coupon.id]
      );
      if (usageCount.count >= coupon.usage_limit) {
        return res.status(400).json({ error: 'Coupon usage limit reached' });
      }
    }

    // Check per-user limit
    if (coupon.per_user_limit > 0) {
      const [[userUsage]] = await pool.query(
        'SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = ? AND user_id = ?',
        [coupon.id, userId]
      );
      if (userUsage.count >= coupon.per_user_limit) {
        return res.status(400).json({ error: 'Coupon already used by you' });
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discount_type === 'percentage') {
      discountAmount = subtotal * (parseFloat(coupon.discount_value) / 100);
      // Apply max discount cap if set
      if (coupon.max_discount && discountAmount > parseFloat(coupon.max_discount)) {
        discountAmount = parseFloat(coupon.max_discount);
      }
    } else if (coupon.discount_type === 'fixed') {
      discountAmount = parseFloat(coupon.discount_value);
      // Don't exceed subtotal
      if (discountAmount > subtotal) {
        discountAmount = subtotal;
      }
    }

    discountAmount = Math.round(discountAmount * 100) / 100;

    res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: parseFloat(coupon.discount_value),
        min_order_amount: parseFloat(coupon.min_order_amount),
        max_discount: coupon.max_discount ? parseFloat(coupon.max_discount) : null,
      },
      discount_amount: discountAmount,
      final_total: Math.round((subtotal - discountAmount) * 100) / 100,
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get coupon details (for display)
router.get('/:code', authenticateToken, async (req, res) => {
  try {
    const { code } = req.params;

    const [coupons] = await pool.query(
      'SELECT id, code, discount_type, discount_value, min_order_amount, max_discount, start_date, expiry_date FROM coupons WHERE code = ? AND is_active = 1',
      [code.toUpperCase()]
    );

    if (coupons.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    const coupon = coupons[0];
    const now = new Date();
    const isValid = new Date(coupon.expiry_date) >= now && new Date(coupon.start_date) <= now;

    res.json({
      ...coupon,
      discount_value: parseFloat(coupon.discount_value),
      min_order_amount: parseFloat(coupon.min_order_amount),
      max_discount: coupon.max_discount ? parseFloat(coupon.max_discount) : null,
      is_valid: isValid,
    });
  } catch (error) {
    console.error('Get coupon error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Apply coupon to order (records usage)
async function applyCouponToOrder(couponId, userId, orderId, discountAmount, connection = pool) {
  try {
    await connection.query(
      'INSERT INTO coupon_usage (coupon_id, user_id, order_id, discount_amount) VALUES (?, ?, ?, ?)',
      [couponId, userId, orderId, discountAmount]
    );
    return { success: true };
  } catch (error) {
    console.error('Apply coupon to order error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = router;
module.exports.applyCouponToOrder = applyCouponToOrder;