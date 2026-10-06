const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { recalculateProductRating, validateRatingAndComment } = require('../utils/reviews');

const router = express.Router();

// Reviews by the currently logged-in customer (for editing/deleting them).
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const [reviews] = await pool.query(
      `SELECT r.id, r.product_id, r.name, r.rating, r.comment, r.is_verified,
              r.created_at, r.updated_at,
              p.name AS product_name, p.image_url AS product_image
       FROM product_reviews r
       JOIN products p ON p.id = r.product_id
       WHERE r.user_id = ?
       ORDER BY r.updated_at DESC, r.created_at DESC`,
      [req.user.id]
    );
    res.json({ reviews });
  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit one of the caller's own reviews. Ownership is enforced server-side.
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const validationError = validateRatingAndComment(req.body.rating, req.body.comment);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const [rows] = await pool.query('SELECT * FROM product_reviews WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }
    const review = rows[0];

    if (Number(review.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'You can only edit your own review.' });
    }

    // Recompute the Verified Purchase flag and order_id from the customer's current orders
    // so an edited review always reflects their real purchase history.
    const [[delivered]] = await pool.query(
      `SELECT COUNT(*) AS c, MIN(o.id) AS order_id
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'delivered'`,
      [req.user.id, review.product_id]
    );
    const isVerified = Number(delivered.c) > 0 ? 1 : 0;
    const orderId = delivered.order_id ? Number(delivered.order_id) : null;

    await pool.query(
      `UPDATE product_reviews
       SET name = ?, email = ?, rating = ?, comment = ?, is_verified = ?, order_id = ?
       WHERE id = ?`,
      [
        req.user.name || review.name,
        req.user.email || review.email,
        Number(req.body.rating),
        String(req.body.comment).trim(),
        isVerified,
        orderId,
        review.id
      ]
    );

    const [updated] = await pool.query('SELECT * FROM product_reviews WHERE id = ?', [review.id]);
    const agg = await recalculateProductRating(review.product_id);

    res.json({
      message: 'Your review has been updated.',
      review: updated[0],
      avg_rating: agg.avg_rating,
      review_count: agg.review_count
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete one of the caller's own reviews. Ownership is enforced server-side
// and the product rating is recalculated from the remaining real reviews.
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM product_reviews WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }
    const review = rows[0];

    if (Number(review.user_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'You can only delete your own review.' });
    }

    await pool.query('DELETE FROM product_reviews WHERE id = ?', [review.id]);
    const agg = await recalculateProductRating(review.product_id);

    res.json({
      message: 'Your review has been deleted.',
      avg_rating: agg.avg_rating,
      review_count: agg.review_count
    });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;