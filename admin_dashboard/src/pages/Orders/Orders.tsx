import { useState, Fragment } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSearchParams } from "react-router-dom"
import { cn } from "lib/utils"
import { formatCurrency, formatRelativeTime, formatDate, getStatusColor, getPaymentMethodColor } from "lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "ui/Card"
import { Button } from "ui/Button"
import { Input } from "ui/Input"
import { Select } from "ui/Input"
import { Table } from "ui/Table"
import { Modal, ConfirmModal } from "ui/Modal"
import { Badge } from "ui/Badge"
import { Dropdown, ActionDropdown } from "ui/Dropdown"
import { Avatar } from "ui/Avatar"
import { Skeleton, SkeletonTable } from "ui/Skeleton"
import { Tabs, TabTrigger, TabContent } from "ui/Tabs"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "lib/api"
import type { Order, OrderStatus, OrderItem, User } from "lib/types"
import {
  Search,
  Filter,
  Eye,
  Edit,
  Truck,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  MapPin,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
} from "lucide-react"

const STATUS_ORDER: OrderStatus[] = ["pending", "processing", "shipped", "delivered", "cancelled"]
const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
}

const STATUS_ICONS: Record<OrderStatus, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  processing: <Package className="h-3 w-3" />,
  shipped: <Truck className="h-3 w-3" />,
  delivered: <CheckCircle className="h-3 w-3" />,
  cancelled: <XCircle className="h-3 w-3" />,
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant="outline" className="gap-1.5" dot>
      {STATUS_ICONS[status]}
      {STATUS_LABELS[status]}
    </Badge>
  )
}

function PaymentMethodBadge({ method }: { method: string }) {
  return (
    <Badge variant="secondary" className="capitalize">
      {method.replace("_", " ")}
    </Badge>
  )
}

const statusOptions = STATUS_ORDER.map((status) => ({
  value: status,
  label: STATUS_LABELS[status],
}))

