const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const [cart] = await pool.query(`
      SELECT c.id, c.quantity, c.product_id, p.name, p.description, p.price, p.image_url, p.stock, p.delivery_type, p.selected_pin_codes
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?
    `, [req.user.id]);
    res.json(cart);
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { product_id, quantity = 1, size } = req.body;

    if (!product_id) {
      return res.status(400).json({ error: 'Product ID required' });
    }

    const [products] = await pool.query('SELECT id, stock FROM products WHERE id = ?', [product_id]);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (products[0].stock < quantity) {
      return res.status(400).json({ error: 'Not enough stock' });
    }

    const [existing] = await pool.query(
      'SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?',
      [req.user.id, product_id]
    );

    if (existing.length > 0) {
      const newQuantity = existing[0].quantity + quantity;
      if (products[0].stock < newQuantity) {
        return res.status(400).json({ error: 'Not enough stock' });
      }
      await pool.query(
        'UPDATE cart SET quantity = ? WHERE id = ?',
        [newQuantity, existing[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [req.user.id, product_id, quantity]
      );
    }

    const [cart] = await pool.query(`
      SELECT c.id, c.quantity, c.product_id, p.name, p.description, p.price, p.image_url, p.stock, p.delivery_type, p.selected_pin_codes
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?
    `, [req.user.id]);

    res.json(cart);
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:productId', authenticateToken, async (req, res) => {
  try {
    const { quantity, size } = req.body;
    const productId = req.params.productId;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: 'Valid quantity required' });
    }

    const [products] = await pool.query('SELECT id, stock FROM products WHERE id = ?', [productId]);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (products[0].stock < quantity) {
      return res.status(400).json({ error: 'Not enough stock' });
    }

    await pool.query(
      'UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?',
      [quantity, req.user.id, productId]
    );

    const [cart] = await pool.query(`
      SELECT c.id, c.quantity, c.product_id, p.name, p.description, p.price, p.image_url, p.stock, p.delivery_type, p.selected_pin_codes
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?
    `, [req.user.id]);

    res.json(cart);
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:productId', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM cart WHERE user_id = ? AND product_id = ?',
      [req.user.id, req.params.productId]
    );

    const [cart] = await pool.query(`
      SELECT c.id, c.quantity, c.product_id, p.name, p.description, p.price, p.image_url, p.stock, p.delivery_type, p.selected_pin_codes
      FROM cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?
    `, [req.user.id]);

    res.json(cart);
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart WHERE user_id = ?', [req.user.id]);
    res.json([]);
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;