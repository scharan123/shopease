import { motion } from "framer-motion"
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { cn } from "../../lib/utils"
import type { SupportType, SupportStatus } from "../../lib/types"

function formatNumber(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}

interface PieChartProps {
  data: Array<{ name: string; value: number; color?: string; totalCount?: number; openCount?: number }>
  height?: number
  showTooltip?: boolean
  showLegend?: boolean
  innerRadius?: number
  outerRadius?: number
  colors?: string[]
  className?: string
  animate?: boolean
  label?: boolean
  labelFormatter?: (value: number, name: string) => string
  extraData?: {
    totalTickets: number
    totalOpen: number
    totalClosed?: number
    chartData: Array<{ name: string; value: number; color: string; totalCount: number; openCount: number; closedCount?: number }>
  }
  tooltipType?: "default" | "open" | "closed"
}

export function PieChart({
  data,
  height = 280,
  showTooltip = true,
  showLegend = true,
  innerRadius = 60,
  outerRadius = 90,
  colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ],
  className,
  animate = true,
  label = false,
  labelFormatter,
  extraData,
  tooltipType = "default",
}: PieChartProps) {
  const CustomTooltip = ({ active, payload }: {
    active?: boolean
    payload?: Array<{ value: number; name: string; color: string; payload: Record<string, unknown> & { totalCount?: number; openCount?: number; closedCount?: number }; percent?: number }>
  }) => {
    if (!active || !payload || !payload.length) return null

    const item = payload[0]
    const value = item.value
    const totalCount = item.payload?.totalCount ?? value
    const openCount = item.payload?.openCount ?? 0
    const closedCount = item.payload?.closedCount ?? 0
    let totalPercentStr = ""
    let openPercentStr = ""
    let closedPercentStr = ""

    if (extraData) {
      if (extraData.totalTickets > 0) {
        totalPercentStr = ((totalCount / extraData.totalTickets) * 100).toFixed(2) + "%"
      }
      if (extraData.totalOpen > 0) {
        openPercentStr = ((openCount / extraData.totalOpen) * 100).toFixed(2) + "%"
      } else {
        openPercentStr = "0.00%"
      }
      if (extraData.totalClosed && extraData.totalClosed > 0) {
        closedPercentStr = ((closedCount / extraData.totalClosed) * 100).toFixed(2) + "%"
      } else {
        closedPercentStr = "0.00%"
      }
    } else if (item.percent !== undefined) {
      totalPercentStr = (item.percent * 100).toFixed(2) + "%"
    } else {
      const total = data.reduce((sum, d) => sum + Number(d.value || 0), 0)
      if (total > 0) {
        totalPercentStr = ((value / total) * 100).toFixed(2) + "%"
      } else {
        totalPercentStr = "0.00%"
      }
      openPercentStr = "0.00%"
      closedPercentStr = "0.00%"
    }

    const isDefault = tooltipType === "default"
    const isOpenOnly = tooltipType === "open"
    const isClosedOnly = tooltipType === "closed"

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={cn(
          "bg-popover border border-border rounded-lg p-3 shadow-lg",
          "min-w-[200px]"
        )}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="font-medium text-popover-foreground">{item.name}</span>
        </div>
        <div className="space-y-1.5 text-sm">
          {isDefault && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Count</span>
                <span className="font-medium text-popover-foreground">{formatNumber(totalCount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Percentage</span>
                <span className="font-medium text-popover-foreground">{totalPercentStr || "0.00%"}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
                <span className="text-muted-foreground">Open Requests</span>
                <span className="font-medium text-popover-foreground">{formatNumber(openCount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Open Percentage</span>
                <span className="font-medium text-popover-foreground">{openPercentStr}</span>
              </div>
              {extraData?.totalClosed !== undefined && (
                <>
                  <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
                    <span className="text-muted-foreground">Closed Requests</span>
                    <span className="font-medium text-popover-foreground">{formatNumber(closedCount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Closed Percentage</span>
                    <span className="font-medium text-popover-foreground">{closedPercentStr}</span>
                  </div>
                </>
              )}
            </>
          )}

          {isOpenOnly && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Open Requests</span>
                <span className="font-medium text-popover-foreground">{formatNumber(value)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Open Percentage</span>
                <span className="font-medium text-popover-foreground">{totalPercentStr}</span>
              </div>
            </>
          )}

          {isClosedOnly && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Closed Requests</span>
                <span className="font-medium text-popover-foreground">{formatNumber(value)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Closed Percentage</span>
                <span className="font-medium text-popover-foreground">{totalPercentStr}</span>
              </div>
            </>
          )}
        </div>
      </motion.div>
    )
  }

  interface CustomLabelProps {
    cx: number
    cy: number
    midAngle?: number
    innerRadius: number
    outerRadius: number
    percent?: number
    value: number
    name?: string
  }

  const CustomLabel = ({ cx, cy, midAngle, innerRadius: ir, outerRadius: or, percent, value, name }: CustomLabelProps) => {
    if (!label || (percent ?? 0) < 0.05 || midAngle === undefined || !name) return null

    // Center label exactly in the middle of the donut segment
    const radius = ir + (or - ir) * 0.5
    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180))
    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180))

    const sliceAngle = (percent ?? 0) * 360
    const fontSize = Math.max(9, Math.min(14, 12 * Math.max(0.6, Math.min(1.3, sliceAngle / 30))))

    const formatted = labelFormatter ? labelFormatter(value, name) : `${((percent ?? 0) * 100).toFixed(2)}%`

    return (
      <motion.text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="hsl(var(--foreground))"
        fontSize={fontSize}
        fontWeight={700}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, type: "spring" }}
        className="pointer-events-none drop-shadow-md"
      >
        {formatted}
      </motion.text>
    )
  }

  const total = data.reduce((sum, item) => sum + Number(item.value), 0)

  return (
    <div className={cn("w-full flex justify-center", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          {showTooltip && <Tooltip content={<CustomTooltip />} />}
          {showLegend && (
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              iconType="circle"
              iconSize={10}
              wrapperStyle={{ paddingTop: 20, paddingRight: 20 }}
              formatter={(value: string) => <span className="text-sm text-muted-foreground">{value}</span>}
            />
          )}
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            label={label ? CustomLabel : false}
            labelLine={false}
            animationDuration={animate ? 1000 : 0}
            animationEasing="ease-out"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  )
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

const SUPPORT_TYPES_ORDER: SupportType[] = ["order_issue", "delivery_issue", "payment_issue", "return_refund", "other"]

interface SupportStatusPieChartProps {
  data: Array<{ status: SupportStatus; count: number }>
  height?: number
  className?: string
  donut?: boolean
}

export function SupportStatusPieChart({ data, height = 280, className, donut = true }: SupportStatusPieChartProps) {
  const statusColors: Record<string, string> = {
    open: "#f97316",
    closed: "#22c55e",
  }

  const statusLabels: Record<string, string> = {
    open: "Open Requests",
    closed: "Closed Requests",
  }

  const chartData = data.map((d) => ({
    name: statusLabels[d.status] || d.status,
    value: d.count,
    color: statusColors[d.status] || "#6b7280",
  }))

  return (
    <PieChart
      data={chartData}
      height={height}
      className={className}
      innerRadius={donut ? 70 : 0}
      outerRadius={90}
      colors={chartData.map((d) => d.color)}
      label={true}
    />
  )
}

interface SupportTypePieChartProps {
  totalData: Record<SupportType, number>
  openData: Record<SupportType, number>
  closedData: Record<SupportType, number>
  height?: number
  className?: string
  donut?: boolean
}

export function SupportTypePieChart({
  totalData,
  openData,
  closedData,
  height = 280,
  className,
  donut = true,
}: SupportTypePieChartProps) {
  const chartData = SUPPORT_TYPES_ORDER.map((type) => ({
    name: SUPPORT_TYPE_LABELS[type],
    value: totalData[type] ?? 0,
    color: SUPPORT_TYPE_COLORS[type],
    totalCount: totalData[type] ?? 0,
    openCount: openData[type] ?? 0,
    closedCount: closedData[type] ?? 0,
  })).filter((d) => d.value > 0)

  const totalTickets = Object.values(totalData).reduce((sum, v) => sum + v, 0)
  const totalOpen = Object.values(openData).reduce((sum, v) => sum + v, 0)
  const totalClosed = Object.values(closedData).reduce((sum, v) => sum + v, 0)

  return (
    <div className={cn("relative", className)} style={{ height }}>
      <PieChart
        data={chartData}
        height={height}
        innerRadius={donut ? 90 : 0}
        outerRadius={120}
        showLegend={false}
        colors={chartData.map((d) => d.color)}
        label={true}
        labelFormatter={(value, name) => {
          const item = chartData.find(d => d.name === name)
          if (!item || totalTickets === 0) return ""
          const pct = (item.value / totalTickets) * 100
          return pct >= 3 ? `${pct.toFixed(2)}%` : ""
        }}
        extraData={{
          totalTickets,
          totalOpen,
          totalClosed,
          chartData,
        }}
      />

    </div>
  )
}