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

interface UnifiedSupportPieChartProps {
  openRequests: number
  closedRequests: number
  supportTypeCounts: Record<SupportType, number>
  totalRequests: number
  height?: number
  className?: string
  donut?: boolean
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

const STATUS_COLORS: Record<SupportStatus, string> = {
  open: "#f97316",
  closed: "#22c55e",
}

const STATUS_LABELS: Record<SupportStatus, string> = {
  open: "Open Requests",
  closed: "Closed Requests",
}

const SUPPORT_TYPES_ORDER: SupportType[] = ["order_issue", "delivery_issue", "payment_issue", "return_refund", "other"]

export function UnifiedSupportPieChart({
  openRequests,
  closedRequests,
  supportTypeCounts,
  totalRequests,
  height = 320,
  className,
  donut = true,
}: UnifiedSupportPieChartProps) {
  const chartData = [
    {
      name: STATUS_LABELS.open,
      value: openRequests,
      color: STATUS_COLORS.open,
      percentage: totalRequests > 0 ? ((openRequests / totalRequests) * 100).toFixed(2) : "0.00",
      category: "status",
    },
    {
      name: STATUS_LABELS.closed,
      value: closedRequests,
      color: STATUS_COLORS.closed,
      percentage: totalRequests > 0 ? ((closedRequests / totalRequests) * 100).toFixed(2) : "0.00",
      category: "status",
    },
    ...SUPPORT_TYPES_ORDER.map((type) => ({
      name: SUPPORT_TYPE_LABELS[type],
      value: supportTypeCounts[type] ?? 0,
      color: SUPPORT_TYPE_COLORS[type],
      percentage: totalRequests > 0 ? (((supportTypeCounts[type] ?? 0) / totalRequests) * 100).toFixed(2) : "0.00",
      category: "type",
    })),
  ].filter((item) => item.value > 0)

  const CustomTooltip = ({ active, payload }: {
    active?: boolean
    payload?: Array<{ value: number; name: string; color: string; payload: Record<string, unknown>; percent?: number }>
  }) => {
    if (!active || !payload || !payload.length) return null

    const item = payload[0]
    const value = item.value
    let percentStr = ""
    if (item.percent !== undefined) {
      percentStr = (item.percent * 100).toFixed(1) + "%"
    } else {
      const total = chartData.reduce((sum, d) => sum + Number(d.value || 0), 0)
      if (total > 0) {
        percentStr = ((value / total) * 100).toFixed(1) + "%"
      }
    }

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
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Count</span>
          <span className="font-medium text-popover-foreground">{formatNumber(value)}</span>
        </div>
        {percentStr && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Percentage</span>
            <span className="font-medium text-popover-foreground">{percentStr}</span>
          </div>
        )}
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
    if (!midAngle || !name || (percent ?? 0) < 0.03) return null

    const sliceAngle = (percent ?? 0) * 360
    const radiusRatio = Math.max(0.35, Math.min(0.65, 0.5 + (sliceAngle - 30) / 200))
    const radius = ir + (or - ir) * radiusRatio
    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180))
    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180))

    const fontSize = Math.max(9, Math.min(12, 11 * Math.max(0.7, Math.min(1.2, sliceAngle / 40))))

    return (
      <motion.text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="hsl(var(--foreground))"
        fontSize={fontSize}
        fontWeight={600}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, type: "spring" }}
        className="pointer-events-none drop-shadow-md"
      >
        {((percent ?? 0) * 100).toFixed(0)}%
      </motion.text>
    )
  }

  return (
    <div className={cn("w-full flex justify-center", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            iconSize={10}
            wrapperStyle={{ paddingTop: 20, paddingRight: 20 }}
            formatter={(value: string) => <span className="text-sm text-muted-foreground">{value}</span>}
          />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={donut ? 70 : 0}
            outerRadius={100}
            paddingAngle={2}
            label={CustomLabel}
            labelLine={false}
            animationDuration={1000}
            animationEasing="ease-out"
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={chartData[index].color} />
            ))}
          </Pie>
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  )
}