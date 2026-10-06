# ShopEase — E-Commerce Platform

## Project Overview
**ShopEase** — A full-stack, production-ready e-commerce platform with 4 independently deployable services.

---

## Architecture

```
├── backend/          # Node.js/Express REST API          (Port 5000)
├── frontend/         # Static HTML/CSS/JS storefront      (Port 3000)
├── admin_dashboard/  # React + TypeScript admin panel     (Port 3001)
├── customer_support/ # React + TypeScript customer portal (Port 3002)
├── nginx/            # Reverse proxy configuration        (Port 80)
├── database.sql      # MySQL schema & seed data
├── docker-compose.yml
└── render.yaml       # Render deployment blueprint
```

### Service Architecture
```
                    ┌──────────────────────┐
                    │   Nginx Proxy (:80)  │
                    └──────┬───────────────┘
           ┌───────────────┼───────────────────────┐
           │               │                       │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────────────▼──────────┐
    │Frontend:3000│ │  API :5000  │ │Admin:3001 │ Support:3002│
    │  (Static)   │ │  (Express)  │ │   (React + Vite SPAs)   │
    └─────────────┘ └──────┬──────┘ └─────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │ MySQL :3306 │
                    └─────────────┘
```

---

## Tech Stack

### Backend
- **Runtime:** Node.js 20
- **Framework:** Express.js
- **Database:** MySQL 8.0
- **Auth:** JWT (JSON Web Tokens)
- **Email:** Nodemailer (Gmail SMTP)
- **Security:** Helmet, CORS, Rate Limiting, Compression
- **Dependencies:** bcryptjs, cors, dotenv, mysql2, joi

### Frontend
- **Type:** Vanilla HTML/CSS/JavaScript
- **Styling:** Custom CSS with CSS Variables
- **Fonts:** Google Fonts (Inter)

### Admin Dashboard
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State:** Zustand
- **Data Fetching:** TanStack React Query
- **Routing:** React Router DOM
- **Charts:** Recharts
- **Forms:** React Hook Form + Zod validation
- **UI:** Lucide Icons, Framer Motion

### Customer Support Portal
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Data Fetching:** TanStack React Query
- **Routing:** React Router DOM
- **PDF Export:** jsPDF
- **UI:** Lucide Icons, Framer Motion, Sonner (Toasts)

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `users` | User accounts (id, name, email, password, role, created_at) |
| `products` | Product catalog (id, name, description, price, rating, discount, stock, category, featured, image_url) |
| `categories` | Product categories (id, name, slug, icon, display_order) |
| `cart` | Shopping cart items (id, user_id, product_id, quantity) |
| `orders` | Customer orders (id, user_id, total_amount, status, shipping_address, payment_method) |
| `order_items` | Individual items in an order (id, order_id, product_id, quantity, price) |
| `wishlist` | Saved products (id, user_id, product_id) |
| `product_reviews` | Product ratings & reviews |
| `support_requests` | Customer support tickets |
| `notifications` | User notifications |
| `customer_addresses` | Saved delivery addresses |
| `referral_codes` | Referral system |
| `coupons` | Discount coupons |
| `serviceable_pincodes` | Delivery availability by pincode |

---

## API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Create new user | No |
| POST | `/login` | User login | No |
| GET | `/me` | Get current user | Yes |
| POST | `/forgot-password` | Request password reset OTP | No |
| POST | `/verify-otp` | Verify OTP | No |
| POST | `/resend-otp` | Resend OTP | No |
| POST | `/reset-password` | Reset password with OTP | No |

### Products (`/api/products`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | List products (search, category, pagination) | No |
| GET | `/featured` | Get featured products | No |
| GET | `/categories` | List categories with product counts | No |
| GET | `/:id` | Get single product | No |

### Cart (`/api/cart`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Get user's cart | Yes |
| POST | `/` | Add item to cart | Yes |
| PUT | `/:productId` | Update item quantity | Yes |
| DELETE | `/:productId` | Remove item from cart | Yes |
| DELETE | `/` | Clear entire cart | Yes |

