import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft, Package, Truck, CreditCard, MapPin, Calendar,
  Clock, CheckCircle, XCircle, AlertCircle, Download, Printer,
  Star, ChevronRight, Loader2, MessageSquare
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PageLayout, Section } from "@/components/layout"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { Modal } from "@/components/ui/Modal"
import { toast } from "@/components/ui/Toast"
import { api } from "@/lib/api"
import { downloadInvoicePDF } from "@/lib/invoiceExport"
import type { Order, OrderStatus, PaymentMethod, ProductReview, SubmitReviewRequest, SubmitReviewResponse } from "@/lib/types"

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
}

const STATUS_ICONS: Record<OrderStatus, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  processing: <Package className="h-3.5 w-3.5" />,
  shipped: <Truck className="h-3.5 w-3.5" />,
  delivered: <CheckCircle className="h-3.5 w-3.5" />,
  cancelled: <XCircle className="h-3.5 w-3.5" />,
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  shipped: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on Delivery",
  card: "Credit/Debit Card",
  upi: "UPI",
  wallet: "Wallet",
  bank_transfer: "Bank Transfer",
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant="outline" className={`gap-1.5 ${STATUS_COLORS[status]}`} dot>
      {STATUS_ICONS[status]}
      {STATUS_LABELS[status]}
    </Badge>
  )
}

function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return (
    <Badge variant="secondary" className="capitalize">
      {PAYMENT_METHOD_LABELS[method] || method.replace("_", " ")}
    </Badge>
  )
}

