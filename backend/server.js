const path = require('path');

// Load backend/.env BEFORE any module that reads SMTP/Gmail credentials
// (utils/email.js, routes/auth.js, ...). The explicit path makes startup
// independent of the current working directory.
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { pool, testConnection } = require('./config/db');

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const categoryRoutes = require('./routes/categories');
const wishlistRoutes = require('./routes/wishlist');
const adminRoutes = require('./routes/admin');
const supportRoutes = require('./routes/support');

const deliveryRoutes = require('./routes/delivery');
const notificationRoutes = require('./routes/notifications');
const reviewRoutes = require('./routes/reviews');
const addressRoutes = require('./routes/addresses');
const referralRoutes = require('./routes/referrals');
const couponRoutes = require('./routes/coupons');

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security headers with Helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
  hsts: NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}));

// Compression for responses
app.use(compression());

// Logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.ADMIN_URL) {
  allowedOrigins.push(process.env.ADMIN_URL);
}
if (process.env.CUSTOMER_SUPPORT_URL) {
  allowedOrigins.push(process.env.CUSTOMER_SUPPORT_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // In development, allow all origins (including file://, any localhost port, etc.)
    if (NODE_ENV !== 'production') {
      callback(null, true);
    } else if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const isDev = NODE_ENV !== 'production';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 10000 : 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 10, // stricter limit for auth endpoints
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 1000 : 5, // 5 support requests per hour
  message: { error: 'Too many support requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files with caching
app.use(express.static(path.join(__dirname, '../frontend'), {
  maxAge: NODE_ENV === 'production' ? '1y' : '0',
  etag: true,
  lastModified: true,
}));

// Apply rate limiters
app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/support', supportLimiter);

// API Routes
console.log('[Startup] Mounting API routes...');
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/notifications', notificationRoutes);

app.use('/api/addresses', addressRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/coupons', couponRoutes);

const authEndpoints = ['register', 'login', 'me', 'forgot-password', 'verify-otp', 'resend-otp', 'reset-password'];
console.log('[Startup] /api/auth endpoints -> ' + authEndpoints.map(e => `/api/auth/${e}`).join(', '));

// Health check (no rate limit)
app.get('/api/health', async (req, res) => {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const latency = Date.now() - start;
    res.json({ 
      status: 'ok', 
      database: 'connected',
      latency: `${latency}ms`,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// Pincode lookup - returns postal location info for an Indian pincode.
// A PIN code identifies a postal locality/area (post office), not a full
// house address, so we return the locality, district and state.
app.get('/api/pincode/:pin', async (req, res) => {
  const pin = req.params.pin;
  if (!/^[0-9]{6}$/.test(pin)) {
    return res.status(400).json({ error: 'Invalid pincode. Must be 6 digits.' });
  }
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const data = await response.json();
    if (data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
      const po = data[0].PostOffice[0];
      res.json({
        pincode: po.Pincode || pin,
        city: po.District || po.Name || '',
        state: po.State || '',
        country: po.Country || 'India',
        division: po.Division || '',
        region: po.Region || '',
        postOffice: po.Name || '',
        block: po.Block || '',
        branchType: po.BranchType || '',
        district: po.District || '',
      });
    } else {
      res.status(404).json({ error: 'Pincode not found' });
    }
  } catch (err) {
    console.error('Pincode lookup error:', err.message);
    res.status(500).json({ error: 'Failed to look up pincode' });
  }
});

// API Info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'ShopEase API',
    version: '1.0.0',
    description: 'E-commerce backend API',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      cart: '/api/cart',
      orders: '/api/orders',
      categories: '/api/categories',
      wishlist: '/api/wishlist',
      admin: '/api/admin',
      support: '/api/support',
      delivery: '/api/delivery/check',
      addresses: '/api/addresses',
      health: '/api/health',
      pincode: '/api/pincode/:pin',
    },
    documentation: '/api/docs',
  });
});

// Frontend is hosted separately (Vercel). Return 404 for unknown routes.
app.get('*', (req, res) => {
  res.status(404).json({ error: 'Route not found. This is an API server.' });
});


// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }
  
  // Rate limit error
  if (err.name === 'RateLimitError') {
    return res.status(429).json({ error: 'Too many requests' });
  }
  
  // Validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  
  // Database error
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Duplicate entry' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'Referenced record not found' });
  }
  
  // Default error
  const status = err.status || 500;
  const message = NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(status).json({ 
    error: message,
    ...(NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

async function startServer() {
  const connected = await testConnection();
  if (!connected) {
    console.error('Failed to connect to database.');
    console.error('Check MySQL is running and DB_HOST/DB_USER/DB_PASSWORD/DB_NAME in backend/.env are correct.');
    console.error('Exiting after failed DB connection. Fix config, then run: npm start');
    process.exit(1);
  }


  const server = app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ShopEase API Server                                       ║
╠══════════════════════════════════════════════════════════════╣
║  Environment: ${NODE_ENV.padEnd(49)}║
║  Port: ${PORT.toString().padEnd(50)}║
║  Health: http://localhost:${PORT}/api/health${' '.repeat(30 - PORT.toString().length)}║
║  API: http://localhost:${PORT}/api${' '.repeat(42)}║
╚══════════════════════════════════════════════════════════════╝
    `);
    console.log(`[Startup] Backend is running and staying up on http://localhost:${PORT}`);
  });

  // Handle listen errors (e.g. port already in use) gracefully instead of
  // crashing the process with an unhandled 'error' event.
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[FATAL] Port ${PORT} is already in use.`);
      console.error('[FATAL] Another process (likely a stale `node server.js` / nodemon) holds the port.');
      console.error("[FATAL] Stop that process, then start this server again with: npm start");
    } else if (err.code === 'EACCES') {
      console.error(`\n[FATAL] Permission denied binding to port ${PORT}.`);
    } else {
      console.error('[FATAL] Server error:', err);
    }
    process.exit(1);
  });

  // Graceful shutdown only on explicit termination signals.
  const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      console.log('HTTP server closed');
      await pool.end();
      console.log('Database pool closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Application-level exceptions logged and swallowed so a single bad request
  // can never crash the whole backend. The server keeps serving other requests.
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception (server keeps running):', err);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection (server keeps running):', reason);
  });
}

startServer();