### Orders (`/api/orders`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Get user's orders | Yes |
| GET | `/:id` | Get order details | Yes |
| POST | `/` | Create order from cart | Yes |

### Wishlist (`/api/wishlist`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/` | Get wishlist | Yes |
| POST | `/` | Add to wishlist | Yes |
| DELETE | `/:productId` | Remove from wishlist | Yes |

### Support (`/api/support`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/` | Create support ticket | Yes |
| GET | `/my` | Get my tickets | Yes |
| GET | `/my/:id` | Get single ticket | Yes |
| GET | `/my/stats` | Get my ticket stats | Yes |

### Reviews (`/api/reviews`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/products/:id/reviews` | Get product reviews | No |
| POST | `/products/:id/reviews` | Submit a review | Yes |
| GET | `/my` | Get my reviews | Yes |
| PUT | `/:id` | Update a review | Yes |
| DELETE | `/:id` | Delete a review | Yes |

### Admin (`/api/admin`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/login` | Admin login | No |
| GET | `/me` | Get admin profile | Admin |
| PUT | `/profile` | Update admin profile | Admin |
| GET | `/stats` | Dashboard statistics | Admin |
| GET | `/analytics` | Sales analytics | Admin |
| GET/POST/PUT/DELETE | `/products` | Product CRUD | Admin |
| GET/POST/PUT/DELETE | `/categories` | Category CRUD | Admin |
| GET/PATCH/DELETE | `/orders` | Order management | Admin |
| GET/PATCH/DELETE | `/users` | User management | Admin |

### Utility

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/pincode/:pin` | Indian pincode lookup | No |
| GET | `/api/health` | Health check | No |

---

## Deployment

### Option 1: Docker Compose (Local / VPS)

```bash
# Copy and configure environment
cp .env.docker .env

# Build and start all services
docker-compose up --build

# Access:
# Frontend:          http://localhost:3000
# Backend API:       http://localhost:5000
# Admin Dashboard:   http://localhost:3001
# Customer Support:  http://localhost:3002
# Nginx Proxy:       http://localhost (all services via one port)
```

### Option 2: Render (Individual Deployment)

Each service deploys independently using `render.yaml`:

| Service | Type | Port |
|---------|------|------|
| `shopease-backend` | Web Service (Node) | 5000 |
| `shopease-frontend` | Static Site | — |
| `shopease-admin` | Static Site | — |
| `shopease-customer-support` | Static Site | — |

**Steps:**
1. Push to GitHub
2. Go to Render Dashboard → **New** → **Blueprint**
3. Connect your repo → Render reads `render.yaml`
4. Set environment variables (DB credentials, JWT secret, API URLs)
5. Deploy!

**Important:** Set `VITE_API_URL` on the admin & customer support services to point to your deployed backend URL (e.g., `https://shopease-backend.onrender.com/api`)

---

## Local Development

### Prerequisites
- Node.js 20+
- MySQL 8.0
- npm

### 1. Database Setup
```bash
mysql -u root -p < database.sql
```

### 2. Backend (Port 5000)
```bash
cd backend
npm install
cp .env.example .env  # Configure your credentials
npm run dev
```

### 3. Frontend (Port 3000)
```bash
cd frontend
npx serve -l 3000 .
```

### 4. Admin Dashboard (Port 5173)
```bash
cd admin_dashboard
npm install
npm run dev
```

### 5. Customer Support (Port 5174)
```bash
cd customer_support
npm install
npm run dev
```

---

## Order Status Flow

```
pending → processing → shipped → delivered
                    ↘
                   cancelled
```

---

## Security Features

- Password hashing with bcrypt (10 rounds)
- JWT authentication (7-day expiry)
- CORS configuration for allowed origins
- Admin role-based access control
- Input validation (Joi) on all endpoints
- SQL injection prevention via parameterized queries
- Helmet security headers
- Rate limiting (API: 100/15min, Auth: 10/15min, Support: 5/hr)
- Compression (gzip)
- Non-root Docker containers
- Health checks on all services