export function OrderDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const orderId = Number(id)

  const [isDownloading, setIsDownloading] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ["customer-order", orderId],
    queryFn: () => api.orders.getMyOne(orderId),
    enabled: !!orderId,
    retry: 1,
  })

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load order details. Please try again.")
      navigate("/dashboard")
    }
  }, [isError, navigate])

  const handleDownloadInvoice = async () => {
    if (!order) return
    setIsDownloading(true)
    try {
      downloadInvoicePDF(order)
      toast.success("Invoice downloaded successfully!")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to download invoice. Please try again."
      toast.error(message)
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePrintInvoice = () => {
    if (!order) return
    setIsPrinting(true)
    try {
      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        toast.error("Please allow popups to print invoice")
        return
      }

      const items = order.items || []
      const subtotal = order.subtotal ?? items.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const couponDiscount = order.coupon_discount ?? 0
      const quantityDiscount = order.quantity_discount ?? 0
      const shipping = order.shipping_charge ?? 0
      const tax = order.tax ?? 0

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoice #${order.id}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; color: #1e293b; }
            .container { max-width: 800px; margin: 0 auto; }
            .header { background: #1976d2; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 24px; }
            .header p { margin: 5px 0 0; opacity: 0.9; }
            .content { border: 1px solid #e2e8f0; border-top: none; padding: 20px; border-radius: 0 0 8px 8px; }
            .section { margin-bottom: 24px; }
            .section-title { font-size: 14px; font-weight: 600; color: #1e293b; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
            .info-item { display: flex; flex-direction: column; gap: 2px; }
            .info-label { font-size: 12px; color: #64748b; }
            .info-value { font-size: 14px; font-weight: 500; }
            .address-box { background: #f8fafc; padding: 12px; border-radius: 6px; white-space: pre-line; font-size: 13px; line-height: 1.6; }
            .items-table { width: 100%; border-collapse: collapse; font-size: 13px; }
            .items-table th { background: #f1f5f9; padding: 10px 8px; text-align: left; font-weight: 600; color: #334155; border-bottom: 2px solid #e2e8f0; }
            .items-table td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
            .items-table .text-right { text-align: right; }
            .items-table .text-center { text-align: center; }
            .summary { width: 100%; max-width: 350px; margin-left: auto; font-size: 13px; }
            .summary-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; }
            .summary-row.total { font-weight: 700; font-size: 16px; border-top: 2px solid #1e293b; border-bottom: none; padding-top: 12px; margin-top: 4px; color: #1976d2; }
            .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 500; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>ShopEase</h1>
              <p>Premium Online Shopping</p>
              <p style="margin-top: 10px; font-size: 18px; font-weight: 600;">INVOICE</p>
              <p style="font-size: 12px; margin-top: 5px;">Order ID: #${order.id}</p>
            </div>
            <div class="content">
              <div class="section">
                <div class="section-title">Order Information</div>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">Order ID</span>
                    <span class="info-value">#${order.id}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Order Date</span>
                    <span class="info-value">${formatDateTime(order.created_at)}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Payment Method</span>
                    <span class="info-value">${PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Order Status</span>
                    <span class="info-value"><span class="badge" style="background: ${getStatusBgColor(order.status)}; color: ${getStatusTextColor(order.status)};">${STATUS_LABELS[order.status]}</span></span>
                  </div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">Customer / Shipping Address</div>
                <div class="info-grid">
                  <div class="info-item" style="grid-column: 1 / -1;">
                    <span class="info-label">Customer Name</span>
                    <span class="info-value">${order.user?.name || "Guest Customer"}</span>
                  </div>
                  <div class="info-item" style="grid-column: 1 / -1;">
                    <span class="info-label">Email</span>
                    <span class="info-value">${order.user?.email || "N/A"}</span>
                  </div>
                </div>
                <div style="margin-top: 12px;">
                  <span class="info-label" style="display: block; margin-bottom: 6px;">Shipping Address</span>
                  <div class="address-box">${order.shipping_address}</div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">Order Items</div>
                <table class="items-table">
                  <thead>
                    <tr>
                      <th style="width: 45%;">Product</th>
                      <th class="text-center" style="width: 10%;">Qty</th>
                      <th class="text-right" style="width: 20%;">Unit Price</th>
                      <th class="text-right" style="width: 25%;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items.map(item => `
                      <tr>
                        <td>${item.product?.name || "Unknown Product"}</td>
                        <td class="text-center">${item.quantity}</td>
                        <td class="text-right">${formatCurrency(item.price)}</td>
                        <td class="text-right">${formatCurrency(item.price * item.quantity)}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>

              <div class="section">
                <div class="section-title">Price Summary</div>
                <table class="summary">
                  <tr class="summary-row">
                    <td>Subtotal</td>
                    <td>${formatCurrency(subtotal)}</td>
                  </tr>
                  ${couponDiscount > 0 ? `
                  <tr class="summary-row" style="color: #16a34a;">
                    <td>Coupon Discount</td>
                    <td>-${formatCurrency(couponDiscount)}</td>
                  </tr>
                  ` : ""}
                  ${quantityDiscount > 0 ? `
                  <tr class="summary-row" style="color: #16a34a;">
                    <td>Quantity Discount</td>
                    <td>-${formatCurrency(quantityDiscount)}</td>
                  </tr>
                  ` : ""}
                  <tr class="summary-row">
                    <td>Shipping</td>
                    <td>${formatCurrency(shipping)}</td>
                  </tr>
                  ${tax > 0 ? `
                  <tr class="summary-row">
                    <td>Tax</td>
                    <td>${formatCurrency(tax)}</td>
                  </tr>
                  ` : ""}
                  <tr class="summary-row total">
                    <td>TOTAL</td>
                    <td>${formatCurrency(order.total_amount)}</td>
                  </tr>
                </table>
              </div>

              <div class="footer">
                <p>Thank you for shopping with ShopEase!</p>
                <p>For any queries, contact support@shopease.com</p>
              </div>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
        </html>
      `

      printWindow.document.write(printContent)
      printWindow.document.close()
      toast.success("Print dialog opened")
    } catch (error) {
      toast.error("Failed to open print dialog")
    } finally {
      setIsPrinting(false)
    }
  }

  function getStatusBgColor(status: OrderStatus): string {
    const colors: Record<OrderStatus, string> = {
      pending: "#fff3e0",
      processing: "#e3f2fd",
      shipped: "#f3e8ff",
      delivered: "#e8f5e9",
      cancelled: "#fef2f2",
    }
    return colors[status] || "#f1f5f9"
  }

  function getStatusTextColor(status: OrderStatus): string {
    const colors: Record<OrderStatus, string> = {
      pending: "#e65100",
      processing: "#1565c0",
      shipped: "#7c3aed",
      delivered: "#166534",
      cancelled: "#b91c1c",
    }
    return colors[status] || "#334155"
  }

  // Review Modal State
  const [reviewProduct, setReviewProduct] = useState<{ productId: number; productName: string; productImage?: string } | null>(null)
  const [reviewRating, setReviewRating] = useState<number>(0)
  const [reviewComment, setReviewComment] = useState<string>("")

  const queryClient = useQueryClient()

  const submitReviewMutation = useMutation<SubmitReviewResponse, Error, SubmitReviewRequest>({
    mutationFn: (data) => api.reviews.submitReview(reviewProduct!.productId, data),
    onSuccess: (response) => {
      toast.success(response.message || "Review submitted successfully!")
      setReviewProduct(null)
      setReviewRating(0)
      setReviewComment("")
      queryClient.invalidateQueries({ queryKey: ["customer-order", orderId] })
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit review. Please try again.")
    },
  })

  const openReviewModal = (productId: number, productName: string, productImage?: string) => {
    setReviewProduct({ productId, productName, productImage })
    setReviewRating(0)
    setReviewComment("")
  }

  const handleSubmitReview = () => {
    if (!reviewProduct) return
    if (reviewRating === 0) {
      toast.error("Please select a rating")
      return
    }
    if (!reviewComment.trim()) {
      toast.error("Please write your feedback")
      return
    }
    if (reviewComment.trim().length < 3) {
      toast.error("Feedback must be at least 3 characters long")
      return
    }
    submitReviewMutation.mutate({ rating: reviewRating, comment: reviewComment.trim() })
  }

  const handleCloseReviewModal = () => {
    if (!submitReviewMutation.isPending) {
      setReviewProduct(null)
      setReviewRating(0)
      setReviewComment("")
    }
  }

  // Review Modal Component
  function ReviewModal() {
    if (!reviewProduct) return null

    return (
      <Modal
        isOpen={true}
        onClose={handleCloseReviewModal}
        title="Rate & Review"
        description={`Share your experience with ${reviewProduct.productName}`}
        size="md"
      >
        <div className="space-y-6">
          {/* Product Info */}
          <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
            {reviewProduct.productImage ? (
              <img src={reviewProduct.productImage} alt={reviewProduct.productName} className="h-16 w-16 rounded-lg object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{reviewProduct.productName}</p>
              <p className="text-sm text-muted-foreground">Order #{order?.id}</p>
            </div>
          </div>

          {/* Star Rating */}
          <div>
            <label className="block text-sm font-medium mb-3">Your Rating</label>
            <div className="flex items-center gap-2" role="radiogroup" aria-label="Select rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={reviewRating === star}
                                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                  onClick={() => setReviewRating(star)}
                  className="p-1 transition-transform hover:scale-110 active:scale-95"
                >
                  <Star
                    className="h-8 w-8"
                    fill={reviewRating >= star ? "currentColor" : "none"}
                    stroke="currentColor"
                    style={{ color: reviewRating >= star ? "#fbbf24" : "#d1d5db" }}
                  />
                </button>
              ))}
            </div>
            {reviewRating > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {["Poor", "Fair", "Good", "Very Good", "Excellent"][reviewRating - 1]}
              </p>
            )}
          </div>

          {/* Review Text */}
          <div>
            <label className="block text-sm font-medium mb-2">Your Feedback</label>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Share your experience with this product..."
              className="w-full min-h-[100px] p-3 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              maxLength={2000}
            />
            <p className="mt-1 text-sm text-muted-foreground">
              {reviewComment.length}/2000 characters
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={handleCloseReviewModal}
              disabled={submitReviewMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={submitReviewMutation.isPending || reviewRating === 0 || !reviewComment.trim()}
              isLoading={submitReviewMutation.isPending}
            >
              {submitReviewMutation.isPending ? "Submitting..." : "Submit Review"}
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  if (isLoading) {
    return (
      <PageLayout title="Order Details" description="Loading order information...">
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Card className="animate-pulse">
                <div className="p-6">
                <div className="h-4 w-48 bg-muted rounded mb-4" />
                <div className="space-y-3">
                  <div className="h-4 w-64 bg-muted rounded" />
                  <div className="h-4 w-48 bg-muted rounded" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </PageLayout>
    )
  }

  if (!order) {
    return (
      <PageLayout title="Order Not Found" description="The order you are looking for does not exist.">
        <div className="text-center py-12">
          <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Order Not Found</h2>
          <p className="text-muted-foreground mb-6">The order you are looking for does not exist or has been removed.</p>
          <Button onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </PageLayout>
    )
  }

  const items = order.items || []
  const subtotal = order.subtotal ?? items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const couponDiscount = order.coupon_discount ?? 0
  const quantityDiscount = order.quantity_discount ?? 0
  const shipping = order.shipping_charge ?? 0
  const tax = order.tax ?? 0

  return (
    <PageLayout title={`Order #${order.id}`} description={`Placed on ${formatDate(order.created_at)}`}>
      <div className="flex items-center justify-between mb-6">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintInvoice}
            disabled={isPrinting}
            className="gap-2"
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {isPrinting ? "Printing..." : "Print Invoice"}
          </Button>
          <Button
            onClick={handleDownloadInvoice}
            disabled={isDownloading}
            className="gap-2"
          >
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isDownloading ? "Generating Invoice..." : "Download Invoice"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Order Items">
            <Card>
              <div className="p-0">
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
                      <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.product?.image_url ? (
                          <img src={item.product.image_url} alt={item.product?.name} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.product?.name || "Unknown Product"}</p>
                        <p className="text-sm text-muted-foreground">Qty: {item.quantity} × {formatCurrency(item.price)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(item.price * item.quantity)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Section>

          <Section title="Price Summary">
            <Card>
              <div className="p-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Coupon Discount</span>
                      <span className="font-medium">-{formatCurrency(couponDiscount)}</span>
                    </div>
                  )}
                  {quantityDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Quantity Discount</span>
                      <span className="font-medium">-{formatCurrency(quantityDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="font-medium">{formatCurrency(shipping)}</span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="font-medium">{formatCurrency(tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-3 border-t border-border text-lg font-bold">
                    <span>TOTAL</span>
                    <span className="text-primary">{formatCurrency(order.total_amount)}</span>
                  </div>
                </div>
              </div>
            </Card>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Order Status">
            <Card>
              <div className="p-6">
                <div className="relative pl-4 border-l border-border">
                  {[
                    { status: "pending" as OrderStatus, label: "Order Placed", time: order.created_at, completed: true },
                    { status: "processing" as OrderStatus, label: "Processing", time: order.status !== "pending" ? order.updated_at : null, completed: ["processing", "shipped", "delivered"].includes(order.status) },
                    { status: "shipped" as OrderStatus, label: "Shipped", time: order.shipped_at, completed: ["shipped", "delivered"].includes(order.status) },
                    { status: "delivered" as OrderStatus, label: "Delivered", time: order.delivered_at, completed: order.status === "delivered" },
                    { status: "cancelled" as OrderStatus, label: "Cancelled", time: order.status === "cancelled" ? order.updated_at : null, completed: order.status === "cancelled" },
                  ].map((step, index) => (
                    <div key={step.status} className="relative mb-6 last:mb-0">
                      <div className="absolute left-[-26px] top-0 h-4 w-4 rounded-full border-2 border-border bg-background flex items-center justify-center z-10">
                        {step.completed && <CheckCircle className="h-3 w-3 text-green-500" />}
                        {!step.completed && index < 3 && <div className="h-2 w-2 rounded-full bg-border" />}
                      </div>
                      <div className={cn("pb-6", step.completed ? "text-foreground" : "text-muted-foreground")}>
                        <div className="flex items-center gap-2 mb-1">
                          {STATUS_ICONS[step.status]}
                          <span className="font-medium">{step.label}</span>
                          {step.completed && step.time && (
                            <span className="text-sm text-muted-foreground">({formatDateTime(step.time)})</span>
                          )}
                        </div>
                        {step.status === "shipped" && order.tracking_number && (
                          <p className="text-sm ml-6">Tracking: <span className="font-mono">{order.tracking_number}</span></p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Section>

          <Section title="Order Information">
            <Card>
              <div className="p-6">
                <dl className="space-y-4">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Order ID</dt>
                    <dd className="font-mono font-medium">#{order.id}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Order Date</dt>
                    <dd>{formatDateTime(order.created_at)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Payment Method</dt>
                    <dd><PaymentMethodBadge method={order.payment_method} /></dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Order Status</dt>
                    <dd><OrderStatusBadge status={order.status} /></dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Total Amount</dt>
                    <dd className="font-medium text-lg">{formatCurrency(order.total_amount)}</dd>
                  </div>
                  {order.tracking_number && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Tracking Number</dt>
                      <dd className="font-mono text-sm">{order.tracking_number}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </Card>
          </Section>

          <Section title="Shipping Address">
            <Card>
              <div className="p-6">
                <div className="space-y-2">
                  <p className="font-medium">{order.user?.name || "Guest Customer"}</p>
                  {order.user?.email && <p className="text-sm text-muted-foreground">{order.user?.email}</p>}
                  <div className="whitespace-pre-wrap text-sm mt-2">{order.shipping_address}</div>
                </div>
              </div>
            </Card>
          </Section>

          {order.status === "delivered" && items.length > 0 && (
            <Section title="Delivered Products">
              <Card>
                <div className="p-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    Share your experience with the products you received.
                  </p>
                  <div className="space-y-4">
                    {items.map((item) => (
                      item.product && (
                        <div key={item.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                              {item.product?.image_url ? (
                                <img src={item.product.image_url} alt={item.product?.name} className="h-full w-full object-cover" />
                              ) : (
                                <Package className="h-6 w-6 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{item.product?.name || "Unknown Product"}</p>
                              <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openReviewModal(item.product!.id, item.product!.name, item.product!.image_url)}
                            className="gap-1.5 flex-shrink-0"
                            aria-label={`Rate and review ${item.product.name}`}
                          >
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span>Rate & Review</span>
                          </Button>
                        </div>
                      )
                    ))}
                  </div>
                  {items.every(item => !item.product) && (
                    <p className="text-center text-muted-foreground py-4">
                      No products available for review.
                    </p>
                  )}
                </div>
              </Card>
            </Section>
          )}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between pt-6 border-t border-border">
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Orders
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrintInvoice} disabled={isPrinting} className="gap-2">
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {isPrinting ? "Printing..." : "Print Invoice"}
          </Button>
          <Button onClick={handleDownloadInvoice} disabled={isDownloading} className="gap-2">
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isDownloading ? "Generating Invoice..." : "Download Invoice"}
          </Button>
        </div>
      </div>
      <ReviewModal />
    </PageLayout>
  )
}