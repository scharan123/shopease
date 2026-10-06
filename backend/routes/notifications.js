const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Inserts a notification row. Used by support ticket creation, support replies
// and other system events. A notification may target a customer (user_id set)
// with an optional ticket_id so customer-support bell clicks can open the
// exact ticket, or target the admin bell (user_id/context = null).
async function createNotification({
  user_id = null,
  ticket_id = null,
  type,
  title,
  message,
  link = null,
  data = null,
}) {
  const [result] = await pool.query(
    `INSERT INTO notifications (user_id, ticket_id, type, title, message, link, data_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user_id, ticket_id, type, title, message, link, data ? JSON.stringify(data) : null]
  );
  return result.insertId;
}

function parseRow(row) {
  let data = null;
  if (row.data_json) {
    try { data = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json; }
    catch (e) { data = null; }
  }
  const { data_json, ...rest } = row;
  return { ...rest, data };
}

// Customer: list the logged-in customer's own notifications (newest first,
// unread on top) + unread count. Used by the Customer Support bell.
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 100);
    const [rows] = await pool.query(
      `SELECT id, user_id, ticket_id, type, title, message, link, data_json, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY is_read ASC, created_at DESC
       LIMIT ?`,
      [req.user.id, limit]
    );

    const [[{ unread }]] = await pool.query(
      'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );

    res.json({ data: rows.map(parseRow), unread_count: Number(unread) });
  } catch (error) {
    console.error('List customer notifications error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Customer: unread count for the bell badge.
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const [[{ unread }]] = await pool.query(
      'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ unread_count: Number(unread) });
  } catch (error) {
    console.error('Get customer unread count error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Customer: mark all of the customer's own notifications as read.
router.post('/my/read-all', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all customer notifications read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: list notifications (newest first, unread on top) + unread count.
// Used by the admin dashboard bell with polling for real-time behaviour.
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit) || 30, 1), 100);
    const [rows] = await pool.query(
      `SELECT id, user_id, ticket_id, type, title, message, link, data_json, is_read, created_at
       FROM notifications
       ORDER BY is_read ASC, created_at DESC
       LIMIT ?`,
      [limit]
    );

    const [[{ unread }]] = await pool.query(
      'SELECT COUNT(*) AS unread FROM notifications WHERE is_read = 0'
    );

    res.json({ data: rows.map(parseRow), unread_count: Number(unread) });
  } catch (error) {
    console.error('List notifications error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark a single notification as read. Admins may mark any notification; a
// customer may only mark notifications that belong to them.
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    } else {
      const [result] = await pool.query(
        'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Notification not found' });
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: mark all notifications as read.
router.post('/read-all', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    await pool.query('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.createNotification = createNotification;