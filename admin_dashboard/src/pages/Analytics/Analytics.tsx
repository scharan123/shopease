import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { cn } from "lib/utils"
import { formatCurrency, formatNumber } from "lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "ui/Card"
import { Badge } from "ui/Badge"
import { Select } from "ui/Input"
import { Skeleton, SkeletonCard, SkeletonChart } from "ui/Skeleton"
import {
  RevenueOrdersChart,
  CategoryRevenueChart,
  PaymentMethodPieChart,
  OrderStatusPieChart,
} from "charts"
import { DollarSign, ShoppingCart, Users, TrendingUp, ArrowUpRight, ArrowDownRight, BarChart3, CreditCard, TrendingUp as TrendingUpIcon } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { api } from "lib/api"
import type { DashboardStats, ChartDataPoint, CategoryRevenue, PaymentMethodStats, OrderStatusStats } from "lib/types"
import { TIME_RANGES } from "lib/types"

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

export function Analytics() {
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
  ] : []

  const isLoading = statsLoading || chartLoading || catLoading || paymentLoading || statusLoading

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground">Detailed analytics and insights</p>
        </div>
        <Select
          value={timeRange}
          onChange={setTimeRange}
          options={TIME_RANGES.map((r) => ({ value: r.value, label: r.label }))}
          className="w-[160px]"
          placeholder="Time range"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <StatCard key={card.title} {...card} delay={index} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
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
              {isLoading ? <SkeletonChart height={350} /> : (
                <RevenueOrdersChart data={chartData || []} height={350} />
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
              {isLoading ? <SkeletonChart height={350} /> : (
                <CategoryRevenueChart data={categoryRevenue || []} height={350} />
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
              <CardTitle className="text-lg">Payment Methods Distribution</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-6 px-6">
              {isLoading ? <SkeletonChart height={350} /> : (
                <PaymentMethodPieChart data={paymentStats || []} height={350} />
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
              <CardTitle className="text-lg">Order Status Distribution</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-6 px-6">
              {isLoading ? <SkeletonChart height={350} /> : (
                <OrderStatusPieChart data={orderStatusStats || []} height={350} />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

    </div>
  )
}
