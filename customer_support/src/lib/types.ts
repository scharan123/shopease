export type SupportType = "order_issue" | "payment_issue" | "delivery_issue" | "return_refund" | "other"
export type SupportStatus = "open" | "closed"

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled"
export type PaymentMethod = "cod" | "card" | "upi" | "wallet" | "bank_transfer"

export interface OrderItem {
  id: number
  order_id: number
  product_id: number
  quantity: number
  price: number
  product?: Product
}

export interface Product {
  id: number
  name: string
  description?: string
  price: number
  image_url?: string
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
  coupon_code?: string
  coupon_discount?: number
  quantity_discount?: number
  offer_discount?: number
  shipping_charge?: number
  tax?: number
  subtotal?: number
}

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
}

export interface User {
  id: number
  name: string
  email: string
  created_at: string
  referred_by?: number | null
  referral_reward_earned?: number
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

export interface SupportStats {
  open: number
  total: number
  closed: number
  support_types?: Record<SupportType, number>
}

export interface ReferralCode {
  code: string
  referral_link: string
}

export interface ReferralStats {
  total_referrals: number
  successful_referrals: number
  pending_referrals: number
  total_rewards_earned: number
}

export interface ReferralHistoryItem {
  id: number
  referrer_user_id: number
  referred_user_id: number
  referral_code: string
  status: 'pending' | 'successful' | 'cancelled'
  reward_amount: number
  created_at: string
  completed_at: string | null
  referred_name: string
  referred_email: string
}

export interface ReferralHistoryResponse {
  data: ReferralHistoryItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface CouponValidationRequest {
  code: string
  cart_subtotal: number
}

export interface CouponValidationResponse {
  valid: boolean
  coupon?: {
    id: number
    code: string
    discount_type: 'percentage' | 'fixed'
    discount_value: number
    min_order_amount: number
    max_discount: number | null
  }
  discount_amount: number
  final_total: number
  error?: string
}

export interface Notification {
  id: number
  user_id: number | null
  ticket_id: number | null
  type: string
  title: string
  message: string
  link: string | null
  data: Record<string, unknown> | null
  is_read: boolean | number
  created_at: string
}

export interface NotificationsResponse {
  data: Notification[]
  unread_count: number
}

export interface ProductReview {
  id: number
  product_id: number
  user_id: number
  name: string
  email: string | null
  rating: number
  comment: string
  is_verified: boolean
  is_current_user?: boolean
  created_at: string
  updated_at: string
}

export interface ProductReviewsResponse {
  product_id: number
  reviews: ProductReview[]
  review_count: number
  avg_rating: number | null
  breakdown: { star: number; count: number; percent: number }[]
}

export interface SubmitReviewRequest {
  rating: number
  comment: string
}

export interface SubmitReviewResponse {
  message: string
  review: ProductReview
  avg_rating: number | null
  review_count: number
}

export const SUPPORT_TYPES: { value: SupportType; label: string }[] = [
  { value: "order_issue", label: "Order Issue" },
  { value: "payment_issue", label: "Payment Issue" },
  { value: "delivery_issue", label: "Delivery Issue" },
  { value: "return_refund", label: "Return & Refund" },
  { value: "other", label: "Other" },
]

export const SUPPORT_STATUSES: { value: SupportStatus; label: string; color: string }[] = [
  { value: "open", label: "Open", color: "blue" },
  { value: "closed", label: "Closed", color: "green" },
]
