import { motion } from "framer-motion"
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
} from "recharts"
import { cn } from "../../lib/utils"
import type { ChartDataPoint } from "../../lib/types"

// ── Rupee formatter ────────────────────────────────────────────
function formatINR(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value}`
}

interface LineChartProps {
  data: ChartDataPoint[]
  lines: {
    key: keyof ChartDataPoint
    label: string
    color: string
    strokeWidth?: number
    dot?: boolean
    type?: "line" | "area"
    isCurrency?: boolean
  }[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  showTooltip?: boolean
  xAxisKey?: keyof ChartDataPoint
  className?: string
  animate?: boolean
}

export function LineChart({
  data,
  lines,
  height = 300,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  xAxisKey = "date",
  className,
  animate = true,
}: LineChartProps) {
  const colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ]

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean
    payload?: Array<{ value: number; name: string; color: string; dataKey: string }>
    label?: string
  }) => {
    if (!active || !payload || !label) return null

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={cn(
          "bg-popover border border-border rounded-lg p-3 shadow-lg",
          "min-w-[160px]"
        )}
      >
        <p className="font-medium text-popover-foreground mb-2">{label}</p>
        {payload.map((item, index) => {
          // Revenue and income lines are currency; orders line is a count
          const isCurrency = item.dataKey === "revenue" || item.dataKey === "income"
          return (
            <div key={index} className="flex items-center gap-2 text-sm">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-popover-foreground">{item.name}: </span>
              <span className="font-medium text-popover-foreground">
                {isCurrency ? formatINR(item.value) : item.value}
              </span>
            </div>
          )
        })}
      </motion.div>
    )
  }

  const CustomDot = ({ cx, cy, stroke, strokeWidth, r }: {
    cx: number
    cy: number
    stroke: string
    strokeWidth: number
    r: number
  }) => (
    <motion.circle
      cx={cx}
      cy={cy}
      r={r}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill="white"
      initial={{ r: 0, opacity: 0 }}
      animate={{ r, opacity: 1 }}
      transition={{ type: "spring", damping: 15, stiffness: 200 }}
    />
  )

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
          )}
          <XAxis
            dataKey={xAxisKey}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => formatINR(value)}
          />
          {showTooltip && <Tooltip content={<CustomTooltip />} />}
          {showLegend && (
            <Legend
              wrapperStyle={{ paddingTop: 20 }}
              formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}
            />
          )}
          {lines.map((line, index) => {
            const color = line.color || colors[index % colors.length]
            const isArea = line.type === "area"

            if (isArea) {
              return (
                <Area
                  key={line.key}
                  type="monotone"
                  dataKey={line.key as string}
                  stroke={color}
                  strokeWidth={line.strokeWidth || 2}
                  fill={color}
                  fillOpacity={0.1}
                  dot={line.dot ? <CustomDot r={4} strokeWidth={2} /> : false}
                  name={line.label}
                  animationDuration={animate ? 1000 : 0}
                  animationEasing="ease-out"
                />
              )
            }

            return (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key as string}
                stroke={color}
                strokeWidth={line.strokeWidth || 2}
                dot={line.dot ? <CustomDot r={4} strokeWidth={2} /> : false}
                name={line.label}
                animationDuration={animate ? 1000 : 0}
                animationEasing="ease-out"
                activeDot={{ r: 6, strokeWidth: 2 }}
              />
            )
          })}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface MultiLineChartProps {
  data: ChartDataPoint[]
  height?: number
  className?: string
}

export function RevenueOrdersChart({ data, height = 300, className }: MultiLineChartProps) {
  return (
    <LineChart
      data={data}
      lines={[
        { key: "revenue", label: "Revenue", color: "hsl(var(--chart-1))", strokeWidth: 2, dot: true, isCurrency: true },
        { key: "orders", label: "Orders", color: "hsl(var(--chart-2))", strokeWidth: 2, dot: true },
        { key: "income", label: "Income", color: "hsl(var(--chart-3))", strokeWidth: 2, dot: true, type: "area", isCurrency: true },
      ]}
      height={height}
      className={className}
    />
  )
}