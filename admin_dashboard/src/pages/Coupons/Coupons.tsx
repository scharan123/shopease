import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Plus, Search, Edit, Trash2, Eye, Loader2, Tag, Percent, Minus, Calendar,
  Filter, X
} from "lucide-react"
import { PageLayout, Section } from "@/components/layout"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import { Table } from "@/components/ui/Table"
import { Modal } from "@/components/ui/Modal"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select"
import { api } from "@/lib/api"
import { useToast } from "@/components/ui/Toast"
import { cn } from "@/lib/utils"
import type { Coupon, CreateCouponInput, UpdateCouponInput, CouponUsage, CouponStatus, CouponDiscountType } from "@/lib/types"

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const STATUS_CONFIG = {
  active: { label: "Active", color: "green", icon: "✓" },
  expired: { label: "Expired", color: "red", icon: "✕" },
  inactive: { label: "Inactive", color: "gray", icon: "○" },
} as const

const DISCOUNT_TYPE_LABELS: Record<CouponDiscountType, string> = {
  percentage: "% Off",
  fixed: "₹ Off",
}

function getCouponStatus(coupon: Coupon): CouponStatus {
  const now = new Date()
  if (!coupon.is_active) return "inactive"
  if (new Date(coupon.expiry_date) < now) return "expired"
  if (new Date(coupon.start_date) > now) return "inactive"
  return "active"
}

function getUsageCount(coupon: Coupon): number {
  return coupon.usage_count || 0
}

