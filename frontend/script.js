// Backend URL: use env-injected value, same-origin /api, local backend, or production fallback
let API = window._API_URL || 'https://backend-server-ka2a.onrender.com/api';
if (window.location.protocol === 'http:' && window.location.port === '5000') {
  API = '/api';
} else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  API = 'http://localhost:5000/api';
}


// Local, network-free image fallback (used when a product image URL fails to load).
function imgFallback(el) {
  const name = (el.alt || 'Product').replace(/[<>&]/g, '');
  el.onerror = null;
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='100%' height='100%' fill='#eee'/><text x='50%' y='50%' font-family='Segoe UI,Arial,sans-serif' font-size='22' fill='#999' text-anchor='middle' dominant-baseline='middle'>" + name + "</text></svg>";
  el.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const state = {
  user: null, token: null,
  products: [], categories: [], cart: [], orders: [], wishlist: [],
  currentView: 'auth', currentCategory: 'all', searchQuery: '',
  currentProductId: null,
  checkoutDelivery: null,
  selectedPin: null,
  selectedPinLocation: null,
  // Saved addresses
  savedAddresses: [],
  selectedAddressId: null,
  // Forgot-password flow
  forgotEmail: null,
  resetToken: null,
  otpResendTimer: null,
  // Server-side delivery availability cache: { pin: { productId: bool } }
  deliveryAvailability: {},
  // PIN-code postal location cache: { pin: location | { notFound: true } }
  pinLocationCache: {},
  carouselIndex: 0, carouselTimer: null, carouselSlides: [],
  // Reviews for the currently open product (serves Edit/Delete on own reviews)
  currentReviews: null,
  editingReviewId: null,
  reviewRating: 0,
  // Share state
  shareProduct: null,
  // Address modal state
  addressModalMode: 'add', // 'add' or 'edit'
  editingAddressId: null,
  // Support dropdown listeners
  supportDropdownListenersAdded: false
};

const $ = (id) => document.getElementById(id);
const navLinks = ['home', 'cart', 'wishlist', 'orders', 'referrals', 'support', 'logout', 'auth'];
const sections = ['auth', 'forgot', 'otp', 'reset', 'home', 'cart', 'wishlist', 'checkout', 'orders', 'product-detail', 'support', 'referrals', 'profile', 'settings'];

const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1400&h=700&fit=crop&q=80',
  'https://images.unsplash.com/photo-1498049794561-77f0a1a1d43e?w=1400&h=700&fit=crop&q=80',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1400&h=700&fit=crop&q=80',
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1400&h=700&fit=crop&q=80'
];

const CATEGORY_ICONS = {
  all: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  clothing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2 12 5 8 2 3.62 3.46A2 2 0 0 0 3 5.13V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5.13a2 2 0 0 0-.62-1.67z"/><path d="M12 5v14"/></svg>',
  accessories: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  vegetables: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 4 13c0-3 2-7 8-11 6 4 8 8 8 11a7 7 0 0 1-7 7z"/><path d="M11 20c0-5 3-9 8-11"/></svg>',
  electronics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>',
  'home-kitchen': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
  sports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20"/></svg>',
  beauty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2-6.3-4.6L5.7 21l2.3-7.2-6-4.4h7.6z"/></svg>'
};

function getCategoryIcon(slug) { return CATEGORY_ICONS[slug] || CATEGORY_ICONS.all; }

function stars(rating) {
  const r = Math.max(0, Math.min(5, Number(rating) || 0));
  let html = '<span class="star-row" aria-label="' + r.toFixed(1) + ' out of 5 stars">';
  for (let i = 1; i <= 5; i++) {
    const fillPct = Math.max(0, Math.min(100, Math.round((r - (i - 1)) * 100)));
    html += '<span class="star" aria-hidden="true">★<span class="star-fill" style="width:' + fillPct + '%">★</span></span>';
  }
  html += '</span>';
  return html;
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Real reviews come from the backend (/api/products/:id/reviews). Mock data
// was removed so the storefront always shows actual customer feedback.
async function fetchProductReviews(productId) {
  try {
    const data = await apiGet(`/products/${productId}/reviews`);
    return {
      reviews: Array.isArray(data.reviews) ? data.reviews : [],
      review_count: Number(data.review_count || 0),
      avg_rating: data.avg_rating == null ? null : Number(data.avg_rating),
      breakdown: Array.isArray(data.breakdown) ? data.breakdown : null
    };
  } catch {
    return { reviews: [], review_count: 0, avg_rating: null, breakdown: null };
  }
}

async function loadProductReviews(productId) {
  const container = $('reviews-tab-content');
  if (!container) return;

  try {
    const data = await fetchProductReviews(productId);
    const { reviews, review_count, avg_rating, breakdown } = data;

    const userReview = state.user ? reviews.find(r => r.is_current_user) : null;
    const isEditing = !!userReview;

    if (review_count === 0) {
      container.innerHTML = `
        <div class="no-reviews" style="text-align: center; padding: 3rem 1rem;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 1rem; color: var(--border);"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h8"/><path d="M8 14h5"/></svg>
          <h3>No reviews yet</h3>
          <p style="color: var(--text-light); margin-top: 0.5rem;">Be the first to review this product!</p>
          ${state.user ? `
            <button class="btn btn-primary" style="margin-top: 1.5rem;" onclick="scrollToWriteReview()">
              Write a Review
            </button>
          ` : `
            <p style="color: var(--text-light); margin-top: 1rem;">Please <a href="#" data-view="auth" style="color: var(--primary);">login</a> to write a review.</p>
          `}
        </div>
      `;
      container.querySelectorAll('[data-view="auth"]').forEach(el => {
        el.addEventListener('click', (e) => { e.preventDefault(); showView('auth'); });
      });
      return;
    }

    let reviewsHtml = `
      <div class="reviews-summary" style="display: flex; gap: 2rem; padding: 1.5rem; background: var(--bg); border-radius: var(--radius-md); margin-bottom: 2rem; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 150px; text-align: center;">
          <div style="font-size: 3rem; font-weight: 700; color: var(--primary);">${avg_rating?.toFixed(1) || '0.0'}</div>
          <div class="rating-stars-large" style="margin: 0.5rem auto;">${stars(avg_rating || 0)}</div>
          <div style="color: var(--text-light); font-size: 0.9rem;">${review_count} review${review_count !== 1 ? 's' : ''}</div>
        </div>
        ${breakdown ? `
        <div style="flex: 2; min-width: 200px;">
          <h4 style="margin-bottom: 1rem;">Rating Breakdown</h4>
          <div class="rating-breakdown">
            ${breakdown.map(b => `
              <div class="breakdown-row" style="display: flex; align-items: center; gap: 0.5rem; margin: 0.4rem 0;">
                <span style="width: 40px; font-size: 0.85rem; color: var(--text-light);">${b.star}★</span>
                <div style="flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden;">
                  <div style="width: ${b.percent}%; height: 100%; background: var(--accent); border-radius: 4px; transition: width 0.3s ease;"></div>
                </div>
                <span style="width: 40px; text-align: right; font-size: 0.85rem; color: var(--text-light);">${b.count}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}
      </div>
      <div class="reviews-list">
        <h3 style="margin-bottom: 1.5rem;">Customer Reviews</h3>
        ${reviews.map(r => `
          <div class="review-card" style="border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1.5rem; margin-bottom: 1rem; background: var(--surface);">
            <div class="review-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
              <div>
                <span class="review-author" style="font-weight: 600;">${escapeHtml(r.name)}</span>
                ${r.is_verified ? '<span class="verified-badge" style="margin-left: 0.5rem; padding: 0.125rem 0.5rem; background: var(--success); color: white; font-size: 0.7rem; border-radius: 4px; font-weight: 600;">Verified Purchase</span>' : ''}
                ${r.is_current_user ? '<span class="your-review-badge" style="margin-left: 0.5rem; padding: 0.125rem 0.5rem; background: var(--primary); color: white; font-size: 0.7rem; border-radius: 4px; font-weight: 600;">Your Review</span>' : ''}
              </div>
              <div class="review-meta" style="display: flex; align-items: center; gap: 1rem;">
                <span class="review-rating" style="color: var(--accent);">${stars(r.rating)}</span>
                <span class="review-date" style="font-size: 0.8rem; color: var(--text-light);">${formatReviewDate(r.created_at)}</span>
              </div>
            </div>
            <div class="review-comment" style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(r.comment)}</div>
          </div>
        `).join('')}
      </div>
      ${state.user ? `
        <div class="write-review-section" style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border);" id="write-review-section">
          <h3>${isEditing ? 'Edit Your Review' : 'Write a Review'}</h3>
          <form id="product-review-form" class="product-review-form" data-product-id="${productId}" ${isEditing ? 'data-edit="true" data-review-id="' + userReview.id + '"' : ''}>
            <div class="form-group">
              <label class="form-label">Your Rating</label>
              <div class="star-picker" id="product-review-star-picker" role="radiogroup" aria-label="Select rating">
                ${[1,2,3,4,5].map(s => `
                  <button type="button" class="star-btn${userReview && userReview.rating >= s ? ' selected' : ''}" data-value="${s}" role="radio" aria-checked="${userReview && userReview.rating >= s ? 'true' : 'false'}" aria-label="${s} star${s > 1 ? 's' : ''}">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </button>
                `).join('')}
              </div>
              <input type="hidden" name="rating" id="product-review-rating" value="${userReview ? userReview.rating : 0}">
            </div>
            <div class="form-group">
              <label class="form-label" for="product-review-comment">Your Feedback</label>
              <textarea name="comment" id="product-review-comment" rows="4" placeholder="Share your experience with this product..." required minlength="3" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: inherit; font-size: 0.9rem; resize: vertical;">${userReview ? escapeHtml(userReview.comment) : ''}</textarea>
            </div>
            <button type="submit" class="btn btn-primary" style="margin-top: 1rem;">${isEditing ? 'Update Review' : 'Submit Review'}</button>
            <p class="form-hint" style="font-size: 0.8rem; color: var(--text-light); margin-top: 0.5rem;">Only customers who have purchased and received this product can leave a review.</p>
          </form>
        </div>
      ` : `
        <div class="login-to-review" style="margin-top: 2rem; padding: 1.5rem; background: var(--bg); border-radius: var(--radius-md); text-align: center;">
          <p>Please <a href="#" data-view="auth" style="color: var(--primary); font-weight: 600;">login</a> to write a review.</p>
        </div>
      `}
    `;

    container.innerHTML = reviewsHtml;

    container.querySelectorAll('[data-view="auth"]').forEach(el => {
      el.addEventListener('click', (e) => { e.preventDefault(); showView('auth'); });
    });

    const starPicker = container.querySelector('#product-review-star-picker');
    const ratingInput = container.querySelector('#product-review-rating');
    if (starPicker && ratingInput) {
      starPicker.querySelectorAll('.star-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const value = parseInt(btn.dataset.value);
          ratingInput.value = value;
          starPicker.querySelectorAll('.star-btn').forEach(b => {
            const bv = parseInt(b.dataset.value);
            b.classList.toggle('selected', bv <= value);
            b.setAttribute('aria-checked', bv <= value ? 'true' : 'false');
          });
        });
      });
    }

    const form = container.querySelector('#product-review-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rating = parseInt(ratingInput.value);
        const comment = form.querySelector('#product-review-comment').value.trim();

        if (!rating) {
          toast('Please select a rating', 'error');
          return;
        }
        if (!comment || comment.length < 3) {
          toast('Please write your feedback (at least 3 characters)', 'error');
          return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
          const res = await apiPost(`/products/${productId}/reviews`, { rating, comment });
          toast(res.message || (isEditing ? 'Review updated successfully!' : 'Review submitted successfully!'), 'success');
          form.reset();
          ratingInput.value = '0';
          starPicker.querySelectorAll('.star-btn').forEach(b => {
            b.classList.remove('selected');
            b.setAttribute('aria-checked', 'false');
          });
          loadProductReviews(productId);
          const productIdx = state.products.findIndex(p => p.id === productId);
          if (productIdx !== -1) {
            const fresh = await apiGet(`/products/${productId}`);
            state.products[productIdx] = { ...state.products[productIdx], ...fresh };
          }
        } catch (err) {
          toast(err.message || 'Failed to submit review', 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });
    }

  } catch (err) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--error);">
        <p>Failed to load reviews. Please try again.</p>
        <button class="btn btn-secondary" style="margin-top: 1rem;" onclick="loadProductReviews(${productId})">Retry</button>
      </div>
    `;
  }
}

function scrollToWriteReview() {
  const section = document.getElementById('write-review-section');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const starPicker = document.querySelector('#product-review-star-picker .star-btn');
    if (starPicker) starPicker.focus();
  }
}

function computeRatingBreakdown(reviews) {
  const buckets = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach(r => {
    const rv = Number(r.rating);
    if (rv >= 1 && rv <= 5) buckets[Math.round(rv)]++;
  });
  const total = reviews.length;
  return [5, 4, 3, 2, 1].map(star => ({
    star,
    count: buckets[star],
    percent: total > 0 ? Math.round((buckets[star] / total) * 100) : 0
  }));
}

function formatReviewDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

// Renders the rating block for a product that already carries review_count /
// review-based rating (from /api/products or /api/wishlist). Products with NO
// reviews show "No ratings yet" - never a fake/random/hardcoded value.
function productRatingHTML(p) {
  let count = Number(p && p.review_count > 0 ? p.review_count : 0);
  if (count <= 0) {
    return '<span class="no-rating">No ratings yet</span>';
  }

  const r = Number(p.rating || 0);
  return `<span class="rating-stars">${stars(r)}</span>` +
         `<span class="rating-value">${r.toFixed(1)} (${count})</span>`;
}

function discounted(p) {
  const price = Number(p.price) || 0;
  const d = Number(p.discount) || 0;
  return Math.max(0, price * (1 - d / 100));
}

// ---------------------------------------------------------------------------
// Indian PIN-code delivery availability (shared by product page & checkout).
//
// A product's delivery config lives on the product itself:
//   delivery_type:       'all-india' | 'selected'
//   selected_pin_codes:  JSON array of 6-digit Indian PIN codes (selected only)
//
// 'all-india' products are available for every valid 6-digit Indian PIN code.
// 'selected' products are available only for the PIN codes listed on them.
//
// This logic is isolated so an official Indian PIN-code data source/API can be
// wired in later (see /api/pincode/:pin for the existing country lookup).
// ---------------------------------------------------------------------------
function isValidPin(pin) {
  return typeof pin === 'string' && /^[0-9]{6}$/.test(pin.trim());
}

function parsePinCodes(raw) {
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter((s) => s.length > 0);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsePinCodes(parsed);
    } catch { /* not JSON — delimiter parse below */ }
    return trimmed.split(/[\s,;]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  }
  return [];
}

function getDeliveryType(product) {
  return (product && product.delivery_type) || 'all-india';
}

// Fetches (and caches) delivery availability for every product for one PIN
// code via the bulk endpoint. All products stay visible; only the flag
// per product changes.
async function loadDeliveryAvailability(pin) {
  if (!isValidPin(pin)) return {};
  const key = String(pin).trim();
  if (state.deliveryAvailability[key]) return state.deliveryAvailability[key];
  try {
    const data = await apiGet(`/products/delivery/bulk?pincode=${encodeURIComponent(key)}`);
    const map = (data && data.availability) || {};
    state.deliveryAvailability[key] = map;
    return map;
  } catch (e) {
    // Only cache real server data, never a failed fetch: caching {} here would
    // wrongly make every product look non-deliverable.
    console.error('Failed to load delivery availability:', e);
    return {};
  }
}

// True when the given product can be delivered to the given PIN code.
// Prefers the server-side availability map; falls back to legacy
// product-level delivery fields when no map has been loaded yet.
function isProductDeliverable(product, pin) {
  if (!isValidPin(pin)) return false;
  const pid = Number(product && product.id !== undefined ? product.id : product.product_id);
  const map = state.deliveryAvailability && state.deliveryAvailability[String(pin).trim()];
  // Authoritative server availability (bulk endpoint) always wins. A product
  // with no entry in a loaded server map is NOT deliverable — the backend
  // treats it exactly the same way via product_serviceable_pincodes. Never
  // guess "deliverable" when the real data says otherwise.
  if (map) {
    return Object.prototype.hasOwnProperty.call(map, pid) ? !!map[pid] : false;
  }
  // No server map loaded yet: fall back to the product's legacy delivery
  // fields so the UI stays functional until the async map arrives.
  if (!product) return false;
  if (getDeliveryType(product) === 'selected') {
    return parsePinCodes(product.selected_pin_codes).includes(String(pin).trim());
  }
  return true;
}

// Authoritative server-side delivery check for a set of items against one PIN
// code. Uses POST /api/delivery/check so Cart & Checkout gating never depends
// on the product-card text/colors — the server's product_serviceable_pincodes
// data is the single source of truth.
async function checkDeliveryForItems(pin, items) {
  if (!isValidPin(pin)) return { pin, results: [], allAvailable: false };
  const list = Array.isArray(items) ? items : state.cart;
  const ids = [...new Set(list.map(i => Number(i.product_id) || Number(i.id)))]
    .filter(n => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return { pin, results: [], allAvailable: true };
  try {
    const data = await apiPost('/delivery/check', { pin, product_ids: ids });
    const byId = new Map(((data && data.results) || []).map(r => [Number(r.product_id), r]));
    const results = list.map(item => {
      const pid = Number(item.product_id) || Number(item.id);
      const serverItem = byId.get(pid);
      return {
        product_id: pid,
        name: (serverItem && serverItem.name) || item.name,
        quantity: Number(item.quantity) || 1,
        available: serverItem ? !!serverItem.available : isProductDeliverable(item, pin),
      };
    });
    return { pin, results, allAvailable: results.every(r => r.available) };
  } catch (e) {
    console.error('Failed to check delivery for cart items:', e);
    const results = list.map(item => ({
      product_id: Number(item.product_id) || Number(item.id),
      name: item.name,
      quantity: Number(item.quantity) || 1,
      available: isProductDeliverable(item, pin),
    }));
    return { pin, results, allAvailable: results.every(r => r.available) };
  }
}

function pinCheckMessage(product, pin) {
  if (!isValidPin(pin)) return 'Please enter a valid 6-digit Indian PIN code.';
  if (isProductDeliverable(product, pin)) return `✓ Delivery available to ${pin}`;
  return `✕ Not deliverable to ${pin}`;
}

// Looks up a 6-digit Indian PIN code's postal location (locality/area,
// district, state) through the backend. Returns the location object on
// success, { notFound: true } when the PIN is not in the India Post data,
// or { error: true } when the lookup itself fails.
async function lookupPinLocation(pin) {
  const key = String(pin).trim();
  if (!isValidPin(key)) return { error: true, message: 'Invalid PIN code' };
  if (state.pinLocationCache[key]) return state.pinLocationCache[key];
  try {
    const res = await fetch(`${API}/pincode/${key}`);
    if (res.status === 404) {
      state.pinLocationCache[key] = { notFound: true };
      return { notFound: true };
    }
    const data = await res.json();
    if (!res.ok) {
      state.pinLocationCache[key] = { error: true, message: data.error || 'Lookup failed' };
      return state.pinLocationCache[key];
    }
    state.pinLocationCache[key] = data;
    return data;
  } catch (e) {
    return { error: true, message: 'Network error' };
  }
}

// ---------------------------------------------------------------------------
// Selected PIN filter (home page) — persists while the customer browses,
// filters the product list, and is reused by the cart & checkout flow.
// ---------------------------------------------------------------------------
function setSelectedPin(pin, location) {
  state.selectedPin = (pin && isValidPin(String(pin).trim())) ? String(pin).trim() : null;
  state.selectedPinLocation = location || null;
  if (state.selectedPin) {
    localStorage.setItem('selectedPin', state.selectedPin);
    if (location) localStorage.setItem('selectedPinLocation', JSON.stringify(location));
    else localStorage.removeItem('selectedPinLocation');
  } else {
    localStorage.removeItem('selectedPin');
    localStorage.removeItem('selectedPinLocation');
  }
  renderPinFilterUI();
}

function renderPinFilterUI() {
  const entry = $('pin-filter-entry');
  const applied = $('pin-applied');
  const result = $('home-pin-result');
  if (entry) entry.style.display = state.selectedPin ? 'none' : '';
  if (applied) applied.style.display = state.selectedPin ? 'flex' : 'none';
  if (applied && state.selectedPin) {
    const val = $('pin-applied-value');
    if (val) val.textContent = state.selectedPin;
    const loc = $('pin-applied-location');
    const det = $('pin-applied-detail');
    const L = state.selectedPinLocation;
    if (loc) {
      loc.textContent = L && !L.notFound && !L.error
        ? [L.city || L.district, L.state, L.country || 'India'].filter(Boolean).join(', ')
        : '';
    }
    if (det) {
      const bits = [];
      if (L && L.postOffice) bits.push(L.postOffice);
      if (L && L.district) bits.push(`District: ${L.district}`);
      if (L && L.state) bits.push(`State: ${L.state}`);
      det.textContent = bits.join(' • ');
      det.style.display = bits.length ? '' : 'none';
    }
  }
  if (result) { result.className = 'pincode-result'; result.dataset.valid = 'unknown'; result.textContent = ''; }
}

async function applyPinFilter() {
  const input = $('home-pin-code');
  const result = $('home-pin-result');
  const pin = (input.value || '').trim();
  if (!isValidPin(pin)) {
    result.className = 'pincode-result error';
    result.dataset.valid = 'invalid';
    result.textContent = 'Please enter a valid 6-digit Indian PIN code.';
    return;
  }
  const location = await lookupPinLocation(pin);
  if (location && location.notFound) {
    result.className = 'pincode-result error';
    result.dataset.valid = 'invalid';
    result.textContent = 'PIN code not found. Please enter a valid Indian PIN code.';
    return;
  }
  if (!location || location.error) {
    result.className = 'pincode-result error';
    result.dataset.valid = 'invalid';
    result.textContent = 'Could not check this PIN code right now. Please try again.';
    return;
  }
  setSelectedPin(pin, location);
  result.className = 'pincode-result success';
  result.dataset.valid = 'valid';
  result.textContent = `✓ Delivery availability checked for PIN code ${state.selectedPin}`;
  await loadDeliveryAvailability(state.selectedPin);
  renderDeliveryStatuses();
  refreshCartDeliveryNotice();
}

function clearPinFilter() {
  const input = $('home-pin-code');
  if (input) input.value = '';
  setSelectedPin(null);
  renderDeliveryStatuses();
  refreshCartDeliveryNotice();
}

// Renders the Delivery available / Not deliverable status on EVERY product
// card for the currently selected PIN code. No product is hidden; only its
// status changes. Results come from the server's per-PIN availability map.
function renderDeliveryStatuses() {
  const elements = document.querySelectorAll('.product-delivery');
  if (!state.selectedPin) {
    elements.forEach(el => {
      el.className = 'product-delivery';
      el.textContent = '';
    });
    return;
  }
  const pin = state.selectedPin;
  const map = state.deliveryAvailability && state.deliveryAvailability[pin];
  if (!map) return;
  state.products.forEach(p => {
    const el = document.querySelector(`.product-delivery[data-id="${p.id}"]`);
    if (!el) return;
    const pid = Number(p.id);
    const ok = Object.prototype.hasOwnProperty.call(map, pid)
      ? !!map[pid]
      : isProductDeliverable(p, pin);
    if (ok) {
      el.className = 'product-delivery available';
      el.textContent = `✓ Delivery available to ${pin}`;
    } else {
      el.className = 'product-delivery unavailable';
      el.textContent = `✕ Not deliverable to ${pin}`;
    }
  });
}
// ---------------------------------------------------------------------------
// Refer & Earn Functions
// ---------------------------------------------------------------------------

let referralPage = 1;
let referralLimit = 20;
let referralTotalPages = 1;

async function loadReferrals() {
  if (!state.user) return;
  
  try {
    // Load referral code and link
    const codeData = await apiGet('/referrals/my-code');
    if (codeData.referral_code) {
      $('referral-code-value').textContent = codeData.referral_code;
      $('referral-link-input').value = codeData.referral_link;
    }
    
    // Load stats
    await loadReferralStats();
    
    // Load history (first page)
    referralPage = 1;
    await loadReferralHistory();
    
    // Bind referral events
    bindReferralEvents();
  } catch (err) {
    console.error('Failed to load referrals:', err);
    toast('Failed to load referral data', 'error');
  }
}

async function loadReferralStats() {
  try {
    const stats = await apiGet('/referrals/stats');
    $('stat-total-referrals').textContent = stats.total_referrals || 0;
    $('stat-successful-referrals').textContent = stats.successful_referrals || 0;
    $('stat-pending-referrals').textContent = stats.pending_referrals || 0;
    $('stat-rewards-earned').textContent = `₹${Number(stats.total_rewards_earned || 0).toFixed(2)}`;
  } catch (err) {
    console.error('Failed to load referral stats:', err);
  }
}

async function loadReferralHistory(page = 1) {
  const tbody = $('referral-history-body');
  const empty = $('referral-history-empty');
  const loading = $('referral-history-loading');
  const table = $('referral-history-table');
  const pagination = $('referral-pagination');
  
  loading.style.display = 'block';
  table.style.display = 'none';
  empty.style.display = 'none';
  pagination.style.display = 'none';
  
  try {
    const data = await apiGet(`/referrals/history?page=${page}&limit=${referralLimit}`);
    
    if (data.data && data.data.length > 0) {
      tbody.innerHTML = data.data.map(ref => {
        const statusClass = ref.status === 'successful' ? 'status-success' : 
                           ref.status === 'pending' ? 'status-pending' : 'status-cancelled';
        const statusLabel = ref.status === 'successful' ? 'Successful' : 
                           ref.status === 'pending' ? 'Pending' : 'Cancelled';
        const reward = ref.reward_amount ? `₹${Number(ref.reward_amount).toFixed(2)}` : '—';
        const date = ref.created_at ? new Date(ref.created_at).toLocaleDateString('en-IN', {
          day: 'numeric', month: 'short', year: 'numeric'
        }) : '—';
        
        return `
          <tr>
            <td>${escapeHtml(ref.referred_name || 'Unknown')} (${escapeHtml(ref.referred_email || '')})</td>
            <td><span class="referral-status ${statusClass}">${statusLabel}</span></td>
            <td>${reward}</td>
            <td>${date}</td>
          </tr>
        `;
      }).join('');
      
      table.style.display = 'table';
      
      // Update pagination
      referralPage = data.pagination.page;
      referralTotalPages = data.pagination.totalPages;
      updateReferralPagination();
      pagination.style.display = 'flex';
    } else {
      table.style.display = 'none';
      empty.style.display = 'block';
    }
  } catch (err) {
    console.error('Failed to load referral history:', err);
    table.style.display = 'none';
    empty.style.display = 'block';
    empty.querySelector('h3').textContent = 'Failed to load history';
    empty.querySelector('p').textContent = 'Please try again later.';
  } finally {
    loading.style.display = 'none';
  }
}

function updateReferralPagination() {
  const info = $('referral-pagination-info');
  const prevBtn = $('referral-prev-page');
  const nextBtn = $('referral-next-page');
  
  if (info) info.textContent = `Page ${referralPage} of ${referralTotalPages || 1}`;
  if (prevBtn) prevBtn.disabled = referralPage <= 1;
  if (nextBtn) nextBtn.disabled = referralPage >= referralTotalPages;
}

function bindReferralEvents() {
  // Copy Code button
  const copyCodeBtn = $('copy-code-btn');
  if (copyCodeBtn) {
    const newCopyCodeBtn = copyCodeBtn.cloneNode(true);
    copyCodeBtn.parentNode.replaceChild(newCopyCodeBtn, copyCodeBtn);
    newCopyCodeBtn.addEventListener('click', copyReferralCode);
  }
  
  // Copy Link button
  const copyLinkBtn = $('copy-link-btn');
  if (copyLinkBtn) {
    const newCopyLinkBtn = copyLinkBtn.cloneNode(true);
    copyLinkBtn.parentNode.replaceChild(newCopyLinkBtn, copyLinkBtn);
    newCopyLinkBtn.addEventListener('click', copyReferralLink);
  }
  
  // Share button
  const shareBtn = $('share-btn');
  if (shareBtn) {
    const newShareBtn = shareBtn.cloneNode(true);
    shareBtn.parentNode.replaceChild(newShareBtn, shareBtn);
    newShareBtn.addEventListener('click', shareReferralLink);
  }
  
  // Pagination
  const prevBtn = $('referral-prev-page');
  const nextBtn = $('referral-next-page');
  
  if (prevBtn) {
    const newPrevBtn = prevBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
    newPrevBtn.addEventListener('click', () => {
      if (referralPage > 1) loadReferralHistory(referralPage - 1);
    });
  }
  
  if (nextBtn) {
    const newNextBtn = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
    newNextBtn.addEventListener('click', () => {
      if (referralPage < referralTotalPages) loadReferralHistory(referralPage + 1);
    });
  }
}

async function copyReferralCode() {
  const code = $('referral-code-value').textContent;
  if (!code || code === '--') {
    toast('No referral code available', 'error');
    return;
  }
  
  try {
    await navigator.clipboard.writeText(code);
    toast('Referral code copied!', 'success');
  } catch (err) {
    fallbackCopyText(code);
    toast('Referral code copied!', 'success');
  }
}

async function copyReferralLink() {
  const link = $('referral-link-input').value;
  if (!link || link === 'Loading...') {
    toast('No referral link available', 'error');
    return;
  }
  
  try {
    await navigator.clipboard.writeText(link);
    toast('Referral link copied!', 'success');
  } catch (err) {
    fallbackCopyText(link);
    toast('Referral link copied!', 'success');
  }
}

function fallbackCopyText(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } catch (e) {
    console.error('Fallback copy failed:', e);
  }
  document.body.removeChild(textarea);
}

async function shareReferralLink() {
  const link = $('referral-link-input').value;
  const code = $('referral-code-value').textContent;
  
  if (!link || link === 'Loading...') {
    toast('No referral link available', 'error');
    return;
  }
  
  const shareData = {
    title: 'ShopEase - Refer & Earn',
    text: `Join me on ShopEase! Use my referral code ${code} and get rewards on your first order.`,
    url: link
  };
  
  try {
    if (navigator.share && navigator.canShare(shareData)) {
      await navigator.share(shareData);
      return;
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.log('Web Share API not available or cancelled:', err);
    }
  }
  
  // Fallback: Open share modal with options
  openReferralShareModal(link, code);
}

function openReferralShareModal(link, code) {
  // Remove existing modal if any
  const existing = document.querySelector('.referral-share-modal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.className = 'referral-share-modal';
  modal.innerHTML = `
    <div class="referral-share-backdrop"></div>
    <div class="referral-share-content">
      <button class="referral-share-close" aria-label="Close">&times;</button>
      <h3>Share Your Referral Link</h3>
      <p class="referral-share-code">Your code: <strong>${code}</strong></p>
      <div class="referral-share-options">
        <a href="https://wa.me/?text=${encodeURIComponent(`Join me on ShopEase! Use my referral code ${code} and get rewards on your first order: ${link}`)}" target="_blank" class="share-option whatsapp" aria-label="Share on WhatsApp">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.52 3.48A12.06 12.06 0 0 0 12 0C5.37 0 0 5.37 0 12c0 1.99.5 3.89 1.38 5.54L0 24l6.3-1.65a12.06 12.06 0 0 0 5.54 1.38c6.63 0 12-5.37 12-12 0-2.35-.65-4.51-1.77-6.4L20.52 3.48zM8 17c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm6.17-7.83c-.27-.14-.71-.22-1.12-.08-.4.14-1.1.48-1.4.89-.3.41-.39.65-.4.84-.02.19-.08.3-.21.38-.13.08-.42.13-.66.02-.24-.11-1.02-.46-1.18-.54-.15-.08-.32-.08-.48-.08-.16 0-.32.01-.48.08-.5.18-1.26.64-1.42.83-.16.19-.2.28-.25.44-.05.16-.02.26.04.34.18.24.64.68 1.1 1.1.4.35.68.52.9.52.24 0 .43-.08.57-.24.08-.09.17-.19.22-.32.05-.13.03-.23-.02-.34-.15-.28-.64-.74-.89-1.04-.12-.15-.26-.29-.4-.44-.15-.15-.23-.29-.24-.44 0-.16.05-.32.18-.47.13-.15.43-.42.55-.6.11-.17.16-.3.26-.44.1-.14.2-.27.34-.39.14-.12.28-.24.43-.35.15-.11.29-.21.44-.32.16-.11.3-.22.44-.34.14-.12.27-.23.4-.34.13-.11.26-.21.39-.31.13-.1.25-.19.37-.28.12-.09.23-.18.33-.27.1-.09.2-.17.29-.25.09-.08.17-.16.24-.24.07-.08.13-.16.18-.24.05-.08.08-.17.09-.26.01-.09-.02-.18-.05-.26-.03-.08-.08-.16-.13-.23-.05-.07-.1-.13-.15-.19-.05-.06-.1-.11-.16-.16-.06-.05-.12-.09-.18-.13-.06-.04-.11-.07-.17-.1-.06-.03-.11-.05-.16-.07-.05-.02-.1-.03-.15-.04-.05-.01-.09-.02-.14-.02-.04 0-.08.01-.12.02-.04.01-.07.03-.1.05-.03.02-.05.05-.07.08-.02.03-.03.06-.04.1-.01.04-.01.08.01.12.02.04.04.08.07.11.03.03.06.05.1.07.04.02.08.03.12.04.04.01.08.01.12.01.04 0 .08-.01.12-.02.04-.01.07-.03.1-.05.03-.02.05-.05.07-.08.02-.03.03-.06.04-.1.01-.04.01-.08-.01-.12-.02-.04-.04-.08-.07-.11-.03-.03-.06-.05-.1-.07-.04-.02-.08-.03-.12-.04-.04-.01-.08-.01-.12-.01-.04 0-.08.01-.12.02-.04.01-.07.03-.1.05-.03.02-.05.05-.07.08-.02.03-.03.06-.04.1-.01.04-.01.08.01.12.02.04.04.08.07.11.03.03.06.05.1.07.04.02.08.03.12.04.04.01.08.01.12.01.04 0 .08-.01.12-.02.04-.01.07-.03.1-.05.03-.02.05-.05.07-.08.02-.03.03-.06.04-.1.01-.04.01-.08-.01-.12-.02-.04-.04-.08-.07-.11-.03-.03-.06-.05-.1-.07-.04-.02-.08-.03-.12-.04z"/></svg>
          <span>WhatsApp</span>
        </a>
        <a href="https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`Join me on ShopEase! Use my referral code ${code}`)}" target="_blank" class="share-option telegram" aria-label="Share on Telegram">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.906 15.854l6.368-2.547a.947.947 0 0 0 .465-1.287l-4.267-8.153a.947.947 0 0 0-1.415.292l-3.852 5.588-2.464-1.978a.947.947 0 0 0-1.226.607l-1.154 4.53a.947.947 0 0 0 .68 1.195l4.354 1.132 2.143 2.143c.347.347.907.347 1.254 0l2.01-2.01zm-2.104-4.537l-1.867-1.867-1.573 2.292-.001-.001-1.643-1.203 2.351-1.335.482-.057.56.56.517 1.856.482-1.358 1.597-1.597-.482-.482-.517-.517z"/></svg>
          <span>Telegram</span>
        </a>
        <a href="mailto:?subject=${encodeURIComponent('Join me on ShopEase')}&body=${encodeURIComponent(`Join me on ShopEase! Use my referral code ${code} and get rewards on your first order: ${link}`)}" class="share-option email" aria-label="Share via Email">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <span>Email</span>
        </a>
        <button class="share-option copy" aria-label="Copy Link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <span>Copy Link</span>
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Bind close events
  modal.querySelector('.referral-share-close').addEventListener('click', () => modal.remove());
  modal.querySelector('.referral-share-backdrop').addEventListener('click', () => modal.remove());
  
  // Bind copy button in modal
  modal.querySelector('.share-option.copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast('Referral link copied!', 'success');
      modal.remove();
    } catch (err) {
      fallbackCopyText(link);
      toast('Referral link copied!', 'success');
      modal.remove();
    }
  });
  
  // Animate in
  requestAnimationFrame(() => modal.classList.add('open'));
}