export function Orders() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "")
  const [statusFilter, setStatusFilter] = useState("all")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [newStatus, setNewStatus] = useState<OrderStatus>("pending")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data: ordersData, isLoading, isFetching } = useQuery({
    queryKey: ["admin", "orders", { search: searchQuery, status: statusFilter, payment: paymentFilter, dateFrom, dateTo, page, limit: pageSize }],
    queryFn: () => api.orders.getAll({
      search: searchQuery,
      status: statusFilter !== "all" ? statusFilter : undefined,
      payment_method: paymentFilter !== "all" ? paymentFilter : undefined,
      startDate: dateFrom || undefined,
      endDate: dateTo || undefined,
      page,
      limit: pageSize,
      sortBy: "created_at",
      sortOrder: "desc",
    }),
  })

  const orders = ordersData?.data || []
  const totalPages = ordersData?.pagination.totalPages || 1
  const totalOrders = ordersData?.pagination.total || 0

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status: OrderStatus; tracking_number?: string } }) =>
      api.orders.updateStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] })
      setIsStatusModalOpen(false)
      setSelectedOrder(null)
      setTrackingNumber("")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.orders.bulkUpdateStatus([id], "cancelled"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] })
      setIsDeleteOpen(false)
      setDeletingId(null)
    },
  })

  const handleView = (order: Order) => {
    setSelectedOrder(order)
    setIsDetailModalOpen(true)
  }

  const handleStatusChange = (order: Order) => {
    setSelectedOrder(order)
    setNewStatus(order.status)
    setTrackingNumber(order.tracking_number || "")
    setIsStatusModalOpen(true)
  }

  const handleDelete = (id: number) => {
    setDeletingId(id)
    setIsDeleteOpen(true)
  }

  const columns = [
    {
      key: "id",
      header: "Order ID",
      render: (row: Order) => (
        <span className="font-mono font-medium">#{row.id}</span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (row: Order) => (
        <div className="flex items-center gap-3">
          <Avatar
            size="sm"
            fallback={row.user?.name || "U"}
            src={row.user?.email ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.user.email}` : undefined}
          />
          <div>
            <p className="font-medium text-sm">{row.user?.name || "Guest"}</p>
            <p className="text-xs text-muted-foreground">{row.user?.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "total_amount",
      header: "Amount",
      render: (row: Order) => (
        <span className="font-medium">{formatCurrency(row.total_amount)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row: Order) => <OrderStatusBadge status={row.status} />,
    },
    {
      key: "payment_method",
      header: "Payment",
      render: (row: Order) => <PaymentMethodBadge method={row.payment_method} />,
    },
    {
      key: "created_at",
      header: "Date",
      render: (row: Order) => <span className="text-sm text-muted-foreground">{formatRelativeTime(row.created_at)}</span>,
    },
    {
      key: "actions",
      header: "",
      render: (row: Order) => (
        <Dropdown
          trigger={({ onToggle }) => (
            <Button variant="ghost" size="icon" onClick={onToggle}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
          items={[
            { label: "View Details", onClick: () => handleView(row), icon: <Eye className="h-4 w-4" /> },
            { label: "Update Status", onClick: () => handleStatusChange(row), icon: <Edit className="h-4 w-4" /> },
            { label: "Cancel Order", onClick: () => handleDelete(row.id), icon: <XCircle className="h-4 w-4" />, danger: true },
          ]}
        />
      ),
    },
  ]

  const handleStatusSubmit = () => {
    if (selectedOrder) {
      updateStatusMutation.mutate({
        id: selectedOrder.id,
        data: { status: newStatus, tracking_number: trackingNumber || undefined },
      })
    }
  }

  const getNextStatus = (current: OrderStatus): OrderStatus => {
    const index = STATUS_ORDER.indexOf(current)
    return STATUS_ORDER[Math.min(index + 1, STATUS_ORDER.length - 1)]
  }

  const getPrevStatus = (current: OrderStatus): OrderStatus => {
    const index = STATUS_ORDER.indexOf(current)
    return STATUS_ORDER[Math.max(index - 1, 0)]
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground">Manage and track customer orders</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => console.log("Export orders")}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 pt-0">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input
              placeholder="Search orders... (by ID, customer name or email)"
              value={searchQuery}
              onChange={(e) => {
                const v = e.target.value
                setSearchQuery(v)
                setPage(1)
                setSearchParams(v ? { q: v } : {}, { replace: true })
              }}
              className="flex-1 max-w-md"
            />
            <Select
              value={statusFilter}
              onChange={(value) => { setStatusFilter(value); setPage(1); }}
              options={[{ value: "all", label: "All Status" }, ...statusOptions]}
              className="w-[160px]"
            />
            <Select
              value={paymentFilter}
              onChange={(value) => { setPaymentFilter(value); setPage(1); }}
              options={[
                { value: "all", label: "All Payments" },
                { value: "cod", label: "Cash on Delivery" },
                { value: "card", label: "Card" },
                { value: "upi", label: "UPI" },
                { value: "wallet", label: "Wallet" },
                { value: "bank_transfer", label: "Bank Transfer" },
              ]}
              className="w-[160px]"
            />
            <Input
              type="date"
              placeholder="From"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="w-[160px]"
            />
            <Input
              type="date"
              placeholder="To"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="w-[160px]"
            />
          </div>

          <Table
            columns={columns}
            data={orders}
            keyExtractor={(row) => row.id}
            isLoading={isLoading}
            emptyMessage="No orders found"
            pagination={{
              page,
              pageSize,
              total: totalOrders,
              onPageChange: setPage,
              onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
            }}
          />
        </CardContent>
      </Card>

      <OrderDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setSelectedOrder(null); }}
        order={selectedOrder}
        onUpdateStatus={handleStatusChange}
      />

      <OrderStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => { setIsStatusModalOpen(false); setSelectedOrder(null); setTrackingNumber(""); }}
        onSubmit={handleStatusSubmit}
        order={selectedOrder}
        status={newStatus}
        setStatus={setNewStatus}
        trackingNumber={trackingNumber}
        setTrackingNumber={setTrackingNumber}
        isLoading={updateStatusMutation.isPending}
      />

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => { setIsDeleteOpen(false); setDeletingId(null); }}
        onConfirm={() => { if (deletingId) deleteMutation.mutate(deletingId) }}
        title="Cancel Order"
        description="Are you sure you want to cancel this order?"
        confirmText="Cancel Order"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

function OrderDetailModal({ isOpen, onClose, order, onUpdateStatus }: { isOpen: boolean; onClose: () => void; order: Order | null; onUpdateStatus: (order: Order) => void }) {
  if (!order) return null

  const currentStatusIndex = STATUS_ORDER.indexOf(order.status)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Order #${order.id}`} size="xl">
      <Tabs defaultValue="details" className="w-full">
        <TabTrigger value="details">Details</TabTrigger>
        <TabTrigger value="items">Items ({order.items?.length || 0})</TabTrigger>
        <TabTrigger value="timeline">Timeline</TabTrigger>

        <TabContent value="details" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Order Information</h4>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Order ID</dt>
                  <dd className="font-mono font-medium">#{order.id}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd><OrderStatusBadge status={order.status} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Payment Method</dt>
                  <dd><PaymentMethodBadge method={order.payment_method} /></dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Total Amount</dt>
                  <dd className="font-medium text-lg">{formatCurrency(order.total_amount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Order Date</dt>
                  <dd>{formatDate(order.created_at)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Last Updated</dt>
                  <dd>{formatDate(order.updated_at)}</dd>
                </div>
                {order.tracking_number && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Tracking Number</dt>
                    <dd className="font-mono text-sm">{order.tracking_number}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Customer Details</h4>
              <dl className="space-y-3">
                {order.user && (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Name</dt>
                      <dd className="font-medium">{order.user.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Email</dt>
                      <dd>{order.user.email}</dd>
                    </div>
                  </>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Shipping Address</dt>
                  <dd className="text-right max-w-xs text-sm">{order.shipping_address}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={() => onUpdateStatus(order)}>Update Status</Button>
          </div>
        </TabContent>

        <TabContent value="items" className="pt-4">
          <div className="space-y-4">
            {order.items?.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4 border border-border rounded-lg">
                <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
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
            <div className="flex justify-end pt-4 border-t border-border">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Subtotal</p>
                <p className="text-xl font-bold">{formatCurrency(order.total_amount)}</p>
              </div>
            </div>
          </div>
        </TabContent>

        <TabContent value="timeline" className="pt-4">
          <div className="relative pl-4 border-l border-border">
            {[
              { status: "pending" as OrderStatus, label: "Order Placed", time: order.created_at, completed: true },
              { status: "processing" as OrderStatus, label: "Processing", time: order.status !== "pending" ? order.updated_at : null, completed: currentStatusIndex >= 1 },
              { status: "shipped" as OrderStatus, label: "Shipped", time: order.shipped_at, completed: currentStatusIndex >= 2 },
              { status: "delivered" as OrderStatus, label: "Delivered", time: order.delivered_at, completed: currentStatusIndex >= 3 },
              { status: "cancelled" as OrderStatus, label: "Cancelled", time: order.status === "cancelled" ? order.updated_at : null, completed: order.status === "cancelled" },
            ].map((step, index) => (
              <motion.div
                key={step.status}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative mb-6 last:mb-0"
              >
                <div className="absolute left-[-26px] top-0 h-4 w-4 rounded-full border-2 border-border bg-background flex items-center justify-center z-10">
                  {step.completed && <CheckCircle className="h-3 w-3 text-green-500" />}
                </div>
                <div className={cn("pb-6", step.completed ? "text-foreground" : "text-muted-foreground")}>
                  <div className="flex items-center gap-2 mb-1">
                    {STATUS_ICONS[step.status]}
                    <span className="font-medium">{step.label}</span>
                    {step.completed && step.time && (
                      <span className="text-sm text-muted-foreground">({formatDate(step.time)})</span>
                    )}
                  </div>
                  {step.status === "shipped" && order.tracking_number && (
                    <p className="text-sm ml-6">Tracking: <span className="font-mono">{order.tracking_number}</span></p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </TabContent>
      </Tabs>
    </Modal>
  )
}

function OrderStatusModal({ isOpen, onClose, onSubmit, order, status, setStatus, trackingNumber, setTrackingNumber, isLoading }: {
  isOpen: boolean
  onClose: () => void
  onSubmit: () => void
  order: Order | null
  status: OrderStatus
  setStatus: (status: OrderStatus) => void
  trackingNumber: string
  setTrackingNumber: (value: string) => void
  isLoading: boolean
}) {
  if (!order) return null

  const currentIndex = STATUS_ORDER.indexOf(order.status)
  const newIndex = STATUS_ORDER.indexOf(status)
  const isForward = newIndex > currentIndex
  const isBackward = newIndex < currentIndex

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Order Status" size="md">
      <div className="space-y-6">
        <div className="space-y-4">
          <p className="text-muted-foreground">Current status: <span className="font-medium text-foreground">{STATUS_LABELS[order.status]}</span></p>
          
          <div className="flex items-center justify-between">
            {STATUS_ORDER.map((s, index) => (
              <Fragment key={s}>
                <div className={cn(
                  "flex flex-col items-center",
                  index === newIndex && "text-primary"
                )}>
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all",
                    index <= newIndex ? "bg-primary border-primary text-primary-foreground" : "bg-background border-border text-muted-foreground"
                  )}>
                    {STATUS_ICONS[s]}
                  </div>
                  <span className={cn("mt-1 text-xs font-medium text-center max-w-[70px]", index <= newIndex ? "text-primary" : "text-muted-foreground")}>
                    {STATUS_LABELS[s]}
                  </span>
                </div>
                {index < STATUS_ORDER.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 mx-2",
                    index < newIndex ? "bg-primary" : "bg-border"
                  )} />
                )}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Select
            label="New Status"
            value={status}
            onChange={(value) => setStatus(value as OrderStatus)}
            options={statusOptions}
          />
          
          {(status === "shipped" || status === "delivered") && (
            <Input
              label="Tracking Number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Enter tracking number"
              required={status === "shipped"}
            />
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button onClick={onSubmit} isLoading={isLoading}>Update Status</Button>
        </div>
      </div>
    </Modal>
  )
}