export function Coupons() {
  const queryClient = useQueryClient()
  const { success: showSuccess, error: showError } = useToast()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<CouponStatus | "all">("all")
  const [page, setPage] = useState(1)
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [formData, setFormData] = useState<CreateCouponInput>({
    code: "",
    discount_type: "percentage",
    discount_value: 0,
    min_order_amount: 0,
    max_discount: null,
    usage_limit: 0,
    per_user_limit: 1,
    start_date: new Date().toISOString().split("T")[0],
    expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    is_active: 1,
  })
  const [usageModalOpen, setUsageModalOpen] = useState(false)
  const [usageData, setUsageData] = useState<CouponUsage[]>([])
  const [usageTotalDiscount, setUsageTotalDiscount] = useState(0)
  const [usageLoading, setUsageLoading] = useState(false)

  const { data: couponsData, isLoading, refetch } = useQuery({
    queryKey: ["admin-coupons", { search, status: statusFilter, page }],
    queryFn: () => api.coupons.getAll({ search, status: statusFilter, page, limit: 20 }),
    placeholderData: (previousData) => previousData,
  })

  const coupons = couponsData?.data || []
  const pagination = couponsData?.pagination

  const createMutation = useMutation({
    mutationFn: (data: CreateCouponInput) => api.coupons.create(data),
    onSuccess: () => {
      showSuccess("Coupon created successfully")
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] })
      closeModal()
    },
    onError: (err: Error) => showError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCouponInput }) => api.coupons.update(id, data),
    onSuccess: () => {
      showSuccess("Coupon updated successfully")
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] })
      closeModal()
    },
    onError: (err: Error) => showError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.coupons.delete(id),
    onSuccess: () => {
      showSuccess("Coupon deleted successfully")
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] })
    },
    onError: (err: Error) => showError(err.message),
  })

  const openCreateModal = () => {
    setIsEditMode(false)
    setFormData({
      code: "",
      discount_type: "percentage",
      discount_value: 0,
      min_order_amount: 0,
      max_discount: null,
      usage_limit: 0,
      per_user_limit: 1,
      start_date: new Date().toISOString().split("T")[0],
      expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      is_active: 1,
    })
    setIsModalOpen(true)
  }

  const openEditModal = (coupon: Coupon) => {
    setIsEditMode(true)
    setSelectedCoupon(coupon)
    setFormData({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      min_order_amount: coupon.min_order_amount,
      max_discount: coupon.max_discount,
      usage_limit: coupon.usage_limit,
      per_user_limit: coupon.per_user_limit,
      start_date: coupon.start_date.split("T")[0],
      expiry_date: coupon.expiry_date.split("T")[0],
      is_active: coupon.is_active,
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedCoupon(null)
    setIsEditMode(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isEditMode && selectedCoupon) {
      updateMutation.mutate({ id: selectedCoupon.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this coupon?")) {
      deleteMutation.mutate(id)
    }
  }

  const handleViewUsage = async (couponId: number) => {
    setUsageLoading(true)
    try {
      const data = await api.coupons.getUsage(couponId, { page: 1, limit: 50 })
      setUsageData(data.data)
      setUsageTotalDiscount(data.total_discount)
      setUsageModalOpen(true)
    } catch (err) {
      showError("Failed to load usage data")
    } finally {
      setUsageLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    refetch()
  }

  return (
    <PageLayout
      title="Coupons"
      description="Manage discount coupons and promotional codes"
      actions={
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Coupon
        </Button>
      }
    >
      {/* Search and Filter */}
      <Card className="mb-6">
        <div className="p-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search coupons by code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </form>
        </div>
      </Card>

      {/* Coupons Table */}
      <Section title="All Coupons">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium text-foreground mb-2">No coupons found</p>
            <p>Create your first coupon to start offering discounts</p>
          </div>
        ) : (
          <Table<Coupon>
            columns={[
              { key: "code", header: "Code", className: "font-mono font-medium" },
              { 
                key: "discount_type", 
                header: "Type",
                render: (coupon) => (
                  <Badge variant="outline" className="gap-1">
                    {coupon.discount_type === "percentage" ? <Percent className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {DISCOUNT_TYPE_LABELS[coupon.discount_type]}
                  </Badge>
                )
              },
              { 
                key: "discount_value", 
                header: "Value",
                render: (coupon) => coupon.discount_type === "percentage" 
                  ? `${coupon.discount_value}%` 
                  : formatCurrency(coupon.discount_value)
              },
              { 
                key: "min_order_amount", 
                header: "Min Order",
                render: (coupon) => coupon.min_order_amount > 0 ? formatCurrency(coupon.min_order_amount) : "No minimum"
              },
              { 
                key: "max_discount", 
                header: "Max Discount",
                render: (coupon) => coupon.max_discount ? formatCurrency(coupon.max_discount) : "No limit"
              },
              { 
                key: "usage", 
                header: "Usage",
                render: (coupon) => {
                  const usage = getUsageCount(coupon)
                  const usageLimit = coupon.usage_limit || 0
                  const usagePercent = usageLimit > 0 ? Math.round((usage / usageLimit) * 100) : 0
                  return (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{usage}</span>
                      {usageLimit > 0 && (
                        <>
                          <span className="text-muted-foreground">/ {usageLimit}</span>
                          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary transition-all" style={{ width: `${usagePercent}%` }} />
                          </div>
                        </>
                      )}
                    </div>
                  )
                }
              },
              { 
                key: "validity", 
                header: "Validity",
                render: (coupon) => (
                  <div className="text-sm">
                    <div>From: {formatDate(coupon.start_date).split(",")[0]}</div>
                    <div className="text-muted-foreground">Until: {formatDate(coupon.expiry_date).split(",")[0]}</div>
                  </div>
                )
              },
              { 
                key: "status", 
                header: "Status",
                render: (coupon) => {
                  const status = getCouponStatus(coupon)
                  const statusConfig = STATUS_CONFIG[status]
                  return (
                    <Badge 
                      variant={statusConfig.color === "green" ? "success" : statusConfig.color === "red" ? "destructive" : "secondary"}
                      className="capitalize"
                    >
                      {statusConfig.label}
                    </Badge>
                  )
                }
              },
              { 
                key: "actions", 
                header: "Actions",
                className: "text-right",
                render: (coupon) => (
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(coupon)}
                      title="Edit"
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewUsage(coupon.id)}
                      title="View Usage"
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(coupon.id)}
                      title="Delete"
                      className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              },
            ]}
            data={coupons}
            keyExtractor={(coupon) => coupon.id}
            pagination={{
              page: pagination?.page || 1,
              pageSize: pagination?.limit || 20,
              total: pagination?.total || 0,
              onPageChange: (page) => setPage(page),
              onPageSizeChange: () => {},
            }}
          />
        )}
      </Section>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={isEditMode ? "Edit Coupon" : "Create Coupon"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Coupon Code *</label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g., SAVE10"
                disabled={isEditMode}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Unique code customers will use at checkout</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Discount Type *</label>
              <Select value={formData.discount_type} onValueChange={(v) => setFormData({ ...formData, discount_type: v as CouponDiscountType })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Discount Value *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                placeholder={formData.discount_type === "percentage" ? "e.g., 10" : "e.g., 100"}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Min Order Amount</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.min_order_amount}
                onChange={(e) => setFormData({ ...formData, min_order_amount: parseFloat(e.target.value) || 0 })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum cart value to apply coupon</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Max Discount (for % only)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.max_discount || ""}
                onChange={(e) => setFormData({ ...formData, max_discount: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="No limit"
              />
              <p className="text-xs text-muted-foreground mt-1">Cap on percentage discount amount</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Usage Limit (0 = unlimited)</label>
              <Input
                type="number"
                min="0"
                value={formData.usage_limit}
                onChange={(e) => setFormData({ ...formData, usage_limit: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">Total times this coupon can be used</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Per User Limit</label>
              <Input
                type="number"
                min="1"
                value={formData.per_user_limit}
                onChange={(e) => setFormData({ ...formData, per_user_limit: parseInt(e.target.value) || 1 })}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground mt-1">Max uses per customer</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Start Date</label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Expiry Date *</label>
              <Input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active === 1}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-foreground">Active</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                isEditMode ? "Update Coupon" : "Create Coupon"
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Usage Modal */}
      <Modal
        isOpen={usageModalOpen}
        onClose={() => setUsageModalOpen(false)}
        title="Coupon Usage History"
        size="xl"
      >
        {usageLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : usageData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No usage data for this coupon</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Discount Given</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(usageTotalDiscount)}</p>
              </div>
              <Badge variant="outline">{usageData.length} usage{usageData.length !== 1 ? "s" : ""}</Badge>
            </div>
            <Table<CouponUsage>
              columns={[
                { key: "user_name", header: "Customer" },
                { key: "user_email", header: "Email" },
                { key: "order_id", header: "Order", render: (usage) => `#${usage.order_id}` },
                { key: "order_total", header: "Order Total", render: (usage) => formatCurrency(usage.order_total) },
                { key: "discount_amount", header: "Discount", render: (usage) => <span className="text-success font-medium">-₹{usage.discount_amount.toFixed(2)}</span> },
                { key: "used_at", header: "Date", render: (usage) => formatDate(usage.used_at) },
              ]}
              data={usageData}
              keyExtractor={(usage) => usage.id}
            />
          </div>
        )}
      </Modal>
    </PageLayout>
  )
}