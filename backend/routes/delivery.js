const express = require('express');
const { pool } = require('../config/db');
const { isValidPin } = require('../utils/delivery');

const router = express.Router();

// POST /api/delivery/check
// Body: { pin: "500001", product_ids: [1, 9, 22] }
//
// Returns delivery availability for each requested product against the
// customer's PIN code using the product_serviceable_pincodes table.
router.post('/check', async (req, res) => {
  try {
    const { pin, product_ids } = req.body || {};

    if (!isValidPin(pin)) {
      return res.status(400).json({ error: 'Enter a valid 6-digit PIN code' });
    }
    if (!Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({ error: 'product_ids array required' });
    }

    const pinCode = String(pin).trim();
    const ids = [...new Set(product_ids.map((id) => Number(id)))];
    const placeholders = ids.map(() => '?').join(',');

    const [names] = await pool.query(
      'SELECT id, name FROM products WHERE id IN (' + placeholders + ')',
      ids
    );
    const [serviceableRows] = await pool.query(
      'SELECT product_id FROM product_serviceable_pincodes WHERE pincode = ? AND product_id IN (' + placeholders + ')',
      [pinCode, ...ids]
    );

    const nameById = new Map(names.map((p) => [Number(p.id), p.name]));
    const serviceable = new Set(serviceableRows.map((r) => Number(r.product_id)));

    const results = ids.map((id) => {
      const name = nameById.get(id);
      return {
        product_id: id,
        name: name || 'Unknown product',
        available: serviceable.has(id),
      };
    });

    res.json({ pin: pinCode, results });
  } catch (error) {
    console.error('Delivery check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;