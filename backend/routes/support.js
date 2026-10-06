const express = require('express');
const { pool } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { sendSupportReplyEmail } = require('../utils/email');
const { createNotification } = require('./notifications');

const router = express.Router();

function generateSupportId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SUP-${timestamp}-${random}`;
}

const SUPPORT_TYPES = {
  order_issue: 'Order Issue',
  payment_issue: 'Payment Issue',
  delivery_issue: 'Delivery Issue',
  return_refund: 'Return / Refund',
  other: 'Other'
};

const STATUSES = ['open', 'closed'];

router.post('/', async (req, res) => {
  try {
    const { name, mobile, email, support_type, description } = req.body;

    if (!name || !mobile || !email || !support_type || !description) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!SUPPORT_TYPES[support_type]) {
      return res.status(400).json({ error: 'Invalid support type' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const mobileRegex = /^[0-9+\-\s]{10,15}$/;
    if (!mobileRegex.test(mobile.replace(/\s/g, ''))) {
      return res.status(400).json({ error: 'Invalid mobile number' });
    }

    let user_id = null;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      if (token) {
        try {
          const jwt = require('jsonwebtoken');
          const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
          const decoded = jwt.verify(token, JWT_SECRET);
          user_id = decoded.id;
        } catch (e) {
        }
      }
    }

    const support_id = generateSupportId();

    const [result] = await pool.query(
      `INSERT INTO support_requests (support_id, user_id, name, mobile, email, support_type, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`,
      [support_id, user_id, name.trim(), mobile.trim(), email.trim().toLowerCase(), support_type, description.trim()]
    );

    const [request] = await pool.query('SELECT * FROM support_requests WHERE id = ?', [result.insertId]);

    const requestData = {
      support_request_id: result.insertId,
      support_id,
      support_type,
      customer_name: name.trim(),
      customer_email: email.trim().toLowerCase(),
      status: request[0].status,
      created_at: request[0].created_at,
    };

    // Create a real notification (stored in the database) so the admin/support
    // bell shows a new support request that links directly to this ticket.
    await createNotification({
      type: 'new_support_request',
      title: 'New Support Request',
      message: `New ticket #${support_id} has been created by ${name.trim()} (${SUPPORT_TYPES[support_type]}).`,
      link: `/support?id=${result.insertId}`,
      ticket_id: result.insertId,
      data: requestData,
    });

    // Notify the logged-in customer that their own ticket was created. This
    // powers the bell in the Customer Support dashboard.
    if (user_id) {
      await createNotification({
        user_id,
        ticket_id: result.insertId,
        type: 'new_support_request',
        title: 'New Support Request',
        message: `Your support ticket #${support_id} has been created.`,
        link: `/support?id=${result.insertId}`,
        data: requestData,
      });
    }

    res.status(201).json({
      message: 'Your support request has been submitted successfully.',
      support_id: support_id,
      request: request[0]
    });
  } catch (error) {
    console.error('Submit support request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/my', authenticateToken, async (req, res) => {
  try {
    const { search, status, support_type, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (sr.support_id LIKE ? OR sr.name LIKE ? OR sr.email LIKE ? OR sr.mobile LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status && STATUSES.includes(status)) {
      whereClause += ' AND sr.status = ?';
      params.push(status);
    }

    if (support_type && SUPPORT_TYPES[support_type]) {
      whereClause += ' AND sr.support_type = ?';
      params.push(support_type);
    }

    const [requests] = await pool.query(`
      SELECT sr.*
      FROM support_requests sr
      ${whereClause}
      ORDER BY sr.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    const [totalResult] = await pool.query(`
      SELECT COUNT(*) as total FROM support_requests sr ${whereClause}
    `, params);

    res.json({
      data: requests,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total: totalResult[0].total,
        totalPages: Math.ceil(totalResult[0].total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get customer support requests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/my/stats', authenticateToken, async (req, res) => {
  try {
    const [[{ open }]] = await pool.query('SELECT COUNT(*) as open FROM support_requests WHERE status = "open"');
    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM support_requests');
    const [[{ closed }]] = await pool.query('SELECT COUNT(*) as closed FROM support_requests WHERE status = "closed"');

    const [typeRows] = await pool.query(`
      SELECT support_type, COUNT(*) as count
      FROM support_requests
      GROUP BY support_type
    `);

    const support_types = {
      order_issue: 0,
      delivery_issue: 0,
      payment_issue: 0,
      return_refund: 0,
      other: 0,
    };
    typeRows.forEach((row) => {
      if (Object.prototype.hasOwnProperty.call(support_types, row.support_type)) {
        support_types[row.support_type] = row.count;
      }
    });

    res.json({ open, total, closed, support_types });
  } catch (error) {
    console.error('Get customer support stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/my/:id', authenticateToken, async (req, res) => {
  try {
    const [requests] = await pool.query(`
      SELECT sr.*, u.name as user_name, u.email as user_email
      FROM support_requests sr
      LEFT JOIN users u ON sr.user_id = u.id
      WHERE sr.id = ?
    `, [req.params.id]);

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Support request not found' });
    }

    res.json(requests[0]);
  } catch (error) {
    console.error('Get customer support request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { search, status, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (support_id LIKE ? OR name LIKE ? OR email LIKE ? OR mobile LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status && STATUSES.includes(status)) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const [requests] = await pool.query(`
      SELECT sr.*, u.name as user_name, u.email as user_email
      FROM support_requests sr
      LEFT JOIN users u ON sr.user_id = u.id
      ${whereClause}
      ORDER BY sr.${sortBy} ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    const [totalResult] = await pool.query(`
      SELECT COUNT(*) as total FROM support_requests ${whereClause}
    `, params);

    res.json({
      data: requests,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total: totalResult[0].total,
        totalPages: Math.ceil(totalResult[0].total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get support requests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const [requests] = await pool.query(`
      SELECT sr.*, u.name as user_name, u.email as user_email
      FROM support_requests sr
      LEFT JOIN users u ON sr.user_id = u.id
      WHERE sr.id = ?
    `, [req.params.id]);

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Support request not found' });
    }

    const request = requests[0];

    res.json(request);
  } catch (error) {
    console.error('Get support request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status } = req.body;
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await pool.query('UPDATE support_requests SET status = ?, updated_at = NOW() WHERE id = ?', [status, req.params.id]);

    const [request] = await pool.query('SELECT * FROM support_requests WHERE id = ?', [req.params.id]);
    if (request.length === 0) {
      return res.status(404).json({ error: 'Support request not found' });
    }

    if (request[0].user_id) {
      await createNotification({
        user_id: request[0].user_id,
        ticket_id: request[0].id,
        type: 'support_status_update',
        title: 'Support Ticket Updated',
        message: `Your support ticket #${request[0].support_id} has been ${status}.`,
        link: `/support?id=${request[0].id}`,
        data: {
          support_request_id: request[0].id,
          support_id: request[0].support_id,
          support_type: request[0].support_type,
          status,
          customer_email: request[0].email,
          updated_at: new Date().toISOString(),
        },
      });
    }

    res.json(request[0]);
  } catch (error) {
    console.error('Update support status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id/reply', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { admin_reply } = req.body;
    if (!admin_reply || !admin_reply.trim()) {
      return res.status(400).json({ error: 'Reply message is required' });
    }

    // Check if the ticket is already closed
    const [existing] = await pool.query('SELECT status FROM support_requests WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Support request not found' });
    }
    if (existing[0].status === 'closed') {
      return res.status(400).json({ error: 'This support request is already closed' });
    }

    // Save reply and automatically close the ticket
    await pool.query(
      'UPDATE support_requests SET admin_reply = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [admin_reply.trim(), 'closed', req.params.id]
    );

    const [request] = await pool.query('SELECT * FROM support_requests WHERE id = ?', [req.params.id]);
    if (request.length === 0) {
      return res.status(404).json({ error: 'Support request not found' });
    }

    // Send email notification to customer
    await sendSupportReplyEmail(request[0], admin_reply.trim());

    // Notify the customer (in-app) that support replied, so their bell shows
    // the updated ticket and clicking it opens this exact ticket.
    if (request[0].user_id) {
      await createNotification({
        user_id: request[0].user_id,
        ticket_id: request[0].id,
        type: 'support_reply',
        title: 'Support Ticket Updated',
        message: `Support has replied to your ticket #${request[0].support_id}.`,
        link: `/support?id=${request[0].id}`,
        data: {
          support_request_id: request[0].id,
          support_id: request[0].support_id,
          support_type: request[0].support_type,
          status: request[0].status,
          admin_reply: admin_reply.trim(),
          customer_email: request[0].email,
          updated_at: new Date().toISOString(),
        },
      });
    }

    res.json(request[0]);
  } catch (error) {
    console.error('Reply to support request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/stats/count', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const [[{ open }]] = await pool.query('SELECT COUNT(*) as open FROM support_requests WHERE status = "open"');
    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM support_requests');

    const [typeRows] = await pool.query(`
      SELECT support_type, COUNT(*) as count
      FROM support_requests
      GROUP BY support_type
    `);

    const [openTypeRows] = await pool.query(`
      SELECT support_type, COUNT(*) as count
      FROM support_requests
      WHERE status = 'open'
      GROUP BY support_type
    `);

    const support_types = {
      order_issue: 0,
      delivery_issue: 0,
      payment_issue: 0,
      return_refund: 0,
      other: 0,
    };
    const open_support_types = {
      order_issue: 0,
      delivery_issue: 0,
      payment_issue: 0,
      return_refund: 0,
      other: 0,
    };
    typeRows.forEach((row) => {
      if (Object.prototype.hasOwnProperty.call(support_types, row.support_type)) {
        support_types[row.support_type] = row.count;
      }
    });
    openTypeRows.forEach((row) => {
      if (Object.prototype.hasOwnProperty.call(open_support_types, row.support_type)) {
        open_support_types[row.support_type] = row.count;
      }
    });

    res.json({ open, total, support_types, open_support_types });
  } catch (error) {
    console.error('Get support stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;