const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Wishlist items are returned with the product's REAL rating (average of its
// customer reviews) and review count. Products with no reviews get rating: null.
const WISHLIST_QUERY = `
  SELECT p.*, w.product_id,
         COUNT(r.id) AS review_count,
         ROUND(AVG(r.rating), 1) AS effective_rating
  FROM wishlist w
  JOIN products p ON w.product_id = p.id
  LEFT JOIN product_reviews r ON r.product_id = p.id
`;

function shapeWishlist(rows) {
  return rows.map((row) => {
    const reviewCount = Number(row.review_count || 0);
    const avgRating = row.effective_rating;
    delete row.effective_rating;
    return {
      ...row,
      rating: reviewCount > 0 && avgRating != null ? Number(avgRating) : null,
      review_count: reviewCount,
    };
  });
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `${WISHLIST_QUERY}
       WHERE w.user_id = ?
       GROUP BY w.product_id, p.id
       ORDER BY w.created_at DESC`,
      [req.user.id]
    );
    res.json(shapeWishlist(rows));
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { product_id } = req.body;
    if (!product_id) return res.status(400).json({ error: 'Product ID required' });

    const [products] = await pool.query('SELECT id FROM products WHERE id = ?', [product_id]);
    if (products.length === 0) return res.status(404).json({ error: 'Product not found' });

    await pool.query(
      'INSERT IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)',
      [req.user.id, product_id]
    );
    const [rows] = await pool.query(
      `${WISHLIST_QUERY} WHERE w.user_id = ? GROUP BY w.product_id, p.id`,
      [req.user.id]
    );
    res.json(shapeWishlist(rows));
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:productId', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM wishlist WHERE user_id = ? AND product_id = ?',
      [req.user.id, req.params.productId]
    );
    const [rows] = await pool.query(
      `${WISHLIST_QUERY} WHERE w.user_id = ? GROUP BY w.product_id, p.id`,
      [req.user.id]
    );
    res.json(shapeWishlist(rows));
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
