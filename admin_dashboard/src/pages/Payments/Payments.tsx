import { useState } from "react"
import { motion } from "framer-motion"
import { cn } from "lib/utils"
import { formatCurrency, formatRelativeTime } from "lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "ui/Card"
import { Button } from "ui/Button"
import { Input } from "ui/Input"
import { Select } from "ui/Input"
import { Table } from "ui/Table"
import { Badge } from "ui/Badge"
import { Skeleton, SkeletonTable } from "ui/Skeleton"
import { Tabs, TabsList, TabTrigger, TabContent } from "ui/Tabs"
import { PaymentMethodPieChart, PaymentMethodBarChart } from "charts"
import { useQuery } from "@tanstack/react-query"
import { api } from "lib/api"
import type { PaymentMethodStats, Order } from "lib/types"
import { CreditCard, DollarSign, Filter, Download, BarChart3, PieChart, Smartphone, Wallet, Building2, TrendingUp } from "lucide-react"

const PAYMENT_METHODS = [
  { value: "cod", label: "Cash on Delivery", icon: DollarSign },
  { value: "card", label: "Credit/Debit Card", icon: CreditCard },
  { value: "upi", label: "UPI", icon: Smartphone },
  { value: "wallet", label: "Wallet", icon: Wallet },
  { value: "bank_transfer", label: "Bank Transfer", icon: Building2 },
]

const METHOD_COLORS: Record<string, string> = {
  cod: "hsl(var(--chart-3))",
  card: "hsl(var(--chart-1))",
  upi: "hsl(var(--chart-4))",
  wallet: "hsl(var(--chart-2))",
  bank_transfer: "hsl(var(--chart-5))",
}

function PaymentMethodCard({ method, stats, index }: { method: string; stats: PaymentMethodStats; index: number }) {
  const color = METHOD_COLORS[method] || "hsl(var(--chart-1))"
  const methodInfo = PAYMENT_METHODS.find(m => m.value === method)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group"
    >
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 left-0 h-full w-1" style={{ backgroundColor: color }} />
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn("p-3 rounded-xl", `bg-[${color}]/10`)}>
                {methodInfo?.icon && <methodInfo.icon className={cn("h-5 w-5", `text-[${color}]`)} />}
              </div>
              <div>
                <h3 className="font-semibold">{methodInfo?.label || method}</h3>
                <p className="text-sm text-muted-foreground">{stats.percentage.toFixed(1)}% of orders</p>
              </div>
            </div>
            <Badge variant="secondary">{stats.count} orders</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.amount)}</p>
              <p className="text-sm text-muted-foreground">Total Amount</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.amount / Math.max(stats.count, 1))}</p>
              <p className="text-sm text-muted-foreground">Avg. Order Value</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function Payments() {
  const [timeRange, setTimeRange] = useState("30d")

  const { data: paymentStats, isLoading: paymentLoading } = useQuery({
    queryKey: ["admin", "analytics", "payments"],
    queryFn: () => api.dashboard.getPaymentStats(),
  })

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["admin", "orders", "payments", timeRange],
    queryFn: () => api.orders.getAll({
      limit: 20,
      page: 1,
      sortBy: "created_at",
      sortOrder: "desc",
    }),
    select: (data) => data.data,
  })

  const totalAmount = paymentStats?.reduce((sum, m) => sum + m.amount, 0) || 0
  const totalOrders = paymentStats?.reduce((sum, m) => sum + m.count, 0) || 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Payments</h1>
          <p className="text-muted-foreground">Payment methods overview and transaction history</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={timeRange}
            onChange={setTimeRange}
            options={[
              { value: "7d", label: "Last 7 Days" },
              { value: "30d", label: "Last 30 Days" },
              { value: "90d", label: "Last 90 Days" },
              { value: "1y", label: "Last Year" },
            ]}
            className="w-[160px]"
            placeholder="Time range"
          />
          <Button variant="outline">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{formatCurrency(totalAmount)}</p>
                </div>
                <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                  <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Transactions</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{totalOrders}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg. Order Value</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{formatCurrency(totalOrders > 0 ? totalAmount / totalOrders : 0)}</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                  <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Payment Methods</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{paymentStats?.length || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-900/30">
                  <PieChart className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card>
            <CardHeader className="p-6">
              <CardTitle className="text-lg">Payment Methods Distribution</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-6 px-6">
              {paymentLoading ? <SkeletonChart height={350} /> : (
                <PaymentMethodPieChart data={paymentStats || []} height={350} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card>
            <CardHeader className="p-6">
              <CardTitle className="text-lg">Revenue by Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-6 px-6">
              {paymentLoading ? <SkeletonChart height={350} /> : (
                <PaymentMethodBarChart data={paymentStats || []} height={350} />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paymentStats?.map((stats, index) => (
          <PaymentMethodCard key={stats.method} method={stats.method} stats={stats} index={index} />
        ))}
      </div>

      <Tabs defaultValue="all" className="w-full mt-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabTrigger value="all">All</TabTrigger>
          {PAYMENT_METHODS.map(m => (
            <TabTrigger key={m.value} value={m.value}>{m.label}</TabTrigger>
          ))}
        </TabsList>

        <TabContent value="all" className="pt-4">
          <Card>
            <CardContent className="p-0">
              <Table
                columns={[
                  { key: "id", header: "Order ID", render: (row: Order) => <span className="font-mono font-medium">#{row.id}</span> },
                  { key: "customer", header: "Customer", render: (row: Order) => row.user?.name || "Guest" },
                  { key: "amount", header: "Amount", render: (row: Order) => <span className="font-medium">{formatCurrency(row.total_amount)}</span> },
                  { key: "method", header: "Method", render: (row: Order) => <Badge variant="secondary" className="capitalize">{row.payment_method.replace("_", " ")}</Badge> },
                  { key: "status", header: "Status", render: (row: Order) => <Badge variant="outline" dot>{row.status}</Badge> },
                  { key: "date", header: "Date", render: (row: Order) => <span className="text-sm text-muted-foreground">{formatRelativeTime(row.created_at)}</span> },
                ]}
                data={ordersData || []}
                keyExtractor={(row) => row.id}
                isLoading={ordersLoading}
                emptyMessage="No transactions found"
              />
            </CardContent>
          </Card>
        </TabContent>

        {PAYMENT_METHODS.map(m => (
          <TabContent key={m.value} value={m.value} className="pt-4">
            <Card>
              <CardContent className="p-0">
                <Table
                  columns={[
                    { key: "id", header: "Order ID", render: (row: Order) => <span className="font-mono font-medium">#{row.id}</span> },
                    { key: "customer", header: "Customer", render: (row: Order) => row.user?.name || "Guest" },
                    { key: "amount", header: "Amount", render: (row: Order) => <span className="font-medium">{formatCurrency(row.total_amount)}</span> },
                    { key: "status", header: "Status", render: (row: Order) => <Badge variant="outline" dot>{row.status}</Badge> },
                    { key: "date", header: "Date", render: (row: Order) => <span className="text-sm text-muted-foreground">{formatRelativeTime(row.created_at)}</span> },
                  ]}
                  data={ordersData?.filter(o => o.payment_method === m.value) || []}
                  keyExtractor={(row) => row.id}
                  isLoading={ordersLoading}
                  emptyMessage={`No ${m.label} transactions`}
                />
              </CardContent>
            </Card>
          </TabContent>
        ))}
      </Tabs>
    </div>
  )
}

function SkeletonChart({ height = 300 }: { height?: number }) {
  return (
    <div className="h-[350px] flex items-center justify-center">
      <Skeleton variant="rectangular" className="w-full h-full" />
    </div>
  )
}
