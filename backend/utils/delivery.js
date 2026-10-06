// Reusable Indian PIN-code delivery logic for ShopEase.
//
// A product's delivery availability is stored in the
// product_serviceable_pincodes table:
//
//   product_serviceable_pincodes (product_id, pincode)
//
// A product is deliverable to a PIN code if it has a row for
// that PIN code. For PIN codes with fewer than 25 explicit mappings,
// a deterministic fallback ensures at least 25 products are deliverable.
//
// An Indian PIN code is validated as 6 digits (the digit pattern of real
// Indian postal codes). This module is intentionally isolated so an official
// Indian PIN-code directory/API (e.g. an India Post lookup) can be plugged in
// later without touching product / cart / order code.

const PIN_CODE_REGEX = /^[0-9]{6}$/;
const MIN_DELIVERABLE_PRODUCTS = 25;

// Returns true for a syntactically valid 6-digit Indian PIN code.
function isValidPin(pin) {
  return typeof pin === 'string' && PIN_CODE_REGEX.test(pin.trim());
}

// Deterministic pseudo-random number generator based on PIN code
// Returns a consistent value for the same PIN, different for different PINs
function pinHash(pin) {
  let hash = 0;
  const str = String(pin).trim();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Get a deterministic "random" value for a product+pin combination
function productPinHash(productId, pin) {
  return pinHash(pin + '-' + productId);
}

// Get deliverable product IDs for a PIN code with minimum 25 guarantee
async function getDeliverableProductIds(db, pin) {
  const cleanPin = String(pin).trim();
  
  // First check explicit mappings in product_serviceable_pincodes
  const [explicitRows] = await db.query(
    'SELECT product_id FROM product_serviceable_pincodes WHERE pincode = ?',
    [cleanPin]
  );
  
  const explicitDeliverable = new Set(explicitRows.map((r) => Number(r.product_id)));
  
  // If we have 25+ explicit mappings, use them
  if (explicitDeliverable.size >= MIN_DELIVERABLE_PRODUCTS) {
    return explicitDeliverable;
  }
  
  // Otherwise, get all product IDs and use deterministic fallback
  const [allProducts] = await db.query('SELECT id FROM products ORDER BY id');
  const allProductIds = allProducts.map((p) => Number(p.id));
  
  // Score each product for this PIN using deterministic hash
  // Products with explicit mapping get highest score
  const scoredProducts = allProductIds.map(id => {
    let score = productPinHash(id, cleanPin);
    // Boost explicit mappings to ensure they're included
    if (explicitDeliverable.has(id)) {
      score += 1000000;
    }
    return { id, score };
  });
  
  // Sort by score descending
  scoredProducts.sort((a, b) => b.score - a.score);
  
  // Take top 25 (or more if we want some buffer)
  const deliverableCount = Math.max(MIN_DELIVERABLE_PRODUCTS, explicitDeliverable.size);
  const deliverable = new Set();
  
  for (let i = 0; i < deliverableCount && i < scoredProducts.length; i++) {
    deliverable.add(scoredProducts[i].id);
  }
  
  return deliverable;
}

// Async: returns true when the given product can be delivered to the given
// PIN code according to the product_serviceable_pincodes table with fallback.
async function isProductDeliverable(db, productId, pin) {
  if (!isValidPin(pin)) return false;
  const deliverable = await getDeliverableProductIds(db, pin);
  return deliverable.has(Number(productId));
}

// Async: returns the subset of the given product ids that are NOT deliverable
// to the given PIN code. productIds may include duplicates from a cart.
async function findUndeliverableProducts(db, productIds, pin) {
  if (!isValidPin(pin)) return [...productIds];
  if (!Array.isArray(productIds) || productIds.length === 0) return [];
  const uniqueIds = [...new Set(productIds)];
  const deliverable = await getDeliverableProductIds(db, pin);
  return uniqueIds.filter((id) => !deliverable.has(Number(id)));
}

// Get bulk delivery availability for all products for a PIN code
async function getBulkDeliveryAvailability(db, pin) {
  if (!isValidPin(pin)) return {};
  const deliverable = await getDeliverableProductIds(db, pin);
  
  const [allProducts] = await db.query('SELECT id FROM products');
  const availability = {};
  allProducts.forEach((p) => {
    availability[Number(p.id)] = deliverable.has(Number(p.id));
  });
  return { pincode: String(pin).trim(), availability };
}

module.exports = { 
  isValidPin, 
  isProductDeliverable, 
  findUndeliverableProducts, 
  getBulkDeliveryAvailability,
  getDeliverableProductIds,
  PIN_CODE_REGEX 
};