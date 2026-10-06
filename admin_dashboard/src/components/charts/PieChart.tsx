import { motion } from "framer-motion"
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Sector,
} from "recharts"
import { cn } from "../../lib/utils"
import type { PaymentMethodStats, OrderStatusStats, SupportType } from "../../lib/types"

// ── Rupee formatter ────────────────────────────────────────────
function formatINR(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`
  return `₹${value}`
}

interface PieChartProps {
  data: (PaymentMethodStats | OrderStatusStats | Record<string, unknown>)[]
  dataKey: string
  nameKey: string
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
  isCurrency?: boolean
}

export function PieChart({
  data,
  dataKey,
  nameKey,
  height = 300,
  showTooltip = true,
  showLegend = true,
  innerRadius = 60,
  outerRadius = 100,
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
  isCurrency = false,
}: PieChartProps) {
  const CustomTooltip = ({ active, payload }: {
    active?: boolean
    payload?: Array<{ value: number; name: string; color: string; payload: Record<string, unknown>; percent?: number }>
  }) => {
    if (!active || !payload || !payload.length) return null

    const item = payload[0]
    const value = item.value
    // Recharts pie chart tooltip payload doesn't always have percent built-in depending on how it's used,
    // but we can calculate it if we know the total. Or use the provided percent if available.
    let percentStr = ""
    if (item.percent !== undefined) {
      percentStr = (item.percent * 100).toFixed(1) + "%"
    } else {
        const total = data.reduce((sum, d) => sum + Number(d[dataKey] || 0), 0)
        if(total > 0) {
            percentStr = ((value / total) * 100).toFixed(1) + "%"
        }
    }


    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={cn(
          "bg-popover border border-border rounded-lg p-3 shadow-lg",
          "min-w-[180px]"
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
          <span className="text-muted-foreground">Value</span>
          <span className="font-medium text-popover-foreground">
            {isCurrency ? formatINR(value) : value}
          </span>
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

  const CustomLabel = ({ cx, cy, midAngle, innerRadius: ir, outerRadius: or, percent, value, name }: {
    cx: number
    cy: number
    midAngle: number
    innerRadius: number
    outerRadius: number
    percent: number
    value: number
    name: string
  }) => {
    if (!label || percent < 0.05) return null

    const radius = ir + (or - ir) * 0.5
    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180))
    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180))

    const formatted = labelFormatter ? labelFormatter(value, name) : `${(percent * 100).toFixed(0)}%`

    return (
      <motion.text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="hsl(var(--foreground))"
        fontSize={12}
        fontWeight={600}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, type: "spring" }}
        className="pointer-events-none drop-shadow-md"
      >
        {formatted}
      </motion.text>
    )
  }

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
              formatter={(value) => <span className="text-sm text-muted-foreground">{value}</span>}
            />
          )}
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            label={label ? <CustomLabel /> : false}
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

interface PaymentMethodPieChartProps {
  data: PaymentMethodStats[]
  height?: number
  className?: string
  donut?: boolean
}

export function PaymentMethodPieChart({ data, height = 300, className, donut = true }: PaymentMethodPieChartProps) {
  const methodColors: Record<string, string> = {
    cod: "hsl(var(--chart-3))",
    card: "hsl(var(--chart-1))",
    upi: "hsl(var(--chart-4))",
    wallet: "hsl(var(--chart-2))",
    bank_transfer: "hsl(var(--chart-5))",
  }

  return (
    <PieChart
      data={data}
      dataKey="amount"
      nameKey="method"
      height={height}
      className={className}
      innerRadius={donut ? 70 : 0}
      outerRadius={100}
      colors={data.map((d) => methodColors[d.method] || "hsl(var(--chart-1))")}
      label={true}
      labelFormatter={(value) => formatINR(value)}
      isCurrency={true}
    />
  )
}

interface OrderStatusPieChartProps {
  data: OrderStatusStats[]
  height?: number
  className?: string
  donut?: boolean
}

export function OrderStatusPieChart({ data, height = 300, className, donut = true }: OrderStatusPieChartProps) {
  const statusColors: Record<string, string> = {
    pending: "hsl(var(--chart-3))",
    processing: "hsl(var(--chart-1))",
    shipped: "hsl(var(--chart-4))",
    delivered: "hsl(var(--chart-2))",
    cancelled: "hsl(var(--destructive))",
  }

  return (
    <PieChart
      data={data}
      dataKey="count"
      nameKey="status"
      height={height}
      className={className}
      innerRadius={donut ? 70 : 0}
      outerRadius={100}
      colors={data.map((d) => statusColors[d.status] || "hsl(var(--chart-1))")}
      label={true}
      labelFormatter={(value) => String(value)}
      isCurrency={false}
    />
  )
}

interface PieChartWithLegendProps extends PieChartProps {
  legendItems?: { name: string; color: string; value: number; percentage: number }[]
}

export function PieChartWithLegend({
  data,
  dataKey,
  nameKey,
  height = 300,
  colors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ],
  className,
  animate = true,
  isCurrency = false
}: PieChartWithLegendProps) {
  const total = data.reduce((sum, item) => sum + Number(item[dataKey]), 0)

  const legendItems = data.map((item, index) => ({
    name: String(item[nameKey]),
    color: colors[index % colors.length],
    value: Number(item[dataKey]),
    percentage: total > 0 ? (Number(item[dataKey]) / total) * 100 : 0,
  }))

  return (
    <div className={cn("flex flex-col md:flex-row items-center gap-8", className)} style={{ height }}>
      <div className="flex-1 flex justify-center">
        <PieChart
          data={data}
          dataKey={dataKey}
          nameKey={nameKey}
          height={height}
          showLegend={false}
          showTooltip={true}
          colors={colors}
          animate={animate}
          isCurrency={isCurrency}
        />
      </div>
      <div className="w-full md:w-64 space-y-3">
        {legendItems.map((item, index) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + index * 0.1 }}
            className="flex items-center gap-3"
          >
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {isCurrency ? formatINR(item.value) : item.value}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-foreground">{item.percentage.toFixed(1)}%</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

interface SupportTypePieChartProps {
  data: Record<string, number>
  openData?: Record<string, number>
  totalOpen?: number
  total?: number
  height?: number
  className?: string
  donut?: boolean
}

export function SupportTypePieChart({ data, openData = {}, totalOpen = 0, total = 0, height = 300, className, donut = true }: SupportTypePieChartProps) {
  const typeColors: Record<string, string> = {
    order_issue: "hsl(var(--chart-1))",
    delivery_issue: "hsl(var(--chart-3))",
    payment_issue: "hsl(var(--chart-2))",
    return_refund: "hsl(var(--destructive))",
    other: "hsl(var(--chart-4))",
  }

  const typeLabels: Record<string, string> = {
    order_issue: "Order Issue",
    delivery_issue: "Delivery Issue",
    payment_issue: "Payment Issue",
    return_refund: "Refund Issue",
    other: "Other Issue",
  }

  const typeOrder: SupportType[] = ["order_issue", "delivery_issue", "payment_issue", "return_refund", "other"]

  const totalTickets = total || typeOrder.reduce((sum, key) => sum + (data[key] || 0), 0)
  const totalClosedTickets = totalTickets - totalOpen

  const chartData = typeOrder.map((key) => ({
    type: key,
    label: typeLabels[key],
    count: data[key] || 0,
    openCount: openData[key] || 0,
  }))

  const pieChartData = chartData.filter((d) => d.count > 0)

  const openPercentage = totalTickets > 0 ? ((totalOpen / totalTickets) * 100) : 0
  const closedPercentage = totalTickets > 0 ? ((totalClosedTickets / totalTickets) * 100) : 0

  const supportTypePercentages = chartData.map((item) => ({
    name: item.label,
    color: typeColors[item.type],
    count: item.count,
    percentage: totalTickets > 0 ? Number(((item.count / totalTickets) * 100).toFixed(2)) : 0,
  })).filter((item) => item.count > 0)

  return (
    <div className={cn("flex flex-col gap-6", className)} style={{ height: "auto", minHeight: height }}>
      <div className="flex flex-col md:flex-row items-center gap-8 w-full">
        <div className="flex-1 flex justify-center relative min-w-0">
          <PieChart
            data={pieChartData}
            dataKey="count"
            nameKey="label"
            height={height}
            showLegend={false}
            showTooltip={true}
            colors={pieChartData.map((d) => typeColors[d.type] || "hsl(var(--chart-1))")}
            innerRadius={donut ? 70 : 0}
            outerRadius={100}
            animate={true}
            label={true}
            labelFormatter={(value, name) => {
              const item = chartData.find(d => d.label === name)
              if (!item || totalTickets === 0) return ""
              const pct = (item.count / totalTickets) * 100
              return pct >= 5 ? `${pct.toFixed(2)}%` : ""
            }}
            isCurrency={false}
          />
        </div>
        <div className="w-full md:w-64 flex flex-col gap-3">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="p-4 bg-muted/30 rounded-lg border border-border/50"
          >
            <p className="text-sm font-medium text-foreground">Open Request</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {totalOpen} <span className="text-lg font-normal text-muted-foreground">({openPercentage.toFixed(2)}%)</span>
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="p-4 bg-muted/30 rounded-lg border border-border/50"
          >
            <p className="text-sm font-medium text-foreground">Close Request</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {totalClosedTickets} <span className="text-lg font-normal text-muted-foreground">({closedPercentage.toFixed(2)}%)</span>
            </p>
          </motion.div>
        </div>
      </div>
      <div className="w-full pt-4 border-t border-border/50">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {supportTypePercentages.map((item, index) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + index * 0.1 }}
              className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
              </div>
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">{item.percentage.toFixed(2)}%</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}