// Handle referral code from URL during registration
function handleReferralFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');
  
  if (refCode && refCode.trim()) {
    // Store referral code for registration
    sessionStorage.setItem('referral_code', refCode.toUpperCase());
    
    // If on auth page, pre-fill the referral code
    const registerForm = $('register-form');
    if (registerForm && !registerForm.querySelector('[name="referral_code"]')) {
      // Add hidden input for referral code
      const hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      hiddenInput.name = 'referral_code';
      hiddenInput.value = refCode.toUpperCase();
      registerForm.appendChild(hiddenInput);
      
      // Navigate to auth view and register tab
      if (typeof handleNav === 'function') handleNav('auth');
      if (typeof switchAuthTab === 'function') switchAuthTab('register');
      
      // Show notification
      const referrerName = urlParams.get('referrer_name') || 'someone';
      toast(`You were referred by ${referrerName}! The referral code has been applied.`, 'success');
      
      // Clean up URL so it doesn't stay in the address bar
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }
}

// Modify handleRegister to include referral_code from sessionStorage
const originalHandleRegister = handleRegister;
handleRegister = async function(e) {
  e.preventDefault(); hideErrors();
  const name = $('register-name').value.trim(), email = $('register-email').value.trim();
  const password = $('register-password').value, confirm = $('register-confirm').value;
  if (!name || !email || !password) return showError('register-error', 'All fields required');
  if (password.length < 8) return showError('register-error', 'Password must be at least 8 characters');
  if (password !== confirm) return showError('register-error', 'Passwords do not match');
  
  // Get referral code from sessionStorage if available
  const referralCode = sessionStorage.getItem('referral_code');
  const requestData = { name, email, password };
  if (referralCode) {
    requestData.referral_code = referralCode;
  }
  
  try {
    const r = await apiPost('/auth/register', requestData);
    if (r.error) return showError('register-error', r.error);
    if (r.message) toast(r.message, 'success');
    
    // Clear referral code after successful registration
    sessionStorage.removeItem('referral_code');
    
    $('register-form').reset();
    const fill = document.querySelector('.strength-fill'), text = document.querySelector('.strength-text');
    if (fill) fill.style.width = '0%';
    if (text) text.textContent = 'Password strength';
    toast('Account created. Please sign in with your new credentials.', 'success');
    $('login-email').value = email;
    switchAuthTab('login');
    $('login-password').value = '';
    $('login-password').focus();
  } catch (err) { showError('register-error', (err instanceof Error && err.message) ? err.message : 'Registration failed'); }
};

// Call handleReferralFromUrl on page load
document.addEventListener('DOMContentLoaded', handleReferralFromUrl);

function init() {
  const t = localStorage.getItem('token'), u = localStorage.getItem('user');
  if (t && u) { state.token = t; state.user = JSON.parse(u); updateAuthUI(); loadCart(); loadWishlist(); loadOrders(); loadSavedAddresses(); }
  const savedPin = localStorage.getItem('selectedPin');
  if (savedPin && isValidPin(savedPin)) {
    state.selectedPin = savedPin;
    const savedLoc = localStorage.getItem('selectedPinLocation');
    if (savedLoc) { try { state.selectedPinLocation = JSON.parse(savedLoc); } catch { /* ignore corrupt data */ } }
  }
  renderPinFilterUI();
  showView(state.user ? 'home' : 'auth');
  bindEvents();
  loadCategories();
  loadFeatured();
  loadProducts();
}

function bindEvents() {
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); handleNav(el.dataset.view); });
  });
  document.querySelector('.logo').addEventListener('click', (e) => { e.preventDefault(); handleNav('home'); });

  const mb = document.querySelector('.mobile-menu-btn');
  const ov = document.querySelector('.mobile-nav-overlay');
  mb.addEventListener('click', () => { ov.classList.toggle('open'); mb.setAttribute('aria-expanded', ov.classList.contains('open')); });
  ov.addEventListener('click', (e) => { if (e.target === ov) { ov.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); } });
  document.querySelector('.mobile-nav-close').addEventListener('click', () => { ov.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); });
  document.querySelectorAll('.mobile-nav-link').forEach(l => l.addEventListener('click', (e) => { e.preventDefault(); handleNav(l.dataset.view); ov.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); }));

  document.querySelectorAll('.auth-tab').forEach(t => t.addEventListener('click', () => switchAuthTab(t.dataset.tab)));
  $('login-form').addEventListener('submit', handleLogin);
  $('register-form').addEventListener('submit', handleRegister);

  $('register-password').addEventListener('input', (e) => checkStrength(e.target.value));
  $('register-confirm').addEventListener('input', checkConfirm);

  // Forgot Password flow
  const forgotLink = $('forgot-password-link');
  if (forgotLink) forgotLink.addEventListener('click', openForgotPassword);
  const forgotForm = $('forgot-form');
  if (forgotForm) forgotForm.addEventListener('submit', handleForgotSubmit);
  const forgotBack = $('forgot-back-link');
  if (forgotBack) forgotBack.addEventListener('click', goBackToLogin);
  const otpForm = $('otp-form');
  if (otpForm) otpForm.addEventListener('submit', handleOtpSubmit);
  const otpResend = $('otp-resend-btn');
  if (otpResend) otpResend.addEventListener('click', handleOtpResend);
  const otpBack = $('otp-back-link');
  if (otpBack) otpBack.addEventListener('click', goBackToLogin);
  const resetForm = $('reset-form');
  if (resetForm) resetForm.addEventListener('submit', handleResetSubmit);
  const resetBack = $('reset-back-link');
  if (resetBack) resetBack.addEventListener('click', goBackToLogin);
  const resetPw = $('reset-password');
  if (resetPw) resetPw.addEventListener('input', (e) => resetStrength(e.target.value));
  const resetConfirm = $('reset-confirm');
  if (resetConfirm) resetConfirm.addEventListener('input', () => {
    const pw = $('reset-password').value, cf = $('reset-confirm').value, el = $('reset-confirm-error');
    if (el && cf && pw !== cf) { el.textContent = 'Passwords do not match'; el.style.display = 'block'; }
    else if (el) { el.textContent = ''; el.style.display = 'none'; }
  });

  $('search-input').addEventListener('input', debounce(onSearch, 300));
  $('search-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { hideSuggestions(); $('search-input').blur(); } });
  $('search-input').addEventListener('focus', () => { if (state.searchQuery.length >= 2) showSuggestions(0); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search-wrapper')) hideSuggestions(); });

  $('checkout-btn').addEventListener('click', async () => {
    if (state.selectedPin) {
      const check = await checkDeliveryForItems(state.selectedPin, state.cart);
      if (!check.allAvailable) {
        toast('Some products in your cart cannot be delivered to this PIN code. Please remove them or change your PIN code.', 'error');
        refreshCartDeliveryNotice();
        return;
      }
    }
    showView('checkout');
  });
  $('checkout-form').addEventListener('submit', handleCheckout);
  $('support-form').addEventListener('submit', handleSupportSubmit);
  $('support-type').addEventListener('change', onSupportTypeChange);

  // Pincode auto-fill: lookup city/state when user enters 6-digit pincode
  $('shipping-zip').addEventListener('input', debounce(async (e) => {
    const pin = e.target.value.trim();
    if (pin.length === 6 && /^[0-9]{6}$/.test(pin)) {
      try {
        const data = await apiGet(`/pincode/${pin}`);
        if (data.city) $('shipping-city').value = data.city;
        if (data.state) {
          const stateSelect = $('shipping-state');
          for (let i = 0; i < stateSelect.options.length; i++) {
            if (stateSelect.options[i].value === data.state || stateSelect.options[i].text === data.state) {
              stateSelect.selectedIndex = i;
              break;
            }
          }
        }
        toast('Location auto-filled from PIN code', 'success');
      } catch {
        // Pincode not found, leave fields for manual entry
      }
    }
  }, 500));

  // Keep the checkout delivery-check PIN in sync with the shipping address PIN
  // and re-run the authoritative delivery check whenever it changes so the
  // "Place Order" button stays correctly enabled/disabled.
  $('shipping-zip').addEventListener('input', (e) => {
    const target = $('checkout-pin-code');
    if (target && target.value !== e.target.value) target.value = e.target.value;
    checkoutPinInputChanged(e.target.value);
  });
  const checkoutPinInput = $('checkout-pin-code');
  if (checkoutPinInput) {
    checkoutPinInput.addEventListener('input', (e) => {
      const zip = $('shipping-zip');
      if (zip && zip.value !== e.target.value) zip.value = e.target.value;
      checkoutPinInputChanged(e.target.value);
    });
    checkoutPinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runCheckoutPinCheck(); } });
  }
  const checkoutPinBtn = $('checkout-pin-check');
  if (checkoutPinBtn) checkoutPinBtn.addEventListener('click', runCheckoutPinCheck);

  // Home PIN code delivery filter
  const homePinCheck = $('home-pin-check');
  if (homePinCheck) homePinCheck.addEventListener('click', applyPinFilter);
  const homePinInput = $('home-pin-code');
  if (homePinInput) {
    homePinInput.addEventListener('input', () => {
      const result = $('home-pin-result');
      if (result && result.dataset.valid !== 'unknown') {
        result.className = 'pincode-result';
        result.dataset.valid = 'unknown';
        result.textContent = '';
      }
    });
    homePinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyPinFilter(); } });
  }
  const pinChangeBtn = $('pin-change-btn');
  if (pinChangeBtn) pinChangeBtn.addEventListener('click', clearPinFilter);

  document.querySelectorAll('.modal-close, .modal-backdrop').forEach(b => b.addEventListener('click', closeModals));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

  // Address modal events
  const addAddressBtn = $('add-new-address-btn');
  if (addAddressBtn) addAddressBtn.addEventListener('click', () => openAddressModal('add'));
  const addressForm = $('address-form');
  if (addressForm) addressForm.addEventListener('submit', saveAddressHandler);
  const addressCancel = $('address-cancel');
  if (addressCancel) addressCancel.addEventListener('click', closeAddressModal);
  const addressModalClose = $('address-modal .modal-close');
  if (addressModalClose) addressModalClose.addEventListener('click', closeAddressModal);
  const addressModalBackdrop = $('address-modal .modal-backdrop');
  if (addressModalBackdrop) addressModalBackdrop.addEventListener('click', closeAddressModal);

  // Pincode auto-fill for address modal
  const addressPincode = $('address-pincode');
  if (addressPincode) {
    addressPincode.addEventListener('input', debounce(async (e) => {
      const pin = e.target.value.trim();
      if (pin.length === 6 && /^[0-9]{6}$/.test(pin)) {
        try {
          const data = await apiGet(`/pincode/${pin}`);
          if (data.city) $('address-city').value = data.city;
          if (data.state) {
            const stateSelect = $('address-state');
            for (let i = 0; i < stateSelect.options.length; i++) {
              if (stateSelect.options[i].value === data.state || stateSelect.options[i].text === data.state) {
                stateSelect.selectedIndex = i;
                break;
              }
            }
          }
          toast('Location auto-filled from PIN code', 'success');
        } catch {
          // Pincode not found, leave fields for manual entry
        }
      }
    }, 500));
  }

  $('carousel-prev').addEventListener('click', () => goSlide(state.carouselIndex - 1));
  $('carousel-next').addEventListener('click', () => goSlide(state.carouselIndex + 1));
  const hero = $('hero-carousel');
  hero.addEventListener('mouseenter', stopCarousel);
  hero.addEventListener('mouseleave', startCarousel);
  document.addEventListener('keydown', (e) => {
    if ($('home-section').style.display !== 'none') {
      if (e.key === 'ArrowLeft') goSlide(state.carouselIndex - 1);
      if (e.key === 'ArrowRight') goSlide(state.carouselIndex + 1);
    }
  });

  // Profile dropdown events
  bindProfileDropdownEvents();

  bindRateReviewEvents();
}

