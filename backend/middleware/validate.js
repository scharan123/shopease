const Joi = require('joi');

const schemas = {
  // Auth
  register: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required(),
    referral_code: Joi.string().max(20).allow('', null).optional(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  changePassword: Joi.object({
    current_password: Joi.string().required(),
    new_password: Joi.string().min(8).max(128).required(),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required(),
  }),

  verifyOtp: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().pattern(/^[0-9]{6}$/).required(),
  }),

  resetPassword: Joi.object({
    reset_token: Joi.string().required(),
    new_password: Joi.string().min(8).max(128).required(),
  }),

  // Support
  supportSubmit: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    mobile: Joi.string().pattern(/^[0-9+\-\s]{10,15}$/).required(),
    support_type: Joi.string().valid('order_issue', 'payment_issue', 'delivery_issue', 'return_refund', 'other').required(),
    description: Joi.string().min(10).max(5000).required(),
  }),

  supportReply: Joi.object({
    admin_reply: Joi.string().min(5).max(5000).required(),
  }),

  supportStatus: Joi.object({
    status: Joi.string().valid('open', 'closed').required(),
  }),

  // Products
  createProduct: Joi.object({
    name: Joi.string().min(2).max(200).required(),
    description: Joi.string().allow('', null).max(5000),
    price: Joi.number().positive().precision(2).required(),
    rating: Joi.number().min(0).max(5).precision(1).default(0),
    discount: Joi.number().min(0).max(100).precision(2).default(0),
    specification: Joi.string().allow('', null).max(5000),
    highlights: Joi.string().allow('', null).max(5000),
    delivery: Joi.string().allow('', null).max(5000),
    sizes: Joi.array().items(Joi.string()).allow(null),
    image_url: Joi.string().uri().allow('', null),
    images: Joi.array().items(Joi.string().uri()).default([]),
    stock: Joi.number().integer().min(0).default(0),
    category: Joi.string().required(),
    category_id: Joi.number().integer().allow(null),
    featured: Joi.boolean().default(false),
  }),

  updateProduct: Joi.object({
    name: Joi.string().min(2).max(200),
    description: Joi.string().allow('', null).max(5000),
    price: Joi.number().positive().precision(2),
    rating: Joi.number().min(0).max(5).precision(1),
    discount: Joi.number().min(0).max(100).precision(2),
    specification: Joi.string().allow('', null).max(5000),
    highlights: Joi.string().allow('', null).max(5000),
    delivery: Joi.string().allow('', null).max(5000),
    sizes: Joi.array().items(Joi.string()).allow(null),
    image_url: Joi.string().uri().allow('', null),
    images: Joi.array().items(Joi.string().uri()),
    stock: Joi.number().integer().min(0),
    category: Joi.string(),
    category_id: Joi.number().integer().allow(null),
    featured: Joi.boolean(),
  }).min(1),

  // Categories
  createCategory: Joi.object({
    name: Joi.string().min(2).max(50).required(),
    slug: Joi.string().pattern(/^[a-z0-9-]+$/).min(2).max(50).required(),
    icon: Joi.string().allow('', null).max(100),
    display_order: Joi.number().integer().min(0).default(0),
    image_url: Joi.string().uri().allow('', null),
  }),

  updateCategory: Joi.object({
    name: Joi.string().min(2).max(50),
    slug: Joi.string().pattern(/^[a-z0-9-]+$/).min(2).max(50),
    icon: Joi.string().allow('', null).max(100),
    display_order: Joi.number().integer().min(0),
    image_url: Joi.string().uri().allow('', null),
  }).min(1),

  // Orders
  updateOrderStatus: Joi.object({
    status: Joi.string().valid('pending', 'processing', 'shipped', 'delivered', 'cancelled').required(),
    tracking_number: Joi.string().allow('', null).max(100),
  }),

  // Checkout
  checkout: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().pattern(/^[0-9+\-\s]{10,15}$/).required(),
    address: Joi.string().min(10).max(500).required(),
    city: Joi.string().min(2).max(100).required(),
    zip: Joi.string().pattern(/^[0-9]{6}$/).required(),
    state: Joi.string().required(),
    country: Joi.string().length(2).default('IN'),
  }),

  // Users
  updateUserRole: Joi.object({
    role: Joi.string().valid('admin', 'user').required(),
  }),

  // Query params
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().allow('', null).max(100),
    sortBy: Joi.string().max(50),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  filter: Joi.object({
    status: Joi.string().max(50),
    category: Joi.string().max(50),
    payment_method: Joi.string().max(50),
    role: Joi.string().valid('admin', 'user'),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')),
  }),
};

function validate(schemaName) {
  const schema = schemas[schemaName];
  if (!schema) {
    throw new Error(`Validation schema "${schemaName}" not found`);
  }

  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return res.status(400).json({
        error: 'Validation failed',
        details,
      });
    }

    req.validated = value;
    next();
  };
}

function validateQuery(schemaName) {
  const schema = schemas[schemaName];
  if (!schema) {
    throw new Error(`Validation schema "${schemaName}" not found`);
  }

  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return res.status(400).json({
        error: 'Invalid query parameters',
        details,
      });
    }

    req.validatedQuery = value;
    next();
  };
}

module.exports = { validate, validateQuery, schemas };