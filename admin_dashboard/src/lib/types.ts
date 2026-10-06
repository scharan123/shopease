export interface User {
  id: number
  name: string
  email: string
  created_at: string
  role?: "admin" | "user"
  order_count?: number
  total_spent?: number
}

export interface Category {
  id: number
  name: string
  slug: string
  icon?: string
  display_order: number
  product_count?: number
  image_url?: string
  created_at?: string
  updated_at?: string
}

export interface Product {
  id: number
  name: string
  description?: string
  price: number
  rating?: number | null
  review_count?: number
  discount?: number
  specification?: string
  highlights?: string
  delivery?: string
  delivery_type?: "all-india" | "selected"
  selected_pin_codes?: string[]
  sizes?: string[]
  image_url?: string
  images?: string[]
  stock: number
  category: string
  category_id?: number
  featured: boolean
  created_at: string
  updated_at?: string
}

export interface Review {
  id: number
  product_id: number
  product_name: string
  product_image?: string
  user_id: number | null
  user_name?: string | null
  user_email?: string | null
  name: string
  email: string | null
  rating: number
  comment: string | null
  is_verified: boolean | number
  created_at: string
}

export interface OrderItem {
  id: number
  order_id: number
  product_id: number
  quantity: number
  price: number
  product?: Product
}

export interface Order {
  id: number
  user_id: number
  total_amount: number
  status: OrderStatus
  shipping_address: string
  payment_method: PaymentMethod
  tracking_number?: string
  shipped_at?: string
  delivered_at?: string
  created_at: string
  updated_at: string
  user?: User
  items?: OrderItem[]
  item_count?: number
}

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled"
export type PaymentMethod = "cod" | "card" | "upi" | "wallet" | "bank_transfer"

export interface DashboardStats {
  total_revenue: number
  total_orders: number
  total_users: number
  conversion_rate: number
  revenue_change: number
  orders_change: number
  users_change: number
  conversion_change: number
}

export interface ChartDataPoint {
  date: string
  orders: number
  revenue: number
  income: number
}

export interface CategoryRevenue {
  category: string
  revenue: number
  orders: number
}

export interface PaymentMethodStats {
  method: string
  count: number
  amount: number
  percentage: number
}

export interface OrderStatusStats {
  status: OrderStatus
  count: number
  percentage: number
}

export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface FilterParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: "asc" | "desc"
  status?: string
  category?: string
  payment_method?: string
  role?: string
  startDate?: string
  endDate?: string
}

export interface AdminUser extends User {
  role: "admin" | "user"
}

export interface CreateCategoryInput {
  name: string
  slug: string
  icon?: string
  display_order?: number
  image_url?: string
}

export interface UpdateCategoryInput extends Partial<CreateCategoryInput> {}

export interface CreateProductInput {
  name: string
  description?: string
  price: number
  rating?: number
  discount?: number
  specification?: string
  highlights?: string
  delivery?: string
  delivery_type?: "all-india" | "selected"
  selected_pin_codes?: string[]
  sizes?: string[]
  image_url?: string
  images?: string[]
  stock: number
  category: string
  category_id?: number
  featured?: boolean
}

export interface UpdateProductInput extends Partial<CreateProductInput> {}

export interface UpdateOrderStatusInput {
  status: OrderStatus
  tracking_number?: string
}

export interface BulkActionInput {
  ids: number[]
  action: "delete" | "update_status" | "export"
  data?: Record<string, unknown>
}

export interface TimeRange {
  label: string
  value: "7d" | "30d" | "90d" | "1y"
  days: number
}

export const TIME_RANGES: TimeRange[] = [
  { label: "Last 7 Days", value: "7d", days: 7 },
  { label: "Last 30 Days", value: "30d", days: 30 },
  { label: "Last 90 Days", value: "90d", days: 90 },
  { label: "Last Year", value: "1y", days: 365 },
]

export const ORDER_STATUSES: { value: OrderStatus; label: string; color: string }[] = [
  { value: "pending", label: "Pending", color: "yellow" },
  { value: "processing", label: "Processing", color: "blue" },
  { value: "shipped", label: "Shipped", color: "purple" },
  { value: "delivered", label: "Delivered", color: "green" },
  { value: "cancelled", label: "Cancelled", color: "red" },
]

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cod", label: "Cash on Delivery" },
  { value: "card", label: "Credit/Debit Card" },
  { value: "upi", label: "UPI" },
  { value: "wallet", label: "Wallet" },
  { value: "bank_transfer", label: "Bank Transfer" },
]

export type SupportType = "order_issue" | "payment_issue" | "delivery_issue" | "return_refund" | "other"
export type SupportStatus = "open" | "closed"

export interface SupportRequest {
  id: number
  support_id: string
  user_id: number | null
  name: string
  mobile: string
  email: string
  support_type: SupportType
  description: string
  admin_reply: string | null
  status: SupportStatus
  created_at: string
  updated_at: string
  user?: User
}

export interface NotificationsResponse {
  data: Notification[]
  unread_count: number
}

export interface Notification {
  id: number
  user_id: number | null
  type: string
  title: string
  message: string | null
  link: string | null
  data: {
    support_request_id?: number
    support_id?: string
    support_type?: SupportType
    customer_name?: string
    customer_email?: string
    status?: SupportStatus
    created_at?: string
  } | null
  is_read: boolean
  created_at: string
}

export const SUPPORT_TYPES: { value: SupportType; label: string }[] = [
  { value: "order_issue", label: "Order Issue" },
  { value: "payment_issue", label: "Payment Issue" },
  { value: "delivery_issue", label: "Delivery Issue" },
  { value: "return_refund", label: "Return / Refund" },
  { value: "other", label: "Other" },
]

export const SUPPORT_STATUSES: { value: SupportStatus; label: string; color: string }[] = [
  { value: "open", label: "Open", color: "blue" },
  { value: "closed", label: "Closed", color: "green" },
]

export type CouponDiscountType = "percentage" | "fixed"
export type CouponStatus = "active" | "expired" | "inactive"

export interface Coupon {
  id: number
  code: string
  discount_type: CouponDiscountType
  discount_value: number
  min_order_amount: number
  max_discount: number | null
  usage_limit: number
  per_user_limit: number
  start_date: string
  expiry_date: string
  is_active: number
  created_at: string
  updated_at: string
  usage_count?: number
}

export interface CouponUsage {
  id: number
  coupon_id: number
  user_id: number
  order_id: number
  discount_amount: number
  used_at: string
  user_name: string
  user_email: string
  order_total: number
}

export interface CouponStats {
  total_coupons: number
  active_coupons: number
  expired_coupons: number
  total_usage: number
  total_discount_given: number
}

export interface CreateCouponInput {
  code: string
  discount_type: CouponDiscountType
  discount_value: number
  min_order_amount?: number
  max_discount?: number | null
  usage_limit?: number
  per_user_limit?: number
  start_date?: string
  expiry_date: string
  is_active?: number
}

export interface UpdateCouponInput extends Partial<CreateCouponInput> {}