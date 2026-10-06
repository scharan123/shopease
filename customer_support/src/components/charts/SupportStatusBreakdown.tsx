import { cn } from "../../lib/utils"
import type { SupportType, SupportStatus } from "../../lib/types"
import {
  Package, Truck, CreditCard, RotateCcw, HelpCircle, AlertCircle, CheckCircle
} from "lucide-react"

const SUPPORT_TYPE_CONFIG: Record<SupportType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }> = {
  order_issue: { label: "Order Issue", icon: Package, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  delivery_issue: { label: "Delivery Issue", icon: Truck, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
  payment_issue: { label: "Payment Issue", icon: CreditCard, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  return_refund: { label: "Return & Refund", icon: RotateCcw, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30" },
  other: { label: "Other", icon: HelpCircle, color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-900/30" },
}

const SUPPORT_TYPES: SupportType[] = ["order_issue", "delivery_issue", "payment_issue", "return_refund", "other"]

interface StatusBreakdownData {
  open: Record<SupportType, number>
  closed: Record<SupportType, number>
}

interface SupportStatusBreakdownProps {
  data: StatusBreakdownData
  className?: string
}

function StatusColumn({ title, icon, iconColor, bgColor, counts, total, status }: {
  title: string
  icon: React.ReactNode
  iconColor: string
  bgColor: string
  counts: Record<SupportType, number>
  total: number
  status: SupportStatus
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 flex-1 min-w-[280px] max-w-full", status === "open" ? "border-orange-500/30" : "border-green-500/30")}>
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("p-3 rounded-xl", bgColor)}>
          <span className={cn("h-5 w-5", iconColor)}>{icon}</span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">Total: <span className="font-medium text-foreground">{total}</span></p>
        </div>
      </div>

      <div className="space-y-2">
        {SUPPORT_TYPES.map((type) => {
          const config = SUPPORT_TYPE_CONFIG[type]
          const Icon = config.icon
          const count = counts[type] ?? 0
          return (
            <div key={type} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className={cn("p-1.5 rounded", config.bgColor)}>
                <Icon className={cn("h-3.5 w-3.5", config.color)} />
              </div>
              <span className="text-sm font-medium text-foreground flex-1 truncate">{config.label}</span>
              <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold", status === "open" ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300")}>
                {count}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Total {title}</span>
        <span className={cn("text-lg font-bold font-mono", status === "open" ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400")}>
          {total}
        </span>
      </div>
    </div>
  )
}

export function SupportStatusBreakdown({ data, className }: SupportStatusBreakdownProps) {
  const openTotal = Object.values(data.open).reduce((sum, count) => sum + count, 0)
  const closedTotal = Object.values(data.closed).reduce((sum, count) => sum + count, 0)

  return (
    <div className={cn("w-full", className)}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusColumn
          title="Open Requests"
          icon={<AlertCircle className="h-5 w-5" />}
          iconColor="text-orange-600 dark:text-orange-400"
          bgColor="bg-orange-100 dark:bg-orange-900/30"
          counts={data.open}
          total={openTotal}
          status="open"
        />
        <StatusColumn
          title="Closed Requests"
          icon={<CheckCircle className="h-5 w-5" />}
          iconColor="text-green-600 dark:text-green-400"
          bgColor="bg-green-100 dark:bg-green-900/30"
          counts={data.closed}
          total={closedTotal}
          status="closed"
        />
      </div>

      <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Grand Total</span>
          <span className="font-bold text-foreground font-mono text-lg">{openTotal + closedTotal}</span>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            Open: {openTotal}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Closed: {closedTotal}
          </span>
        </div>
      </div>
    </div>
  )
}