import { useState } from "react"
import { motion } from "framer-motion"
import { cn } from "lib/utils"
import { formatCurrency } from "lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "ui/Card"
import { Button } from "ui/Button"
import { Input } from "ui/Input"
import { Select } from "ui/Input"
import { Table } from "ui/Table"
import { Badge } from "ui/Badge"
import { Skeleton, SkeletonTable } from "ui/Skeleton"
import { Tabs, TabsList, TabTrigger, TabContent } from "ui/Tabs"
import { RevenueOrdersChart, CategoryRevenueChart, PaymentMethodPieChart, OrderStatusBarChart } from "charts"
import { useQuery } from "@tanstack/react-query"
import { api } from "lib/api"
import type { Order, CategoryRevenue } from "lib/types"
import { Download, Filter, BarChart3, PieChart as PieChartIcon, TrendingUp, DollarSign, ShoppingCart, Users, Package } from "lucide-react"

const REPORT_TYPES = [
  { value: "sales", label: "Sales Report", icon: <DollarSign className="h-4 w-4" /> },
  { value: "orders", label: "Orders Report", icon: <ShoppingCart className="h-4 w-4" /> },
  { value: "products", label: "Products Report", icon: <Package className="h-4 w-4" /> },
  { value: "users", label: "Users Report", icon: <Users className="h-4 w-4" /> },
  { value: "categories", label: "Categories Report", icon: <Package className="h-4 w-4" /> },
]

export function Reports() {
  const [reportType, setReportType] = useState("sales")
  const [timeRange, setTimeRange] = useState("30d")
  const [format, setFormat] = useState("pdf")

  const { data: stats } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api.dashboard.getStats(),
  })

  const { data: categoryRevenue } = useQuery({
    queryKey: ["admin", "analytics", "categories"],
    queryFn: () => api.dashboard.getCategoryRevenue(),
  })

  const { data: chartData } = useQuery({
    queryKey: ["admin", "analytics", timeRange],
    queryFn: () => api.dashboard.getChartData(timeRange),
  })

  const { data: paymentStats } = useQuery({
    queryKey: ["admin", "analytics", "payments"],
    queryFn: () => api.dashboard.getPaymentStats(),
  })

  const { data: orderStatusStats } = useQuery({
    queryKey: ["admin", "analytics", "order-status"],
    queryFn: () => api.dashboard.getOrderStatusStats(),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">Generate and export business reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={format}
            onChange={setFormat}
            options={[
              { value: "pdf", label: "PDF" },
              { value: "csv", label: "CSV" },
              { value: "excel", label: "Excel" },
            ]}
            className="w-[120px]"
          />
          <Button variant="outline">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {REPORT_TYPES.map((type) => (
          <Button
            key={type.value}
            variant={reportType === type.value ? "default" : "outline"}
            onClick={() => setReportType(type.value)}
            className="gap-2"
          >
            {type.icon}
            {type.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between p-6">
              <CardTitle className="text-lg">
                {REPORT_TYPES.find(t => t.value === reportType)?.label} Overview
              </CardTitle>
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
              />
            </CardHeader>
            <CardContent className="p-0 pb-6 px-6">
              {reportType === "sales" && (
                <RevenueOrdersChart data={chartData || []} height={350} />
              )}
              {reportType === "orders" && (
                <OrderStatusBarChart data={orderStatusStats || []} height={350} />
              )}
              {reportType === "products" && (
                <CategoryRevenueChart data={categoryRevenue || []} height={350} />
              )}
              {reportType === "categories" && (
                <CategoryRevenueChart data={categoryRevenue || []} height={350} horizontal={false} />
              )}
              {reportType === "users" && (
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
              <CardTitle className="text-lg">Key Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats && [
                { label: "Total Revenue", value: formatCurrency(stats.total_revenue), icon: <DollarSign className="h-5 w-5 text-green-500" />, color: "green" },
                { label: "Total Orders", value: stats.total_orders.toLocaleString(), icon: <ShoppingCart className="h-5 w-5 text-blue-500" />, color: "blue" },
                { label: "Total Users", value: stats.total_users.toLocaleString(), icon: <Users className="h-5 w-5 text-purple-500" />, color: "purple" },
                { label: "Conversion Rate", value: `${Number(stats.conversion_rate).toFixed(1)}%`, icon: <TrendingUp className="h-5 w-5 text-orange-500" />, color: "orange" },
              ].map((metric, index) => (
                <motion.div
                  key={metric.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 bg-muted/50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", `bg-${metric.color}-100 dark:bg-${metric.color}-900/30`)}>
                      {metric.icon}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{metric.label}</p>
                      <p className="font-semibold text-lg">{metric.value}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
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
          <Card>
            <CardHeader className="p-6">
              <CardTitle className="text-lg">Revenue by Category</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-6 px-6">
              <CategoryRevenueChart data={categoryRevenue || []} height={300} />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card>
            <CardHeader className="p-6">
              <CardTitle className="text-lg">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-6 px-6">
              <PaymentMethodPieChart data={paymentStats || []} height={300} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Card>
        <CardHeader className="p-6">
          <CardTitle className="text-lg">Report Data Table</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table
            columns={getReportColumns(reportType)}
            data={getReportData(reportType, { categoryRevenue, paymentStats, orderStatusStats, chartData })}
            keyExtractor={(row) => row.id || row.category || row.method || row.status}
            isLoading={false}
            emptyMessage="No data available for this report"
          />
        </CardContent>
      </Card>
    </div>
  )
}

function getReportColumns(type: string) {
  switch (type) {
    case "sales":
      return [
        { key: "date", header: "Date", render: (row: any) => row.date },
        { key: "orders", header: "Orders", render: (row: any) => row.orders },
        { key: "revenue", header: "Revenue", render: (row: any) => formatCurrency(row.revenue) },
        { key: "income", header: "Income", render: (row: any) => formatCurrency(row.income) },
      ]
    case "orders":
      return [
        { key: "status", header: "Status", render: (row: any) => <Badge variant="outline" dot>{row.status}</Badge> },
        { key: "count", header: "Count", render: (row: any) => row.count },
        { key: "percentage", header: "Percentage", render: (row: any) => `${row.percentage.toFixed(1)}%` },
      ]
    case "products":
    case "categories":
      return [
        { key: "category", header: "Category", render: (row: any) => row.category },
        { key: "revenue", header: "Revenue", render: (row: any) => formatCurrency(row.revenue) },
        { key: "orders", header: "Orders", render: (row: any) => row.orders },
      ]
    case "users":
      return [
        { key: "method", header: "Method", render: (row: any) => row.method },
        { key: "count", header: "Count", render: (row: any) => row.count },
        { key: "amount", header: "Amount", render: (row: any) => formatCurrency(row.amount) },
        { key: "percentage", header: "Percentage", render: (row: any) => `${row.percentage.toFixed(1)}%` },
      ]
    default:
      return []
  }
}

function getReportData(type: string, data: any) {
  switch (type) {
    case "sales":
      return data.chartData || []
    case "orders":
      return data.orderStatusStats || []
    case "products":
    case "categories":
      return data.categoryRevenue || []
    case "users":
      return data.paymentStats || []
    default:
      return []
  }
}
