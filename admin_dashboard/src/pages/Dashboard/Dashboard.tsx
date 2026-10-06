import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { cn } from "lib/utils"
import { formatCurrency, formatNumber, formatRelativeTime } from "lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "ui/Card"
import { Badge } from "ui/Badge"
import { Button } from "ui/Button"
import { Select } from "ui/Input"
import { Table } from "ui/Table"
import { Avatar, AvatarGroup } from "ui/Avatar"
import { Skeleton, SkeletonCard, SkeletonChart } from "ui/Skeleton"
import {
  RevenueOrdersChart,
  CategoryRevenueChart,
  PaymentMethodPieChart,
  OrderStatusPieChart,
} from "charts"
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Package,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { api } from "../../lib/api"
import { TIME_RANGES } from "../../lib/types"
import type { DashboardStats, ChartDataPoint, CategoryRevenue, PaymentMethodStats, OrderStatusStats, Order, User } from "../../lib/types"

const STAT_CARDS = [
  {
    title: "Total Revenue",
    value: 0,
    change: 0,
    icon: DollarSign,
    color: "hsl(var(--chart-1))",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  {
    title: "Total Orders",
    value: 0,
    change: 0,
    icon: ShoppingCart,
    color: "hsl(var(--chart-2))",
    bg: "bg-green-100 dark:bg-green-900/30",
    textColor: "text-green-600 dark:text-green-400",
  },
  {
    title: "Total Users",
    value: 0,
    change: 0,
    icon: Users,
    color: "hsl(var(--chart-3))",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    textColor: "text-yellow-600 dark:text-yellow-400",
  },
  {
    title: "Conversion Rate",
    value: 0,
    change: 0,
    icon: TrendingUp,
    color: "hsl(var(--chart-4))",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    textColor: "text-purple-600 dark:text-purple-400",
    isPercent: true,
  },
]

function StatCard({ title, value, change, icon: Icon, bg, textColor, isPercent = false, delay = 0 }: {
  title: string
  value: number
  change: number
  icon: React.ComponentType<{ className?: string }>
  bg: string
  textColor: string
  isPercent?: boolean
  delay?: number
}) {
  const displayValue = isPercent ? `${Number(value).toFixed(1)}%` : formatCurrency(Number(value))
  const changeAbs = Math.abs(change)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: delay * 0.1 }}
      className="group"
    >
      <Card className="relative overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + delay * 0.1, type: "spring" }}
                className="mt-2 text-3xl font-bold text-foreground"
              >
                {displayValue}
              </motion.div>
              <div className={cn("mt-3 flex items-center gap-1.5 text-sm", change >= 0 ? "text-green-600" : "text-red-600")}>
                <span className={cn("font-medium", change >= 0 ? "" : "")}>
                  {change >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                </span>
                <span className="font-medium">{changeAbs.toFixed(1)}%</span>
                <span className="text-muted-foreground">vs last period</span>
              </div>
            </div>
            <div className={cn("p-3 rounded-xl", bg)}>
              <Icon className={cn("h-6 w-6", textColor)} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function RecentOrdersTable({ orders, isLoading }: { orders: Order[]; isLoading: boolean }) {
  const columns = [
    {
      key: "id",
      header: "Order ID",
      render: (row: Order) => (
        <span className="font-mono font-medium">#{row.id}</span>
      ),
    },
    {
      key: "user",
      header: "Customer",
      render: (row: Order) => (
        <div className="flex items-center gap-3">
          <Avatar
            size="sm"
            fallback={row.user?.name || "U"}
            src={row.user?.email ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.user.email}` : undefined}
          />
          <div>
            <p className="font-medium text-sm">{row.user?.name || "Unknown"}</p>
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
      render: (row: Order) => {
        const statusConfig: Record<string, { icon: React.ReactNode; label: string }> = {
          pending: { icon: <Clock className="h-3 w-3" />, label: "Pending" },
          processing: { icon: <Package className="h-3 w-3" />, label: "Processing" },
          shipped: { icon: <CreditCard className="h-3 w-3" />, label: "Shipped" },
          delivered: { icon: <CheckCircle className="h-3 w-3" />, label: "Delivered" },
          cancelled: { icon: <XCircle className="h-3 w-3" />, label: "Cancelled" },
        }
        const config = statusConfig[row.status] || statusConfig.pending
        return (
          <Badge variant="outline" className="gap-1.5" dot>
            {config.icon}
            {config.label}
          </Badge>
        )
      },
    },
    {
      key: "payment_method",
      header: "Payment",
      render: (row: Order) => (
        <Badge variant="secondary" className="capitalize">{row.payment_method.replace("_", " ")}</Badge>
      ),
    },
    {
      key: "created_at",
      header: "Date",
      render: (row: Order) => (
        <span className="text-sm text-muted-foreground">{formatRelativeTime(row.created_at)}</span>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-6">
        <CardTitle className="text-lg">Recent Orders</CardTitle>
        <Button variant="ghost" size="sm">View All</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table
          columns={columns}
          data={orders}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No recent orders"
        />
      </CardContent>
    </Card>
  )
}

function TopProductsTable({ products, isLoading }: { products: Product[]; isLoading: boolean }) {
  const columns = [
    {
      key: "image",
      header: "Product",
      render: (row: Product) => (
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
            {row.image_url ? (
              <img src={row.image_url} alt={row.name} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="font-medium text-sm truncate max-w-[200px]">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.category}</p>
          </div>
        </div>
      ),
    },
    {
      key: "price",
      header: "Price",
      render: (row: Product) => <span className="font-medium">{formatCurrency(row.price)}</span>,
    },
    {
      key: "stock",
      header: "Stock",
      render: (row: Product) => (
        <Badge variant={row.stock > 10 ? "success" : row.stock > 0 ? "warning" : "destructive"}>
          {row.stock} left
        </Badge>
      ),
    },
    {
      key: "featured",
      header: "Featured",
      render: (row: Product) => (
        <Badge variant={row.featured ? "success" : "secondary"} className="capitalize">
          {row.featured ? "Yes" : "No"}
        </Badge>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-6">
        <CardTitle className="text-lg">Top Products</CardTitle>
        <Button variant="ghost" size="sm">View All</Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table
          columns={columns}
          data={products}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No products found"
        />
      </CardContent>
    </Card>
  )
}

type Product = {
  id: number
  name: string
  price: number
  stock: number
  category: string
  featured: boolean
  image_url?: string
}

export function Dashboard() {
  const [timeRange, setTimeRange] = useState("30d")

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api.dashboard.getStats(),
  })

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ["admin", "analytics", timeRange],
    queryFn: () => api.dashboard.getChartData(timeRange),
  })

  const { data: categoryRevenue, isLoading: catLoading } = useQuery({
    queryKey: ["admin", "analytics", "categories"],
    queryFn: () => api.dashboard.getCategoryRevenue(),
  })

  const { data: paymentStats, isLoading: paymentLoading } = useQuery({
    queryKey: ["admin", "analytics", "payments"],
    queryFn: () => api.dashboard.getPaymentStats(),
  })

  const { data: orderStatusStats, isLoading: statusLoading } = useQuery({
    queryKey: ["admin", "analytics", "order-status"],
    queryFn: () => api.dashboard.getOrderStatusStats(),
  })

  const { data: recentOrders, isLoading: ordersLoading } = useQuery({
    queryKey: ["admin", "orders", "recent"],
    queryFn: () => api.orders.getAll({ limit: 5, page: 1, sortBy: "created_at", sortOrder: "desc" }),
    select: (data) => data.data,
  })

  const { data: topProducts, isLoading: productsLoading } = useQuery({
    queryKey: ["admin", "products", "top"],
    queryFn: () => api.products.getAll({ limit: 5, page: 1, sortBy: "created_at", sortOrder: "desc" }),
    select: (data) => data.data,
  })

  const statCards = stats ? [
    {
      title: "Total Revenue",
      value: stats.total_revenue,
      change: stats.revenue_change,
      icon: DollarSign,
      bg: "bg-blue-100 dark:bg-blue-900/30",
      textColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Total Orders",
      value: stats.total_orders,
      change: stats.orders_change,
      icon: ShoppingCart,
      bg: "bg-green-100 dark:bg-green-900/30",
      textColor: "text-green-600 dark:text-green-400",
    },
    {
      title: "Total Users",
      value: stats.total_users,
      change: stats.users_change,
      icon: Users,
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
      textColor: "text-yellow-600 dark:text-yellow-400",
    },
    {
      title: "Conversion Rate",
      value: stats.conversion_rate,
      change: stats.conversion_change,
      icon: TrendingUp,
      bg: "bg-purple-100 dark:bg-purple-900/30",
      textColor: "text-purple-600 dark:text-purple-400",
      isPercent: true,
    },
  ] : STAT_CARDS

  const isLoading = statsLoading || chartLoading || catLoading || paymentLoading || statusLoading

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your e-commerce performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={timeRange}
            onChange={setTimeRange}
            options={TIME_RANGES.map((r) => ({ value: r.value, label: r.label }))}
            className="w-[160px]"
            placeholder="Time range"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <StatCard key={card.title} {...card} delay={index} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-2"
        >
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between p-6">
              <CardTitle className="text-lg">Revenue & Orders Trend</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-1))" }} />
                  Revenue
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-2))" }} />
                  Orders
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "hsl(var(--chart-3))" }} />
                  Income
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0 pb-6 px-6">
              {isLoading ? <SkeletonChart height={300} /> : (
                <RevenueOrdersChart data={chartData || []} height={300} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="h-full">
            <CardHeader className="p-6">
              <CardTitle className="text-lg">Revenue by Category</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-6 px-6">
              {isLoading ? <SkeletonChart height={300} /> : (
                <CategoryRevenueChart data={categoryRevenue || []} height={300} />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="h-full">
            <CardHeader className="p-6">
              <CardTitle className="text-lg">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-6 px-6">
              {isLoading ? <SkeletonChart height={300} /> : (
                <PaymentMethodPieChart data={paymentStats || []} height={300} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="h-full">
            <CardHeader className="p-6">
              <CardTitle className="text-lg">Order Status</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-6 px-6">
              {isLoading ? <SkeletonChart height={300} /> : (
                <OrderStatusPieChart data={orderStatusStats || []} height={300} />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <RecentOrdersTable orders={recentOrders || []} isLoading={ordersLoading} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <TopProductsTable products={topProducts || []} isLoading={productsLoading} />
        </motion.div>
      </div>
    </div>
  )
}
