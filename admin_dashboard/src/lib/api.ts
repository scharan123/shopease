import type {
  User,
  Category,
  Product,
  Order,
  DashboardStats,
  ChartDataPoint,
  CategoryRevenue,
  PaymentMethodStats,
  OrderStatusStats,
  PaginatedResponse,
  FilterParams,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateProductInput,
  UpdateProductInput,
  UpdateOrderStatusInput,
  BulkActionInput,
  SupportRequest,
  SupportStatus,
  NotificationsResponse,
  Review,
  Coupon,
  CouponUsage,
  CouponStats,
  CreateCouponInput,
  UpdateCouponInput,
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
  const token = localStorage.getItem("admin_token")
  
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

export const api = {
  auth: {
    login: (email: string, password: string) =>
      fetchWithAuth<{ user: User; token: string }>("/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    me: () => fetchWithAuth<User>("/admin/me"),
    updateProfile: (data: { name: string; email: string }) =>
      fetchWithAuth<User>("/admin/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    changePassword: (data: { current_password: string; new_password: string }) =>
      fetchWithAuth<User>("/admin/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    logout: () => fetchWithAuth("/admin/logout", { method: "POST" }),
  },

  dashboard: {
    getStats: () => fetchWithAuth<DashboardStats>("/admin/stats"),
    getChartData: (range: string) =>
      fetchWithAuth<ChartDataPoint[]>(`/admin/analytics?range=${range}`),
    getCategoryRevenue: () => fetchWithAuth<CategoryRevenue[]>("/admin/analytics/categories"),
    getPaymentStats: () => fetchWithAuth<PaymentMethodStats[]>("/admin/analytics/payments"),
    getOrderStatusStats: () => fetchWithAuth<OrderStatusStats[]>("/admin/analytics/order-status"),
  },

  categories: {
    getAll: (params?: FilterParams) => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value))
          }
        })
      }
      return fetchWithAuth<PaginatedResponse<Category>>(
        `/admin/categories?${searchParams.toString()}`
      )
    },
    getOne: (id: number) => fetchWithAuth<Category>(`/admin/categories/${id}`),
    create: (data: CreateCategoryInput) =>
      fetchWithAuth<Category>("/admin/categories", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: UpdateCategoryInput) =>
      fetchWithAuth<Category>(`/admin/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      fetchWithAuth(`/admin/categories/${id}`, { method: "DELETE" }),
    bulkDelete: (ids: number[]) =>
      fetchWithAuth("/admin/categories/bulk", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      }),
    reorder: (items: { id: number; display_order: number }[]) =>
      fetchWithAuth("/admin/categories/reorder", {
        method: "PUT",
        body: JSON.stringify({ items }),
      }),
  },

  products: {
    getAll: (params?: FilterParams) => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value))
          }
        })
      }
      return fetchWithAuth<PaginatedResponse<Product>>(
        `/admin/products?${searchParams.toString()}`
      )
    },
    getOne: (id: number) => fetchWithAuth<Product>(`/admin/products/${id}`),
    create: (data: CreateProductInput) =>
      fetchWithAuth<Product>("/admin/products", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: UpdateProductInput) =>
      fetchWithAuth<Product>(`/admin/products/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      fetchWithAuth(`/admin/products/${id}`, { method: "DELETE" }),
    bulkDelete: (ids: number[]) =>
      fetchWithAuth("/admin/products/bulk", {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      }),
    uploadImages: (id: number, files: File[]) => {
      const formData = new FormData()
      files.forEach((file) => formData.append("images", file))
      return fetchWithAuth<string[]>(`/admin/products/${id}/images`, {
        method: "POST",
        headers: {},
        body: formData,
      })
    },
    deleteImage: (id: number, imageUrl: string) =>
      fetchWithAuth(`/admin/products/${id}/images`, {
        method: "DELETE",
        body: JSON.stringify({ image_url: imageUrl }),
      }),
  },

  orders: {
    getAll: (params?: FilterParams) => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value))
          }
        })
      }
      return fetchWithAuth<PaginatedResponse<Order>>(
        `/admin/orders?${searchParams.toString()}`
      )
    },
    getOne: (id: number) => fetchWithAuth<Order>(`/admin/orders/${id}`),
    updateStatus: (id: number, data: UpdateOrderStatusInput) =>
      fetchWithAuth<Order>(`/admin/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    bulkUpdateStatus: (ids: number[], status: Order["status"]) =>
      fetchWithAuth("/admin/orders/bulk-status", {
        method: "PATCH",
        body: JSON.stringify({ ids, status }),
      }),
    export: (params?: FilterParams) => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value))
          }
        })
      }
      return fetch(`${API_BASE}/admin/orders/export?${searchParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
        },
      }).then((res) => res.blob())
    },
  },

  users: {
    getAll: (params?: FilterParams) => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value))
          }
        })
      }
      return fetchWithAuth<PaginatedResponse<User>>(
        `/admin/users?${searchParams.toString()}`
      )
    },
    getOne: (id: number) => fetchWithAuth<User>(`/admin/users/${id}`),
    updateRole: (id: number, role: "admin" | "user") =>
      fetchWithAuth<User>(`/admin/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    delete: (id: number) =>
      fetchWithAuth(`/admin/users/${id}`, { method: "DELETE" }),
    export: (params?: FilterParams) => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value))
          }
        })
      }
      return fetch(`${API_BASE}/admin/users/export?${searchParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
        },
      }).then((res) => res.blob())
    },
  },

  reviews: {
    getAll: (params?: FilterParams) => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value))
          }
        })
      }
      return fetchWithAuth<PaginatedResponse<Review>>(
        `/admin/reviews?${searchParams.toString()}`
      )
    },
    delete: (id: number) =>
      fetchWithAuth(`/admin/reviews/${id}`, { method: "DELETE" }),
  },

  support: {
    getAll: (params?: FilterParams) => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value))
          }
        })
      }
      return fetchWithAuth<PaginatedResponse<SupportRequest>>(
        `/support?${searchParams.toString()}`
      )
    },
    getOne: (id: number) => fetchWithAuth<SupportRequest>(`/support/${id}`),
    updateStatus: (id: number, status: SupportStatus) =>
      fetchWithAuth<SupportRequest>(`/support/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    reply: (id: number, admin_reply: string) =>
      fetchWithAuth<SupportRequest>(`/support/${id}/reply`, {
        method: "PATCH",
        body: JSON.stringify({ admin_reply }),
      }),
    getStats: () => fetchWithAuth<{ open: number; total: number; support_types: Record<string, number>; open_support_types: Record<string, number> }>("/support/stats/count"),
  },

  notifications: {
    getAll: () => fetchWithAuth<NotificationsResponse>("/notifications"),
    markRead: (id: number) =>
      fetchWithAuth(`/notifications/${id}/read`, {
        method: "PATCH",
      }),
    markAllRead: () =>
      fetchWithAuth("/notifications/read-all", {
        method: "POST",
        body: JSON.stringify({}),
      }),
  },

  coupons: {
    getAll: (params?: FilterParams & { status?: string }) => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value))
          }
        })
      }
      return fetchWithAuth<PaginatedResponse<Coupon>>(
        `/admin/coupons?${searchParams.toString()}`
      )
    },
    getOne: (id: number) => fetchWithAuth<Coupon>(`/admin/coupons/${id}`),
    create: (data: CreateCouponInput) =>
      fetchWithAuth<Coupon>("/admin/coupons", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: number, data: UpdateCouponInput) =>
      fetchWithAuth<Coupon>(`/admin/coupons/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: number) =>
      fetchWithAuth(`/admin/coupons/${id}`, { method: "DELETE" }),
    getUsage: (id: number, params?: FilterParams) => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value))
          }
        })
      }
      return fetchWithAuth<{ data: CouponUsage[]; total_discount: number; pagination: PaginatedResponse<CouponUsage>['pagination'] }>(
        `/admin/coupons/${id}/usage?${searchParams.toString()}`
      )
    },
    getStats: () => fetchWithAuth<CouponStats>("/admin/referrals/stats"),
  },

  referrals: {
    getAll: (params?: FilterParams & { status?: string }) => {
      const searchParams = new URLSearchParams()
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, String(value))
          }
        })
      }
      return fetchWithAuth<PaginatedResponse<{
        id: number
        referrer_user_id: number
        referred_user_id: number
        referral_code: string
        status: string
        reward_amount: number
        created_at: string
        completed_at: string | null
        referrer_name: string
        referrer_email: string
        referred_name: string
        referred_email: string
      }>>(`/admin/referrals?${searchParams.toString()}`)
    },
    getStats: () => fetchWithAuth<CouponStats>("/admin/referrals/stats"),
  },
}

export { ApiError }