function bindProfileDropdownEvents() {
  // Desktop profile dropdown
  const profileTrigger = $('profile-trigger');
  const profileDropdown = $('profile-dropdown');
  const profileWrapper = $('profile-wrapper');

  // Mobile profile dropdown
  const mobileProfileTrigger = $('mobile-profile-trigger');
  const mobileProfileDropdown = $('mobile-profile-dropdown');
  const mobileProfileWrapper = $('mobile-profile-wrapper');

  function toggleProfileDropdown(trigger, dropdown, wrapper) {
    if (!trigger || !dropdown || !wrapper) return;
    const isOpen = dropdown.style.display !== 'none';
    if (isOpen) {
      dropdown.style.display = 'none';
      trigger.setAttribute('aria-expanded', 'false');
    } else {
      dropdown.style.display = 'block';
      trigger.setAttribute('aria-expanded', 'true');
      positionDropdown(trigger, dropdown);
    }
  }

  function closeProfileDropdown(trigger, dropdown) {
    if (dropdown) dropdown.style.display = 'none';
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function positionDropdown(trigger, dropdown) {
    if (!trigger || !dropdown) return;
    const rect = trigger.getBoundingClientRect();
    const dropdownRect = dropdown.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Reset styles
    dropdown.style.left = '';
    dropdown.style.right = '';
    dropdown.style.top = '';
    dropdown.style.bottom = '';

    // Position below the trigger
    const top = rect.bottom + 8;
    const left = rect.left;

    // Check if dropdown goes off right edge
    if (left + dropdownRect.width > viewportWidth - 16) {
      dropdown.style.right = '0';
      dropdown.style.left = 'auto';
    } else {
      dropdown.style.left = `${left}px`;
      dropdown.style.right = 'auto';
    }

    // Check if dropdown goes off bottom edge
    if (top + dropdownRect.height > viewportHeight - 16) {
      dropdown.style.top = 'auto';
      dropdown.style.bottom = `${viewportHeight - rect.top + 8}px`;
    } else {
      dropdown.style.top = `${top}px`;
      dropdown.style.bottom = 'auto';
    }
  }

  // Desktop profile trigger click
  if (profileTrigger) {
    profileTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleProfileDropdown(profileTrigger, profileDropdown, profileWrapper);
    });
  }

  // Mobile profile trigger click
  if (mobileProfileTrigger) {
    mobileProfileTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleProfileDropdown(mobileProfileTrigger, mobileProfileDropdown, mobileProfileWrapper);
    });
  }

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (profileDropdown && !profileWrapper?.contains(e.target)) {
      closeProfileDropdown(profileTrigger, profileDropdown);
    }
    if (mobileProfileDropdown && !mobileProfileWrapper?.contains(e.target)) {
      closeProfileDropdown(mobileProfileTrigger, mobileProfileDropdown);
    }
  });

  // Close dropdowns on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProfileDropdown(profileTrigger, profileDropdown);
      closeProfileDropdown(mobileProfileTrigger, mobileProfileDropdown);
    }
  });

  // Profile item click - show profile page
  const profileItem = $('profile-item');
  const mobileProfileItem = $('mobile-profile-item');
  const handleProfileClick = () => {
    closeProfileDropdown(profileTrigger, profileDropdown);
    closeProfileDropdown(mobileProfileTrigger, mobileProfileDropdown);
    showView('profile');
  };
  if (profileItem) profileItem.addEventListener('click', handleProfileClick);
  if (mobileProfileItem) mobileProfileItem.addEventListener('click', handleProfileClick);

  // Settings item click - show settings page
  const settingsItem = $('settings-item');
  const mobileSettingsItem = $('mobile-settings-item');
  const handleSettingsClick = () => {
    closeProfileDropdown(profileTrigger, profileDropdown);
    closeProfileDropdown(mobileProfileTrigger, mobileProfileDropdown);
    showView('settings');
  };
  if (settingsItem) settingsItem.addEventListener('click', handleSettingsClick);
  if (mobileSettingsItem) mobileSettingsItem.addEventListener('click', handleSettingsClick);

  // Sign out item click - use existing logout logic
  const signoutItem = $('signout-item');
  const mobileSignoutItem = $('mobile-signout-item');
  const handleSignoutClick = () => {
    closeProfileDropdown(profileTrigger, profileDropdown);
    closeProfileDropdown(mobileProfileTrigger, mobileProfileDropdown);
    logout();
  };
  if (signoutItem) signoutItem.addEventListener('click', handleSignoutClick);
  if (mobileSignoutItem) mobileSignoutItem.addEventListener('click', handleSignoutClick);

  // Update dropdown position on scroll/resize
  window.addEventListener('scroll', () => {
    if (profileDropdown?.style.display !== 'none') positionDropdown(profileTrigger, profileDropdown);
    if (mobileProfileDropdown?.style.display !== 'none') positionDropdown(mobileProfileTrigger, mobileProfileDropdown);
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (profileDropdown?.style.display !== 'none') positionDropdown(profileTrigger, profileDropdown);
    if (mobileProfileDropdown?.style.display !== 'none') positionDropdown(mobileProfileTrigger, mobileProfileDropdown);
  });
}

function handleNav(view) {
  if (view === 'logout') { logout(); return; }
  if (view === 'cart' || view === 'orders' || view === 'wishlist' || view === 'checkout' || view === 'auth' || view === 'referrals') {
    if (!state.user && view !== 'auth') { showView('auth'); toast('Please login first', 'info'); return; }
  }
  if (view === 'auth') { logout(); return; }
  showView(view);
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => { t.classList.toggle('active', t.dataset.tab === tab); t.setAttribute('aria-selected', t.dataset.tab === tab); });
  $('login-form').style.display = tab === 'login' ? 'block' : 'none';
  $('register-form').style.display = tab === 'register' ? 'block' : 'none';
  hideErrors();
}

async function handleLogin(e) {
  e.preventDefault(); hideErrors();
  const email = $('login-email').value.trim(), password = $('login-password').value;
  if (!email || !password) return showError('login-error', 'Email and password required');
  try {
    const r = await apiPost('/auth/login', { email, password });
    if (r.error) return showError('login-error', r.error);
    setAuth(r.user, r.token); toast('Welcome back!', 'success'); showView('home');
  } catch (err) { showError('login-error', (err instanceof Error && err.message) ? err.message : 'Login failed'); }
}

async function handleRegister(e) {
  e.preventDefault(); hideErrors();
  const name = $('register-name').value.trim(), email = $('register-email').value.trim();
  const password = $('register-password').value, confirm = $('register-confirm').value;
  if (!name || !email || !password) return showError('register-error', 'All fields required');
  if (password.length < 8) return showError('register-error', 'Password must be at least 8 characters');
  if (password !== confirm) return showError('register-error', 'Passwords do not match');
  try {
    const r = await apiPost('/auth/register', { name, email, password });
    if (r.error) return showError('register-error', r.error);
    if (r.message) toast(r.message, 'success');
    $('register-form').reset();
    const fill = document.querySelector('.strength-fill'), text = document.querySelector('.strength-text');
    if (fill) fill.style.width = '0%';
    if (text) text.textContent = 'Password strength';
    toast('Account created. Please sign in with your new credentials.', 'success');
    $('login-email').value = email;
    switchAuthTab('login');
    $('login-password').value = '';
    $('login-password').focus();
  } catch (err) { showError('register-error', (err instanceof Error && err.message) ? err.message : 'Registration failed'); }
}

function checkStrength(pw) {
  const fill = document.querySelector('.strength-fill'), text = document.querySelector('.strength-text');
  let score = 0;
  if (pw.length >= 8) score++; if (/[A-Z]/.test(pw)) score++; if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++; if (pw.length >= 12) score++;
  const colors = ['#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e'];
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  fill.style.width = (score / 5 * 100) + '%';
  fill.style.background = colors[Math.min(score, 4)];
  text.textContent = pw ? labels[score] : 'Password strength';
}

// ===== Forgot Password flow =====

function openForgotPassword() {
  clearForgotFlow();
  showView('forgot');
  setTimeout(() => { const el = $('forgot-email'); if (el) el.focus(); }, 100);
}

function goBackToLogin(e) {
  if (e) e.preventDefault();
  clearForgotFlow();
  switchAuthTab('login');
  showView('auth');
}

function clearForgotFlow() {
  clearOtpResendTimer();
  state.forgotEmail = null;
  state.resetToken = null;
  ['forgot-form', 'otp-form', 'reset-form'].forEach(id => { const el = $(id); if (el) el.reset(); });
  resetForgotStrength();
  hideErrors();
  const resend = $('otp-resend-btn');
  if (resend) resend.textContent = 'Resend OTP';
}

function setButtonLoading(btn, loading) {
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-loading');
  btn.disabled = loading;
  if (text) text.style.display = loading ? 'none' : 'inline';
  if (spinner) spinner.style.display = loading ? 'inline-flex' : 'none';
}

async function handleForgotSubmit(e) {
  e.preventDefault(); hideErrors();
  const email = $('forgot-email').value.trim();
  if (!email) return showError('forgot-error', 'Please enter your email address');
  const btn = $('forgot-send-btn');
  setButtonLoading(btn, true);
  try {
    const r = await apiPost('/auth/forgot-password', { email });
    state.forgotEmail = email;
    startOtpResendTimer(r.resend_after || 60);
    $('otp-email-display').textContent = email;
    if (r.message) toast(r.message, 'success');
    showView('otp');
    setTimeout(() => { const el = $('otp-input'); if (el) el.focus(); }, 100);
  } catch (err) {
    if (err.status === 429 && err.data && err.data.resend_after) {
      startOtpResendTimer(err.data.resend_after);
    }
    showError('forgot-error', err.message || 'Failed to send OTP. Please try again.');
  } finally {
    setButtonLoading(btn, false);
  }
}

async function handleOtpSubmit(e) {
  e.preventDefault(); hideErrors();
  const otp = $('otp-input').value.trim();
  if (!/^[0-9]{6}$/.test(otp)) return showError('otp-error', 'Please enter the 6-digit OTP');
  if (!state.forgotEmail) return showError('otp-error', 'Session expired. Please start again.');
  const btn = $('otp-verify-btn');
  setButtonLoading(btn, true);
  try {
    const r = await apiPost('/auth/verify-otp', { email: state.forgotEmail, otp });
    state.resetToken = r.reset_token;
    $('reset-email-display').textContent = state.forgotEmail;
    showView('reset');
    setTimeout(() => { const el = $('reset-password'); if (el) el.focus(); }, 100);
  } catch (err) {
    if (err.status === 429 && err.data && err.data.resend_after) startOtpResendTimer(err.data.resend_after);
    showError('otp-error', err.message || 'Invalid OTP. Please try again.');
  } finally {
    setButtonLoading(btn, false);
  }
}

async function handleOtpResend(e) {
  e.preventDefault();
  const btn = $('otp-resend-btn');
  if (!btn || btn.disabled) return;
  if (!state.forgotEmail) return showError('otp-error', 'Session expired. Please start again.');
  btn.disabled = true;
  btn.textContent = 'Sending...';
  try {
    const r = await apiPost('/auth/resend-otp', { email: state.forgotEmail });
    startOtpResendTimer(r.resend_after || 60);
    $('otp-input').value = '';
    if (r.message) toast(r.message, 'success');
    hideErrors();
    setTimeout(() => { const el = $('otp-input'); if (el) el.focus(); }, 100);
  } catch (err) {
    btn.textContent = 'Resend OTP';
    if (err.status === 429 && err.data && err.data.resend_after) {
      startOtpResendTimer(err.data.resend_after);
      showError('otp-error', err.message || 'Please wait before resending.');
    } else {
      btn.disabled = false;
      showError('otp-error', err.message || 'Failed to resend OTP. Please try again.');
    }
  }
}

async function handleResetSubmit(e) {
  e.preventDefault(); hideErrors();
  const pw = $('reset-password').value, confirm = $('reset-confirm').value;
  if (!state.resetToken || !state.forgotEmail) return showError('reset-error', 'Your OTP verification has expired. Please start again.');
  if (pw.length < 8) return showError('reset-error', 'Password must be at least 8 characters');
  if (pw !== confirm) return showError('reset-confirm-error', 'Passwords do not match.');
  const btn = $('reset-password-btn');
  setButtonLoading(btn, true);
  try {
    const r = await apiPost('/auth/reset-password', { reset_token: state.resetToken, new_password: pw });
    const email = state.forgotEmail;
    clearForgotFlow();
    switchAuthTab('login');
    if (email) $('login-email').value = email;
    $('login-password').value = '';
    showView('auth');
    if (r.message) toast(r.message, 'success');
    setTimeout(() => { const el = $('login-password'); if (el) el.focus(); }, 100);
  } catch (err) {
    showError('reset-error', err.message || 'Failed to reset password. Please try again.');
  } finally {
    setButtonLoading(btn, false);
  }
}

function startOtpResendTimer(seconds) {
  clearOtpResendTimer();
  const btn = $('otp-resend-btn');
  const timer = $('otp-resend-timer');
  btn.disabled = true;
  let remaining = Math.max(1, Math.floor(Number(seconds) || 60));
  timer.textContent = `Resend available in ${remaining}s`;
  state.otpResendTimer = setInterval(() => {
    remaining = remaining - 1;
    if (remaining <= 0) {
      clearOtpResendTimer();
      btn.disabled = false;
      timer.textContent = '';
    } else {
      timer.textContent = `Resend available in ${remaining}s`;
    }
  }, 1000);
}

function clearOtpResendTimer() {
  if (state.otpResendTimer) { clearInterval(state.otpResendTimer); state.otpResendTimer = null; }
  const btn = $('otp-resend-btn');
  const timer = $('otp-resend-timer');
  if (btn) btn.disabled = true;
  if (timer) timer.textContent = '';
}

function resetStrength(pw) {
  const fill = $('reset-strength-fill'), text = $('reset-strength-text');
  let score = 0;
  if (pw.length >= 8) score++; if (/[A-Z]/.test(pw)) score++; if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++; if (pw.length >= 12) score++;
  const colors = ['#ef4444', '#f59e0b', '#eab308', '#84cc16', '#22c55e'];
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  if (fill) fill.style.width = (score / 5 * 100) + '%';
  if (fill) fill.style.background = colors[Math.min(score, 4)];
  if (text) text.textContent = pw ? labels[score] : 'Password strength';
}

function resetForgotStrength() {
  const fill = $('reset-strength-fill'), text = $('reset-strength-text');
  if (fill) { fill.style.width = '0%'; fill.style.background = ''; }
  if (text) text.textContent = 'Password strength';
}

function checkConfirm() {
  const pw = $('register-password').value, cf = $('register-confirm').value, el = $('confirm-error');
  if (cf && pw !== cf) { el.textContent = 'Passwords do not match'; el.style.display = 'block'; }
  else el.style.display = 'none';
}

function setAuth(user, token) {
  state.user = user; state.token = token;
  localStorage.setItem('user', JSON.stringify(user)); localStorage.setItem('token', token);
  updateAuthUI(); loadCart(); loadWishlist(); loadOrders(); loadSavedAddresses();
}

function logout() {
  state.user = null; state.token = null; state.cart = []; state.orders = []; state.savedAddresses = []; state.selectedAddressId = null;
  localStorage.removeItem('user'); localStorage.removeItem('token');
  updateAuthUI(); showView('auth');
}

function updateAuthUI() {
  const logged = !!state.user;
  navLinks.forEach(v => { 
    const el = document.querySelector(`[data-view="${v}"]`); 
    if (el) {
      if (v === 'auth') {
        el.style.display = logged ? 'none' : 'flex';
      } else if (v === 'support') {
        el.style.display = 'flex'; // Support always visible
      } else {
        el.style.display = logged ? 'flex' : 'none'; 
      }
    }
  });
  document.querySelectorAll('.mobile-nav-link').forEach(l => { 
    const v = l.dataset.view; 
    if (v === 'auth') {
      l.style.display = logged ? 'none' : 'block';
    } else if (v === 'support') {
      l.style.display = 'block'; // Support always visible
    } else {
      l.style.display = logged ? 'block' : 'none'; 
    }
  });

  // Profile wrapper visibility
  const profileWrapper = $('profile-wrapper');
  const mobileProfileWrapper = $('mobile-profile-wrapper');
  if (profileWrapper) profileWrapper.style.display = logged ? 'flex' : 'none';
  if (mobileProfileWrapper) mobileProfileWrapper.style.display = logged ? 'flex' : 'none';

  // Update profile info if logged in
  if (logged && state.user) {
    updateProfileUI(state.user);
  }
}

function updateProfileUI(user) {
  const name = user.name || 'Customer';
  const email = user.email || '';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Desktop profile
  const profileName = $('profile-name');
  const profileDropdownName = $('profile-dropdown-name');
  const profileDropdownEmail = $('profile-dropdown-email');
  const profileAvatar = $('profile-avatar');
  const profileDropdownAvatar = $('profile-dropdown-avatar');
  const profileAvatarLarge = $('profile-avatar-large');
  const profileDisplayName = $('profile-display-name');
  const profileDisplayEmail = $('profile-display-email');
  const profileDetailName = $('profile-detail-name');
  const profileDetailEmail = $('profile-detail-email');
  const profileDetailJoined = $('profile-detail-joined');

  // Mobile profile
  const mobileProfileName = $('mobile-profile-name');
  const mobileProfileDropdownName = $('mobile-profile-dropdown-name');
  const mobileProfileDropdownEmail = $('mobile-profile-dropdown-email');
  const mobileProfileAvatar = $('mobile-profile-avatar');
  const mobileProfileDropdownAvatar = $('mobile-profile-dropdown-avatar');

  // Helper to create avatar with initials or use image
  const setAvatar = (el, name) => {
    if (!el) return;
    if (user.profile_image) {
      el.innerHTML = `<img src="${user.profile_image}" alt="${escapeHtml(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      el.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    }
  };

  const setAvatarLarge = (el, name) => {
    if (!el) return;
    if (user.profile_image) {
      el.innerHTML = `<img src="${user.profile_image}" alt="${escapeHtml(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      el.innerHTML = `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    }
  };

  // Update desktop
  if (profileName) profileName.textContent = name;
  if (profileDropdownName) profileDropdownName.textContent = name;
  if (profileDropdownEmail) profileDropdownEmail.textContent = email;
  if (profileAvatar) setAvatar(profileAvatar, name);
  if (profileDropdownAvatar) setAvatarLarge(profileDropdownAvatar, name);
  if (profileAvatarLarge) setAvatarLarge(profileAvatarLarge, name);
  if (profileDisplayName) profileDisplayName.textContent = name;
  if (profileDisplayEmail) profileDisplayEmail.textContent = email;
  if (profileDetailName) profileDetailName.textContent = name;
  if (profileDetailEmail) profileDetailEmail.textContent = email;
  if (profileDetailJoined) {
    const joined = user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '--';
    profileDetailJoined.textContent = joined;
  }

  // Update mobile
  if (mobileProfileName) mobileProfileName.textContent = name;
  if (mobileProfileDropdownName) mobileProfileDropdownName.textContent = name;
  if (mobileProfileDropdownEmail) mobileProfileDropdownEmail.textContent = email;
  if (mobileProfileAvatar) setAvatar(mobileProfileAvatar, name);
  if (mobileProfileDropdownAvatar) setAvatarLarge(mobileProfileDropdownAvatar, name);
}

function showView(view, productId) {
  sections.forEach(s => { const el = $(`${s}-section`); if (el) el.style.display = s === view ? 'block' : 'none'; });
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(l => l.classList.toggle('active', l.dataset.view === view));
  state.currentView = view;
  if (view === 'home') { loadProducts(); }
  if (view === 'cart') renderCart();
  if (view === 'wishlist') loadWishlist();
  if (view === 'checkout') renderCheckout();
  if (view === 'orders') { loadOrders(); }
  if (view === 'product-detail' && productId) { renderProductDetail(productId); }
  if (view === 'support') { prefillSupportForm(); }
  if (view === 'referrals') { loadReferrals(); }
  if (view === 'profile') { updateProfilePage(); }
  if (view === 'settings') { updateSettingsPage(); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProfilePage() {
  if (!state.user) return;
  const user = state.user;
  const name = user.name || 'Customer';
  const email = user.email || '';
  
  const profileDisplayName = $('profile-display-name');
  const profileDisplayEmail = $('profile-display-email');
  const profileDetailName = $('profile-detail-name');
  const profileDetailEmail = $('profile-detail-email');
  const profileDetailJoined = $('profile-detail-joined');
  const profileAvatarLarge = $('profile-avatar-large');

  if (profileDisplayName) profileDisplayName.textContent = name;
  if (profileDisplayEmail) profileDisplayEmail.textContent = email;
  if (profileDetailName) profileDetailName.textContent = name;
  if (profileDetailEmail) profileDetailEmail.textContent = email;
  if (profileDetailJoined) {
    const joined = user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '--';
    profileDetailJoined.textContent = joined;
  }
  if (profileAvatarLarge) {
    if (user.profile_image) {
      profileAvatarLarge.innerHTML = `<img src="${user.profile_image}" alt="${escapeHtml(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      profileAvatarLarge.innerHTML = `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    }
  }
}

function updateSettingsPage() {
  // Settings page is static, no dynamic updates needed for now
}

async function apiReq(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(`${API}${endpoint}`, { ...options, headers });
  // Parse the body so the backend's real error message is preserved.
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Login/Register run before the user is authenticated (token is null), so
    // never auto-logout there. Surface the server's message instead.
    if ((res.status === 401 || res.status === 403) && state.token) {
      logout();
    }
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
const apiGet = (e) => apiReq(e, { method: 'GET' });
const apiPost = (e, d) => apiReq(e, { method: 'POST', body: JSON.stringify(d) });
const apiDelete = (e) => apiReq(e, { method: 'DELETE' });
const apiPut = (e, d) => apiReq(e, { method: 'PUT', body: JSON.stringify(d) });

// Address API functions
async function loadSavedAddresses() {
  if (!state.user) { state.savedAddresses = []; return; }
  try {
    const addresses = await apiGet('/addresses');
    state.savedAddresses = Array.isArray(addresses) ? addresses : [];
  } catch (e) {
    console.error('Failed to load saved addresses:', e);
    state.savedAddresses = [];
  }
}

async function createAddress(data) {
  return await apiPost('/addresses', data);
}

async function updateAddress(id, data) {
  return await apiPut(`/addresses/${id}`, data);
}

async function deleteAddress(id) {
  return await apiDelete(`/addresses/${id}`);
}

async function setDefaultAddress(id) {
  return await apiPut(`/addresses/${id}/default`, {});
}

async function loadCategories() {
  try {
    const cats = await apiGet('/categories');
    state.categories = cats;
    const wrap = $('categories-scroll');
    wrap.querySelectorAll('.category-pill:not(.active)').forEach(p => p.remove());
    cats.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'category-pill'; btn.dataset.category = c.slug;
      btn.innerHTML = `<span class="cat-icon">${getCategoryIcon(c.slug)}</span>${c.name}`;
      btn.addEventListener('click', () => selectCategory(c.slug));
      wrap.appendChild(btn);
    });
  } catch (e) { console.error(e); }
}

function selectCategory(slug) {
  state.currentCategory = slug; state.searchQuery = '';
  document.querySelectorAll('.category-pill').forEach(p => p.classList.toggle('active', p.dataset.category === slug));
  $('search-input').value = '';
  loadProducts();
}

async function loadFeatured() {
  try {
    const slides = await apiGet('/products/featured');
    state.carouselSlides = slides;
    const track = $('carousel-track'), dots = $('carousel-dots');
    if (slides.length === 0) { $('hero-carousel').style.display = 'none'; return; }
    track.innerHTML = slides.map((s, i) => `
      <div class="carousel-slide">
        <div class="carousel-slide-bg" style="background-image:url('${HERO_IMAGES[i % HERO_IMAGES.length]}')"></div>
        <div class="carousel-content">
          <span class="carousel-badge">Featured</span>
          <h2>${s.name}</h2>
          <p>${s.description ? s.description.slice(0, 100) : ''}</p>
          <button class="btn btn-primary" onclick="addToCart(${s.id})">Shop Now • ₹${parseFloat(s.price).toFixed(2)}</button>
        </div>
      </div>`).join('');
    dots.innerHTML = slides.map((_, i) => `<button class="carousel-dot ${i === 0 ? 'active' : ''}" data-i="${i}" aria-label="Go to slide ${i + 1}"></button>`).join('');
    dots.querySelectorAll('.carousel-dot').forEach(d => d.addEventListener('click', () => goSlide(parseInt(d.dataset.i))));
    startCarousel();
  } catch { $('hero-carousel').style.display = 'none'; }
}

function goSlide(i) {
  const n = state.carouselSlides.length;
  state.carouselIndex = (i + n) % n;
  $('carousel-track').style.transform = `translateX(-${state.carouselIndex * 100}%)`;
  document.querySelectorAll('.carousel-dot').forEach((d, idx) => d.classList.toggle('active', idx === state.carouselIndex));
}
function startCarousel() { stopCarousel(); state.carouselTimer = setInterval(() => goSlide(state.carouselIndex + 1), 5000); }
function stopCarousel() { if (state.carouselTimer) clearInterval(state.carouselTimer); }

async function loadProducts() {
  const grid = $('products-grid'), loading = $('products-loading'), empty = $('no-products');
  loading.style.display = 'block'; grid.innerHTML = ''; empty.style.display = 'none';
  try {
    const params = new URLSearchParams({ limit: 200 });
    if (state.currentCategory !== 'all') params.set('category', state.currentCategory);
    if (state.searchQuery) params.set('search', state.searchQuery);
    const data = await apiGet(`/products?${params}`);
    state.products = data.products;
    loading.style.display = 'none';
    $('product-count').textContent = `${data.pagination.total} products`;
    if (data.products.length === 0) {
      empty.style.display = 'block';
      empty.textContent = 'No products found matching your criteria.';
      return;
    }
grid.innerHTML = data.products.map((p, i) => `
      <article class="product-card" style="animation-delay:${i * 0.05}s" data-id="${p.id}">
        <div class="product-image-wrap">
          ${p.featured ? '<span class="product-badge">Featured</span>' : ''}
          <img class="product-image" src="${p.image_url}" alt="${p.name}" loading="lazy" onerror="imgFallback(this)">
          <button class="product-fav${isWishlisted(p.id) ? ' active' : ''}" data-id="${p.id}" aria-label="Save to wishlist">♥</button>
          <button class="product-share" data-id="${p.id}" aria-label="Share product">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          </button>
        </div>
        <div class="product-info">
          <span class="product-cat">${p.category}</span>
          <h3 class="product-name">${p.name}</h3>
          <div class="product-rating">
            ${productRatingHTML(p)}
          </div>
          <p class="product-desc">${p.description || `${p.name} is selected for dependable quality and everyday value.`}</p>
          <div class="product-bottom">
            <div class="price-block">
              ${p.discount > 0 ? `<s class="product-price-old">₹${parseFloat(p.price).toFixed(2)}</s> ` : ''}
              <span class="product-price">₹${discounted(p).toFixed(2)}</span>
            </div>
            <div class="product-add-controls" data-id="${p.id}" data-label="Add" data-stock="${p.stock}">
              <button class="btn btn-primary btn-sm add-to-cart" data-id="${p.id}" data-label="Add" ${p.stock === 0 ? 'disabled' : ''}>Add</button>
              <div class="qty-control product-qty" style="display:none;">
                <button class="qty-btn stock-dec" data-id="${p.id}" aria-label="Decrease quantity">−</button>
                <span class="qty-value stock-qty">0</span>
                <button class="qty-btn stock-inc" data-id="${p.id}" aria-label="Increase quantity">+</button>
              </div>
            </div>
          </div>
          <div class="product-delivery" data-id="${p.id}" aria-live="polite"></div>
        </div>
      </article>`).join('');
    grid.querySelectorAll('.add-to-cart').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); addToCart(parseInt(b.dataset.id)); }));
    grid.querySelectorAll('.stock-inc').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); updateQty(parseInt(b.dataset.id), 1); }));
    grid.querySelectorAll('.stock-dec').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); updateQty(parseInt(b.dataset.id), -1); }));
    grid.querySelectorAll('.product-fav').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); toggleWishlist(parseInt(b.dataset.id)); }));
    grid.querySelectorAll('.product-share').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); openShareModal(parseInt(b.dataset.id)); }));
    grid.querySelectorAll('.product-card').forEach(c => c.addEventListener('click', () => openProduct(parseInt(c.dataset.id))));
    markCartButtons();
    if (state.selectedPin) await loadDeliveryAvailability(state.selectedPin);
    renderDeliveryStatuses();
  } catch (e) { loading.style.display = 'none'; console.error(e); }
}

