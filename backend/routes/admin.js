const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { authenticateToken, generateToken, JWT_SECRET } = require('../middleware/auth');
const { recalculateProductRating } = require('../utils/reviews');

const router = express.Router();

const adminAuth = (req, res, next) => {
  authenticateToken(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND role = "admin"', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userData = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = generateToken(userData);

    res.json({ user: userData, token });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', adminAuth, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(users[0]);
  } catch (error) {
    console.error('Get admin user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', adminAuth, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

router.put('/profile', adminAuth, async (req, res) => {
  try {
    const { name, email, current_password, new_password } = req.body;
    const userId = req.user.id;

    const [existing] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = existing[0];

    const updates = [];
    const params = [];

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (email !== undefined) {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ error: 'Invalid email address' });
      }
      const [emailCheck] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email.trim(), userId]);
      if (emailCheck.length > 0) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      updates.push('email = ?');
      params.push(email.trim());
    }

    if (new_password !== undefined) {
      if (!current_password) {
        return res.status(400).json({ error: 'Current password is required to change password' });
      }
      const valid = await bcrypt.compare(current_password, user.password);
      if (!valid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      if (!new_password || new_password.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }
      const hashed = await bcrypt.hash(new_password, 10);
      updates.push('password = ?');
      params.push(hashed);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    params.push(userId);

    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [userId]
    );
    res.json(updated[0]);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/stats', adminAuth, async (req, res) => {
  try {
    const [[{ total_revenue }]] = await pool.query('SELECT COALESCE(SUM(total_amount), 0) as total_revenue FROM orders');
    const [[{ total_orders }]] = await pool.query('SELECT COUNT(*) as total_orders FROM orders');
    const [[{ total_users }]] = await pool.query('SELECT COUNT(*) as total_users FROM users WHERE role = "user"');
    const [[{ conversion_rate }]] = await pool.query(`
      SELECT 
        CASE 
          WHEN (SELECT COUNT(*) FROM users WHERE role = "user") > 0 
          THEN ROUND((SELECT COUNT(*) FROM orders) * 100.0 / (SELECT COUNT(*) FROM users WHERE role = "user"), 2)
          ELSE 0 
        END as conversion_rate
    `);

    const [[{ prev_revenue }]] = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) as prev_revenue 
      FROM orders 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
    const [[{ prev_orders }]] = await pool.query(`
      SELECT COUNT(*) as prev_orders 
      FROM orders 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
    const [[{ prev_users }]] = await pool.query(`
      SELECT COUNT(*) as prev_users 
      FROM users 
      WHERE role = "user" AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);
    const [[{ prev_conversion }]] = await pool.query(`
      SELECT 
        CASE 
          WHEN (SELECT COUNT(*) FROM users WHERE role = "user" AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)) > 0 
          THEN ROUND((SELECT COUNT(*) FROM orders WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)) * 100.0 / (SELECT COUNT(*) FROM users WHERE role = "user" AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)), 2)
          ELSE 0 
        END as prev_conversion
    `);

    const revenue_change = prev_revenue > 0 ? ((total_revenue - prev_revenue) / prev_revenue) * 100 : 0;
    const orders_change = prev_orders > 0 ? ((total_orders - prev_orders) / prev_orders) * 100 : 0;
    const users_change = prev_users > 0 ? ((total_users - prev_users) / prev_users) * 100 : 0;
    const conversion_change = prev_conversion > 0 ? ((conversion_rate - prev_conversion) / prev_conversion) * 100 : 0;

    res.json({
      total_revenue,
      total_orders,
      total_users,
      conversion_rate,
      revenue_change: Math.round(revenue_change * 10) / 10,
      orders_change: Math.round(orders_change * 10) / 10,
      users_change: Math.round(users_change * 10) / 10,
      conversion_change: Math.round(conversion_change * 10) / 10,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/analytics', adminAuth, async (req, res) => {
  try {
    const { range = '30d' } = req.query;
    let days = 30;
    let groupFormat = '%Y-%m-%d';
    let dateFilter = 'DATE_SUB(NOW(), INTERVAL 30 DAY)';

    switch (range) {
      case '7d':
        days = 7;
        dateFilter = 'DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case '30d':
        days = 30;
        dateFilter = 'DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
      case '90d':
        days = 90;
        dateFilter = 'DATE_SUB(NOW(), INTERVAL 90 DAY)';
        break;
      case '1y':
        days = 365;
        groupFormat = '%Y-%m';
        dateFilter = 'DATE_SUB(NOW(), INTERVAL 1 YEAR)';
        break;
    }

    const [data] = await pool.query(`
      SELECT 
        DATE_FORMAT(created_at, '${groupFormat}') as date,
        COUNT(*) as orders,
        COALESCE(SUM(total_amount), 0) as revenue,
        COALESCE(SUM(total_amount) * 0.3, 0) as income
      FROM orders
      WHERE created_at >= ${dateFilter}
      GROUP BY DATE_FORMAT(created_at, '${groupFormat}')
      ORDER BY date ASC
    `);

    res.json(data);
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/analytics/categories', adminAuth, async (req, res) => {
  try {
    const [data] = await pool.query(`
      SELECT 
        c.name as category,
        COALESCE(SUM(oi.price * oi.quantity), 0) as revenue,
        COUNT(DISTINCT o.id) as orders
      FROM categories c
      LEFT JOIN products p ON c.slug = p.category
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
    `);
    res.json(data);
  } catch (error) {
    console.error('Get category revenue error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/analytics/payments', adminAuth, async (req, res) => {
  try {
    const [data] = await pool.query(`
      SELECT 
        payment_method as method,
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as amount,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders), 2) as percentage
      FROM orders
      GROUP BY payment_method
      ORDER BY amount DESC
    `);
    res.json(data);
  } catch (error) {
    console.error('Get payment stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/analytics/order-status', adminAuth, async (req, res) => {
  try {
    const [data] = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders), 2) as percentage
      FROM orders
      GROUP BY status
      ORDER BY 
        CASE status
          WHEN 'pending' THEN 1
          WHEN 'processing' THEN 2
          WHEN 'shipped' THEN 3
          WHEN 'delivered' THEN 4
          WHEN 'cancelled' THEN 5
        END
    `);
    res.json(data);
  } catch (error) {
    console.error('Get order status stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/categories', adminAuth, async (req, res) => {
  try {
    const { search, limit = 50, page = 1, sortBy = 'display_order', sortOrder = 'asc' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (LOWER(name) LIKE LOWER(?) OR LOWER(slug) LIKE LOWER(?))';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    const [categories] = await pool.query(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.slug = p.category
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.${sortBy} ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    const [totalResult] = await pool.query(`
      SELECT COUNT(*) as total FROM categories ${whereClause}
    `, params);

    res.json({
      data: categories,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total: totalResult[0].total,
        totalPages: Math.ceil(totalResult[0].total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/categories', adminAuth, async (req, res) => {
  try {
    const { name, slug, icon, display_order = 0, image_url } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Name and slug are required' });
    }

    const [existing] = await pool.query('SELECT id FROM categories WHERE slug = ?', [slug]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Slug already exists' });
    }

    const [result] = await pool.query(
      'INSERT INTO categories (name, slug, icon, display_order, image_url) VALUES (?, ?, ?, ?, ?)',
      [name, slug, icon || null, display_order, image_url || null]
    );

    const [category] = await pool.query('SELECT * FROM categories WHERE id = ?', [result.insertId]);
    res.status(201).json(category[0]);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/categories/:id', adminAuth, async (req, res) => {
  try {
    const { name, slug, icon, display_order, image_url } = req.body;

    const [existing] = await pool.query('SELECT id FROM categories WHERE slug = ? AND id != ?', [slug, req.params.id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Slug already exists' });
    }

    await pool.query(
      'UPDATE categories SET name = ?, slug = ?, icon = ?, display_order = ?, image_url = ? WHERE id = ?',
      [name, slug, icon || null, display_order || 0, image_url || null, req.params.id]
    );

    const [category] = await pool.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (category.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category[0]);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/categories/:id', adminAuth, async (req, res) => {
  try {
    const [products] = await pool.query('SELECT COUNT(*) as count FROM products WHERE category = (SELECT slug FROM categories WHERE id = ?)', [req.params.id]);
    if (products[0].count > 0) {
      return res.status(400).json({ error: 'Cannot delete category with products' });
    }

    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/categories/bulk', adminAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs array required' });
    }

    const [products] = await pool.query(
      'SELECT COUNT(*) as count FROM products WHERE category IN (SELECT slug FROM categories WHERE id IN (?))',
      [ids]
    );
    if (products[0].count > 0) {
      return res.status(400).json({ error: 'Cannot delete categories with products' });
    }

    await pool.query('DELETE FROM categories WHERE id IN (?)', [ids]);
    res.json({ message: 'Categories deleted successfully' });
  } catch (error) {
    console.error('Bulk delete categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/categories/reorder', adminAuth, async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array required' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const item of items) {
        await connection.query(
          'UPDATE categories SET display_order = ? WHERE id = ?',
          [item.display_order, item.id]
        );
      }
      await connection.commit();
      res.json({ message: 'Categories reordered successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Reorder categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/products', adminAuth, async (req, res) => {
  try {
    const { search, category, limit = 50, page = 1, sortBy = 'created_at', sortOrder = 'desc', stock } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (LOWER(name) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (category && category !== 'all') {
      whereClause += ' AND category = ?';
      params.push(category);
    }

    if (stock === 'in_stock') {
      whereClause += ' AND stock > 0';
    } else if (stock === 'low_stock') {
      whereClause += ' AND stock > 0 AND stock <= 10';
    } else if (stock === 'out_of_stock') {
      whereClause += ' AND stock = 0';
    }

    const [products] = await pool.query(`
      SELECT p.*, COUNT(r.id) AS review_count,
             ROUND(AVG(r.rating), 1) AS effective_rating
      FROM products p
      LEFT JOIN product_reviews r ON r.product_id = p.id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.${sortBy} ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    const [totalResult] = await pool.query(
      `SELECT COUNT(*) as total FROM products ${whereClause}`,
      params
    );

    // Rating is the real average of customer reviews (null when no reviews).
    const shapedProducts = products.map((p) => {
      const reviewCount = Number(p.review_count || 0);
      const avgRating = p.effective_rating;
      delete p.effective_rating;
      return {
        ...p,
        rating: reviewCount > 0 && avgRating != null ? Number(avgRating) : null,
        review_count: reviewCount,
      };
    });

    res.json({
      data: shapedProducts,
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

router.post('/products', adminAuth, async (req, res) => {
  try {
    const { name, description, price, rating = 0, discount = 0, specification, highlights, delivery, delivery_type = 'all-india', selected_pin_codes, sizes, image_url, images, stock, category, category_id, featured = false } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({ error: 'Name, price, and category are required' });
    }

    const [result] = await pool.query(
      'INSERT INTO products (name, description, price, rating, discount, specification, highlights, delivery, delivery_type, selected_pin_codes, sizes, image_url, images, stock, category, category_id, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, description || null, price, rating || 0, discount || 0, specification || null, highlights || null, delivery || null, delivery_type, selected_pin_codes ? JSON.stringify(selected_pin_codes) : null, sizes ? JSON.stringify(sizes) : null, image_url || null, JSON.stringify(images || []), stock || 0, category, category_id || null, featured]
    );

    const [product] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json(product[0]);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/products/:id', adminAuth, async (req, res) => {
  try {
    const { name, description, price, rating, discount, specification, highlights, delivery, delivery_type, selected_pin_codes, sizes, image_url, images, stock, category, category_id, featured } = req.body;

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (price !== undefined) { updates.push('price = ?'); params.push(price); }
    if (rating !== undefined) { updates.push('rating = ?'); params.push(rating); }
    if (discount !== undefined) { updates.push('discount = ?'); params.push(discount); }
    if (specification !== undefined) { updates.push('specification = ?'); params.push(specification); }
    if (highlights !== undefined) { updates.push('highlights = ?'); params.push(highlights); }
    if (delivery !== undefined) { updates.push('delivery = ?'); params.push(delivery); }
    if (delivery_type !== undefined) { updates.push('delivery_type = ?'); params.push(delivery_type); }
    if (selected_pin_codes !== undefined) { updates.push('selected_pin_codes = ?'); params.push(JSON.stringify(selected_pin_codes)); }
    if (sizes !== undefined) { updates.push('sizes = ?'); params.push(JSON.stringify(sizes)); }
    if (image_url !== undefined) { updates.push('image_url = ?'); params.push(image_url); }
    if (images !== undefined) { updates.push('images = ?'); params.push(JSON.stringify(images)); }
    if (stock !== undefined) { updates.push('stock = ?'); params.push(stock); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (category_id !== undefined) { updates.push('category_id = ?'); params.push(category_id); }
    if (featured !== undefined) { updates.push('featured = ?'); params.push(featured); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.params.id);
    await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);

    const [product] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (product.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product[0]);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/products/:id', adminAuth, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/products/bulk', adminAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs array required' });
    }

    await pool.query('DELETE FROM products WHERE id IN (?)', [ids]);
    res.json({ message: 'Products deleted successfully' });
  } catch (error) {
    console.error('Bulk delete products error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/orders', adminAuth, async (req, res) => {
  try {
    const { search, status, payment_method, startDate, endDate, limit = 20, page = 1, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (o.id LIKE ? OR LOWER(u.name) LIKE LOWER(?) OR LOWER(u.email) LIKE LOWER(?))';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (status && status !== 'all') {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }

    if (payment_method && payment_method !== 'all') {
      whereClause += ' AND o.payment_method = ?';
      params.push(payment_method);
    }

    if (startDate) {
      whereClause += ' AND DATE(o.created_at) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND DATE(o.created_at) <= ?';
      params.push(endDate);
    }

    const [orders] = await pool.query(`
      SELECT o.*, u.name as user_name, u.email as user_email,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause}
      ORDER BY o.${sortBy} ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    const [totalResult] = await pool.query(`
      SELECT COUNT(*) as total FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${whereClause}
    `, params);

    const shapedOrders = orders.map((o) => ({
      ...o,
      user: { name: o.user_name, email: o.user_email },
    }));

    res.json({
      data: shapedOrders,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total: totalResult[0].total,
        totalPages: Math.ceil(totalResult[0].total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/orders/:id', adminAuth, async (req, res) => {
  try {
    const [orders] = await pool.query(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `, [req.params.id]);

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const [items] = await pool.query(`
      SELECT oi.*, p.name, p.image_url
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [req.params.id]);

    res.json({ ...orders[0], items, user: { name: orders[0].user_name, email: orders[0].user_email } });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/orders/:id/status', adminAuth, async (req, res) => {
  try {
    const { status, tracking_number } = req.body;
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updates = ['status = ?', 'updated_at = NOW()'];
    const params = [status];

    if (status === 'shipped' && tracking_number) {
      updates.push('tracking_number = ?', 'shipped_at = NOW()');
      params.push(tracking_number);
    } else if (status === 'delivered') {
      updates.push('delivered_at = NOW()');
    }

    params.push(req.params.id);
    await pool.query(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, params);

    const [order] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (order.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order[0]);
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/orders/bulk-status', adminAuth, async (req, res) => {
  try {
    const { ids, status } = req.body;
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs array required' });
    }
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await pool.query('UPDATE orders SET status = ?, updated_at = NOW() WHERE id IN (?)', [status, ids]);
    res.json({ message: 'Orders updated successfully' });
  } catch (error) {
    console.error('Bulk update order status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/users', adminAuth, async (req, res) => {
  try {
    const { search, role, limit = 20, page = 1, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (LOWER(name) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?))';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (role && role !== 'all') {
      whereClause += ' AND role = ?';
      params.push(role);
    }

    const [users] = await pool.query(`
      SELECT u.*, 
        (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE user_id = u.id) as total_spent
      FROM users u
      ${whereClause}
      ORDER BY u.${sortBy} ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    const [totalResult] = await pool.query(`
      SELECT COUNT(*) as total FROM users ${whereClause}
    `, params);

    res.json({
      data: users,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total: totalResult[0].total,
        totalPages: Math.ceil(totalResult[0].total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/users/:id', adminAuth, async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT u.*, 
        (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE user_id = u.id) as total_spent
      FROM users u
      WHERE u.id = ?
    `, [req.params.id]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [orders] = await pool.query(`
      SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
    `, [req.params.id]);

    res.json({ ...users[0], recent_orders: orders });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/users/:id/role', adminAuth, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (req.params.id == req.user.id && role === 'user') {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);

    const [users] = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [req.params.id]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(users[0]);
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    if (req.params.id == req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// All customer reviews (with product + customer info) for the admin panel.
router.get('/reviews', adminAuth, async (req, res) => {
  try {
    const { search, rating, limit = 20, page = 1, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    const sortColumns = ['created_at', 'rating', 'id'];
    const orderCol = sortColumns.includes(sortBy) ? sortBy : 'created_at';
    const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (LOWER(p.name) LIKE LOWER(?) OR LOWER(COALESCE(r.name, u.name, \'\')) LIKE LOWER(?) OR LOWER(COALESCE(r.comment, \'\')) LIKE LOWER(?))';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (rating && Number.isInteger(Number(rating)) && Number(rating) >= 1 && Number(rating) <= 5) {
      whereClause += ' AND r.rating = ?';
      params.push(Number(rating));
    }

    const [reviews] = await pool.query(`
      SELECT r.id, r.product_id, r.user_id, r.name, r.email, r.rating, r.comment,
             r.is_verified, r.created_at,
             p.name AS product_name, p.image_url AS product_image,
             u.name AS user_name, u.email AS user_email
      FROM product_reviews r
      JOIN products p ON r.product_id = p.id
      LEFT JOIN users u ON r.user_id = u.id
      ${whereClause}
      ORDER BY r.${orderCol} ${orderDir}
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    const [totalResult] = await pool.query(`
      SELECT COUNT(*) as total
      FROM product_reviews r
      JOIN products p ON r.product_id = p.id
      LEFT JOIN users u ON r.user_id = u.id
      ${whereClause}
    `, params);

    res.json({
      data: reviews,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total: totalResult[0].total,
        totalPages: Math.ceil(totalResult[0].total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a review and recalculate the product's rating from remaining reviews.
router.delete('/reviews/:id', adminAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT product_id FROM product_reviews WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }
    const productId = rows[0].product_id;

    await pool.query('DELETE FROM product_reviews WHERE id = ?', [req.params.id]);

    await recalculateProductRating(productId);

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

// ==================== COUPON MANAGEMENT ====================

// Get all coupons (admin)
router.get('/coupons', adminAuth, async (req, res) => {
  try {
    const { search, status, limit = 50, page = 1, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (LOWER(code) LIKE LOWER(?) OR LOWER(discount_type) LIKE LOWER(?))';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (status && status !== 'all') {
      if (status === 'active') {
        whereClause += ' AND is_active = 1 AND expiry_date >= NOW()';
      } else if (status === 'expired') {
        whereClause += ' AND expiry_date < NOW()';
      } else if (status === 'inactive') {
        whereClause += ' AND is_active = 0';
      }
    }

    const [coupons] = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM coupon_usage WHERE coupon_id = c.id) as usage_count
      FROM coupons c
      ${whereClause}
      ORDER BY c.${sortBy} ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    const [totalResult] = await pool.query(`
      SELECT COUNT(*) as total FROM coupons ${whereClause}
    `, params);

    res.json({
      data: coupons.map(c => ({
        ...c,
        discount_value: parseFloat(c.discount_value),
        min_order_amount: parseFloat(c.min_order_amount),
        max_discount: c.max_discount ? parseFloat(c.max_discount) : null,
        usage_count: parseInt(c.usage_count) || 0
      })),
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total: totalResult[0].total,
        totalPages: Math.ceil(totalResult[0].total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single coupon
router.get('/coupons/:id', adminAuth, async (req, res) => {
  try {
    const [coupons] = await pool.query('SELECT * FROM coupons WHERE id = ?', [req.params.id]);
    if (coupons.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }
    const coupon = coupons[0];
    res.json({
      ...coupon,
      discount_value: parseFloat(coupon.discount_value),
      min_order_amount: parseFloat(coupon.min_order_amount),
      max_discount: coupon.max_discount ? parseFloat(coupon.max_discount) : null,
    });
  } catch (error) {
    console.error('Get coupon error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create coupon
router.post('/coupons', adminAuth, async (req, res) => {
  try {
    const { code, discount_type, discount_value, min_order_amount, max_discount, usage_limit, per_user_limit, start_date, expiry_date, is_active } = req.body;

    if (!code || !discount_type || discount_value === undefined) {
      return res.status(400).json({ error: 'Code, discount type, and discount value are required' });
    }

    if (!['percentage', 'fixed'].includes(discount_type)) {
      return res.status(400).json({ error: 'Discount type must be percentage or fixed' });
    }

    const [existing] = await pool.query('SELECT id FROM coupons WHERE code = ?', [code.toUpperCase()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }

    const [result] = await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount, usage_limit, per_user_limit, start_date, expiry_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code.toUpperCase(),
        discount_type,
        discount_value,
        min_order_amount || 0,
        max_discount || null,
        usage_limit || 0,
        per_user_limit || 1,
        start_date || new Date(),
        expiry_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        is_active !== undefined ? is_active : 1
      ]
    );

    const [coupon] = await pool.query('SELECT * FROM coupons WHERE id = ?', [result.insertId]);
    res.status(201).json({
      ...coupon[0],
      discount_value: parseFloat(coupon[0].discount_value),
      min_order_amount: parseFloat(coupon[0].min_order_amount),
      max_discount: coupon[0].max_discount ? parseFloat(coupon[0].max_discount) : null,
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update coupon
router.put('/coupons/:id', adminAuth, async (req, res) => {
  try {
    const { code, discount_type, discount_value, min_order_amount, max_discount, usage_limit, per_user_limit, start_date, expiry_date, is_active } = req.body;

    const [existing] = await pool.query('SELECT id FROM coupons WHERE code = ? AND id != ?', [code.toUpperCase(), req.params.id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }

    const updates = [];
    const params = [];

    if (code !== undefined) { updates.push('code = ?'); params.push(code.toUpperCase()); }
    if (discount_type !== undefined) { updates.push('discount_type = ?'); params.push(discount_type); }
    if (discount_value !== undefined) { updates.push('discount_value = ?'); params.push(discount_value); }
    if (min_order_amount !== undefined) { updates.push('min_order_amount = ?'); params.push(min_order_amount); }
    if (max_discount !== undefined) { updates.push('max_discount = ?'); params.push(max_discount); }
    if (usage_limit !== undefined) { updates.push('usage_limit = ?'); params.push(usage_limit); }
    if (per_user_limit !== undefined) { updates.push('per_user_limit = ?'); params.push(per_user_limit); }
    if (start_date !== undefined) { updates.push('start_date = ?'); params.push(start_date); }
    if (expiry_date !== undefined) { updates.push('expiry_date = ?'); params.push(expiry_date); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.params.id);
    await pool.query(`UPDATE coupons SET ${updates.join(', ')} WHERE id = ?`, params);

    const [coupon] = await pool.query('SELECT * FROM coupons WHERE id = ?', [req.params.id]);
    if (coupon.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    res.json({
      ...coupon[0],
      discount_value: parseFloat(coupon[0].discount_value),
      min_order_amount: parseFloat(coupon[0].min_order_amount),
      max_discount: coupon[0].max_discount ? parseFloat(coupon[0].max_discount) : null,
    });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete coupon
router.delete('/coupons/:id', adminAuth, async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM coupons WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }
    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get coupon usage stats
router.get('/coupons/:id/usage', adminAuth, async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    const [usage] = await pool.query(`
      SELECT cu.*, u.name as user_name, u.email as user_email, o.total_amount as order_total
      FROM coupon_usage cu
      JOIN users u ON cu.user_id = u.id
      JOIN orders o ON cu.order_id = o.id
      WHERE cu.coupon_id = ?
      ORDER BY cu.used_at DESC
      LIMIT ? OFFSET ?
    `, [req.params.id, limitNum, offset]);

    const [[totalResult]] = await pool.query(
      'SELECT COUNT(*) as total FROM coupon_usage WHERE coupon_id = ?',
      [req.params.id]
    );

    const [[totalDiscount]] = await pool.query(
      'SELECT COALESCE(SUM(discount_amount), 0) as total_discount FROM coupon_usage WHERE coupon_id = ?',
      [req.params.id]
    );

    res.json({
      data: usage.map(u => ({
        ...u,
        discount_amount: parseFloat(u.discount_amount),
        order_total: parseFloat(u.order_total)
      })),
      total_discount: parseFloat(totalDiscount.total_discount),
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total: totalResult.total,
        totalPages: Math.ceil(totalResult.total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get coupon usage error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Referral stats for admin
router.get('/referrals/stats', adminAuth, async (req, res) => {
  try {
    const [[totalReferrals]] = await pool.query('SELECT COUNT(*) as count FROM referrals');
    const [[successfulReferrals]] = await pool.query('SELECT COUNT(*) as count FROM referrals WHERE status = "successful"');
    const [[pendingReferrals]] = await pool.query('SELECT COUNT(*) as count FROM referrals WHERE status = "pending"');
    const [[totalRewards]] = await pool.query('SELECT COALESCE(SUM(reward_amount), 0) as total FROM referrals WHERE status = "successful"');

    res.json({
      total_referrals: totalReferrals.count,
      successful_referrals: successfulReferrals.count,
      pending_referrals: pendingReferrals.count,
      total_rewards_paid: totalRewards.total,
    });
  } catch (error) {
    console.error('Get referral stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all referrals for admin
router.get('/referrals', adminAuth, async (req, res) => {
  try {
    const { search, status, limit = 50, page = 1, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 100);

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (LOWER(u1.name) LIKE LOWER(?) OR LOWER(u1.email) LIKE LOWER(?) OR LOWER(u2.name) LIKE LOWER(?) OR LOWER(u2.email) LIKE LOWER(?) OR r.referral_code LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status && status !== 'all') {
      whereClause += ' AND r.status = ?';
      params.push(status);
    }

    const [referrals] = await pool.query(`
      SELECT r.*, u1.name as referrer_name, u1.email as referrer_email, u2.name as referred_name, u2.email as referred_email
      FROM referrals r
      JOIN users u1 ON r.referrer_user_id = u1.id
      JOIN users u2 ON r.referred_user_id = u2.id
      ${whereClause}
      ORDER BY r.${sortBy} ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    const [totalResult] = await pool.query(`
      SELECT COUNT(*) as total FROM referrals r
      JOIN users u1 ON r.referrer_user_id = u1.id
      JOIN users u2 ON r.referred_user_id = u2.id
      ${whereClause}
    `, params);

    res.json({
      data: referrals.map(r => ({
        ...r,
        reward_amount: parseFloat(r.reward_amount)
      })),
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total: totalResult[0].total,
        totalPages: Math.ceil(totalResult[0].total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get referrals error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});