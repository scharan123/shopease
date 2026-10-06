const { pool } = require('../config/db');

// Recalculate a product's stored rating from its real customer reviews and
// persist it. Reviews with no reviews get a stored 0.0; the API reports
// rating: null (and the UI shows "No ratings yet") when review_count is 0.
async function recalculateProductRating(productId) {
  const [[agg]] = await pool.query(
    `SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS review_count
     FROM product_reviews WHERE product_id = ?`,
    [productId]
  );
  await pool.query('UPDATE products SET rating = ? WHERE id = ?', [
    agg.avg_rating == null ? 0.0 : agg.avg_rating,
    productId
  ]);
  return {
    avg_rating: agg.avg_rating == null ? null : Number(agg.avg_rating),
    review_count: Number(agg.review_count || 0),
  };
}

// Shared validation for a submitted review. Returns an error message string,
// or null when the rating and feedback are valid.
function validateRatingAndComment(rating, comment) {
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return 'Rating must be a whole number between 1 and 5';
  }
  const c = typeof comment === 'string' ? comment.trim() : '';
  if (!c) return 'Please write your feedback before submitting.';
  if (c.length < 3) return 'Feedback must be at least 3 characters long.';
  return null;
}

module.exports = { recalculateProductRating, validateRatingAndComment };