function onSearch(e) {
  state.searchQuery = e.target.value.trim();
  if (state.searchQuery.length >= 2) showSuggestions(0);
  loadProducts();
}

function showSuggestions() {
  const box = $('search-suggestions');
  const q = state.searchQuery.toLowerCase();
  const matches = state.products.filter(p => p.name.toLowerCase().includes(q)).slice(0, 6);
  if (matches.length === 0) { box.style.display = 'none'; return; }
  box.innerHTML = matches.map(p => `
    <div class="suggestion-item" data-id="${p.id}">
      <img class="suggestion-img" src="${p.image_url}" alt="" onerror="this.style.display='none'">
      <div class="suggestion-info">
        <div class="suggestion-name">${p.name}</div>
        <div class="suggestion-cat">${p.category} • ₹${parseFloat(p.price).toFixed(2)}</div>
      </div>
    </div>`).join('');
  box.style.display = 'block';
  box.querySelectorAll('.suggestion-item').forEach(it => it.addEventListener('click', () => { openProduct(parseInt(it.dataset.id)); hideSuggestions(); }));
}
function hideSuggestions() { $('search-suggestions').style.display = 'none'; }

async function openProduct(id) {
  showView('product-detail', id);
}

async function renderProductDetail(id) {
  let p = state.products.find(x => x.id === id);
  if (!p) {
    try {
      p = await apiGet(`/products/${id}`);
      state.products.push(p);
    } catch {
      showView('home');
      return;
    }
  }
  if (!p) { showView('home'); return; }
  state.currentProductId = id;

  const description = p.description || `${p.name} is a carefully selected ${p.category || 'everyday'} product made for reliable performance and lasting value.`;
  const specification = p.specification || `Product: ${p.name}\nCategory: ${p.category || 'General'}\nQuality: Premium\nUsage: Everyday use`;
  const highlights = (p.highlights || '').split('\n').map(s => s.trim()).filter(Boolean);
  const deliveryLines = (p.delivery || '').split('\n').map(s => s.trim()).filter(Boolean);
  const specItems = specification.split('\n').map(s => s.trim()).filter(Boolean);

  const categoryObj = state.categories.find(c => c.slug === p.category);
  const categoryName = categoryObj ? categoryObj.name : p.category;

  const breadcrumbCategory = $('breadcrumb-category');
  const breadcrumbProduct = $('breadcrumb-product');
  breadcrumbCategory.textContent = categoryName;
  breadcrumbProduct.textContent = p.name;

  const reviewCount = Number(p.review_count || 0);
  const avgRating = p.rating != null ? Number(p.rating) : 0;

  // Set share product state
  state.shareProduct = { ...p, avgRating, reviewCount };

  // Parse sizes from product (JSON array or comma-separated string)
  let sizes = [];
  if (p.sizes) {
    try {
      sizes = typeof p.sizes === 'string' ? JSON.parse(p.sizes) : p.sizes;
    } catch {
      sizes = p.sizes.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  const isClothing = p.category === 'clothing';
  const hasSizes = sizes.length > 0;

  $('product-detail-content').innerHTML = `
      <div class="product-gallery">
        <div class="main-image-wrapper">
          <img class="main-image" src="${p.image_url}" alt="${p.name}" onerror="imgFallback(this)">
        </div>
      </div>

      <div class="product-info">
        <span class="product-category">${categoryName}</span>
        <h1 class="product-title">${p.name}</h1>

        <div class="product-rating-row">
          ${reviewCount > 0
            ? `<div class="rating-stars-large">${stars(avgRating)}</div>
               <span class="rating-value-large">${avgRating.toFixed(1)}</span>
               <span class="review-count">(${reviewCount} review${reviewCount === 1 ? '' : 's'})</span>`
            : `<span class="no-rating">No ratings yet</span>`}
          <button class="product-share-btn" id="pd-share-btn" aria-label="Share product" title="Share">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="6.68"/></svg>
          </button>
        </div>

        <div class="product-price-row">
          ${p.discount > 0 ? `<span class="original-price">₹${parseFloat(p.price).toFixed(2)}</span>` : ''}
          <span class="current-price">₹${discounted(p).toFixed(2)}</span>
          ${p.discount > 0 ? `<span class="discount-percent">${Number(p.discount).toFixed(0)}% off</span>` : ''}
          <span class="tax-info">Inclusive of all taxes</span>
        </div>

        <div class="product-meta">
          <div class="delivery-options" id="delivery-options">
            ${getDeliveryOptions().map((opt, i) => `
              <label class="delivery-option ${i === 0 ? 'selected' : ''}" data-days="${opt.days}">
                <input type="radio" name="delivery" ${i === 0 ? 'checked' : ''} style="display:none;">
                <span class="delivery-label">${opt.label}</span>
                <span class="delivery-date">${opt.date}</span>
              </label>
            `).join('')}
          </div>
          <div class="pincode-checker">
            <label class="pincode-label" for="pd-pin-code">Check Delivery to your PIN Code</label>
            <div class="pincode-input-row">
              <input type="text" id="pd-pin-code" class="pincode-input" inputmode="numeric" maxlength="6" placeholder="Enter 6-digit PIN code" autocomplete="postal-code" aria-label="Enter 6-digit PIN code">
              <button type="button" class="btn btn-primary btn-sm pincode-check-btn" id="pd-pin-check">Check</button>
            </div>
            <p class="pincode-result" id="pd-pin-result" data-valid="unknown" role="status"></p>
          </div>
        </div>
        ${hasSizes && isClothing ? `
        <div class="product-size-selector">
          <label class="size-label">Select Size</label>
          <div class="size-options" id="size-options">
            ${sizes.map(size => `
              <button type="button" class="size-btn" data-size="${size}" aria-label="Size ${size}">${size}</button>
            `).join('')}
          </div>
          <span class="size-hint">Select a size to continue</span>
        </div>
        ` : ''}

        <div class="product-actions">
          <div class="quantity-selector">
            <label>Qty</label>
            <div class="qty-control" id="pd-qty-control">
              <button class="qty-btn" id="pd-minus" aria-label="Decrease quantity">−</button>
              <span class="qty-value" id="pd-qty">1</span>
              <button class="qty-btn" id="pd-plus" aria-label="Increase quantity">+</button>
            </div>
          </div>
          <div class="action-buttons">
            <button class="btn btn-primary btn-lg" id="pd-add" data-id="${p.id}" data-label="Add to Cart" ${p.stock === 0 ? 'disabled' : ''}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1 4 4v4"/></svg>
              <span class="btn-text">Add to Cart</span>
            </button>
            <div class="qty-control" id="pd-cart-controls" style="display:none;">
              <button class="qty-btn" id="pd-cart-dec" aria-label="Decrease quantity">−</button>
              <span class="qty-value" id="pd-cart-qty">1</span>
              <button class="qty-btn" id="pd-cart-inc" aria-label="Increase quantity">+</button>
            </div>
            <button class="btn btn-dark btn-lg" id="pd-buy">
              Buy Now
            </button>
          </div>
        </div>

        <div class="product-info-cards">
          <div class="product-highlights-section">
            <h3>Highlights</h3>
            <ul class="highlights-list">
              ${highlights.length > 0 ? highlights.map(h => `<li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>${h}</li>`).join('') : '<li>Premium quality product</li><li>100% genuine</li><li>Great value for money</li>'}
            </ul>
          </div>

          <div class="delivery-details-section">
            <h3>Delivery & Returns</h3>
            <ul class="delivery-details-list">
              ${deliveryLines.length > 0 ? deliveryLines.map(d => `<li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${d}</li>`).join('') : `
                <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Free standard delivery in 3-5 working days</li>
                <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Cash on Delivery available</li>
                <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>30-day easy return & replacement</li>
                <li><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Ships within 24 hours</li>
              `}
            </ul>
          </div>
        </div>
      </div>

      <div class="product-tabs">
        <div class="tab-headers" role="tablist">
          <button class="tab-btn active" role="tab" aria-selected="true" data-tab="description">Description</button>
          <button class="tab-btn" role="tab" aria-selected="false" data-tab="specifications">Specifications</button>
          <button class="tab-btn" role="tab" aria-selected="false" data-tab="reviews">Reviews (${reviewCount})</button>
        </div>

        <div class="tab-panels">
          <div class="tab-panel active" role="tabpanel" data-tab="description">
            <div class="description-content">
              ${description.split('\n\n').map(para => `<p>${para}</p>`).join('')}
              ${highlights.length > 0 ? `
              <h4>Key Features</h4>
              <ul class="feature-list">
                ${highlights.map(h => `<li>${h}</li>`).join('')}
              </ul>` : ''}
            </div>
          </div>

          <div class="tab-panel" role="tabpanel" data-tab="specifications">
            <div class="specifications-content">
              ${specItems.length > 0 ? `
                <div class="spec-grid">
                  ${specItems.slice(0, 7).map(item => {
                    const [key, ...valParts] = item.split(':');
                    const val = valParts.join(':').trim();
                    return key.trim() && val ? `
                      <div class="spec-cell">
                        <span class="spec-name">${key.trim()}</span>
                        <span class="spec-value">${val}</span>
                      </div>` : '';
                  }).join('')}
                </div>
              ` : `
                <p class="no-specs">No specifications available for this product.</p>
              `}
            </div>
          </div>

          <div class="tab-panel" role="tabpanel" data-tab="reviews">
            <div id="reviews-tab-content" class="reviews-tab-content">
              <div class="reviews-loading" style="text-align: center; padding: 2rem;">
                <div class="spinner" style="margin: 0 auto 1rem;"></div>
                <p>Loading reviews...</p>
              </div>
            </div>
          </div>
        </div>
      </div>`;

  let qty = 1;
  const minusBtn = $('pd-minus');
  const plusBtn = $('pd-plus');
  const qtyEl = $('pd-qty');
  const addBtn = $('pd-add');
  const buyBtn = $('pd-buy');
  const cartDecBtn = $('pd-cart-dec');
  const cartIncBtn = $('pd-cart-inc');
  const cartQtyEl = $('pd-cart-qty');
  const qtyControl = $('pd-qty-control');
  const cartControls = $('pd-cart-controls');

  // Check if product is already in cart
  const cartItem = state.cart.find(i => i.product_id === id);
  if (cartItem) {
    qty = cartItem.quantity;
    qtyEl.textContent = qty;
    cartQtyEl.textContent = qty;
    qtyControl.style.display = 'none';
    cartControls.style.display = 'flex';
    addBtn.style.display = 'none';
    const textSpan = addBtn.querySelector('.btn-text');
    if (textSpan) textSpan.textContent = '✓ Added';
  }

  if (minusBtn) minusBtn.addEventListener('click', () => { qty = Math.max(1, qty - 1); qtyEl.textContent = qty; });
  if (plusBtn) plusBtn.addEventListener('click', () => { qty = Math.min(p.stock || 99, qty + 1); qtyEl.textContent = qty; });
  if (addBtn) addBtn.addEventListener('click', () => {
      if (hasSizes && isClothing && !selectedSize) {
        const hint = document.querySelector('.size-hint');
        if (hint) { hint.textContent = 'Please select a size'; hint.style.color = '#ef4444'; }
        return;
      }
      addToCart(id, qty, selectedSize);
      updateProductDetailCartUI(id, qty);
    });
  if (buyBtn) buyBtn.addEventListener('click', async () => {
      if (hasSizes && isClothing && !selectedSize) {
        const hint = document.querySelector('.size-hint');
        if (hint) { hint.textContent = 'Please select a size'; hint.style.color = '#ef4444'; }
        return;
      }
      // Never let a non-deliverable product jump straight into checkout.
      if (state.selectedPin && !isProductDeliverable(p, state.selectedPin)) {
        toast(`This product ${pinCheckMessage(p, state.selectedPin)}. Please change your PIN code or choose a different product.`, 'error');
        return;
      }
      const added = await addToCart(id, qty, selectedSize);
      if (added) {
        if (state.selectedPin) {
          $('checkout-pin-code').value = state.selectedPin;
          if (!$('shipping-zip').value) $('shipping-zip').value = state.selectedPin;
        }
        setTimeout(() => showView('checkout'), 300);
      }
    });
  if (cartDecBtn) cartDecBtn.addEventListener('click', () => updateQty(id, -1));
  if (cartIncBtn) cartIncBtn.addEventListener('click', () => updateQty(id, 1));

  // Delivery option selection
  document.querySelectorAll('.delivery-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.delivery-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      opt.querySelector('input').checked = true;
    });
  });

  // Size selector for clothing items
  let selectedSize = null;
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedSize = btn.dataset.size;
      const hint = document.querySelector('.size-hint');
      if (hint) hint.textContent = `Size ${selectedSize} selected`;
    });
  });

  const pinInput = $('pd-pin-code');
  const pinBtn = $('pd-pin-check');
  const pinResult = $('pd-pin-result');
  if (pinInput && state.selectedPin) pinInput.value = state.selectedPin;
  const runPinCheck = async () => {
    const pin = (pinInput.value || '').trim();
    if (!isValidPin(pin)) {
      pinResult.className = 'pincode-result error';
      pinResult.dataset.valid = 'invalid';
      pinResult.textContent = 'Please enter a valid 6-digit Indian PIN code.';
      return;
    }
    const location = await lookupPinLocation(pin);
    if (location && location.notFound) {
      pinResult.className = 'pincode-result error';
      pinResult.dataset.valid = 'invalid';
      pinResult.textContent = 'PIN code not found. Please enter a valid Indian PIN code.';
      return;
    }
    if (!location || location.error) {
      pinResult.className = 'pincode-result error';
      pinResult.dataset.valid = 'invalid';
      pinResult.textContent = 'Could not check this PIN code right now. Please try again.';
      return;
    }
    await loadDeliveryAvailability(pin);
    const ok = isProductDeliverable(p, pin);
    pinResult.className = ok ? 'pincode-result success' : 'pincode-result error';
    pinResult.dataset.valid = ok ? 'valid' : 'invalid';
    pinResult.textContent = pinCheckMessage(p, pin);
  };
  if (pinBtn) pinBtn.addEventListener('click', runPinCheck);
  if (pinInput) {
    pinInput.addEventListener('input', () => {
      if (pinResult.dataset.valid !== 'unknown') { pinResult.className = 'pincode-result'; pinResult.dataset.valid = 'unknown'; pinResult.textContent = ''; }
    });
    pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runPinCheck(); } });
  }

  // Product detail share button
  const pdShareBtn = $('pd-share-btn');
  if (pdShareBtn) pdShareBtn.addEventListener('click', () => openShareModal(p.id));

  initTabs();
}

function updateProductDetailCartUI(productId, newQty) {
  const addBtn = $('pd-add');
  const qtyControl = $('pd-qty-control');
  const cartControls = $('pd-cart-controls');
  const cartQtyEl = $('pd-cart-qty');
  const cartDecBtn = $('pd-cart-dec');
  
  if (newQty > 0) {
    qtyControl.style.display = 'none';
    cartControls.style.display = 'flex';
    addBtn.style.display = 'none';
    cartQtyEl.textContent = newQty;
    const textSpan = addBtn.querySelector('.btn-text');
    if (textSpan) textSpan.textContent = '✓ Added';
    if (cartDecBtn) cartDecBtn.style.visibility = 'visible';
  } else {
    qtyControl.style.display = 'flex';
    cartControls.style.display = 'none';
    addBtn.style.display = '';
    const textSpan = addBtn.querySelector('.btn-text');
    if (textSpan) textSpan.textContent = addBtn.dataset.label || 'Add to Cart';
  }
}

// ----- Review helpers (edit/delete own review from the reviews tab) -----

function paintStarPicker(value) {
  const picker = $('review-star-picker');
  const labelEl = $('review-star-label');
  if (!picker) return;
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  picker.querySelectorAll('.star-btn').forEach((b) => {
    const bv = Number(b.dataset.value);
    b.classList.toggle('selected', bv <= v);
    b.setAttribute('aria-checked', bv <= v ? 'true' : 'false');
  });
  if (labelEl) labelEl.textContent = v ? `${v} star${v > 1 ? 's' : ''}` : 'Tap a star to rate';
}

function findMyReview(reviewId) {
  const list = (state.currentReviews && state.currentReviews.reviews) || [];
  return list.find((r) => Number(r.id) === Number(reviewId)) || null;
}

