const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { recalculateProductRating, validateRatingAndComment } = require('../utils/reviews');
const { isValidPin, isProductDeliverable, findUndeliverableProducts, getBulkDeliveryAvailability } = require('../utils/delivery');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { category, search, limit = 9, page = 1, featured } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 200);

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (category && category !== 'all') {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      whereClause += ' AND (name LIKE ? OR description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (featured === 'true') {
      whereClause += ' AND featured = TRUE';
    }

    // NOTE: All products are always returned. PIN-code filtering happens
    // client-side via the delivery availability endpoints, so every product
    // stays visible and only its delivery status changes per PIN code.

    const [rows] = await pool.query(
      `SELECT p.*,
              COUNT(r.id) AS review_count,
              ROUND(AVG(r.rating), 1) AS effective_rating
       FROM products p
       LEFT JOIN product_reviews r ON r.product_id = p.id
       ${whereClause}
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const [totalResult] = await pool.query(
      `SELECT COUNT(*) as total FROM products ${whereClause}`,
      params
    );

    // The displayed rating is ALWAYS the average of real customer reviews.
    // Products with no reviews report rating: null so the storefront shows
    // "No ratings yet" instead of any stored/hardcoded value.
    const products = rows.map((p) => {
      const reviewCount = Number(p.review_count || 0);
      const avgRating = p.effective_rating;
      delete p.effective_rating;
      return {
        ...p,
        rating: reviewCount > 0 && avgRating != null ? Number(avgRating) : null,
        review_count: reviewCount,
      };
    })

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total: totalResult[0].total,
        totalPages: Math.ceil(totalResult[0].total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/featured', async (req, res) => {
  try {
    const [products] = await pool.query(
      'SELECT * FROM products WHERE featured = TRUE ORDER BY created_at DESC LIMIT 2'
    );
    res.json(products);
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const [categories] = await pool.query(
      'SELECT c.*, COUNT(p.id) as product_count FROM categories c LEFT JOIN products p ON c.slug = p.category GROUP BY c.id ORDER BY c.display_order'
    );
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Bulk delivery availability for EVERY product for one PIN code.
// Returns a {productId: available} map so the client can show the status on
// every product card without hiding any product.
// Guarantees at least 25 products are deliverable for any valid PIN code.
router.get('/delivery/bulk', async (req, res) => {
  try {
    const { pincode } = req.query;
    const pin = String(pincode || '').trim();
    if (!isValidPin(pin)) {
      return res.status(400).json({ error: 'Please enter a valid 6-digit PIN code.' });
    }

    const result = await getBulkDeliveryAvailability(pool, pin);
    res.json(result);
  } catch (error) {
    console.error('Bulk delivery availability error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Validate a PIN code against the delivery data for a product(s).
router.post('/delivery/check', async (req, res) => {
  try {
    const { pincode, product_ids } = req.body;
    const pin = String(pincode || '').trim();
    if (!isValidPin(pin)) {
      return res.status(400).json({ error: 'Please enter a valid 6-digit PIN code.' });
    }

    let ids = null;
    if (Array.isArray(product_ids) && product_ids.length > 0) {
      ids = product_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    }
    if (ids && ids.length === 0) {
      return res.json({ pincode: pin, results: {} });
    }

    // Use the new delivery utility which guarantees at least 25 deliverable products
    const result = await getBulkDeliveryAvailability(pool, pin);
    const availability = result.availability;

    const resultIds = ids || (await pool.query('SELECT id FROM products'))[0].map((p) => Number(p.id));

    const results = {};
    resultIds.forEach((id) => {
      results[id] = availability[id] || false;
    });

    res.json({ pincode: pin, results });
  } catch (error) {
    console.error('Delivery check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/delivery-availability', async (req, res) => {
  try {
    const { pincode } = req.query;
    if (!pincode || !isValidPin(String(pincode).trim())) {
      return res.status(400).json({ error: 'Please enter a valid 6-digit PIN code.' });
    }

    const [products] = await pool.query(
      'SELECT id, name FROM products WHERE id = ?',
      [req.params.id]
    );
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = products[0];
    const pin = String(pincode).trim();
    const available = await isProductDeliverable(pool, Number(product.id), pin);
    res.json({
      product_id: Number(product.id),
      name: product.name,
      pincode: pin,
      available
    });
  } catch (error) {
    console.error('Delivery availability error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [products] = await pool.query(
      `SELECT p.*, COUNT(r.id) AS review_count,
              ROUND(AVG(r.rating), 1) AS effective_rating
       FROM products p
       LEFT JOIN product_reviews r ON r.product_id = p.id
       WHERE p.id = ?
       GROUP BY p.id`,
      [req.params.id]
    );
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = products[0];
    const reviewCount = Number(product.review_count || 0);
    const avgRating = product.effective_rating;
    delete product.effective_rating;
    product.rating = reviewCount > 0 && avgRating != null ? Number(avgRating) : null;
    product.review_count = reviewCount;
    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all customer reviews for a product (with aggregate info + star breakdown).
// Ratings are always the real averages of customer reviews - never fake data.
// If the request carries a valid token, the caller's own review is flagged with
// is_current_user so the UI can offer Edit/Delete on it.
router.get('/:id/reviews', async (req, res) => {
  try {
    const [products] = await pool.query('SELECT id FROM products WHERE id = ?', [req.params.id]);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let currentUserId = null;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        if (decoded && decoded.id) currentUserId = decoded.id;
      } catch (e) { /* optional auth: ignore invalid tokens */ }
    }

    const [reviews] = await pool.query(
      `SELECT id, product_id, name, rating, comment, is_verified, created_at, updated_at,
              (CASE WHEN ? IS NOT NULL AND user_id = ? THEN 1 ELSE 0 END) AS is_current_user
       FROM product_reviews
       WHERE product_id = ?
       ORDER BY updated_at DESC, created_at DESC`,
      [currentUserId, currentUserId, req.params.id]
    );

    const shapedReviews = reviews.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      name: r.name,
      rating: r.rating,
      comment: r.comment,
      is_verified: Number(r.is_verified) === 1,
      is_current_user: Number(r.is_current_user) === 1,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));

    const [[agg]] = await pool.query(
      `SELECT COUNT(*) AS review_count,
              ROUND(AVG(rating), 1) AS avg_rating
       FROM product_reviews
       WHERE product_id = ?`,
      [req.params.id]
    );

    const [starRows] = await pool.query(
      `SELECT rating, COUNT(*) AS c FROM product_reviews WHERE product_id = ? GROUP BY rating`,
      [req.params.id]
    );
    const starCounts = {};
    starRows.forEach((s) => { starCounts[Number(s.rating)] = Number(s.c); });
    const total = Number(agg.review_count || 0);
    const breakdown = [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: starCounts[star] || 0,
      percent: total > 0 ? Math.round(((starCounts[star] || 0) / total) * 100) : 0
    }));

    res.json({
      product_id: Number(req.params.id),
      reviews: shapedReviews,
      review_count: total,
      avg_rating: agg.avg_rating == null ? null : Number(agg.avg_rating),
      breakdown
    });
  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit (or update) a review for a product. Only logged-in customers can
// review, and only the products they have actually purchased. One review per
// customer per product - a second submission updates the existing one instead
// of creating a duplicate. The product rating is recalculated from real
// reviews. The customer identity always comes from the verified JWT, never
// from the request body.
router.post('/:id/reviews', authenticateToken, async (req, res) => {
  try {
    const validationError = validateRatingAndComment(req.body.rating, req.body.comment);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment).trim();

    const [products] = await pool.query('SELECT id FROM products WHERE id = ?', [req.params.id]);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const productId = Number(req.params.id);
    const userId = req.user.id;

    // Purchase gate: only customers who actually bought the product AND the order was delivered may review it.
    // Also fetch the order_id for the delivered order to link the review.
    const [[purchased]] = await pool.query(
      `SELECT COUNT(*) AS c, MIN(o.id) AS order_id
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'delivered'`,
      [userId, productId]
    );
    if (Number(purchased.c) === 0) {
      return res.status(403).json({ error: 'You can only review a product after it has been delivered.' });
    }
    const orderId = purchased.order_id ? Number(purchased.order_id) : null;

    // "Verified Purchase" badge for deliveries that have been completed.
    const [[delivered]] = await pool.query(
      `SELECT COUNT(*) AS c
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'delivered'`,
      [userId, productId]
    );
    const isVerified = Number(delivered.c) > 0 ? 1 : 0;

    const name = req.user.name || 'Customer';
    const email = req.user.email || null;

    const [existing] = await pool.query(
      'SELECT id FROM product_reviews WHERE user_id = ? AND product_id = ?',
      [userId, productId]
    );

    let review;
    let created = false;

    if (existing.length > 0) {
      // One user + one product = one review: update instead of duplicating.
      await pool.query(
        `UPDATE product_reviews SET name = ?, email = ?, rating = ?, comment = ?, is_verified = ?, order_id = ?
         WHERE id = ?`,
        [name, email, rating, comment, isVerified, orderId, existing[0].id]
      );
      review = (await pool.query('SELECT * FROM product_reviews WHERE id = ?', [existing[0].id]))[0][0];
    } else {
      try {
        const [result] = await pool.query(
          `INSERT INTO product_reviews (product_id, user_id, name, email, rating, comment, is_verified, order_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [productId, userId, name, email, rating, comment, isVerified, orderId]
        );
        review = (await pool.query('SELECT * FROM product_reviews WHERE id = ?', [result.insertId]))[0][0];
        created = true;
      } catch (err) {
        // Unique index (user_id, product_id) race guard -> update the existing one.
        if (!err || err.code !== 'ER_DUP_ENTRY') throw err;
        const [rows] = await pool.query(
          'SELECT id FROM product_reviews WHERE user_id = ? AND product_id = ?',
          [userId, productId]
        );
        if (rows.length === 0) throw err;
        await pool.query(
          `UPDATE product_reviews SET name = ?, email = ?, rating = ?, comment = ?, is_verified = ?, order_id = ?
           WHERE id = ?`,
          [name, email, rating, comment, isVerified, orderId, rows[0].id]
        );
        review = (await pool.query('SELECT * FROM product_reviews WHERE id = ?', [rows[0].id]))[0][0];
      }
    }

    const agg = await recalculateProductRating(productId);

    res.status(created ? 201 : 200).json({
      message: created
        ? 'Thank you! Your review has been submitted.'
        : 'Thank you! Your review has been updated.',
      review,
      avg_rating: agg.avg_rating,
      review_count: agg.review_count
    });
  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;