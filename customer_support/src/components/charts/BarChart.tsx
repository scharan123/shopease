import { motion } from "framer-motion"
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { cn } from "../../lib/utils"
import type { SupportType } from "../../lib/types"

function formatNumber(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}

interface BarChartProps {
  data: Array<{ name: string; value: number; color?: string }>
  height?: number
  showGrid?: boolean
  showTooltip?: boolean
  colors?: string[]
  horizontal?: boolean
  maxBarSize?: number
  className?: string
  animate?: boolean
  label?: string
  isCurrency?: boolean
}

export function BarChart({
  data,
  height = 280,
  showGrid = true,
  showTooltip = true,
  colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ],
  horizontal = false,
  maxBarSize = 40,
  className,
  animate = true,
  label,
  isCurrency = false,
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
            {isCurrency ? `₹${formatNumber(value)}` : formatNumber(value)}
          </span>
        </div>
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
                dataKey="name"
                type="category"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
                width={120}
                tickFormatter={(value) => String(value).length > 14 ? String(value).slice(0, 14) + "…" : value}
              />
              <XAxis
                type="number"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => isCurrency ? `₹${formatNumber(value)}` : String(value)}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey="name"
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
                tickFormatter={(value) => isCurrency ? `₹${formatNumber(value)}` : String(value)}
              />
            </>
          )}
          {showTooltip && <Tooltip content={<CustomTooltip />} />}
          <Bar
            dataKey="value"
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

interface SupportTypeBarChartProps {
  data: Array<{ type: SupportType; count: number }>
  height?: number
  className?: string
}

const SUPPORT_TYPE_LABELS: Record<SupportType, string> = {
  order_issue: "Order Issue",
  delivery_issue: "Delivery Issue",
  payment_issue: "Payment Issue",
  return_refund: "Return & Refund",
  other: "Other",
}

const SUPPORT_TYPE_COLORS: Record<SupportType, string> = {
  order_issue: "#3b82f6",
  delivery_issue: "#f97316",
  payment_issue: "#a855f7",
  return_refund: "#ef4444",
  other: "#0ea5e9",
}

export function SupportTypeBarChart({ data, height = 280, className }: SupportTypeBarChartProps) {
  const chartData = data.map((d) => ({
    name: SUPPORT_TYPE_LABELS[d.type],
    value: d.count,
    color: SUPPORT_TYPE_COLORS[d.type],
  }))

  return (
    <BarChart
      data={chartData}
      height={height}
      horizontal={true}
      maxBarSize={32}
      className={className}
      colors={chartData.map((d) => d.color)}
      isCurrency={false}
    />
  )
}