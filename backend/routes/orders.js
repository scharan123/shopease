const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { sendOrderConfirmation } = require('../utils/email');
const { isValidPin, findUndeliverableProducts } = require('../utils/delivery');
const { completeReferral } = require('./referrals');
const { applyCouponToOrder } = require('./coupons');

const router = express.Router();

// Quantity discount tiers (matching frontend)
const QUANTITY_DISCOUNT_TIERS = [
  { minQty: 1, maxQty: 1, discount: 0 },
  { minQty: 2, maxQty: 2, discount: 5 },
  { minQty: 3, maxQty: 3, discount: 10 },
  { minQty: 4, maxQty: 4, discount: 10 },
  { minQty: 5, maxQty: Infinity, discount: 15 }
];

function getQuantityDiscountPercent(quantity) {
  const tier = QUANTITY_DISCOUNT_TIERS.find(t => quantity >= t.minQty && quantity <= t.maxQty);
  return tier ? tier.discount : 0;
}

function calculateQuantityDiscount(cartItems) {
  let totalDiscount = 0;
  for (const item of cartItems) {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.price) || 0;
    const itemSubtotal = price * qty;
    const discountPercent = getQuantityDiscountPercent(qty);
    if (discountPercent > 0) {
      totalDiscount += itemSubtotal * (discountPercent / 100);
    }
  }
  return Math.round(totalDiscount * 100) / 100;
}

// Helper to parse shipping address string into components
function parseShippingAddress(address) {
  // Expected format: "Name, House/Flat, Street/Area, City, State PINCODE, Country"
  // Or: "Name, House/Flat, Street/Area, City, State, PINCODE, Country"
  const parts = address.split(',').map(p => p.trim());
  const result = {
    name: '',
    address_line: '',
    area: '',
    city: '',
    state: '',
    pincode: '',
    country: 'IN'
  };

  if (parts.length >= 1) result.name = parts[0];
  if (parts.length >= 2) result.address_line = parts[1];
  if (parts.length >= 3) result.area = parts[2];
  if (parts.length >= 4) result.city = parts[3];

  // Try to find pincode in parts[3], parts[4], or parts[5]
  // The pincode is a 6-digit number
  let pincodeFound = false;
  for (let i = 3; i < Math.min(parts.length, 6); i++) {
    const pincodeMatch = parts[i].match(/(\d{6})/);
    if (pincodeMatch) {
      result.pincode = pincodeMatch[1];
      const beforePincode = parts[i].substring(0, parts[i].indexOf(pincodeMatch[1])).trim();
      result.state = beforePincode.replace(/,$/, '').trim();
      pincodeFound = true;
      break;
    }
  }

  if (!pincodeFound && parts.length >= 5) {
    // Fallback: assume parts[4] is state
    result.state = parts[4];
  }

  if (parts.length >= 6) {
    result.country = parts[5].trim().toUpperCase();
    if (result.country.length !== 2) result.country = 'IN';
  }

  return result;
}