async function editMyReview(reviewId) {
  const review = findMyReview(reviewId);
  if (!review || !state.user) return;
  state.editingReviewId = Number(reviewId);
  state.reviewRating = Number(review.rating) || 0;
  const commentEl = $('review-comment');
  if (commentEl) commentEl.value = review.comment || '';
  const heading = document.querySelector('#review-form-section h4');
  if (heading) heading.textContent = 'Edit Your Review';
  const btn = $('submit-review');
  if (btn) btn.textContent = 'Update Review';
  const errEl = $('review-form-error');
  const okEl = $('review-form-success');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  if (okEl) { okEl.style.display = 'none'; okEl.textContent = ''; }
  paintStarPicker(state.reviewRating);
  const section = $('review-form-section');
  if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteMyReview(reviewId) {
  if (!state.user) return;
  if (!window.confirm('Delete your review? The product rating will be recalculated.')) return;
  try {
    await apiDelete(`/reviews/${reviewId}`);
    state.editingReviewId = null;
    state.reviewRating = 0;
    toast('Your review has been deleted.', 'success');
    const p = state.products.find((x) => x.id === state.currentProductId);
    await renderProductDetail(state.currentProductId);
  } catch (e) {
    toast((e && e.message) ? e.message : 'Failed to delete your review.', 'error');
  }
}

// Wire up the "Write a Review" widget on the product detail page. Customers
// must be logged in and have purchased the product; each customer may have one
// review per product (a second submission edits it). Resubmitting always
// refreshes the rating from the real reviews in the backend.
function bindReviewForm(p, productId) {
  const picker = $('review-star-picker');
  const submitBtn = $('submit-review');
  if (!picker || !submitBtn) return;

  const labelEl = $('review-star-label');
  const errEl = $('review-form-error');
  const okEl = $('review-form-success');
  const commentEl = $('review-comment');
  const heading = document.querySelector('#review-form-section h4');
  const starBtns = picker.querySelectorAll('.star-btn');
  let submitting = false;

  const applyEditState = () => {
    if (state.editingReviewId) {
      const review = findMyReview(state.editingReviewId);
      if (review) {
        state.reviewRating = Number(review.rating) || 0;
        if (commentEl) commentEl.value = review.comment || '';
        if (submitBtn) submitBtn.textContent = 'Update Review';
      } else {
        state.editingReviewId = null;
        state.reviewRating = 0;
        if (submitBtn) submitBtn.textContent = 'Submit Review';
      }
    } else {
      if (submitBtn) submitBtn.textContent = 'Submit Review';
    }
    if (heading) heading.textContent = state.editingReviewId ? 'Edit Your Review' : 'Write a Review';
    paintStarPicker(state.reviewRating);
  };
  applyEditState();

  starBtns.forEach((b) => {
    b.addEventListener('click', () => {
      state.reviewRating = Number(b.dataset.value);
      paintStarPicker(state.reviewRating);
    });
  });

  submitBtn.addEventListener('click', async () => {
    if (submitting) return;
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (okEl) { okEl.style.display = 'none'; okEl.textContent = ''; }

    if (!state.user) {
      showView('auth');
      toast('Please login to submit a review', 'info');
      return;
    }
    if (!state.reviewRating) {
      if (errEl) { errEl.textContent = 'Please select a star rating above.'; errEl.style.display = 'block'; }
      return;
    }
    const comment = (commentEl ? commentEl.value : '').trim();
    if (!comment || comment.length < 3) {
      if (errEl) { errEl.textContent = 'Please write your feedback (at least 3 characters).'; errEl.style.display = 'block'; }
      return;
    }

    submitting = true;
    submitBtn.disabled = true;
    try {
      let res;
      if (state.editingReviewId) {
        res = await apiPut(`/reviews/${state.editingReviewId}`, { rating: state.reviewRating, comment });
      } else {
        res = await apiPost(`/products/${productId}/reviews`, { rating: state.reviewRating, comment });
      }
      state.editingReviewId = null;
      state.reviewRating = 0;
      if (heading) heading.textContent = 'Write a Review';
      if (submitBtn) submitBtn.textContent = 'Submit Review';
      if (commentEl) commentEl.value = '';
      paintStarPicker(0);
      if (okEl) { okEl.textContent = res.message || 'Thank you! Your review has been saved.'; okEl.style.display = 'block'; }
      toast(res.message || 'Review saved', 'success');
      try {
        const fresh = await apiGet(`/products/${productId}`);
        const idx = state.products.findIndex((x) => x.id === productId);
        if (idx !== -1) state.products[idx] = { ...state.products[idx], ...fresh };
        await renderProductDetail(productId);
      } catch { /* keep current page */ }
    } catch (e) {
      if (errEl) { errEl.textContent = (e && e.message) ? e.message : 'Failed to save your review. Please try again.'; errEl.style.display = 'block'; }
    } finally {
      submitting = false;
      submitBtn.disabled = false;
    }
  });
}

function getDeliveryDate(daysOffset = 3) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getDeliveryOptions() {
  const options = [];
  const date1 = new Date();
  date1.setDate(date1.getDate() + 1);
  options.push({ days: 1, label: 'Fastest Delivery', date: 'Tomorrow (' + date1.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) + ')' });
  const date2 = new Date();
  date2.setDate(date2.getDate() + 2);
  options.push({ days: 2, label: '2 Day Delivery', date: date2.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) });
  return options;
}

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  let reviewsLoaded = false;

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      tabBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      tabPanels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      document.querySelector(`.tab-panel[data-tab="${tab}"]`)?.classList.add('active');

      if (tab === 'reviews' && !reviewsLoaded) {
        loadProductReviews(state.currentProductId);
        reviewsLoaded = true;
      }
    });
  });
}

async function addToCart(productId, qty = 1, size = null) {
  if (!state.user) { showView('auth'); toast('Please login first', 'info'); return false; }

  try {
    await apiPost('/cart', { product_id: productId, quantity: qty, size });
    await loadCart();
    return true;
  } catch { toast('Failed to add', 'error'); return false; }
}

async function loadCart() {
  if (!state.user) { state.cart = []; updateCartCount(); markCartButtons(); return; }
  try {
    const cart = await apiGet('/cart');
    state.cart = Array.isArray(cart) ? cart : [];
    updateCartCount(); markCartButtons();
    if (state.currentView === 'cart') renderCart();
    if (state.currentView === 'checkout') renderCheckout();
    if (state.currentView === 'product-detail' && state.currentProductId) {
      const cartItem = state.cart.find(i => i.product_id === state.currentProductId);
      updateProductDetailCartUI(state.currentProductId, cartItem ? cartItem.quantity : 0);
    }
  } catch (e) { console.error(e); state.cart = []; updateCartCount(); markCartButtons(); }
}

function updateCartCount() {
  const n = (Array.isArray(state.cart) ? state.cart : []).reduce((s, i) => s + (i.quantity || 0), 0);
  $('cart-count').textContent = n; $('mobile-cart-count').textContent = n;
}

function isInCart(productId) { return (Array.isArray(state.cart) ? state.cart : []).some(i => i.product_id === productId); }

function markCartButtons() {
  document.querySelectorAll('.add-to-cart, .add-from-wishlist, #pd-add').forEach(btn => {
    if (!btn.dataset.id || btn.disabled) return;
    const added = isInCart(parseInt(btn.dataset.id));
    btn.classList.toggle('added', added);
    
    const textSpan = btn.querySelector('.btn-text');
    if (textSpan) {
      textSpan.textContent = added ? '✓ Added' : (btn.dataset.label || 'Add');
    } else {
      btn.textContent = added ? '✓ Added' : (btn.dataset.label || 'Add');
    }
  });
  document.querySelectorAll('.product-add-controls').forEach(ctrl => {
    if (!ctrl.dataset.id) return;
    const added = isInCart(parseInt(ctrl.dataset.id));
    const addBtn = ctrl.querySelector('.add-to-cart');
    const qtyCtrl = ctrl.querySelector('.product-qty');
    if (!addBtn || !qtyCtrl) return;
    if (added) {
      const item = state.cart.find(i => i.product_id === parseInt(ctrl.dataset.id));
      addBtn.style.display = 'none';
      qtyCtrl.style.display = 'flex';
      const q = ctrl.querySelector('.stock-qty');
      if (q) q.textContent = item ? item.quantity : 1;
      const decBtn = ctrl.querySelector('.stock-dec');
      if (decBtn) decBtn.style.visibility = 'visible';
    } else {
      addBtn.style.display = '';
      qtyCtrl.style.display = 'none';
    }
  });
}

async function loadWishlist() {
  if (!state.user) { state.wishlist = []; return; }
  try {
    const list = await apiGet('/wishlist');
    state.wishlist = Array.isArray(list) ? list : [];
    updateWishlistCount();
    if (state.currentView === 'wishlist') renderWishlist();
    markFavButtons();
  } catch (e) { console.error(e); }
}

function isWishlisted(id) { return (Array.isArray(state.wishlist) ? state.wishlist : []).some(w => w.product_id === id); }

function updateWishlistCount() {
  const n = state.wishlist.length;
  const ec = $('wishlist-count'), mc = $('mobile-wishlist-count');
  if (ec) ec.textContent = n;
  if (mc) mc.textContent = n;
}

async function toggleWishlist(productId) {
  if (!state.user) { showView('auth'); toast('Please login first', 'info'); return; }
  const fav = isWishlisted(productId);
  try {
    if (fav) state.wishlist = await apiDelete(`/wishlist/${productId}`);
    else state.wishlist = await apiPost('/wishlist', { product_id: productId });
    updateWishlistCount();
    markFavButtons();
    if (state.currentView === 'wishlist') renderWishlist();
    toast(fav ? 'Removed from wishlist' : 'Added to wishlist', 'success');
  } catch { toast('Wishlist update failed', 'error'); }
}

function markFavButtons() {
  document.querySelectorAll('.product-fav').forEach(btn => {
    if (!btn.dataset.id) return;
    btn.classList.toggle('active', isWishlisted(parseInt(btn.dataset.id)));
  });
}

function renderWishlist() {
  const items = $('wishlist-items'), empty = $('wishlist-empty');
  if (state.wishlist.length === 0) { items.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  items.innerHTML = state.wishlist.map((w, i) => `
    <article class="wishlist-card" style="animation-delay:${i * 0.05}s" data-id="${w.product_id}">
      <div class="wishlist-image-wrap">
        <img class="wishlist-image" src="${w.image_url}" alt="${w.name}" loading="lazy" onerror="imgFallback(this)">
        <button class="product-fav active" data-id="${w.product_id}" aria-label="Remove from wishlist">♥</button>
        <button class="product-share" data-id="${w.product_id}" aria-label="Share product">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="6.68"/></svg>
        </button>
      </div>
      <div class="wishlist-info">
        <span class="product-cat">${w.category}</span>
        <h3 class="product-name">${w.name}</h3>
        <p class="product-desc">${w.description || `${w.name} is selected for dependable quality and everyday value.`}</p>
        <div class="product-rating">
          ${productRatingHTML(w)}
        </div>
        <div class="product-bottom">
          <div class="price-block">
            ${w.discount > 0 ? `<s class="product-price-old">₹${parseFloat(w.price).toFixed(2)} </s>` : ''}
            <span class="product-price">₹${discounted(w).toFixed(2)}</span>
          </div>
          <button class="btn btn-primary btn-sm add-from-wishlist" data-id="${w.product_id}" data-label="Add to Cart" ${w.stock === 0 ? 'disabled' : ''}>Add to Cart</button>
        </div>
      </div>
    </article>`).join('');
  items.querySelectorAll('.product-fav').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); toggleWishlist(parseInt(b.dataset.id)); }));
  items.querySelectorAll('.add-from-wishlist').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); addToCart(parseInt(b.dataset.id), 1); }));
  items.querySelectorAll('.product-share').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); openShareModal(parseInt(b.dataset.id)); }));
  items.querySelectorAll('.wishlist-card').forEach(c => c.addEventListener('click', () => openProduct(parseInt(c.dataset.id))));
  markCartButtons();
}

function renderCart() {
  const items = $('cart-items'), empty = $('cart-empty'), summary = $('cart-summary');
  if (state.cart.length === 0) { items.innerHTML = ''; empty.style.display = 'block'; summary.style.display = 'none'; refreshCartDeliveryNotice(); return; }
  empty.style.display = 'none'; summary.style.display = 'block';
  items.innerHTML = state.cart.map(i => `
    <div class="cart-item" data-id="${i.product_id}">
      <img class="cart-item-img" src="${i.image_url}" alt="${i.name}" onerror="imgFallback(this)">
      <div class="cart-item-info">
        <div class="cart-item-name">${i.name}</div>
          <div class="cart-item-description">${i.description || 'Quality product with dependable everyday performance.'}</div>
        <div class="cart-item-price">₹${parseFloat(i.price).toFixed(2)} each</div>
        <div class="cart-item-delivery" data-id="${i.product_id}" aria-live="polite"></div>
      </div>
      <div class="cart-item-side">
        <div class="qty-control">
          <button class="qty-btn dec" data-id="${i.product_id}" aria-label="Decrease quantity">−</button>
          <span class="qty-value">${i.quantity}</span>
          <button class="qty-btn inc" data-id="${i.product_id}" aria-label="Increase quantity">+</button>
        </div>
        <button class="btn btn-danger btn-sm rem" data-id="${i.product_id}">Remove</button>
      </div>
    </div>`).join('');
  items.querySelectorAll('.dec').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); updateQty(parseInt(b.dataset.id), -1); }));
  items.querySelectorAll('.inc').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); updateQty(parseInt(b.dataset.id), 1); }));
  items.querySelectorAll('.rem').forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); removeItem(parseInt(b.dataset.id)); }));
  items.querySelectorAll('.cart-item').forEach(c => c.addEventListener('click', () => openProduct(parseInt(c.dataset.id))));
  const total = state.cart.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0);
  $('cart-subtotal').textContent = `₹${total.toFixed(2)}`;
  $('cart-total').textContent = `₹${total.toFixed(2)}`;
  refreshCartDeliveryNotice();
}

// Fills in the per-item ✓ Deliverable / ✕ Not deliverable status inside the
// cart for the currently selected PIN code.
function renderCartDeliveryStatuses(pin, results) {
  document.querySelectorAll('.cart-item-delivery').forEach(el => {
    const pid = Number(el.dataset.id);
    if (!isValidPin(pin)) {
      el.className = 'cart-item-delivery';
      el.textContent = '';
      return;
    }
    const r = (Array.isArray(results) ? results : []).find(x => Number(x.product_id) === pid);
    const available = r
      ? r.available
      : isProductDeliverable(state.cart.find(i => Number(i.product_id) === pid), pin);
    el.className = 'cart-item-delivery ' + (available ? 'available' : 'unavailable');
    el.textContent = available ? `✓ Deliverable to ${pin}` : `✕ Not deliverable to ${pin}`;
  });
}

// Validates EVERY cart item against the currently selected PIN code using the
// server's authoritative delivery data. When some items are not deliverable it
// shows a clear message on each item and in the banner, and blocks the
// "Proceed to Checkout" button.
async function refreshCartDeliveryNotice() {
  const notice = $('cart-delivery-notice');
  const checkoutBtn = $('checkout-btn');
  if (!notice) return;
  const reset = () => { notice.style.display = 'none'; notice.className = 'cart-delivery-notice'; notice.innerHTML = ''; };
  if (checkoutBtn) checkoutBtn.disabled = false;

  if (!state.selectedPin) { renderCartDeliveryStatuses(); reset(); return; }
  if (state.cart.length === 0) { renderCartDeliveryStatuses(); reset(); return; }

  const pin = state.selectedPin;
  const check = await checkDeliveryForItems(pin, state.cart);
  renderCartDeliveryStatuses(pin, check.results);

  const unavailable = check.results.filter(r => !r.available);

  if (check.allAvailable) {
    notice.style.display = 'flex';
    notice.className = 'cart-delivery-notice success';
    notice.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <span>All items can be delivered to PIN code <strong>${pin}</strong>.</span>`;
    if (checkoutBtn) checkoutBtn.disabled = false;
    return;
  }

  notice.style.display = 'block';
  notice.className = 'cart-delivery-notice error';
  notice.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
    <div>
      <strong>Some products in your cart cannot be delivered to ${pin}:</strong>
      <ul>${unavailable.map(r => `<li>${r.name}</li>`).join('')}</ul>
      <span>Please remove them or change your PIN code before proceeding to checkout.</span>
    </div>`;
  if (checkoutBtn) checkoutBtn.disabled = true;
}

async function updateQty(productId, change) {
  const item = state.cart.find(i => i.product_id === productId);
  if (!item) return;
  const newQ = item.quantity + change;
  if (newQ < 1) return removeItem(productId);
  try { await apiPut(`/cart/${productId}`, { quantity: newQ }); await loadCart(); } catch {}
}
async function removeItem(productId) {
  try { await apiDelete(`/cart/${productId}`); await loadCart(); } catch {}
}

// Disables/Enables the "Place Order" button and shows a blocking message based
// on the authoritative delivery check for the current checkout PIN code.
//   allAvailable === true  -> button enabled, no message
//   allAvailable === false -> button disabled + "please remove/change PIN" msg
//   undefined/null         -> unverified (no/partial PIN): leave enabled; the
//                             submit handler re-validates before creating the
//                             order.
function updatePlaceOrderState(allAvailable) {
  const btn = $('place-order-btn');
  const block = $('checkout-delivery-block');
  if (allAvailable === true) {
    if (btn) btn.disabled = false;
    if (block) block.style.display = 'none';
  } else if (allAvailable === false) {
    if (btn) btn.disabled = true;
    if (block) block.style.display = 'block';
  } else {
    if (btn) btn.disabled = false;
    if (block) block.style.display = 'none';
  }
}

// Shared handler for the checkout PIN / shipping-zip inputs. Keeps the two PIN
// fields in sync, invalidates the previous delivery result and re-runs the
// authoritative delivery check (debounced) once a full 6-digit PIN is entered,
// so the "Place Order" button reflects the very latest cart + PIN state.
function checkoutPinInputChanged(pinValue) {
  const pin = (pinValue || '').trim();
  const result = $('checkout-pin-result');
  if (result && result.dataset.valid !== 'unknown') {
    result.className = 'pincode-result';
    result.dataset.valid = 'unknown';
    result.textContent = '';
  }
  const list = $('checkout-availability-list');
  if (list) list.innerHTML = '';
  state.checkoutDelivery = null;
  if (pin.length === 6 && isValidPin(pin)) {
    scheduleCheckoutPinCheck();
  } else {
    updatePlaceOrderState(null);
  }
}

async function runCheckoutPinCheck() {
  const pinInput = $('checkout-pin-code');
  const result = $('checkout-pin-result');
  const list = $('checkout-availability-list');
  const pin = (pinInput.value || '').trim();

  if (!isValidPin(pin)) {
    state.checkoutDelivery = null;
    if (list) list.innerHTML = '';
    if (result) {
      result.className = 'pincode-result error';
      result.dataset.valid = 'invalid';
      result.textContent = 'Please enter a valid 6-digit Indian PIN code.';
    }
    updatePlaceOrderState(null);
    return;
  }

  const location = await lookupPinLocation(pin);
  if (location && location.notFound) {
    state.checkoutDelivery = null;
    if (list) list.innerHTML = '';
    if (result) {
      result.className = 'pincode-result error';
      result.dataset.valid = 'invalid';
      result.textContent = 'PIN code not found. Please enter a valid Indian PIN code.';
    }
    updatePlaceOrderState(null);
    return;
  }
  if (!location || location.error) {
    if (result) {
      result.className = 'pincode-result error';
      result.dataset.valid = 'invalid';
      result.textContent = 'Could not check this PIN code right now. Please try again.';
    }
    updatePlaceOrderState(null);
    return;
  }

  const check = await checkDeliveryForItems(pin, state.cart);
  state.checkoutDelivery = { pin, results: check.results, allAvailable: check.allAvailable };

  if (result) {
    result.className = check.allAvailable ? 'pincode-result success' : 'pincode-result error';
    result.dataset.valid = check.allAvailable ? 'valid' : 'invalid';
    result.textContent = check.allAvailable
      ? `✓ Delivery available to all items for PIN code ${pin}`
      : `✕ Some items are not available for delivery to PIN code ${pin}`;
  }

  if (list) {
    list.innerHTML = check.results.map(r => `
      <div class="availability-item ${r.available ? 'available' : 'unavailable'}">
        <span class="availability-name">${r.name}${r.quantity > 1 ? ` × ${r.quantity}` : ''}</span>
        <span class="availability-status">${r.available ? '✓ Available' : '✕ Not available for this PIN code'}</span>
      </div>`).join('');
  }

  updatePlaceOrderState(check.allAvailable);
}
const scheduleCheckoutPinCheck = debounce(runCheckoutPinCheck, 400);

// Coupon state
let appliedCoupon = null;
let appliedCouponCode = null;

// Quantity discount tiers
const QUANTITY_DISCOUNT_TIERS = [
  { minQty: 1, maxQty: 1, discount: 0 },
  { minQty: 2, maxQty: 2, discount: 5 },
  { minQty: 3, maxQty: 3, discount: 10 },
  { minQty: 4, maxQty: 4, discount: 10 },
  { minQty: 5, maxQty: Infinity, discount: 15 }
];

function getQuantityDiscountPercent(quantity) {
  const tier = QUANTITY_DISCOUNT_TIERS.find(t => quantity >= t.minQty && quantity <= t.maxQty);
  return tier ? tier.discount : 0;
}

function calculateQuantityDiscount(cart) {
  let totalDiscount = 0;
  for (const item of cart) {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.price) || 0;
    const itemSubtotal = price * qty;
    const discountPercent = getQuantityDiscountPercent(qty);
    if (discountPercent > 0) {
      totalDiscount += itemSubtotal * (discountPercent / 100);
    }
  }
  return Math.round(totalDiscount * 100) / 100;
}

function renderCheckout() {
  if (state.cart.length === 0) { showView('cart'); return; }
  const box = $('checkout-items');
  box.innerHTML = state.cart.map(i => `
    <div class="checkout-item"><span>${i.name} × ${i.quantity}</span><span>₹${(parseFloat(i.price) * i.quantity).toFixed(2)}</span></div>`).join('');
  const sub = state.cart.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0);
  
  // Calculate quantity discount
  const quantityDiscount = calculateQuantityDiscount(state.cart);
  
  // Calculate coupon discount
  let couponDiscount = 0;
  if (appliedCoupon) {
    couponDiscount = appliedCoupon.discount_amount || 0;
    $('checkout-discount').textContent = `-₹${couponDiscount.toFixed(2)}`;
    $('checkout-discount-row').style.display = 'flex';
  } else {
    $('checkout-discount-row').style.display = 'none';
  }
  
  // Show quantity discount row
  if (quantityDiscount > 0) {
    $('checkout-quantity-discount').textContent = `-₹${quantityDiscount.toFixed(2)}`;
    $('checkout-quantity-discount-row').style.display = 'flex';
  } else {
    $('checkout-quantity-discount-row').style.display = 'none';
  }
  
  const tax = sub * 0.08;
  const deliveryCharge = 0; // Free shipping
  
  // Final total: Subtotal - Coupon Discount - Quantity Discount + Delivery Charge + Tax
  const total = Number(sub) - Number(couponDiscount) - Number(quantityDiscount) + Number(deliveryCharge) + Number(tax);
  
  $('checkout-subtotal').textContent = `₹${sub.toFixed(2)}`;
  $('checkout-tax').textContent = `₹${tax.toFixed(2)}`;
  $('checkout-total').textContent = `₹${total.toFixed(2)}`;
  
  // Render applied coupon display
  renderAppliedCouponDisplay();
  
  // Prefill shipping fields ONLY from the currently logged-in user's actual
  // account data, and never overwrite what the customer has already typed.
  if (state.user) {
    if (!$('shipping-name').value && state.user.name) $('shipping-name').value = state.user.name;
    if (!$('shipping-email').value && state.user.email) $('shipping-email').value = state.user.email;
  }
  // Carry the PIN selected on the home page into checkout when no PIN is set yet.
  if (state.selectedPin && !$('checkout-pin-code').value) {
    $('checkout-pin-code').value = state.selectedPin;
    if (!$('shipping-zip').value) $('shipping-zip').value = state.selectedPin;
  }
  // Load and display saved addresses
  loadSavedAddresses().then(renderSavedAddresses);
  // Auto-run the authoritative delivery check so the "Place Order" button is
  // enabled/disabled based on the CURRENT cart + PIN before the customer can
  // even attempt to submit. Keep it disabled while the check is in flight.
  const pin = ($('checkout-pin-code').value || '').trim();
  if (isValidPin(pin)) {
    const btn = $('place-order-btn');
    if (btn) btn.disabled = true;
    runCheckoutPinCheck();
  } else {
    state.checkoutDelivery = null;
    updatePlaceOrderState(null);
  }
  
  // Setup coupon apply button
  setupCouponApply();
}

