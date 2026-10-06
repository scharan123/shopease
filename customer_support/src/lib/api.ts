import type {
  User,
  SupportRequest,
  SupportStatus,
  PaginatedResponse,
  SupportStats,
  Notification,
  NotificationsResponse,
  ReferralCode,
  ReferralStats,
  ReferralHistoryResponse,
  CouponValidationRequest,
  CouponValidationResponse,
  Order,
  OrderStatus,
  PaymentMethod,
  ProductReview,
  ProductReviewsResponse,
  SubmitReviewRequest,
  SubmitReviewResponse,
} from "./types"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api"

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("customer_token")

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new ApiError(
      errorData.error || `HTTP error! status: ${response.status}`,
      response.status,
      errorData
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

export interface Address {
  id: number
  user_id: number
  name: string
  phone: string
  address_line: string
  area: string | null
  city: string
  state: string
  pincode: string
  country: string
  is_default: number
  created_at: string
  updated_at: string
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      fetchWithAuth<{ user: User; token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    register: (data: { name: string; email: string; password: string; referral_code?: string }) =>
      fetchWithAuth<{ user: { id: number; name: string; email: string }; token: string; message: string }>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      ),
    me: () => fetchWithAuth<User>("/auth/me"),
    forgotPassword: (email: string) =>
      fetchWithAuth<{ otpToken: string }>("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    verifyResetOTP: (otpToken: string, otp: string) =>
      fetchWithAuth<{ success: boolean }>("/auth/verify-reset-otp", {
        method: "POST",
        body: JSON.stringify({ otpToken, otp }),
      }),
    resetPassword: (otpToken: string, otp: string, newPassword: string, confirmPassword: string) =>
      fetchWithAuth<{ success: boolean }>("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ otpToken, otp, newPassword, confirmPassword }),
      }),
  },

  addresses: {
    getAll: () => fetchWithAuth<Address[]>("/addresses"),
    create: (data: {
      name: string
      phone: string
      address_line: string
      area?: string
      city: string
      state: string
      pincode: string
      country?: string
      is_default?: boolean
    }) =>
      fetchWithAuth<Address>("/addresses", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: Partial<Address>) =>
      fetchWithAuth<Address>(`/addresses/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      fetchWithAuth<{ success: boolean }>(`/addresses/${id}`, {
        method: "DELETE",
      }),
    setDefault: (id: number) =>
      fetchWithAuth<Address>(`/addresses/${id}/default`, {
        method: "PUT",
      }),
  },

  support: {
    getMy: (params?: { page?: number; limit?: number; search?: string; status?: string; support_type?: string }) => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && String(value) !== "") {
            searchParams.append(key, String(value))
          }
        })
      }
      return fetchWithAuth<PaginatedResponse<SupportRequest>>(
        `/support/my?${searchParams.toString()}`
      )
    },
    getMyOne: (id: number) =>
      fetchWithAuth<SupportRequest>(`/support/my/${id}`),
    getMyStats: () =>
      fetchWithAuth<SupportStats>("/support/my/stats"),
    create: (data: {
      name: string
      email: string
      mobile: string
      support_type: string
      description: string
    }) =>
      fetchWithAuth<{ message: string; support_id: string; request: SupportRequest }>(
        "/support",
        {
          method: "POST",
          body: JSON.stringify(data),
        }
      ),
  },

  notifications: {
    getMy: (params?: { limit?: number }) => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && String(value) !== "") {
            searchParams.append(key, String(value))
          }
        })
      }
      const qs = searchParams.toString()
      return fetchWithAuth<NotificationsResponse>(`/notifications/my${qs ? `?${qs}` : ""}`)
    },
    getUnreadCount: () =>
      fetchWithAuth<{ unread_count: number }>("/notifications/unread-count"),
    markRead: (id: number) =>
      fetchWithAuth<{ success: boolean }>(`/notifications/${id}/read`, {
        method: "PATCH",
      }),
    markAllRead: () =>
      fetchWithAuth<{ success: boolean }>("/notifications/my/read-all", {
        method: "POST",
      }),
  },

  referrals: {
    getMyCode: () => fetchWithAuth<ReferralCode>("/referrals/my-code"),
    getStats: () => fetchWithAuth<ReferralStats>("/referrals/stats"),
    getHistory: (params?: { page?: number; limit?: number }) => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && String(value) !== "") {
            searchParams.append(key, String(value))
          }
        })
      }
      return fetchWithAuth<ReferralHistoryResponse>(`/referrals/history?${searchParams.toString()}`)
    },
    validateCode: (code: string) => fetchWithAuth<{ valid: boolean; referral_code: string; referrer_name: string }>(`/referrals/validate/${code}`),
  },

  coupons: {
    validate: (data: CouponValidationRequest) => fetchWithAuth<CouponValidationResponse>("/coupons/validate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  },

  reviews: {
    getProductReviews: (productId: number) =>
      fetchWithAuth<ProductReviewsResponse>(`/products/${productId}/reviews`),
    submitReview: (productId: number, data: SubmitReviewRequest) =>
      fetchWithAuth<SubmitReviewResponse>(`/products/${productId}/reviews`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getMyReviews: () =>
      fetchWithAuth<{ reviews: ProductReview[] }>("/reviews/my"),
    updateReview: (reviewId: number, data: SubmitReviewRequest) =>
      fetchWithAuth<SubmitReviewResponse>(`/reviews/${reviewId}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    deleteReview: (reviewId: number) =>
      fetchWithAuth<{ message: string; avg_rating: number | null; review_count: number }>(`/reviews/${reviewId}`, {
        method: "DELETE",
      }),
  },

  orders: {
    getMy: (params?: { page?: number; limit?: number; status?: OrderStatus }) => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && String(value) !== "") {
            searchParams.append(key, String(value))
          }
        })
      }
      return fetchWithAuth<PaginatedResponse<Order>>(
        `/orders?${searchParams.toString()}`
      ).then(transformOrderListResponse)
    },
    getMyOne: (id: number) =>
      fetchWithAuth<Order>(`/orders/${id}`).then(transformOrderResponse),
  },
}

function transformOrderResponse(data: any): Order {
  if (!data) return data
  return {
    ...data,
    coupon_discount: data.discount_amount ?? 0,
    shipping_charge: data.delivery_charge ?? 0,
    tax: data.tax_amount ?? 0,
  }
}

function transformOrderListResponse(data: PaginatedResponse<Order>): PaginatedResponse<Order> {
  if (!data?.data) return data
  return {
    ...data,
    data: data.data.map(transformOrderResponse),
  }
}

export { ApiError }