// Calculate coupon discount (server-side validation)
async function calculateCouponDiscount(connection, couponCode, subtotal, userId) {
  if (!couponCode) return { discount: 0, coupon_id: null, coupon_code: null };

  const [coupons] = await connection.query(
    `SELECT * FROM coupons WHERE code = ? AND is_active = 1`,
    [couponCode.toUpperCase()]
  );

  if (coupons.length === 0) {
    throw new Error('Invalid coupon code');
  }

  const coupon = coupons[0];
  const now = new Date();

  // Check expiry
  if (new Date(coupon.expiry_date) < now) {
    throw new Error('Coupon expired');
  }

  // Check start date
  if (new Date(coupon.start_date) > now) {
    throw new Error('Coupon not yet valid');
  }

  // Check minimum order amount
  if (subtotal < parseFloat(coupon.min_order_amount)) {
    throw new Error(`Minimum order value is ₹${parseFloat(coupon.min_order_amount).toFixed(2)}`);
  }

  // Check usage limit
  if (coupon.usage_limit > 0) {
    const [[usageCount]] = await connection.query(
      'SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = ?',
      [coupon.id]
    );
    if (usageCount.count >= coupon.usage_limit) {
      throw new Error('Coupon usage limit reached');
    }
  }

  // Check per-user limit
  if (coupon.per_user_limit > 0) {
    const [[userUsage]] = await connection.query(
      'SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = ? AND user_id = ?',
      [coupon.id, userId]
    );
    if (userUsage.count >= coupon.per_user_limit) {
      throw new Error('Coupon already used by you');
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

  return {
    discount: discountAmount,
    coupon_id: coupon.id,
    coupon_code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: parseFloat(coupon.discount_value)
  };
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const [orders] = await pool.query(`
      SELECT o.*
      FROM orders o
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `, [req.user.id]);

    for (let order of orders) {
      const [items] = await pool.query(`
        SELECT oi.*, p.name, p.image_url
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `, [order.id]);
      order.items = items;
    }

    res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const [items] = await pool.query(`
      SELECT oi.*, p.name, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [req.params.id]);

    res.json({ ...orders[0], items });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { shipping_address, payment_method = 'cod', email, pin_code, phone, coupon_code } = req.body;
    if (!shipping_address) {
      return res.status(400).json({ error: 'Shipping address required' });
    }

    // Delivery validation: every cart item must be deliverable to the PIN code.
    const deliveryPin = (typeof pin_code === 'string' && pin_code.trim()) || '';
    if (!isValidPin(deliveryPin)) {
      return res.status(400).json({ error: 'Enter a valid 6-digit PIN code' });
    }

    const [cartItems] = await connection.query(`
      SELECT c.quantity, c.product_id, p.price, p.name, p.stock
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?
    `, [req.user.id]);

    if (cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        await connection.rollback();
        return res.status(400).json({ error: `Not enough stock for ${item.name}` });
      }
    }

    // Delivery validation against product_serviceable_pincodes: every cart
    // item must be deliverable to the entered PIN code.
    const undeliverableIds = await findUndeliverableProducts(
      connection,
      cartItems.map((i) => i.product_id),
      deliveryPin
    );
    if (undeliverableIds.length > 0) {
      await connection.rollback();
      const names = cartItems
        .filter((i) => undeliverableIds.includes(Number(i.product_id)))
        .map((i) => i.name);
      return res.status(400).json({
        error: `Some products in your cart cannot be delivered to PIN code ${deliveryPin}: ${names.join(', ')}`
      });
    }

    const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Calculate quantity discount (server-side)
    const quantityDiscount = calculateQuantityDiscount(cartItems);

    // Calculate coupon discount (server-side)
    let discountAmount = 0;
    let couponId = null;
    let appliedCouponCode = null;

    if (coupon_code) {
      try {
        const couponResult = await calculateCouponDiscount(connection, coupon_code, subtotal, req.user.id);
        discountAmount = couponResult.discount;
        couponId = couponResult.coupon_id;
        appliedCouponCode = couponResult.coupon_code;
      } catch (couponError) {
        await connection.rollback();
        return res.status(400).json({ error: couponError.message });
      }
    }

    // Calculate total: Subtotal - Coupon Discount - Quantity Discount + Delivery Charge + Tax
    const deliveryCharge = 0; // Free shipping
    const tax = Math.round(subtotal * 0.08 * 100) / 100;
    const total = Math.round((subtotal - discountAmount - quantityDiscount + deliveryCharge + tax) * 100) / 100;

    const [orderResult] = await connection.query(
      'INSERT INTO orders (user_id, total_amount, shipping_address, payment_method, status, coupon_id, discount_amount, coupon_code, quantity_discount, tax_amount, delivery_charge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, total, shipping_address, payment_method, 'pending', couponId, discountAmount, appliedCouponCode, quantityDiscount, tax, deliveryCharge]
    );

    const orderId = orderResult.insertId;

    for (const item of cartItems) {
      await connection.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.price]
      );

      await connection.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    await connection.query('DELETE FROM cart WHERE user_id = ?', [req.user.id]);

    // Record coupon usage
    if (couponId && discountAmount > 0) {
      await applyCouponToOrder(couponId, req.user.id, orderId, discountAmount, connection);
    }

    await connection.commit();

    // Save address to customer_addresses if user doesn't have this exact address
    try {
      const parsed = parseShippingAddress(shipping_address);
      if (parsed.pincode && isValidPin(parsed.pincode)) {
        // Check if this exact address already exists for the user
        const [existingAddr] = await pool.query(
          'SELECT id FROM customer_addresses WHERE user_id = ? AND address_line = ? AND pincode = ?',
          [req.user.id, parsed.address_line, parsed.pincode]
        );

        if (existingAddr.length === 0) {
          // Check if user has any default address
          const [defaultAddr] = await pool.query(
            'SELECT id FROM customer_addresses WHERE user_id = ? AND is_default = 1',
            [req.user.id]
          );

          await pool.query(
            `INSERT INTO customer_addresses (user_id, name, phone, address_line, area, city, state, pincode, country, is_default)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              req.user.id,
              parsed.name || req.user.name,
              phone || '', // phone from request body
              parsed.address_line,
              parsed.area || null,
              parsed.city,
              parsed.state,
              parsed.pincode,
              parsed.country,
              defaultAddr.length === 0 ? 1 : 0 // Set as default if no default exists
            ]
          );
        }
      }
    } catch (addrError) {
      // Don't fail the order if address saving fails - just log it
      console.warn('Failed to save address to customer_addresses:', addrError.message);
    }

    const [order] = await connection.query('SELECT * FROM orders WHERE id = ?', [orderId]);

    // Fetch order items for the email
    const [orderItems] = await pool.query(`
      SELECT oi.*, p.name, p.image_url
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [orderId]);

    // Send confirmation email (non-blocking)
    sendOrderConfirmation({
      id: orderId,
      email: email || req.user.email,
      items: orderItems,
      total: total,
      subtotal: subtotal,
      discount: discountAmount,
      quantity_discount: quantityDiscount,
      tax: tax,
      delivery_charge: deliveryCharge,
      coupon_code: appliedCouponCode,
      shipping_address: shipping_address,
      payment_method: payment_method,
      status: 'pending',
      created_at: new Date(),
    }).catch(() => {});

    // Complete referral if this is the user's first successful order
    // Check if this is the user's first completed order
    const [[orderCount]] = await pool.query(
      'SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status NOT IN ("cancelled")',
      [req.user.id]
    );

    if (orderCount.count === 1) {
      // This is the first order, complete any pending referrals
      await completeReferral(req.user.id, orderId, pool);
    }

    res.status(201).json({ 
      ...order[0], 
      email,
      subtotal,
      discount_amount: discountAmount,
      quantity_discount: quantityDiscount,
      tax_amount: tax,
      delivery_charge: deliveryCharge,
      coupon_code: appliedCouponCode
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Server error' });
  } finally {
    connection.release();
  }
});

module.exports = router;