function renderAppliedCouponDisplay() {
  const couponDisplay = $('checkout-coupon-display');
  if (!couponDisplay) return;
  
  if (appliedCoupon && appliedCouponCode) {
    const discountLabel = appliedCoupon.discount_type === 'percentage' 
      ? `${appliedCoupon.discount_value}% OFF` 
      : `₹${appliedCoupon.discount_value} OFF`;
    couponDisplay.innerHTML = `
      <div class="applied-coupon-badge" style="display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3); background: rgba(16, 185, 129, 0.1); border: 1px solid var(--success); border-radius: var(--radius-md); margin-top: var(--space-3);">
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--success);"><polyline points="20 6 9 17 4 12"/></svg>
          <div>
            <div style="font-weight: 600; color: var(--success); font-size: var(--fs-sm);">Coupon Applied</div>
            <div style="font-size: var(--fs-xs); color: var(--text-light);">${appliedCouponCode} — ${discountLabel}</div>
          </div>
        </div>
        <button type="button" id="checkout-coupon-remove" class="btn btn-secondary btn-sm" style="padding: var(--space-1) var(--space-3); font-size: var(--fs-xs);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          Remove
        </button>
      </div>
    `;
    const removeBtn = $('checkout-coupon-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', removeAppliedCoupon);
    }
    // Hide the input section
    const couponInputSection = document.querySelector('.checkout-coupon .pincode-input-row');
    if (couponInputSection) couponInputSection.style.display = 'none';
    const couponResult = $('checkout-coupon-result');
    if (couponResult) couponResult.style.display = 'none';
  } else {
    couponDisplay.innerHTML = '';
    // Show the input section
    const couponInputSection = document.querySelector('.checkout-coupon .pincode-input-row');
    if (couponInputSection) couponInputSection.style.display = 'flex';
    const couponResult = $('checkout-coupon-result');
    if (couponResult) couponResult.style.display = 'block';
  }
}

function setupCouponApply() {
  const applyBtn = $('checkout-coupon-apply');
  const couponInput = $('checkout-coupon-code');
  const couponResult = $('checkout-coupon-result');
  const couponDisplay = $('checkout-coupon-display');
  
  if (!applyBtn || !couponInput) return;
  
  // Remove existing listeners
  const newApplyBtn = applyBtn.cloneNode(true);
  applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
  
  newApplyBtn.addEventListener('click', async () => {
    const code = couponInput.value.trim().toUpperCase();
    if (!code) {
      couponResult.className = 'pincode-result error';
      couponResult.dataset.valid = 'invalid';
      couponResult.textContent = 'Please enter a coupon code';
      return;
    }
    
    const sub = state.cart.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0);
    newApplyBtn.disabled = true;
    newApplyBtn.textContent = 'Applying...';
    couponResult.className = 'pincode-result';
    couponResult.dataset.valid = 'unknown';
    couponResult.textContent = '';
    
    try {
      const data = await apiPost('/coupons/validate', { code, cart_subtotal: sub });
      if (data.valid) {
        appliedCoupon = {
          code: data.coupon.code,
          discount_amount: data.discount_amount,
          discount_type: data.coupon.discount_type,
          discount_value: data.coupon.discount_value
        };
        appliedCouponCode = code;
        couponResult.className = 'pincode-result success';
        couponResult.dataset.valid = 'valid';
        couponResult.textContent = `✓ Coupon Applied — ${data.coupon.discount_type === 'percentage' ? data.coupon.discount_value + '% OFF' : '₹' + data.coupon.discount_value + ' OFF'}`;
        couponInput.value = code;
        renderCheckout(); // Re-render to show discount with remove button
      } else {
        appliedCoupon = null;
        appliedCouponCode = null;
        couponResult.className = 'pincode-result error';
        couponResult.dataset.valid = 'invalid';
        couponResult.textContent = formatCouponError(data.error);
        renderCheckout(); // Re-render to hide discount
      }
    } catch (err) {
      appliedCoupon = null;
      appliedCouponCode = null;
      couponResult.className = 'pincode-result error';
      couponResult.dataset.valid = 'invalid';
      couponResult.textContent = formatCouponError(err.message);
      renderCheckout();
    } finally {
      newApplyBtn.disabled = false;
      newApplyBtn.textContent = 'Apply';
    }
  });
  
  // Allow Enter key to apply coupon
  const newCouponInput = couponInput.cloneNode(true);
  couponInput.parentNode.replaceChild(newCouponInput, couponInput);
  newCouponInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      newApplyBtn.click();
    }
  });
}

function removeAppliedCoupon() {
  appliedCoupon = null;
  appliedCouponCode = null;
  renderCheckout();
}

function formatCouponError(error) {
  if (!error) return 'Invalid coupon code.';
  const msg = error.toLowerCase();
  if (msg.includes('expired')) return 'This coupon has expired.';
  if (msg.includes('not yet valid') || msg.includes('start')) return 'This coupon is not yet valid.';
  if (msg.includes('inactive') || msg.includes('unavailable')) return 'This coupon is currently unavailable.';
  if (msg.includes('minimum order') || msg.includes('min_order')) return 'Minimum order value for this coupon is not met.';
  if (msg.includes('already used') || msg.includes('per_user') || msg.includes('per user')) return 'You have already used this coupon.';
  if (msg.includes('usage limit') || msg.includes('usage_limit') || msg.includes('reached')) return 'This coupon has reached its usage limit.';
  if (msg.includes('invalid')) return 'Invalid coupon code.';
  return error;
}

// Render saved addresses in the checkout section
function renderSavedAddresses() {
  const container = $('saved-addresses-list');
  if (!container) return;

  if (state.savedAddresses.length === 0) {
    container.innerHTML = '<p style="color: var(--text-light); font-size: var(--fs-sm); padding: var(--space-3);">No saved addresses yet. Click "+ Add New Address" to add one.</p>';
    return;
  }

  container.innerHTML = state.savedAddresses.map(addr => {
    const isDefault = addr.is_default === 1;
    const isSelected = state.selectedAddressId === addr.id;
    const fullAddress = [
      addr.address_line,
      addr.area,
      addr.city,
      addr.state,
      `PIN: ${addr.pincode}`
    ].filter(Boolean).join(', ');

    return `
      <div class="saved-address-card ${isDefault ? 'default' : ''} ${isSelected ? 'selected' : ''}" data-id="${addr.id}">
        <div class="saved-address-radio" aria-hidden="true"></div>
        <div class="saved-address-info">
          <div class="saved-address-header">
            <span class="saved-address-name">${escapeHtml(addr.name)}</span>
            ${isDefault ? '<span class="saved-address-default-badge">Default</span>' : ''}
          </div>
          <div class="saved-address-details">
            ${escapeHtml(addr.address_line)}<br>
            ${addr.area ? escapeHtml(addr.area) + '<br>' : ''}
            ${escapeHtml(addr.city)}, ${escapeHtml(addr.state)}<br>
            <span class="saved-address-pincode">PIN: ${escapeHtml(addr.pincode)}</span>
          </div>
        </div>
        <div class="saved-address-actions">
          <button type="button" class="saved-address-action-btn ${isSelected ? 'primary' : ''} select-address-btn" data-id="${addr.id}">
            ${isSelected ? '✓ Selected' : 'Select'}
          </button>
          ${!isDefault ? `<button type="button" class="saved-address-action-btn set-default-btn" data-id="${addr.id}">Set as Default</button>` : ''}
          <button type="button" class="saved-address-action-btn edit-address-btn" data-id="${addr.id}">Edit</button>
          <button type="button" class="saved-address-action-btn delete-address-btn" data-id="${addr.id}">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  // Bind events
  container.querySelectorAll('.select-address-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectAddress(parseInt(btn.dataset.id));
    });
  });

  container.querySelectorAll('.set-default-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await setDefaultAddressHandler(parseInt(btn.dataset.id));
    });
  });

  container.querySelectorAll('.edit-address-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openAddressModal('edit', parseInt(btn.dataset.id));
    });
  });

  container.querySelectorAll('.delete-address-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to delete this address?')) {
        await deleteAddressHandler(parseInt(btn.dataset.id));
      }
    });
  });

  // Also make the card clickable for selection
  container.querySelectorAll('.saved-address-card').forEach(card => {
    card.addEventListener('click', () => {
      selectAddress(parseInt(card.dataset.id));
    });
  });
}

// Select an address and fill the shipping form
function selectAddress(addressId) {
  const addr = state.savedAddresses.find(a => a.id === addressId);
  if (!addr) return;

  state.selectedAddressId = addressId;

  // Fill the shipping form
  $('shipping-name').value = addr.name;
  $('shipping-address').value = addr.address_line;
  $('shipping-city').value = addr.city;
  $('shipping-state').value = addr.state;
  $('shipping-zip').value = addr.pincode;
  $('shipping-country').value = addr.country || 'IN';

  // Also update the checkout PIN code field
  $('checkout-pin-code').value = addr.pincode;

  // Re-render to show selection
  renderSavedAddresses();

  // Re-run delivery check with new PIN
  checkoutPinInputChanged(addr.pincode);

  toast(`Selected: ${addr.name}`, 'success');
}

// Set address as default
async function setDefaultAddressHandler(addressId) {
  try {
    const updated = await setDefaultAddress(addressId);
    if (updated) {
      await loadSavedAddresses();
      renderSavedAddresses();
      toast('Default address updated', 'success');
    }
  } catch (e) {
    toast('Failed to set default address', 'error');
  }
}

// Delete address
async function deleteAddressHandler(addressId) {
  try {
    await deleteAddress(addressId);
    if (state.selectedAddressId === addressId) {
      state.selectedAddressId = null;
    }
    await loadSavedAddresses();
    renderSavedAddresses();
    toast('Address deleted', 'success');
  } catch (e) {
    toast('Failed to delete address', 'error');
  }
}

// Open address modal (add/edit)
function openAddressModal(mode, addressId = null) {
  state.addressModalMode = mode;
  state.editingAddressId = addressId;

  const modal = $('address-modal');
  const form = $('address-form');
  const title = $('address-modal-title');
  const saveBtn = $('address-save');

  form.reset();
  hideErrors();

  if (mode === 'edit' && addressId) {
    const addr = state.savedAddresses.find(a => a.id === addressId);
    if (addr) {
      title.textContent = 'Edit Address';
      saveBtn.querySelector('.btn-text').textContent = 'Update Address';
      $('address-name').value = addr.name;
      $('address-phone').value = addr.phone || '';
      $('address-line').value = addr.address_line;
      $('address-area').value = addr.area || '';
      $('address-city').value = addr.city;
      $('address-pincode').value = addr.pincode;
      $('address-state').value = addr.state;
      $('address-country').value = addr.country || 'IN';
      $('address-set-default').checked = addr.is_default === 1;
    }
  } else {
    title.textContent = 'Add New Address';
    saveBtn.querySelector('.btn-text').textContent = 'Save Address';
    // Pre-fill name from user if available
    if (state.user && state.user.name) {
      $('address-name').value = state.user.name;
    }
    $('address-country').value = 'IN';
  }

  modal.style.display = 'flex';
  setTimeout(() => $('address-name').focus(), 100);
}

// Close address modal
function closeAddressModal() {
  $('address-modal').style.display = 'none';
  $('address-form').reset();
  state.addressModalMode = 'add';
  state.editingAddressId = null;
}

// Save address (create or update)
async function saveAddressHandler(e) {
  e.preventDefault();
  hideErrors();

  const formData = {
    name: $('address-name').value.trim(),
    phone: $('address-phone').value.trim(),
    address_line: $('address-line').value.trim(),
    area: $('address-area').value.trim() || null,
    city: $('address-city').value.trim(),
    state: $('address-state').value.trim(),
    pincode: $('address-pincode').value.trim(),
    country: $('address-country').value.trim(),
    is_default: $('address-set-default').checked
  };

  // Validate required fields
  if (!formData.name || !formData.phone || !formData.address_line || !formData.city || !formData.state || !formData.pincode) {
    return showError('address-error', 'Please fill all required fields');
  }

  // Validate PIN code
  if (!isValidPin(formData.pincode)) {
    return showError('address-error', 'Please enter a valid 6-digit Indian PIN code');
  }

  const btn = $('address-save');
  btn.querySelector('.btn-text').style.display = 'none';
  btn.querySelector('.btn-loading').style.display = 'inline-flex';
  btn.disabled = true;

  try {
    let result;
    if (state.addressModalMode === 'edit' && state.editingAddressId) {
      result = await updateAddress(state.editingAddressId, formData);
    } else {
      result = await createAddress(formData);
    }

    if (result) {
      closeAddressModal();
      await loadSavedAddresses();
      renderSavedAddresses();

      // If this is the first address or set as default, auto-select it
      if (state.addressModalMode === 'add' && (result.is_default || state.savedAddresses.length === 1)) {
        selectAddress(result.id);
      } else if (state.addressModalMode === 'edit' && result.is_default) {
        selectAddress(result.id);
      }

      toast(state.addressModalMode === 'edit' ? 'Address updated' : 'Address saved', 'success');
    }
  } catch (err) {
    showError('address-error', err.message || 'Failed to save address');
  } finally {
    btn.querySelector('.btn-text').style.display = 'inline';
    btn.querySelector('.btn-loading').style.display = 'none';
    btn.disabled = false;
  }
}

async function handleCheckout(e) {
  e.preventDefault(); hideErrors();
  const address = `${$('shipping-name').value}, ${$('shipping-address').value}, ${$('shipping-city').value}, ${$('shipping-state').value} ${$('shipping-zip').value}, ${$('shipping-country').value}`;
  if (!$('shipping-name').value || !$('shipping-address').value || !$('shipping-city').value || !$('shipping-zip').value) {
    return showError('checkout-error', 'Please fill all required fields');
  }

  // Delivery validation: require a valid PIN code and every item must be deliverable.
  const zip = ($('shipping-zip').value || '').trim();
  const pin = (($('checkout-pin-code').value) || '').trim() || zip;
  if (!isValidPin(pin)) {
    return showError('checkout-error', 'Please enter a valid 6-digit Indian PIN code');
  }
  if ($('checkout-pin-code').value !== pin) $('checkout-pin-code').value = pin;
  // Final authoritative delivery validation for the ENTIRE cart against the
  // entered PIN code. If ANY product is not deliverable the order is blocked.
  const check = await checkDeliveryForItems(pin, state.cart);
  if (!check.allAvailable) {
    const names = check.results.filter(r => !r.available).map(r => r.name).join(', ');
    updatePlaceOrderState(false);
    return showError('checkout-error', `Some products in your cart cannot be delivered to ${pin}: ${names || 'one or more items'}. Please remove them or change your PIN code.`);
  }
  updatePlaceOrderState(true);

  const btn = $('place-order-btn');
  btn.querySelector('.btn-text').style.display = 'none';
  btn.querySelector('.btn-loading').style.display = 'inline-flex';
  btn.disabled = true;
  try {
    const r = await apiPost('/orders', {
      shipping_address: address,
      email: $('shipping-email').value.trim(),
      pin_code: pin,
      phone: $('shipping-phone').value.trim(),
      coupon_code: appliedCoupon ? appliedCoupon.code : undefined
    });
    if (r.error) { showError('checkout-error', r.error); }
    else {
      const deliveryDate = getDeliveryDate();
      const orderItems = state.cart.map(item => `
        <div class="order-confirm-item">
          <img src="${item.image_url}" alt="${item.name}" class="order-confirm-img" onerror="imgFallback(this)">
          <div class="order-confirm-details">
            <h4>${item.name}</h4>
            <span>Qty: ${item.quantity} × ₹${parseFloat(item.price).toFixed(2)}</span>
          </div>
        </div>
      `).join('');
      
      // Use backend calculated values for accuracy
      const sub = Number(r.subtotal) || state.cart.reduce((s, i) => s + parseFloat(i.price) * i.quantity, 0);
      const tax = Number(r.tax_amount) || (sub * 0.08);
      const couponDiscount = Number(r.discount_amount) || (appliedCoupon ? appliedCoupon.discount_amount : 0);
      const quantityDiscount = Number(r.quantity_discount) || 0;
      const deliveryCharge = Number(r.delivery_charge) || 0;
      const finalTotal = Number(r.total_amount) || 0;
      
      let discountHtml = '';
      if (couponDiscount > 0) {
        discountHtml += `
          <div class="order-confirm-row discount">
            <span>Coupon Discount${appliedCoupon ? ` (${appliedCoupon.code})` : ''}</span>
            <span style="color: var(--success);">-₹${couponDiscount.toFixed(2)}</span>
          </div>
        `;
      }
      if (quantityDiscount > 0) {
        discountHtml += `
          <div class="order-confirm-row discount">
            <span>Quantity Discount</span>
            <span style="color: var(--success);">-₹${quantityDiscount.toFixed(2)}</span>
          </div>
        `;
      }
      
      $('checkout-success').innerHTML = `
        <div class="order-confirmation">
          <div class="confirm-icon">✓</div>
          <h3>Order Confirmed</h3>
          <p class="order-id">Order #${r.id}</p>
          <div class="order-confirm-items">${orderItems}</div>
          <div class="order-confirm-summary">
            <div class="order-confirm-row"><span>Subtotal</span><span>₹${sub.toFixed(2)}</span></div>
            ${discountHtml}
            <div class="order-confirm-row"><span>Shipping</span><span>${deliveryCharge === 0 ? 'Free' : '₹' + deliveryCharge.toFixed(2)}</span></div>
            <div class="order-confirm-row"><span>Tax</span><span>₹${tax.toFixed(2)}</span></div>
            <div class="order-confirm-row total"><span>Total</span><span>₹${finalTotal.toFixed(2)}</span></div>
          </div>
          <div class="order-confirm-delivery">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Expected delivery by <strong>${deliveryDate}</strong></span>
          </div>
          <div class="order-confirm-address">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span><strong>Shipping Address:</strong> ${escapeHtml($('shipping-address').value.trim())}, ${escapeHtml($('shipping-city').value.trim())}, ${escapeHtml($('shipping-state').value.trim())} ${escapeHtml($('shipping-zip').value.trim())}, ${escapeHtml($('shipping-country').value.trim())}</span>
          </div>
          <p class="confirm-email">Confirmation sent to ${escapeHtml($('shipping-email').value.trim())}</p>
        </div>
      `;
      $('checkout-success').style.display = 'block';
      state.cart = []; state.checkoutDelivery = null; appliedCoupon = null; updateCartCount(); await loadOrders();
      setTimeout(() => { $('checkout-form').reset(); showView('orders'); }, 3000);
    }
  } catch (err) { showError('checkout-error', err.message || 'Failed to place order'); }
  finally { btn.querySelector('.btn-text').style.display = 'inline'; btn.querySelector('.btn-loading').style.display = 'none'; btn.disabled = false; }
}async function loadOrders() {
  if (!state.user) { state.orders = []; $('orders-loading').style.display = 'none'; $('no-orders').style.display = 'block'; return; }
  $('orders-loading').style.display = 'block'; $('orders-list').innerHTML = ''; $('no-orders').style.display = 'none';
  try {
    const orders = await apiGet('/orders');
    state.orders = Array.isArray(orders) ? orders : [];
    $('orders-loading').style.display = 'none';
    if (state.orders.length === 0) { $('no-orders').style.display = 'block'; return; }

    const statusMeta = {
      pending:    { label: 'Pending',    color: '#f59e0b', bg: '#fffbeb', icon: '🕐' },
      processing: { label: 'Processing', color: '#3b82f6', bg: '#eff6ff', icon: '⚙️' },
      shipped:    { label: 'Shipped',    color: '#8b5cf6', bg: '#f5f3ff', icon: '🚚' },
      delivered:  { label: 'Delivered',  color: '#10b981', bg: '#ecfdf5', icon: '✓' },
      cancelled:  { label: 'Cancelled',  color: '#ef4444', bg: '#fef2f2', icon: '✕' },
    };

    $('orders-list').innerHTML = orders.map(o => {
      const sm = statusMeta[o.status] || { label: o.status, color: '#64748b', bg: '#f8fafc', icon: '•' };
      const orderDate = new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const orderTime = new Date(o.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const itemsList = (o.items && o.items.length > 0) ? o.items : [{ name: 'Product', image_url: '', quantity: 1, price: 0 }];

      const itemsHtml = itemsList.map(it => `
        <div class="fk-product-row">
          <div class="fk-product-img-wrap">
            <img class="fk-product-img" src="${it.image_url}" alt="${it.name}" onerror="imgFallback(this)">
          </div>
          <div class="fk-product-info">
            <div class="fk-product-name">${it.name}</div>
            <div class="fk-product-meta">
              <span class="fk-qty-badge">Qty: ${it.quantity}</span>
              <span class="fk-dot">•</span>
              <span class="fk-price-tag">₹${parseFloat(it.price || 0).toFixed(2)}</span>
              <span class="fk-dot">•</span>
              <span class="fk-order-num">Order #${o.id}</span>
            </div>
            <div class="fk-order-datetime">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${orderDate} &nbsp;
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${orderTime}
            </div>
          </div>
        </div>
      `).join('');

      return `
      <div class="fk-order-card" data-id="${o.id}">
        <div class="fk-order-left">
          ${itemsHtml}
        </div>
        <div class="fk-order-right">
          <span class="fk-status-badge" style="color:${sm.color};background:${sm.bg};">
            ${sm.icon} ${sm.label}
          </span>
          <div class="fk-order-amount">₹${parseFloat(o.total_amount).toFixed(2)}</div>
          <button class="fk-view-btn view-order" data-id="${o.id}">View Details</button>
        </div>
      </div>`;
    }).join('');

    $('orders-list').querySelectorAll('.view-order').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); openOrder(parseInt(b.dataset.id)); }));
  } catch { $('orders-loading').style.display = 'none'; }
}

async function toggleOrder(card) {
  const id = parseInt(card.dataset.id);
  const box = $(`order-items-${id}`);
  if (card.classList.contains('expanded')) { card.classList.remove('expanded'); return; }
  if (!box.innerHTML) {
    try {
      const o = await apiGet(`/orders/${id}`);
      box.innerHTML = o.items.map(it => `
        <div class="order-item">
          <img class="order-item-img" src="${it.image_url}" alt="" onerror="this.style.background='#eee'">
          <div class="order-item-info">
            <div class="order-item-name">${it.name}</div>
            <div class="order-item-meta"><span>Qty: ${it.quantity}</span><span>₹${parseFloat(it.price).toFixed(2)} each</span></div>
          </div>
          <div class="order-item-price">₹${(parseFloat(it.price) * it.quantity).toFixed(2)}</div>
        </div>`).join('');
    } catch {}
  }
  card.classList.add('expanded');
}

async function openOrder(id) {
  try {
    const o = await apiGet(`/orders/${id}`);
    const statuses = ['pending', 'processing', 'shipped', 'delivered'];
    const idx = statuses.indexOf(o.status);
    const isDelivered = o.status === 'delivered';
    
    let currentUserReview = null;
    if (state.user && o.items && o.items.length > 0) {
      try {
        const reviewsRes = await apiGet(`/products/${o.items[0].product_id}/reviews`);
        if (reviewsRes && reviewsRes.reviews) {
          currentUserReview = reviewsRes.reviews.find(r => r.is_current_user);
        }
      } catch (_) {}
    }
    
    $('order-detail').innerHTML = `
      <div class="order-detail-header">
        <div><h2 id="modal-order-title">Order #${o.id}</h2><div class="order-date">${fmtDate(o.created_at)}</div></div>
        <span class="order-status status-${o.status}">${o.status}</span>
      </div>
      <div class="order-detail-grid">
        <div class="order-detail-field"><span class="order-detail-label">Payment</span><span class="order-detail-value">${(o.payment_method || 'cod').toUpperCase()}</span></div>
        <div class="order-detail-field"><span class="order-detail-label">Address</span><span class="order-detail-value">${o.shipping_address}</span></div>
        <div class="order-detail-field"><span class="order-detail-label">Total</span><span class="order-detail-value">₹${parseFloat(o.total_amount).toFixed(2)}</span></div>
        <div class="order-detail-field"><span class="order-detail-label">Items</span><span class="order-detail-value">${o.items.length}</span></div>
      </div>
      <div class="order-detail-items">
        ${o.items.map(it => `
          <div class="order-detail-item">
            <img class="order-detail-item-img" src="${it.image_url}" alt="" onerror="this.style.background='#eee'">
            <div class="order-detail-item-info">
              <div class="order-detail-item-name">${it.name}</div>
              <div class="order-detail-item-meta"><span>Qty: ${it.quantity}</span><span>₹${parseFloat(it.price).toFixed(2)} each</span></div>
            </div>
            <div class="order-detail-item-price">₹${(parseFloat(it.price) * it.quantity).toFixed(2)}</div>
            ${isDelivered ? `
              <button class="btn btn-secondary btn-sm rate-review-item-btn" 
                data-order-id="${o.id}" 
                data-product-id="${it.product_id}" 
                data-product-name="${escapeHtml(it.name)}"
                data-product-image="${it.image_url || ''}"
                ${currentUserReview && currentUserReview.product_id === it.product_id ? 'data-reviewed="true"' : ''}
                aria-label="${currentUserReview && currentUserReview.product_id === it.product_id ? 'Update review for' : 'Rate & Review'} ${escapeHtml(it.name)}">
                ${currentUserReview && currentUserReview.product_id === it.product_id ? '✏️ Update Review' : '⭐ Rate & Review'}
              </button>
            ` : ''}
          </div>`).join('')}
      </div>
      <div class="order-timeline">
        <h3>Status Timeline</h3>
        ${statuses.map((s, i) => `
          <div class="timeline-step ${i < idx ? 'completed' : i === idx ? 'active' : ''}">
            <div class="timeline-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
            <div class="timeline-content"><div class="timeline-title">${s.charAt(0).toUpperCase() + s.slice(1)}</div><div class="timeline-time">${i <= idx ? fmtDate(o.updated_at || o.created_at) : 'Pending'}</div></div>
          </div>`).join('')}
      </div>
      <div class="order-detail-actions">
        <button class="btn btn-secondary" id="btn-print-invoice" data-order-id="${o.id}">🖨️ Print Invoice</button>
        <button class="btn btn-primary" id="btn-download-invoice" data-order-id="${o.id}">📥 Download Invoice</button>
      </div>`;
    
    $('order-modal').style.display = 'flex';
    
    const printBtn = $('btn-print-invoice');
    const downloadBtn = $('btn-download-invoice');
    
    if (printBtn) printBtn.addEventListener('click', () => handlePrintInvoice(o));
    if (downloadBtn) downloadBtn.addEventListener('click', () => handleDownloadInvoice(o));
    
    if (isDelivered) {
      document.querySelectorAll('.rate-review-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const productId = parseInt(btn.dataset.productId);
          const productName = btn.dataset.productName;
          const productImage = btn.dataset.productImage;
          const orderId = parseInt(btn.dataset.orderId);
          handleRateReview(productId, productName, productImage, orderId);
        });
      });
    }
  } catch (e) { console.error(e); }
}

function handleRateReview(productId, productName, productImage, orderId) {
  closeModals();
  if (productId) {
    openRateReviewModal(productId, productName, productImage, orderId);
  } else {
    toast('No product found to review', 'error');
  }
}

function handlePrintInvoice(order) {
  const printWindow = window.open('', '_blank');
  const invoiceHtml = generateInvoiceHtml(order);
  printWindow.document.write(invoiceHtml);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function handleDownloadInvoice(order) {
  try {
    console.log('Starting PDF generation for order:', order.id);
    generateAndDownloadPdfInvoice(order);
    toast('Invoice downloaded successfully', 'success');
  } catch (err) {
    console.error('PDF generation error:', err);
    console.error('Error stack:', err.stack);
    toast('Failed to generate invoice PDF: ' + (err.message || err), 'error');
  }
}

function generateInvoiceHtml(order) {
  const user = state.user || {};
  const orderDate = new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const subtotal = order.items.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
  const tax = subtotal * 0.08;
  // Temporarily ignore discount calculations
  // const discount = parseFloat(order.discount_amount) || 0;
  const discount = 0;
  const shipping = parseFloat(order.delivery_charge) || 0;
  const total = parseFloat(order.total_amount);
  
  const addressParts = order.shipping_address ? order.shipping_address.split(',').map(s => s.trim()) : [];
  const shippingAddress = addressParts.join('<br>');
  
  let itemsHtml = '';
  order.items.forEach((item, index) => {
    const itemTotal = parseFloat(item.price) * item.quantity;
    itemsHtml += `
      <tr>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${index + 1}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <img src="${item.image_url}" alt="${escapeHtml(item.name)}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; background: #f1f5f9;" onerror="this.style.display='none'">
            <span>${escapeHtml(item.name)}</span>
          </div>
        </td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">₹${parseFloat(item.price).toFixed(2)}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right;">₹${itemTotal.toFixed(2)}</td>
      </tr>`;
  });
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Invoice - Order #${order.id}</title>
      <style>
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; color: #1e293b; font-size: 12px; }
        .invoice-container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2563eb; }
        .logo { display: flex; align-items: center; gap: 10px; color: #2563eb; font-weight: 700; font-size: 24px; }
        .logo svg { width: 32px; height: 32px; }
        .invoice-title { text-align: right; }
        .invoice-title h1 { margin: 0; font-size: 28px; color: #1e293b; }
        .invoice-title p { margin: 5px 0 0; color: #64748b; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
        .info-box h3 { margin: 0 0 10px; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-box p { margin: 4px 0; font-size: 13px; line-height: 1.6; }
        .info-box .label { color: #64748b; font-weight: 500; }
        .info-box .value { color: #1e293b; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f8fafc; padding: 10px 8px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; border: 1px solid #e2e8f0; }
        th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: right; }
        td { font-size: 12px; }
        .totals { width: 100%; max-width: 350px; margin-left: auto; }
        .totals table { width: 100%; }
        .totals td { padding: 8px 12px; border: none; border-bottom: 1px solid #e2e8f0; }
        .totals td:first-child { text-align: left; color: #64748b; }
        .totals td:last-child { text-align: right; font-weight: 600; color: #1e293b; }
        .totals .total-row td { border-top: 2px solid #2563eb; border-bottom: none; font-size: 14px; font-weight: 700; color: #2563eb; padding-top: 12px; }
        .footer-note { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 13px; }
        .footer-note p { margin: 4px 0; }
        @media print { body { padding: 0; } .invoice-container { padding: 0; box-shadow: none; } }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          <div class="logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 6H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/><path d="M3.5 12h17"/><path d="M12 8v8"/></svg>
            <span>ShopEase</span>
          </div>
          <div class="invoice-title">
            <h1>INVOICE</h1>
            <p>Order #${order.id}</p>
          </div>
        </div>
        
        <div class="info-grid">
          <div class="info-box">
            <h3>Bill To</h3>
            <p><span class="label">Name:</span> <span class="value">${escapeHtml(user.name || 'Customer')}</span></p>
            <p><span class="label">Email:</span> <span class="value">${escapeHtml(user.email || '')}</span></p>
            <p><span class="label">Phone:</span> <span class="value">${escapeHtml(user.phone || 'N/A')}</span></p>
            <p><span class="label">Address:</span> <span class="value">${shippingAddress || 'N/A'}</span></p>
          </div>
          <div class="info-box">
            <h3>Order Details</h3>
            <p><span class="label">Order ID:</span> <span class="value">#${order.id}</span></p>
            <p><span class="label">Order Date:</span> <span class="value">${orderDate}</span></p>
            <p><span class="label">Payment Method:</span> <span class="value">${(order.payment_method || 'cod').toUpperCase()}</span></p>
            <p><span class="label">Delivery Status:</span> <span class="value">${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span></p>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">#</th>
              <th style="width: 40%;">Product</th>
              <th style="width: 10%; text-align: center;">Qty</th>
              <th style="width: 20%; text-align: right;">Price</th>
              <th style="width: 20%; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div class="totals">
          <table>
            <tr><td>Subtotal</td><td>₹${subtotal.toFixed(2)}</td></tr>
            <!-- Temporarily ignore discount row -->
            <!-- ${discount > 0 ? `<tr><td>Coupon Discount</td><td style="color: #10b981;">-₹${discount.toFixed(2)}</td></tr>` : ''} -->
            <tr><td>Shipping</td><td>${shipping === 0 ? 'Free' : '₹' + shipping.toFixed(2)}</td></tr>
            <tr><td>Tax (8%)</td><td>₹${tax.toFixed(2)}</td></tr>
            <tr class="total-row"><td>Total</td><td>₹${total.toFixed(2)}</td></tr>
          </table>
        </div>
        
        <div class="footer-note">
          <p><strong>Thank you for shopping with ShopEase!</strong></p>
          <p>For any queries, contact us at support@shopease.com</p>
        </div>
      </div>
    </body>
    </html>`;
}

function generateAndDownloadPdfInvoice(order) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  
  const user = state.user || {};
  const orderDate = new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const subtotal = order.items.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
  const tax = subtotal * 0.08;
  // Temporarily ignore discount calculations
  // const discount = parseFloat(order.discount_amount) || 0;
  const discount = 0;
  const shipping = parseFloat(order.delivery_charge) || 0;
  const total = parseFloat(order.total_amount);
  
  const addressParts = order.shipping_address ? order.shipping_address.split(',').map(s => s.trim()) : [];
  const shippingAddress = addressParts.join(', ');
  
  let y = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  
  // Header with logo and invoice title
  doc.setFontSize(24);
  doc.setTextColor(37, 99, 235); // Primary blue
  doc.setFont('helvetica', 'bold');
  doc.text('ShopEase', margin, y);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Premium Online Shopping', margin, y + 5);
  
  // Invoice title on right
  doc.setFontSize(28);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  const invoiceTitleWidth = doc.getTextWidth('INVOICE');
  doc.text('INVOICE', pageWidth - margin - invoiceTitleWidth, y);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  const orderIdText = `Order #${order.id}`;
  const orderIdWidth = doc.getTextWidth(orderIdText);
  doc.text(orderIdText, pageWidth - margin - orderIdWidth, y + 6);
  
  y += 20;
  
  // Horizontal line
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;
  
  // Bill To and Order Details sections
  const boxHeight = 50;
  const boxWidth = contentWidth / 2 - 5;
  
  // Bill To box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, boxWidth, boxHeight, 3, 3, 'F');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', margin + 4, y + 6);
  
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${user.name || 'Customer'}`, margin + 4, y + 13);
  doc.text(`Email: ${user.email || 'N/A'}`, margin + 4, y + 19);
  doc.text(`Phone: ${user.phone || 'N/A'}`, margin + 4, y + 25);
  
  // Split address into multiple lines if needed
  const addressLines = doc.splitTextToSize(`Address: ${shippingAddress || 'N/A'}`, boxWidth - 8);
  let addrY = y + 31;
  addressLines.forEach((line, i) => {
    if (addrY + 5 < y + boxHeight - 3) {
      doc.text(line, margin + 4, addrY);
      addrY += 5;
    }
  });
  
  // Order Details box
  const rightBoxX = margin + boxWidth + 10;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightBoxX, y, boxWidth, boxHeight, 3, 3, 'F');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDER DETAILS', rightBoxX + 4, y + 6);
  
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.text(`Order ID: #${order.id}`, rightBoxX + 4, y + 13);
  doc.text(`Order Date: ${orderDate}`, rightBoxX + 4, y + 19);
  doc.text(`Payment: ${(order.payment_method || 'cod').toUpperCase()}`, rightBoxX + 4, y + 25);
  doc.text(`Status: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}`, rightBoxX + 4, y + 31);
  
  y += boxHeight + 10;
  
  // Items table
  const tableHeaders = ['#', 'Product', 'Qty', 'Price', 'Total'];
  const tableData = order.items.map((item, index) => [
    String(index + 1),
    item.name,
    String(item.quantity),
    `${parseFloat(item.price).toFixed(2)}`,
    `${(parseFloat(item.price) * item.quantity).toFixed(2)}`
  ]);
  
  // Define common column widths and positions for both table and totals
  const colWidths = [
    contentWidth * 0.08,
    contentWidth * 0.40,
    contentWidth * 0.12,
    contentWidth * 0.20,
    contentWidth * 0.20
  ];
  const colX = [margin];
  for (let i = 1; i < colWidths.length; i++) {
    colX[i] = colX[i-1] + colWidths[i-1];
  }
  
  // Check if autoTable is available (jspdf-autotable plugin)
  if (typeof doc.autoTable === 'function') {
    doc.autoTable({
      startY: y,
      head: [[
        { content: '#', styles: { halign: 'center' } },
        { content: 'Product', styles: { halign: 'left' } },
        { content: 'Qty', styles: { halign: 'center' } },
        { content: 'Price', styles: { halign: 'right' } },
        { content: 'Total', styles: { halign: 'right' } }
      ]],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: colWidths[0] },
        1: { halign: 'left', cellWidth: colWidths[1] },
        2: { halign: 'center', cellWidth: colWidths[2] },
        3: { halign: 'right', cellWidth: colWidths[3] },
        4: { halign: 'right', cellWidth: colWidths[4] }
      },
      margin: { left: margin, right: margin },
      styles: { cellPadding: 4 },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });
    
    y = doc.lastAutoTable.finalY + 8;
  } else {
    console.warn('jspdf-autotable plugin not available, using fallback table');
    // Fallback: draw simple table manually
    
    // Draw header row
    doc.setFillColor(37, 99, 235);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.rect(margin, y, contentWidth, 8, 'F');
    tableHeaders.forEach((header, i) => {
      const align = i === 0 || i === 2 ? 'center' : i >= 3 ? 'right' : 'left';
      const x = align === 'center' ? colX[i] + colWidths[i] / 2 : 
                align === 'right' ? colX[i] + colWidths[i] - 2 : colX[i] + 2;
      doc.text(header, x, y + 5.5, { align: align });
    });
    y += 8;
    
    // Draw data rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    tableData.forEach((row, rowIndex) => {
      const splitProductName = doc.splitTextToSize(row[1], colWidths[1] - 4);
      const rowHeight = Math.max(7, splitProductName.length * 4 + 3);

      if (y + rowHeight > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
        // Optionally redraw header here, but keeping it simple as requested
      }

      if (rowIndex % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, rowHeight, 'F');
      }
      row.forEach((cell, i) => {
        const align = i === 0 || i === 2 ? 'center' : i >= 3 ? 'right' : 'left';
        const x = align === 'center' ? colX[i] + colWidths[i] / 2 : 
                  align === 'right' ? colX[i] + colWidths[i] - 2 : colX[i] + 2;
        if (i === 1) {
          doc.text(splitProductName, x, y + 5, { align: align });
        } else {
          doc.text(cell, x, y + 5, { align: align });
        }
      });
      y += rowHeight;
    });
    y += 8;
  }
  
  // Totals section (right aligned)
  const startLineY = (typeof doc.autoTable === 'function' && doc.lastAutoTable) ? doc.lastAutoTable.finalY : y - 8;
  const separatorX = colX[3]; // The exact boundary between Qty and Price columns
  const totalsX = colX[3] + 4; // Shift labels slightly to the right of the separator
  const rightEdgeX = colX[4] + colWidths[4] - 2; // Right edge of 'Total' column
  
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  
  const addTotalRow = (label, value, isTotal = false, isDiscount = false) => {
    if (isDiscount) {
      doc.setTextColor(16, 185, 129);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
    } else if (isTotal) {
      doc.setTextColor(37, 99, 235);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
    } else {
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
    }
    doc.text(label, totalsX, y);
    doc.text(value, rightEdgeX, y, { align: 'right' });
    y += 7;
  };
  
  addTotalRow('Subtotal', `${subtotal.toFixed(2)}`);
  // Temporarily ignore discount row
  // if (discount > 0) addTotalRow('Coupon Discount', `-${discount.toFixed(2)}`, false, true);
  addTotalRow('Shipping', shipping === 0 ? 'Free' : `${shipping.toFixed(2)}`);
  addTotalRow('Tax (8%)', `${tax.toFixed(2)}`);
  
  // Total line removed - was causing unwanted blue line across Total amount
  // doc.setDrawColor(37, 99, 235);
  // doc.setLineWidth(0.5);
  // doc.line(totalsX, y - 1, rightEdgeX, y - 1);

  addTotalRow('Total', `${total.toFixed(2)}`, true);
  
  // Draw the single vertical separator line
  doc.setDrawColor(226, 232, 240); // Light gray to match theme
  doc.setLineWidth(0.3);
  doc.line(separatorX, startLineY, separatorX, y - 2);
  
  y += 15;
  
  // Footer note
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;
  
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  const thankYouText = 'Thank you for shopping with ShopEase!';
  const thankYouWidth = doc.getTextWidth(thankYouText);
  doc.text(thankYouText, (pageWidth - thankYouWidth) / 2, y);
  
  y += 7;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  const supportText = 'For any queries, contact us at support@shopease.com';
  const supportWidth = doc.getTextWidth(supportText);
  doc.text(supportText, (pageWidth - supportWidth) / 2, y);
  
  // Save the PDF
  const filename = `ShopEase_Invoice_${order.id}.pdf`;
  try {
    // Use blob download for better compatibility
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (saveErr) {
    console.error('Blob download failed, trying doc.save:', saveErr);
    // Fallback to doc.save
    doc.save(filename);
  }
}

