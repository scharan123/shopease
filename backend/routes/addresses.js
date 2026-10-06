const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { isValidPin } = require('../utils/delivery');

const router = express.Router();

// GET /api/addresses - Get all saved addresses for the logged-in user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [addresses] = await pool.query(
      'SELECT * FROM customer_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [req.user.id]
    );
    res.json(addresses);
  } catch (error) {
    console.error('Get addresses error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/addresses - Create a new saved address
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name,
      phone,
      address_line,
      area,
      city,
      state,
      pincode,
      country = 'IN',
      is_default = false
    } = req.body;

    // Validate required fields
    if (!name || !phone || !address_line || !city || !state || !pincode) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // Validate PIN code
    if (!isValidPin(pincode)) {
      return res.status(400).json({ error: 'Invalid PIN code. Must be 6 digits.' });
    }

    // Check for duplicate address (same user + same address_line + pincode)
    const [existing] = await pool.query(
      'SELECT id FROM customer_addresses WHERE user_id = ? AND address_line = ? AND pincode = ?',
      [req.user.id, address_line.trim(), pincode.trim()]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'This address already exists in your saved addresses' });
    }

    // If this is set as default, unset other defaults for this user
    if (is_default) {
      await pool.query('UPDATE customer_addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    }

    const areaValue = area ? area.trim() : null;
    const [result] = await pool.query(
      `INSERT INTO customer_addresses (user_id, name, phone, address_line, area, city, state, pincode, country, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, name.trim(), phone.trim(), address_line.trim(), areaValue, city.trim(), state.trim(), pincode.trim(), country, is_default ? 1 : 0]
    );

    const [address] = await pool.query('SELECT * FROM customer_addresses WHERE id = ?', [result.insertId]);
    res.status(201).json(address[0]);
  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/addresses/:id - Update a saved address
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const addressId = req.params.id;
    const {
      name,
      phone,
      address_line,
      area,
      city,
      state,
      pincode,
      country,
      is_default
    } = req.body;

    // Verify address belongs to user
    const [addresses] = await pool.query('SELECT * FROM customer_addresses WHERE id = ? AND user_id = ?', [addressId, req.user.id]);
    if (addresses.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Validate PIN code if provided
    if (pincode && !isValidPin(pincode)) {
      return res.status(400).json({ error: 'Invalid PIN code. Must be 6 digits.' });
    }

    // If setting as default, unset other defaults
    if (is_default === true) {
      await pool.query('UPDATE customer_addresses SET is_default = 0 WHERE user_id = ? AND id != ?', [req.user.id, addressId]);
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name.trim()); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone.trim()); }
    if (address_line !== undefined) { updates.push('address_line = ?'); values.push(address_line.trim()); }
    if (area !== undefined) { updates.push('area = ?'); values.push(area?.trim() || null); }
    if (city !== undefined) { updates.push('city = ?'); values.push(city.trim()); }
    if (state !== undefined) { updates.push('state = ?'); values.push(state.trim()); }
    if (pincode !== undefined) { updates.push('pincode = ?'); values.push(pincode.trim()); }
    if (country !== undefined) { updates.push('country = ?'); values.push(country); }
    if (is_default !== undefined) { updates.push('is_default = ?'); values.push(is_default ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(addressId);

    await pool.query(`UPDATE customer_addresses SET ${updates.join(', ')} WHERE id = ?`, values);

    const [updated] = await pool.query('SELECT * FROM customer_addresses WHERE id = ?', [addressId]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/addresses/:id - Delete a saved address
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const addressId = req.params.id;

    // Verify address belongs to user
    const [addresses] = await pool.query('SELECT * FROM customer_addresses WHERE id = ? AND user_id = ?', [addressId, req.user.id]);
    if (addresses.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    await pool.query('DELETE FROM customer_addresses WHERE id = ?', [addressId]);
    res.json({ success: true, message: 'Address deleted' });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/addresses/:id/default - Set an address as default
router.put('/:id/default', authenticateToken, async (req, res) => {
  try {
    const addressId = req.params.id;

    // Verify address belongs to user
    const [addresses] = await pool.query('SELECT * FROM customer_addresses WHERE id = ? AND user_id = ?', [addressId, req.user.id]);
    if (addresses.length === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Unset all other defaults for this user
    await pool.query('UPDATE customer_addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);

    // Set this address as default
    await pool.query('UPDATE customer_addresses SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [addressId]);

    const [updated] = await pool.query('SELECT * FROM customer_addresses WHERE id = ?', [addressId]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Set default address error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;