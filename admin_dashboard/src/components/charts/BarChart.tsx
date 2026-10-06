import { motion } from "framer-motion"
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { cn } from "../../lib/utils"
import type { CategoryRevenue, PaymentMethodStats, OrderStatusStats } from "../../lib/types"

// ── Rupee formatter ────────────────────────────────────────────
function formatINR(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value}`
}

interface BarChartProps {
  data: (CategoryRevenue | PaymentMethodStats | OrderStatusStats | Record<string, unknown>)[]
  dataKey: string
  nameKey: string
  height?: number
  showGrid?: boolean
  showTooltip?: boolean
  showLegend?: boolean
  colors?: string[]
  horizontal?: boolean
  maxBarSize?: number
  className?: string
  animate?: boolean
  label?: string
  labelColor?: string
  isCurrency?: boolean
}

export function BarChart({
  data,
  dataKey,
  nameKey,
  height = 300,
  showGrid = true,
  showTooltip = true,
  showLegend = false,
  colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ],
  horizontal = false,
  maxBarSize = 50,
  className,
  animate = true,
  label,
  labelColor,
  isCurrency = true,
}: BarChartProps) {
  const CustomTooltip = ({ active, payload, label: tooltipLabel }: {
    active?: boolean
    payload?: Array<{ value: number; name: string; color: string; payload: Record<string, unknown> }>
    label?: string
  }) => {
    if (!active || !payload || !tooltipLabel) return null

    const item = payload[0]
    const value = item.value

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={cn(
          "bg-popover border border-border rounded-lg p-3 shadow-lg",
          "min-w-[160px]"
        )}
      >
        <p className="font-medium text-popover-foreground mb-2">{tooltipLabel}</p>
        <div className="flex items-center gap-2 text-sm">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-popover-foreground">{item.name}: </span>
          <span className="font-medium text-popover-foreground">
            {isCurrency ? formatINR(value) : value}
          </span>
        </div>
        {item.payload.orders && (
          <p className="text-xs text-muted-foreground mt-1">
            {item.payload.orders as number} orders
          </p>
        )}
      </motion.div>
    )
  }

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 10, right: 30, left: horizontal ? 10 : 0, bottom: horizontal ? 5 : 0 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={!horizontal}
              horizontal={horizontal}
            />
          )}
          {horizontal ? (
            <>
              <YAxis
                dataKey={nameKey}
                type="category"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
                width={90}
                tickFormatter={(value) => String(value).length > 14 ? String(value).slice(0, 14) + "…" : value}
              />
              <XAxis
                type="number"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => isCurrency ? formatINR(value) : String(value)}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={nameKey}
                type="category"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
                interval={0}
                tickFormatter={(value) => String(value).length > 10 ? String(value).slice(0, 10) + "…" : value}
              />
              <YAxis
                type="number"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => isCurrency ? formatINR(value) : String(value)}
              />
            </>
          )}
          {showTooltip && <Tooltip content={<CustomTooltip />} />}
          {showLegend && (
            <Legend
              wrapperStyle={{ paddingTop: 20 }}
              formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}
            />
          )}
          <Bar
            dataKey={dataKey}
            name={label || "Value"}
            maxBarSize={maxBarSize}
            radius={[4, 4, 0, 0]}
            animationDuration={animate ? 1000 : 0}
            animationEasing="ease-out"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface CategoryRevenueChartProps {
  data: CategoryRevenue[]
  height?: number
  className?: string
  horizontal?: boolean
}

export function CategoryRevenueChart({ data, height = 300, className, horizontal = true }: CategoryRevenueChartProps) {
  const chartColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"]
  return (
    <BarChart
      data={data}
      dataKey="revenue"
      nameKey="category"
      height={height}
      horizontal={horizontal}
      maxBarSize={40}
      className={className}
      colors={chartColors}
      isCurrency={true}
    />
  )
}

interface PaymentMethodChartProps {
  data: PaymentMethodStats[]
  height?: number
  className?: string
}

export function PaymentMethodBarChart({ data, height = 300, className }: PaymentMethodChartProps) {
  return (
    <BarChart
      data={data}
      dataKey="amount"
      nameKey="method"
      height={height}
      horizontal={true}
      maxBarSize={40}
      className={className}
      isCurrency={true}
      colors={data.map((d) => {
        const methodColors: Record<string, string> = {
          cod: "hsl(var(--chart-3))",
          card: "hsl(var(--chart-1))",
          upi: "hsl(var(--chart-4))",
          wallet: "hsl(var(--chart-2))",
          bank_transfer: "hsl(var(--chart-5))",
        }
        return methodColors[d.method] || "hsl(var(--chart-1))"
      })}
    />
  )
}

interface OrderStatusChartProps {
  data: OrderStatusStats[]
  height?: number
  className?: string
}

export function OrderStatusBarChart({ data, height = 300, className }: OrderStatusChartProps) {
  const statusColors: Record<string, string> = {
    pending: "hsl(var(--chart-3))",
    processing: "hsl(var(--chart-1))",
    shipped: "hsl(var(--chart-4))",
    delivered: "hsl(var(--chart-2))",
    cancelled: "hsl(var(--destructive))",
  }

  return (
    <BarChart
      data={data}
      dataKey="count"
      nameKey="status"
      height={height}
      horizontal={false}
      maxBarSize={50}
      className={className}
      isCurrency={false}
      colors={data.map((d) => statusColors[d.status] || "hsl(var(--chart-1))")}
    />
  )
}