function prefillSupportForm() {
  // Support form fields are left empty for the customer to fill manually
}

function onSupportTypeChange() {
  const type = $('support-type').value;
  const group = $('order-selector-group');
  const orderSel = $('support-order-id');
  if (type === 'order_issue') {
    // Populate order dropdown from state.orders
    orderSel.innerHTML = '<option value="">\u2014 Select the order with the issue \u2014</option>';
    if (state.orders && state.orders.length > 0) {
      state.orders.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id;
        const date = new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const amount = '\u20B9' + parseFloat(o.total_amount).toFixed(2);
        opt.textContent = `Order #${o.id} \u2014 ${date} \u2014 ${amount} (${o.status})`;
        orderSel.appendChild(opt);
      });
      group.style.display = 'block';
    } else {
      // User not logged in or no orders — show the row with a message
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = state.user ? 'No orders found on your account' : 'Please log in to see your orders';
      opt.disabled = true;
      orderSel.appendChild(opt);
      group.style.display = 'block';
    }
  } else {
    group.style.display = 'none';
    orderSel.value = '';
  }
}

async function handleSupportSubmit(e) {
  e.preventDefault(); hideErrors();
  const name = $('support-name').value.trim();
  const email = $('support-email').value.trim();
  const mobile = $('support-mobile').value.trim();
  const support_type = $('support-type').value;
  let description = $('support-description').value.trim();
  const order_id = $('support-order-id') ? $('support-order-id').value : '';

  if (!name || !email || !mobile || !support_type || !description) {
    return showError('support-error', 'All fields are required');
  }

  // Require an order selection for order issues
  if (support_type === 'order_issue' && !order_id) {
    return showError('support-error', 'Please select the order you are having an issue with');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return showError('support-error', 'Please enter a valid email address');
  }

  const mobileRegex = /^[0-9+\-\s]{10,15}$/;
  if (!mobileRegex.test(mobile.replace(/\s/g, ''))) {
    return showError('support-error', 'Please enter a valid 10-digit mobile number');
  }

  // Prepend order reference to description so admin sees it clearly
  if (support_type === 'order_issue' && order_id) {
    description = `[Order Reference: #${order_id}]\n\n${description}`;
  }

  const btn = $('support-submit-btn');
  btn.querySelector('.btn-text').style.display = 'none';
  btn.querySelector('.btn-loading').style.display = 'inline-flex';
  btn.disabled = true;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;

    const res = await fetch(`${API}/support`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, email, mobile, support_type, description })
    });

    const data = await res.json();

    if (data.error) {
      showError('support-error', data.error);
    } else {
      $('support-success').textContent = `Your support request has been submitted (${data.support_id}). Our team will get back to you shortly.`;
      $('support-success').style.display = 'block';
      $('support-form').reset();
      $('order-selector-group').style.display = 'none';
      setTimeout(() => {
        $('support-success').style.display = 'none';
        showView('home');
      }, 4000);
    }
  } catch {
    showError('support-error', 'Failed to submit. Please check your connection and try again.');
  } finally {
    btn.querySelector('.btn-text').style.display = 'inline';
    btn.querySelector('.btn-loading').style.display = 'none';
    btn.disabled = false;
  }
}

function closeModals() { 
  $('order-modal').style.display = 'none'; 
  $('address-modal').style.display = 'none';
  closeShareModal();
  closeRateReviewModal();
}

function closeRateReviewModal() {
  const modal = $('rate-review-modal');
  if (modal) {
    modal.style.display = 'none';
    const form = $('rate-review-form');
    if (form) form.reset();
    hideRateReviewErrors();
    resetRateReviewStars();
  }
}

function hideRateReviewErrors() {
  const errors = ['rate-review-rating-error', 'rate-review-comment-error', 'rate-review-error', 'rate-review-success'];
  errors.forEach(id => { const el = $(id); if (el) { el.style.display = 'none'; el.textContent = ''; } });
}

function resetRateReviewStars() {
  document.querySelectorAll('.rate-review-star').forEach(star => {
    star.classList.remove('selected');
    star.setAttribute('aria-checked', 'false');
  });
}

function setRateReviewStars(rating) {
  document.querySelectorAll('.rate-review-star').forEach(star => {
    const value = parseInt(star.dataset.value);
    star.classList.toggle('selected', value <= rating);
    star.setAttribute('aria-checked', value <= rating ? 'true' : 'false');
  });
}

function openRateReviewModal(productId, productName, productImage, orderId) {
  if (!state.user) {
    showView('auth');
    toast('Please login to submit a review', 'info');
    return;
  }

  const modal = $('rate-review-modal');
  const productNameEl = $('rate-review-product-name');
  const productImageEl = $('rate-review-product-image');
  const form = $('rate-review-form');

  if (!modal || !productNameEl || !form) return;

  productNameEl.textContent = productName;
  if (productImageEl) {
    if (productImage) {
      productImageEl.src = productImage;
      productImageEl.alt = productName;
      productImageEl.style.display = 'block';
    } else {
      productImageEl.style.display = 'none';
    }
  }
  form.dataset.productId = productId;
  form.dataset.orderId = orderId;

  resetRateReviewStars();
  hideRateReviewErrors();

  if (state.user) {
    (async () => {
      try {
        const reviewsRes = await apiGet(`/products/${productId}/reviews`);
        if (reviewsRes && reviewsRes.reviews) {
          const existingReview = reviewsRes.reviews.find(r => r.is_current_user);
          if (existingReview) {
            const commentEl = $('rate-review-comment');
            if (commentEl) commentEl.value = existingReview.comment || '';
            setRateReviewStars(existingReview.rating);
            const submitBtn = $('rate-review-submit');
            if (submitBtn) {
              submitBtn.querySelector('.btn-text').textContent = 'Update Review';
            }
          }
        }
      } catch (_) {}
    })();
  }

  modal.style.display = 'flex';
  $('rate-review-comment').focus();
}

async function submitRateReview(e) {
  e.preventDefault();
  hideRateReviewErrors();

  if (!state.user) {
    showView('auth');
    toast('Please login to submit a review', 'info');
    return;
  }

  const form = $('rate-review-form');
  const productId = parseInt(form.dataset.productId);
  const orderId = parseInt(form.dataset.orderId);
  const commentEl = $('rate-review-comment');
  const submitBtn = $('rate-review-submit');
  const ratingErrorEl = $('rate-review-rating-error');
  const commentErrorEl = $('rate-review-comment-error');
  const generalErrorEl = $('rate-review-error');
  const successEl = $('rate-review-success');

  const selectedStar = document.querySelector('.rate-review-star.selected');
  const rating = selectedStar ? parseInt(selectedStar.dataset.value) : 0;
  const comment = (commentEl.value || '').trim();

  let hasError = false;

  if (!rating || rating < 1 || rating > 5) {
    if (ratingErrorEl) { ratingErrorEl.textContent = 'Please select a rating.'; ratingErrorEl.style.display = 'block'; }
    hasError = true;
  }

  if (!comment) {
    if (commentErrorEl) { commentErrorEl.textContent = 'Please write a review.'; commentErrorEl.style.display = 'block'; }
    hasError = true;
  } else if (comment.length < 3) {
    if (commentErrorEl) { commentErrorEl.textContent = 'Review must be at least 3 characters.'; commentErrorEl.style.display = 'block'; }
    hasError = true;
  }

  if (hasError) return;

  submitBtn.disabled = true;
  submitBtn.querySelector('.btn-text').style.display = 'none';
  submitBtn.querySelector('.btn-loading').style.display = 'inline-flex';

  try {
    const res = await apiPost(`/products/${productId}/reviews`, { rating, comment, order_id: orderId });

    if (successEl) { successEl.textContent = res.message || 'Review submitted successfully.'; successEl.style.display = 'block'; }
    toast(res.message || 'Review submitted successfully.', 'success');

    setTimeout(async () => {
      closeRateReviewModal();
      if (state.currentProductId === productId) {
        try {
          const fresh = await apiGet(`/products/${productId}`);
          const idx = state.products.findIndex(p => p.id === productId);
          if (idx !== -1) {
            state.products[idx] = { ...state.products[idx], ...fresh };
          }
        } catch (_) {}
        await renderProductDetail(productId);
      }
      loadOrders();
    }, 1500);
  } catch (err) {
    const msg = (err && err.message) ? err.message : 'Failed to submit review. Please try again.';
    if (err.status === 403 && msg.includes('purchased')) {
      if (generalErrorEl) { generalErrorEl.textContent = 'You can only review products from your completed orders.'; generalErrorEl.style.display = 'block'; }
    } else if (err.status === 403 && msg.includes('already')) {
      if (generalErrorEl) { generalErrorEl.textContent = 'You have already reviewed this product.'; generalErrorEl.style.display = 'block'; }
    } else if (generalErrorEl) {
      generalErrorEl.textContent = msg;
      generalErrorEl.style.display = 'block';
    }
    toast(msg, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').style.display = 'inline';
    submitBtn.querySelector('.btn-loading').style.display = 'none';
  }
}

function bindRateReviewEvents() {
  const stars = document.querySelectorAll('.rate-review-star');
  stars.forEach(star => {
    star.addEventListener('click', () => {
      const value = parseInt(star.dataset.value);
      setRateReviewStars(value);
      const ratingErrorEl = $('rate-review-rating-error');
      if (ratingErrorEl) { ratingErrorEl.style.display = 'none'; ratingErrorEl.textContent = ''; }
    });
    star.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const value = parseInt(star.dataset.value);
        setRateReviewStars(value);
        const ratingErrorEl = $('rate-review-rating-error');
        if (ratingErrorEl) { ratingErrorEl.style.display = 'none'; ratingErrorEl.textContent = ''; }
      }
    });
  });

  const form = $('rate-review-form');
  if (form) {
    form.addEventListener('submit', submitRateReview);
  }

  const cancelBtn = $('rate-review-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeRateReviewModal);
  }

  const modalClose = document.querySelector('#rate-review-modal .modal-close');
  if (modalClose) {
    modalClose.addEventListener('click', closeRateReviewModal);
  }

  const modalBackdrop = document.querySelector('#rate-review-modal .modal-backdrop');
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', closeRateReviewModal);
  }
}

function openShareModal(productId) {
  const product = state.products.find(p => p.id === productId) || state.shareProduct;
  if (!product) {
    toast('Product not found', 'error');
    return;
  }
  state.shareProduct = product;
  renderShareModal(product);
}

function closeShareModal() {
  const modal = $('share-modal');
  if (modal) {
    modal.classList.remove('open');
    if (modal._escHandler) {
      document.removeEventListener('keydown', modal._escHandler);
      modal._escHandler = null;
    }
    setTimeout(() => modal.remove(), 200);
  }
}

function renderShareModal(product) {
  // Remove existing modal if any
  closeShareModal();
  
  const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`;
  const shareText = `Check out this product:\n${product.name}\n₹${discounted(product).toFixed(2)}\n\n${productUrl}`;
  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(productUrl);
  
  const modal = document.createElement('div');
  modal.id = 'share-modal';
  modal.className = 'share-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'share-modal-title');
  modal.innerHTML = `
    <div class="share-modal-backdrop" tabindex="-1"></div>
    <div class="share-modal-content">
      <button class="share-modal-close" aria-label="Close share modal">&times;</button>
      <h3 id="share-modal-title">Share Product</h3>
      <div class="share-product-preview">
        <img src="${product.image_url}" alt="${escapeHtml(product.name)}" onerror="imgFallback(this)">
        <div class="share-product-info">
          <span class="share-product-name">${escapeHtml(product.name)}</span>
          <span class="share-product-price">₹${discounted(product).toFixed(2)}</span>
        </div>
      </div>
      <div class="share-options" role="list">
        <button class="share-option" data-action="copy" role="listitem" aria-label="Copy link">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>Copy Link</span>
        </button>
        <button class="share-option" data-action="whatsapp" role="listitem" aria-label="Share on WhatsApp">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.52-.075-.148-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.372-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.194 1.871.18.255-.007.525-.084.791-.372 1.964-1.964 2.5-3.988 2.792-4.558.31-.615.413-1.214.455-1.377a.51.51 0 0 0-.262-.39.45.45 0 0 0-.206-.075c-.112-.008-.273-.01-.52-.012-.206-.007-.479-.01-.64-.01-.382 0-.763.148-.94.399-.197.25-.372.52-.372.644 0 .05-.027.15-.05.25-.112.348-.364 1.027-.65 1.812-.242.68-.65 1.735-1.1 2.307-.317.399-.75.77-1.22 1.174-.436.373-.827.625-1.04.72z"/></svg>
          <span>WhatsApp</span>
        </button>
        <button class="share-option" data-action="telegram" role="listitem" aria-label="Share on Telegram">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 4.325a9.027 9.027 0 0 0-7.48 5.95 9.027 9.027 0 0 0 4.86 6.904l-1.885 5.918a.926.926 0 0 0 1.43 1.042l6.29-4.74a.918.918 0 0 0 .412-.484l1.324-2.253a.916.916 0 0 1 1.07-.117l1.538 1.405a.917.917 0 0 0 1.313-.077l1.483-1.483a.915.915 0 0 0 .07-1.213l-1.666-5.844a9.027 9.027 0 0 0-5.54-6.288zm.024 1.427a7.18 7.18 0 0 1 5.958 4.122l-.974 3.415a.776.776 0 0 1-1.126.436l-2.24-1.662a.776.776 0 0 0-.914.233l-4.353 5.926a.776.776 0 0 1-1.235-.461l-1.092-5.79a7.18 7.18 0 0 1 5.064-7.131z"/></svg>
          <span>Telegram</span>
        </button>
        <button class="share-option" data-action="email" role="listitem" aria-label="Share via Email">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <span>Email</span>
        </button>
        <button class="share-option" data-action="mail" role="listitem" aria-label="Share via Mail">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M18 8h-1a2 2 0 0 0 0 4h1a2 2 0 1 1 0 4H4a2 2 0 1 1 0-4h14a2 2 0 1 1 0-4H8a2 2 0 0 1 0-4h10z"/></svg>
          <span>Mail</span>
        </button>
        <button class="share-option" data-action="message" role="listitem" aria-label="Share via Message">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h8"/><path d="M8 14h5"/></svg>
          <span>Message</span>
        </button>
        <button class="share-option" data-action="instagram" role="listitem" aria-label="Share on Instagram">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          <span>Instagram</span>
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Animate in
  requestAnimationFrame(() => modal.classList.add('open'));
  
  // Bind events
  const backdrop = modal.querySelector('.share-modal-backdrop');
  const closeBtn = modal.querySelector('.share-modal-close');
  const options = modal.querySelectorAll('.share-option');
  
  const closeHandler = () => closeShareModal();
  backdrop.addEventListener('click', closeHandler);
  closeBtn.addEventListener('click', closeHandler);
  
  // Escape key
  const escHandler = (e) => { if (e.key === 'Escape') closeShareModal(); };
  document.addEventListener('keydown', escHandler);
  modal._escHandler = escHandler;
  
  options.forEach(opt => {
    opt.addEventListener('click', async (e) => {
      const action = opt.dataset.action;
      await handleShareAction(action, product, productUrl, shareText, encodedText, encodedUrl);
      closeShareModal();
    });
  });
}

async function handleShareAction(action, product, productUrl, shareText, encodedText, encodedUrl) {
  switch (action) {
    case 'copy':
      try {
        await navigator.clipboard.writeText(productUrl);
        toast('Link copied!', 'success');
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = productUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
        toast('Link copied!', 'success');
      }
      break;
      
    case 'whatsapp':
      window.open(`https://wa.me/?text=${encodedText}`, '_blank');
      break;
      
    case 'telegram':
      window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank');
      break;
      
    case 'email':
    case 'mail':
      const subject = encodeURIComponent(`Check out this product - ${product.name}`);
      const body = encodeURIComponent(`Check out this product:\n${product.name}\n₹${discounted(product).toFixed(2)}\n\n${productUrl}`);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
      break;
      
    case 'message':
      // Use Web Share API if available, otherwise fallback to SMS
      if (navigator.share && navigator.canShare && navigator.canShare({ title: product.name, text: shareText, url: productUrl })) {
        try {
          await navigator.share({ title: product.name, text: shareText, url: productUrl });
        } catch (e) {
          if (e.name !== 'AbortError') {
            // Fallback to SMS
            window.location.href = `sms:?body=${encodedText}`;
          }
        }
      } else {
        // Fallback to SMS
        window.location.href = `sms:?body=${encodedText}`;
      }
      break;
      
    case 'instagram':
      // Instagram doesn't support direct URL sharing from desktop
      // Best we can do is copy link and inform user
      try {
        await navigator.clipboard.writeText(productUrl);
        toast('Link copied! Open Instagram and paste in your story/post.', 'info');
      } catch {
        const textarea = document.createElement('textarea');
        textarea.value = productUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
        toast('Link copied! Open Instagram and paste in your story/post.', 'info');
      }
      // Optionally open Instagram on mobile
      if (/Mobi|Android/i.test(navigator.userAgent)) {
        window.open('https://www.instagram.com/', '_blank');
      }
      break;
  }
}

/* ===== Support Dashboard Header Functions ===== */

// Notification state
let supportNotifications = [];
let supportUnreadCount = 0;

// Profile dropdown state
let supportProfileDropdownOpen = false;
let supportNotificationDropdownOpen = false;

// Fetch notifications from backend
async function fetchSupportNotifications() {
  if (!state.user) return;
  try {
    const data = await apiGet('/notifications/my');
    supportNotifications = Array.isArray(data.data) ? data.data : [];
    supportUnreadCount = data.unread_count || 0;
    updateSupportNotificationBadge();
    renderSupportNotificationList();
  } catch (e) {
    console.error('Failed to fetch notifications:', e);
    supportNotifications = [];
    supportUnreadCount = 0;
    updateSupportNotificationBadge();
    renderSupportNotificationList();
  }
}

// Update notification badge
function updateSupportNotificationBadge() {
  const badge = $('support-notification-badge');
  if (!badge) return;
  if (supportUnreadCount > 0) {
    badge.textContent = supportUnreadCount > 99 ? '99+' : supportUnreadCount;
    badge.classList.add('visible');
  } else {
    badge.classList.remove('visible');
  }
}

// Render notification list
function renderSupportNotificationList() {
  const list = $('support-notification-list');
  const empty = list ? list.querySelector('.notification-empty') : null;
  if (!list) return;
  
  if (supportNotifications.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    return;
  }
  
  if (empty) empty.style.display = 'none';
  
  list.innerHTML = supportNotifications.map(n => `
    <div class="notification-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}" role="option" tabindex="0">
      <div class="notification-item-content">
        <div class="notification-item-title">
          <svg class="notification-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          ${escapeHtml(n.title || 'Notification')}
        </div>
        ${n.ticket_id ? `<div class="notification-item-ticket">Ticket #${escapeHtml(n.ticket_id)}</div>` : ''}
        ${n.reference_id ? `<div class="notification-item-ticket">Ref #${escapeHtml(n.reference_id)}</div>` : ''}
        <div class="notification-item-message">${escapeHtml(n.message || '')}</div>
        <div class="notification-item-time">${formatNotificationDate(n.created_at)}</div>
      </div>
    </div>
  `).join('');
  
  // Bind click events
  list.querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', () => handleNotificationClick(parseInt(item.dataset.id)));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleNotificationClick(parseInt(item.dataset.id));
      }
    });
  });
}

// Format notification date
function formatNotificationDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// Handle notification click - mark as read
async function handleNotificationClick(notificationId) {
  const notification = supportNotifications.find(n => n.id === notificationId);
  if (!notification || notification.is_read) return;
  
  try {
    await apiPost(`/notifications/${notificationId}/read`);
    notification.is_read = true;
    supportUnreadCount = Math.max(0, supportUnreadCount - 1);
    updateSupportNotificationBadge();
    renderSupportNotificationList();
  } catch (e) {
    console.error('Failed to mark notification as read:', e);
  }
}

// Mark all notifications as read
async function markAllSupportNotificationsRead() {
  if (supportUnreadCount === 0) return;
  
  try {
    await apiPost('/notifications/my/read-all');
    supportNotifications.forEach(n => n.is_read = true);
    supportUnreadCount = 0;
    updateSupportNotificationBadge();
    renderSupportNotificationList();
    toast('All notifications marked as read', 'success');
  } catch (e) {
    console.error('Failed to mark all as read:', e);
    toast('Failed to mark all as read', 'error');
  }
}

// Position notification dropdown below the bell button
function positionNotificationDropdown() {
  const dropdown = $('support-notification-dropdown');
  const bell = $('support-notification-bell');
  if (!dropdown || !bell) return;
  
  const bellRect = bell.getBoundingClientRect();
  const dropdownWidth = 360;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const gap = 8;
  
  let top = bellRect.bottom + gap;
  let left = bellRect.right - dropdownWidth;
  
  if (left < 8) {
    left = 8;
  }
  
  if (left + dropdownWidth > viewportWidth - 8) {
    left = viewportWidth - dropdownWidth - 8;
  }
  
  if (top + 400 > viewportHeight - 8) {
    top = bellRect.top - 400 - gap;
    if (top < 8) {
      top = 8;
    }
  }
  
  dropdown.style.top = `${top}px`;
  dropdown.style.left = `${left}px`;
  dropdown.style.right = 'auto';
}

// Reposition dropdown if open (for scroll/resize)
function repositionNotificationDropdownIfOpen() {
  const dropdown = $('support-notification-dropdown');
  if (dropdown && dropdown.style.display !== 'none') {
    positionNotificationDropdown();
  }
}

// Reposition profile dropdown if open (for scroll/resize)
function repositionProfileDropdownIfOpen() {
  const dropdown = $('support-profile-dropdown');
  if (dropdown && dropdown.style.display !== 'none') {
    positionSupportProfileDropdown();
  }
}

// Combined reposition for both dropdowns
function repositionSupportDropdownsIfOpen() {
  repositionNotificationDropdownIfOpen();
  repositionProfileDropdownIfOpen();
}

// Toggle notification dropdown
function toggleSupportNotificationDropdown() {
  const dropdown = $('support-notification-dropdown');
  const bell = $('support-notification-bell');
  if (!dropdown || !bell) return;
  
  const isOpen = dropdown.style.display !== 'none';
  
  // Close profile dropdown if open
  closeSupportProfileDropdown();
  
  if (isOpen) {
    dropdown.style.display = 'none';
    bell.setAttribute('aria-expanded', 'false');
    supportNotificationDropdownOpen = false;
  } else {
    positionNotificationDropdown();
    dropdown.style.display = 'block';
    bell.setAttribute('aria-expanded', 'true');
    supportNotificationDropdownOpen = true;
    // Refresh notifications when opening
    fetchSupportNotifications();
  }
}

// Close notification dropdown
function closeSupportNotificationDropdown() {
  const dropdown = $('support-notification-dropdown');
  const bell = $('support-notification-bell');
  if (!dropdown) return;
  dropdown.style.display = 'none';
  if (bell) bell.setAttribute('aria-expanded', 'false');
  supportNotificationDropdownOpen = false;
}

// Position profile dropdown below the trigger button
function positionSupportProfileDropdown() {
  const dropdown = $('support-profile-dropdown');
  const trigger = $('support-profile-trigger');
  if (!dropdown || !trigger) return;
  
  const triggerRect = trigger.getBoundingClientRect();
  const dropdownWidth = 260;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const gap = 8;
  
  let top = triggerRect.bottom + gap;
  let left = triggerRect.right - dropdownWidth;
  
  if (left < 8) {
    left = 8;
  }
  
  if (left + dropdownWidth > viewportWidth - 8) {
    left = viewportWidth - dropdownWidth - 8;
  }
  
  if (top + 300 > viewportHeight - 8) {
    top = triggerRect.top - 300 - gap;
    if (top < 8) {
      top = 8;
    }
  }
  
  dropdown.style.top = `${top}px`;
  dropdown.style.left = `${left}px`;
  dropdown.style.right = 'auto';
}

// Toggle profile dropdown
function toggleSupportProfileDropdown() {
  const dropdown = $('support-profile-dropdown');
  const trigger = $('support-profile-trigger');
  if (!dropdown || !trigger) return;
  
  const isOpen = dropdown.style.display !== 'none';
  
  // Close notification dropdown if open
  closeSupportNotificationDropdown();
  
  if (isOpen) {
    dropdown.style.display = 'none';
    trigger.setAttribute('aria-expanded', 'false');
    supportProfileDropdownOpen = false;
  } else {
    positionSupportProfileDropdown();
    dropdown.style.display = 'block';
    trigger.setAttribute('aria-expanded', 'true');
    supportProfileDropdownOpen = true;
  }
}

// Close profile dropdown
function closeSupportProfileDropdown() {
  const dropdown = $('support-profile-dropdown');
  const trigger = $('support-profile-trigger');
  if (!dropdown) return;
  dropdown.style.display = 'none';
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  supportProfileDropdownOpen = false;
}

// Close all support dropdowns
function closeAllSupportDropdowns() {
  closeSupportNotificationDropdown();
  closeSupportProfileDropdown();
}

// Update profile UI with user data
function updateSupportProfileUI() {
  if (!state.user) return;
  
  // Update profile trigger
  const avatar = $('support-profile-avatar');
  const name = $('support-profile-name');
  
  // Update dropdown
  const dropdownAvatar = $('support-dropdown-avatar');
  const dropdownName = $('support-dropdown-name');
  const dropdownEmail = $('support-dropdown-email');
  
  if (state.user.profile_image) {
    // Use profile image if available
    const imgHtml = `<img src="${escapeHtml(state.user.profile_image)}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    if (avatar) avatar.innerHTML = imgHtml;
    if (dropdownAvatar) dropdownAvatar.innerHTML = imgHtml.replace('width="24" height="24"', 'width="32" height="32"');
  }
  
  if (name) name.textContent = escapeHtml(state.user.name || 'Customer');
  if (dropdownName) dropdownName.textContent = escapeHtml(state.user.name || 'Customer');
  if (dropdownEmail) dropdownEmail.textContent = escapeHtml(state.user.email || 'customer@email.com');
}

// Handle profile item clicks
function handleSupportProfileItemClick(action) {
  closeSupportProfileDropdown();
  
  switch (action) {
    case 'profile':
      // Navigate to profile page/section
      showView('profile'); // Will need profile view or handle appropriately
      break;
    case 'settings':
      // Navigate to settings
      showView('settings'); // Will need settings view or handle appropriately
      break;
    case 'signout':
      logout();
      break;
  }
}

// Bind support dashboard header events
function bindSupportDashboardHeaderEvents() {
  // Notification bell
  const bell = $('support-notification-bell');
  if (bell) {
    const newBell = bell.cloneNode(true);
    bell.parentNode.replaceChild(newBell, bell);
    newBell.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSupportNotificationDropdown();
    });
  }
  
  // Mark all as read
  const markAllRead = $('support-mark-all-read');
  if (markAllRead) {
    const newMarkAllRead = markAllRead.cloneNode(true);
    markAllRead.parentNode.replaceChild(newMarkAllRead, markAllRead);
    newMarkAllRead.addEventListener('click', (e) => {
      e.stopPropagation();
      markAllSupportNotificationsRead();
    });
  }
  
  // Profile trigger
  const profileTrigger = $('support-profile-trigger');
  if (profileTrigger) {
    const newTrigger = profileTrigger.cloneNode(true);
    profileTrigger.parentNode.replaceChild(newTrigger, profileTrigger);
    newTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSupportProfileDropdown();
    });
  }
  
  // Profile dropdown items
  const profileItem = $('support-profile-item');
  const settingsItem = $('support-settings-item');
  const signoutItem = $('support-signout-item');
  
  if (profileItem) {
    const newProfileItem = profileItem.cloneNode(true);
    profileItem.parentNode.replaceChild(newProfileItem, profileItem);
    newProfileItem.addEventListener('click', (e) => {
      e.stopPropagation();
      handleSupportProfileItemClick('profile');
    });
  }
  
  if (settingsItem) {
    const newSettingsItem = settingsItem.cloneNode(true);
    settingsItem.parentNode.replaceChild(newSettingsItem, settingsItem);
    newSettingsItem.addEventListener('click', (e) => {
      e.stopPropagation();
      handleSupportProfileItemClick('settings');
    });
  }
  
  if (signoutItem) {
    const newSignoutItem = signoutItem.cloneNode(true);
    signoutItem.parentNode.replaceChild(newSignoutItem, signoutItem);
    newSignoutItem.addEventListener('click', (e) => {
      e.stopPropagation();
      handleSupportProfileItemClick('signout');
    });
  }
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    const notificationWrapper = $('support-notification-wrapper');
    const profileWrapper = $('support-profile-wrapper');
    
    if (notificationWrapper && !notificationWrapper.contains(e.target)) {
      closeSupportNotificationDropdown();
    }
    
    if (profileWrapper && !profileWrapper.contains(e.target)) {
      closeSupportProfileDropdown();
    }
  });
  
  // Reposition dropdown on scroll/resize (only add once)
  if (!state.supportDropdownListenersAdded) {
    window.addEventListener('scroll', repositionSupportDropdownsIfOpen, { passive: true });
    window.addEventListener('resize', repositionSupportDropdownsIfOpen);
    state.supportDropdownListenersAdded = true;
  }
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllSupportDropdowns();
    }
  });
  
  // Theme toggle
  const themeToggle = $('support-theme-toggle');
  if (themeToggle) {
    const newThemeToggle = themeToggle.cloneNode(true);
    themeToggle.parentNode.replaceChild(newThemeToggle, themeToggle);
    newThemeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
      localStorage.setItem('theme', isDark ? 'light' : 'dark');
    });
  }
}

// Initialize support dashboard when view is shown
const originalShowView = showView;
showView = function(view, productId) {
  const result = originalShowView(view, productId);
  if (view === 'support') {
    updateSupportProfileUI();
    bindSupportDashboardHeaderEvents();
    fetchSupportNotifications();
  }
  return result;
};

// Also update the prefillSupportForm to use real user data
const originalPrefillSupportForm = prefillSupportForm;
prefillSupportForm = function() {
  originalPrefillSupportForm();
  if (state.user) {
    if ($('support-name')) $('support-name').value = state.user.name || '';
    if ($('support-email')) $('support-email').value = state.user.email || '';
  }
};

function fmtDate(s) { return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function showError(id, msg) { const el = $(id); if (el) { el.textContent = msg; el.style.display = 'block'; } }
function hideErrors() { document.querySelectorAll('.error').forEach(e => { e.style.display = 'none'; e.textContent = ''; }); }
function toast(msg, type = 'info') {
  const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg;
  $('toast-container').appendChild(t);
  setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 300); }, 2500);
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

document.addEventListener('DOMContentLoaded', init);
