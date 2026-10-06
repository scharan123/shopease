import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams, useLocation } from "react-router-dom"
import {
  MessageSquare, Search, ChevronRight, ChevronLeft,
  CheckCircle, Clock, Loader2, Mail, Phone,
  FileDown, FileSpreadsheet, TicketCheck, TicketX, TicketPlus,
  FilterX,
  Package, Truck, CreditCard, RotateCcw, HelpCircle, Layers
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PageLayout, Section } from "@/components/layout"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input, Select } from "@/components/ui/Input"
import { Modal } from "@/components/ui/Modal"
import { toast } from "@/components/ui/Toast"
import { api } from "@/lib/api"
import {
  fetchAllSupportTickets,
  downloadSupportTicketsPDF,
  downloadSupportTicketsCSV,
} from "@/lib/supportExport"
import { SupportTypePieChart, PieChart } from "@/components/charts"
import type { SupportRequest, SupportStatus, SupportType, SupportStats } from "@/lib/types"
import { SUPPORT_TYPES, SUPPORT_STATUSES } from "@/lib/types"

function truncate(text: string, length: number) {
  if (text.length <= length) return text
  return text.slice(0, length) + "..."
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const getSupportTypeLabel = (type: SupportType) => {
  return SUPPORT_TYPES.find(t => t.value === type)?.label || type
}

const getStatusBadge = (status: SupportStatus) => {
  const statusConfig = SUPPORT_STATUSES.find(s => s.value === status)
  if (!statusConfig) return <Badge variant="outline">{status}</Badge>

  const variantMap: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"> = {
    blue: "info",
    green: "success",
    red: "destructive",
  }

  return <Badge variant={variantMap[statusConfig.color] || "outline"} className="capitalize">{statusConfig.label}</Badge>
}

const normalizeStatus = (status: string): SupportStatus => {
  const normalized = status.toLowerCase().trim()
  if (normalized === "open") return "open"
  if (normalized === "closed") return "closed"
  return "open"
}

const normalizeSupportType = (type: string): SupportType => {
  const normalized = type.toLowerCase().trim()
  const validTypes: SupportType[] = ["order_issue", "delivery_issue", "payment_issue", "return_refund", "other"]
  if (validTypes.includes(normalized as SupportType)) return normalized as SupportType
  return "other"
}

const calculatePercentage = (count: number, total: number): number => {
  if (total === 0) return 0
  return Math.round((count / total) * 100)
}

const SUPPORT_TYPE_CONFIG: Record<SupportType | "all", { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string; badgeColor: string }> = {
  all: { label: "All Support Types", icon: Layers, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/30", badgeColor: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
  order_issue: { label: "Order Issue", icon: Package, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/30", badgeColor: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
  delivery_issue: { label: "Delivery Issue", icon: Truck, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/30", badgeColor: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" },
  payment_issue: { label: "Payment Issue", icon: CreditCard, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/30", badgeColor: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300" },
  return_refund: { label: "Return & Refund", icon: RotateCcw, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30", badgeColor: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" },
  other: { label: "Other", icon: HelpCircle, color: "text-gray-600 dark:text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-900/30", badgeColor: "bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300" },
}

const SUPPORT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "All Support Types", label: "All Support Types" },
  { value: "order_issue", label: "Order Issue" },
  { value: "delivery_issue", label: "Delivery Issue" },
  { value: "payment_issue", label: "Payment Issue" },
  { value: "return_refund", label: "Return & Refund" },
  { value: "other", label: "Other" },
]

const SUMMARY_CARD_CONFIG = {
  total: { title: "Total Requests", icon: TicketPlus, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/30", iconBg: "bg-blue-100 dark:bg-blue-900/30" },
  open: { title: "Open Requests", icon: Clock, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/30", iconBg: "bg-orange-100 dark:bg-orange-900/30" },
  closed: { title: "Closed Requests", icon: CheckCircle, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/30", iconBg: "bg-green-100 dark:bg-green-900/30" },
}

export function Support() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStatus = searchParams.get("status") || "all"

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<SupportStatus | "all">(
    initialStatus === "open" || initialStatus === "closed" ? initialStatus : "all"
  )
  const [selectedSupportType, setSelectedSupportType] = useState("All Support Types")
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null)
  const [exporting, setExporting] = useState<"pdf" | "csv" | null>(null)
  const location = useLocation()

  // Fetch support stats for summary cards
  const { data: stats, isLoading: statsLoading } = useQuery<SupportStats>({
    queryKey: ["customer-support-stats"],
    queryFn: () => api.support.getMyStats(),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  })

  useEffect(() => {
    const param = searchParams.get("status")
    if (param === "open" || param === "closed") {
      setStatusFilter(param)
    } else if (param === "all" || !param) {
      setStatusFilter("all")
    }
  }, [searchParams])

  const clearIdParam = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete("id")
      return next
    })
  }

  // When the customer clicks a bell notification (e.g. "Ticket #TICKET-001")
  // it navigates to /support?id=<ticketId>. Open that exact ticket here.
  useEffect(() => {
    const paramId = searchParams.get("id")
    if (!paramId) return
    const ticketId = Number(paramId)
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      clearIdParam()
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const fresh = await api.support.getMyOne(ticketId)
        if (!cancelled) {
          setSelectedRequest(fresh)
          clearIdParam()
        }
      } catch {
        if (!cancelled) {
          clearIdParam()
          toast.error("Could not load the requested support ticket")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [location.key])

  const { data, isLoading } = useQuery({
    queryKey: ["customer-support", search],
    queryFn: async () => {
      const pageSize = 100
      const all: SupportRequest[] = []
      let page = 1
      while (true) {
        const res = await api.support.getMy({ page, limit: pageSize, search })
        if (res?.data?.length) all.push(...res.data)
        const total = res?.pagination?.total ?? all.length
        const totalPages = Math.max(1, Math.ceil(total / pageSize))
        if (!res?.data?.length || page >= totalPages || all.length >= total) break
        page += 1
      }
      return all
    },
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  })

  const tickets = Array.isArray(data) ? data : []

  const computedStats = useMemo(() => {
    const normalizedTickets = tickets.map(t => ({
      ...t,
      status: normalizeStatus(t.status),
      support_type: normalizeSupportType(t.support_type),
    }))

    const total = normalizedTickets.length
    const open = normalizedTickets.filter(t => t.status === "open").length
    const closed = normalizedTickets.filter(t => t.status === "closed").length

    const supportTypeCounts: Record<SupportType, number> = {
      order_issue: 0,
      delivery_issue: 0,
      payment_issue: 0,
      return_refund: 0,
      other: 0,
    }

    const openByType: Record<SupportType, number> = {
      order_issue: 0,
      delivery_issue: 0,
      payment_issue: 0,
      return_refund: 0,
      other: 0,
    }

    const closedByType: Record<SupportType, number> = {
      order_issue: 0,
      delivery_issue: 0,
      payment_issue: 0,
      return_refund: 0,
      other: 0,
    }

    normalizedTickets.forEach(t => {
      supportTypeCounts[t.support_type] = (supportTypeCounts[t.support_type] || 0) + 1
      if (t.status === "open") {
        openByType[t.support_type] = (openByType[t.support_type] || 0) + 1
      } else if (t.status === "closed") {
        closedByType[t.support_type] = (closedByType[t.support_type] || 0) + 1
      }
    })

    return {
      total,
      open,
      closed,
      supportTypeCounts,
      openByType,
      closedByType,
    }
  }, [tickets])

  // Use computedStats as primary source (ground truth from actual tickets)
  // Use stats only as fallback while tickets are loading
  const totalRequests = isLoading ? (stats?.total ?? 0) : computedStats.total
  const openRequests = isLoading ? (stats?.open ?? 0) : computedStats.open
  const closedRequests = isLoading ? (stats?.closed ?? 0) : computedStats.closed
  const supportTypeCounts = computedStats.supportTypeCounts
  const openByType = computedStats.openByType
  const closedByType = computedStats.closedByType

  const totalPercentage = calculatePercentage(totalRequests, totalRequests)
  const openPercentage = calculatePercentage(openRequests, totalRequests)
  const closedPercentage = calculatePercentage(closedRequests, totalRequests)

  const filteredTickets = tickets.filter((ticket) => {
    const normalizedStatus = normalizeStatus(ticket.status)
    const normalizedType = normalizeSupportType(ticket.support_type)
    const statusMatches = statusFilter === "all" || normalizedStatus === statusFilter
    const typeMatches =
      selectedSupportType === "All Support Types" ||
      normalizedType === selectedSupportType
    return statusMatches && typeMatches
  })

  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageTickets = filteredTickets.slice((safePage - 1) * pageSize, safePage * pageSize)

  const handleViewRequest = async (request: SupportRequest) => {
    const freshData = await api.support.getMyOne(request.id)
    setSelectedRequest(freshData)
  }

  const handleDownloadPDF = () => {
    setExporting("pdf")
    fetchAllSupportTickets()
      .then((allTickets) => {
        downloadSupportTicketsPDF(allTickets)
        toast.success(`${allTickets.length} support tickets exported. PDF downloaded successfully.`)
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to generate PDF"
        toast.error(message)
      })
      .finally(() => setExporting(null))
  }

  const handleDownloadCSV = () => {
    setExporting("csv")
    fetchAllSupportTickets()
      .then((allTickets) => {
        downloadSupportTicketsCSV(allTickets)
        toast.success(`${allTickets.length} support tickets exported. CSV downloaded successfully.`)
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Failed to generate CSV"
        toast.error(message)
      })
      .finally(() => setExporting(null))
  }

  const handleSummaryFilter = (filter: { status?: SupportStatus | "all"; supportType?: SupportType | "all" }) => {
    if (filter.status !== undefined) {
      setStatusFilter(filter.status)
      setSearchParams(filter.status === "all" ? {} : { status: filter.status })
    }
    if (filter.supportType !== undefined) {
      const supportTypeValue = filter.supportType === "all" ? "All Support Types" : filter.supportType
      setSelectedSupportType(supportTypeValue)
    }
    setPage(1)
  }

  const clearAllFilters = () => {
    setStatusFilter("all")
    setSelectedSupportType("All Support Types")
    setSearch("")
    setSearchParams({})
    setPage(1)
  }

  const hasActiveFilters = statusFilter !== "all" || selectedSupportType !== "All Support Types" || search !== ""

  return (
    <PageLayout
      title="My Support Requests"
      description="Track and manage your support tickets"
    >
      <Section
        title="Downloads"
        description="Export all your support tickets as PDF or CSV"
      >
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Export your support tickets</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Downloads include all your support tickets, regardless of the current filter.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                onClick={handleDownloadPDF}
                disabled={exporting !== null}
                className="gap-2"
              >
                {exporting === "pdf" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
                {exporting === "pdf" ? "Generating PDF..." : "Download PDF"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadCSV}
                disabled={exporting !== null}
                className="gap-2"
              >
                {exporting === "csv" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                {exporting === "csv" ? "Generating CSV..." : "Download CSV"}
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Summary">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-6 animate-pulse">
                <div className="h-4 w-24 bg-muted rounded mb-2" />
                <div className="h-8 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => handleSummaryFilter({ status: "all", supportType: "all" })}
              className="h-auto p-6 text-left hover:shadow-md transition-shadow cursor-pointer group"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${SUMMARY_CARD_CONFIG.total.iconBg}`}>
                  <SUMMARY_CARD_CONFIG.total.icon className={`h-6 w-6 ${SUMMARY_CARD_CONFIG.total.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-3xl font-bold text-foreground">{totalRequests}</p>
                  <p className="text-sm font-medium text-muted-foreground mt-1">{SUMMARY_CARD_CONFIG.total.title}</p>
                  <p className="text-sm font-semibold text-primary mt-1">{totalPercentage}%</p>
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSummaryFilter({ status: "open" })}
              className="h-auto p-6 text-left hover:shadow-md transition-shadow cursor-pointer group"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${SUMMARY_CARD_CONFIG.open.iconBg}`}>
                  <SUMMARY_CARD_CONFIG.open.icon className={`h-6 w-6 ${SUMMARY_CARD_CONFIG.open.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-3xl font-bold text-foreground">{openRequests}</p>
                  <p className="text-sm font-medium text-muted-foreground mt-1">{SUMMARY_CARD_CONFIG.open.title}</p>
                  <p className="text-sm font-semibold text-orange-600 dark:text-orange-400 mt-1">{openPercentage}%</p>
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSummaryFilter({ status: "closed" })}
              className="h-auto p-6 text-left hover:shadow-md transition-shadow cursor-pointer group"
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${SUMMARY_CARD_CONFIG.closed.iconBg}`}>
                  <SUMMARY_CARD_CONFIG.closed.icon className={`h-6 w-6 ${SUMMARY_CARD_CONFIG.closed.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-3xl font-bold text-foreground">{closedRequests}</p>
                  <p className="text-sm font-medium text-muted-foreground mt-1">{SUMMARY_CARD_CONFIG.closed.title}</p>
                  <p className="text-sm font-semibold text-green-600 dark:text-green-400 mt-1">{closedPercentage}%</p>
                </div>
              </div>
            </Button>
          </div>
        )}
      </Section>

      <Section title="Support Types">
        {statsLoading || isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 animate-pulse">
                <div className="h-4 w-24 bg-muted rounded mb-2" />
                <div className="h-6 w-12 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {[
              { value: "all" as const, label: "All Support Types" },
              ...SUPPORT_TYPES,
            ].map((type) => {
              const config = SUPPORT_TYPE_CONFIG[type.value as SupportType | "all"]
              const count = type.value === "all" ? totalRequests : supportTypeCounts[type.value as SupportType] ?? 0
              const isSelected = selectedSupportType === (type.value === "all" ? "All Support Types" : type.value)
              const Icon = config.icon
              return (
                <Button
                  key={type.value}
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => handleSummaryFilter({ supportType: type.value === "all" ? "all" : type.value as SupportType })}
                  className={cn(
                    "h-auto px-4 py-3 text-left transition-all gap-2",
                    isSelected ? "shadow-md" : "hover:shadow-sm"
                  )}
                >
                  <div className={`p-2 rounded-lg ${config.bgColor}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium capitalize">{config.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.badgeColor}`}>
                      {count}
                    </span>
                  </div>
                </Button>
              )
            })}
          </div>
        )}
      </Section>

      <Section title="Analytics">
        {statsLoading || isLoading ? (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-6 animate-pulse">
              <div className="h-6 w-40 bg-muted rounded mb-4" />
              <div className="h-64 bg-muted rounded" />
            </div>
            <div className="rounded-lg border border-border bg-card p-6 animate-pulse">
              <div className="h-6 w-40 bg-muted rounded mb-4" />
              <div className="h-64 bg-muted rounded" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-lg border border-border bg-card p-6 animate-pulse">
                <div className="h-6 w-40 bg-muted rounded mb-4" />
                <div className="h-64 bg-muted rounded" />
              </div>
              <div className="rounded-lg border border-border bg-card p-6 animate-pulse">
                <div className="h-6 w-40 bg-muted rounded mb-4" />
                <div className="h-64 bg-muted rounded" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Layers className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Support Types Distribution</h3>
              </div>
              <div style={{ height: 280 }}>
                <SupportTypePieChart
                  totalData={supportTypeCounts}
                  openData={openByType}
                  closedData={closedByType}
                  donut={true}
                />
              </div>
              <div className="mt-6 pt-6 border-t border-border">
                <h4 className="text-sm font-semibold text-foreground mb-4">Total Support Types</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { type: "order_issue", label: "Order Issue", color: "#3b82f6" },
                    { type: "delivery_issue", label: "Delivery Issue", color: "#f97316" },
                    { type: "payment_issue", label: "Payment Issue", color: "#a855f7" },
                    { type: "return_refund", label: "Return & Refund", color: "#ef4444" },
                    { type: "other", label: "Other", color: "#0ea5e9" },
                  ].map((item) => {
                    const totalCount = supportTypeCounts[item.type as SupportType] ?? 0
                    const totalPercentage = totalRequests > 0 ? ((totalCount / totalRequests) * 100).toFixed(2) : "0.00"
                    return (
                      <div key={item.type} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div className="flex items-center gap-3">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-sm font-medium text-foreground">{item.label}</span>
                        </div>
                        <span className="font-medium text-foreground text-right">
                          {totalCount} ({totalPercentage}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-lg border border-orange-500/30 bg-card p-6 flex flex-col">
                <h4 className="font-semibold text-orange-700 dark:text-orange-300 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  Open Request
                </h4>
                <div style={{ height: 280 }} className="mb-6">
                  <PieChart
                    data={[
                      { name: "Order Issue", value: openByType["order_issue"] ?? 0, color: "#3b82f6" },
                      { name: "Delivery Issue", value: openByType["delivery_issue"] ?? 0, color: "#f97316" },
                      { name: "Payment Issue", value: openByType["payment_issue"] ?? 0, color: "#a855f7" },
                      { name: "Return & Refund", value: openByType["return_refund"] ?? 0, color: "#ef4444" },
                      { name: "Other", value: openByType["other"] ?? 0, color: "#0ea5e9" },
                    ].filter(d => d.value > 0)}
                    height={280}
                    innerRadius={70}
                    outerRadius={100}
                    showLegend={false}
                    colors={[
                      { name: "Order Issue", color: "#3b82f6", value: openByType["order_issue"] ?? 0 },
                      { name: "Delivery Issue", color: "#f97316", value: openByType["delivery_issue"] ?? 0 },
                      { name: "Payment Issue", color: "#a855f7", value: openByType["payment_issue"] ?? 0 },
                      { name: "Return & Refund", color: "#ef4444", value: openByType["return_refund"] ?? 0 },
                      { name: "Other", color: "#0ea5e9", value: openByType["other"] ?? 0 },
                    ].filter(d => d.value > 0).map(d => d.color)}
                    label={true}
                    labelFormatter={(value) => {
                      if (openRequests === 0) return ""
                      const pct = (value / openRequests) * 100
                      return pct >= 3 ? `${pct.toFixed(2)}%` : ""
                    }}
                    tooltipType="open"
                  />
                </div>
                <div className="space-y-3 mt-auto">
                  {[
                    { type: "order_issue" as const, label: "Order Issue", color: "#3b82f6" },
                    { type: "delivery_issue" as const, label: "Delivery Issue", color: "#f97316" },
                    { type: "payment_issue" as const, label: "Payment Issue", color: "#a855f7" },
                    { type: "return_refund" as const, label: "Return & Refund", color: "#ef4444" },
                    { type: "other" as const, label: "Other", color: "#0ea5e9" },
                  ].map((item) => {
                    const count = openByType[item.type] ?? 0
                    const percentage = openRequests > 0 ? ((count / openRequests) * 100).toFixed(2) : "0.00"
                    return (
                      <div key={item.type} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div className="flex items-center gap-3">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-sm font-medium text-foreground">{item.label}</span>
                        </div>
                        <span className="font-medium text-foreground text-right">
                          {count} ({percentage}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-green-500/30 bg-card p-6 flex flex-col">
                <h4 className="font-semibold text-green-700 dark:text-green-300 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Closed Request
                </h4>
                <div style={{ height: 280 }} className="mb-6">
                  <PieChart
                    data={[
                      { name: "Order Issue", value: closedByType["order_issue"] ?? 0, color: "#3b82f6" },
                      { name: "Delivery Issue", value: closedByType["delivery_issue"] ?? 0, color: "#f97316" },
                      { name: "Payment Issue", value: closedByType["payment_issue"] ?? 0, color: "#a855f7" },
                      { name: "Return & Refund", value: closedByType["return_refund"] ?? 0, color: "#ef4444" },
                      { name: "Other", value: closedByType["other"] ?? 0, color: "#0ea5e9" },
                    ].filter(d => d.value > 0)}
                    height={280}
                    innerRadius={70}
                    outerRadius={100}
                    showLegend={false}
                    colors={[
                      { name: "Order Issue", color: "#3b82f6", value: closedByType["order_issue"] ?? 0 },
                      { name: "Delivery Issue", color: "#f97316", value: closedByType["delivery_issue"] ?? 0 },
                      { name: "Payment Issue", color: "#a855f7", value: closedByType["payment_issue"] ?? 0 },
                      { name: "Return & Refund", color: "#ef4444", value: closedByType["return_refund"] ?? 0 },
                      { name: "Other", color: "#0ea5e9", value: closedByType["other"] ?? 0 },
                    ].filter(d => d.value > 0).map(d => d.color)}
                    label={true}
                    labelFormatter={(value) => {
                      if (closedRequests === 0) return ""
                      const pct = (value / closedRequests) * 100
                      return pct >= 3 ? `${pct.toFixed(2)}%` : ""
                    }}
                    tooltipType="closed"
                  />
                </div>
                <div className="space-y-3 mt-auto">
                  {[
                    { type: "order_issue" as const, label: "Order Issue", color: "#3b82f6" },
                    { type: "delivery_issue" as const, label: "Delivery Issue", color: "#f97316" },
                    { type: "payment_issue" as const, label: "Payment Issue", color: "#a855f7" },
                    { type: "return_refund" as const, label: "Return & Refund", color: "#ef4444" },
                    { type: "other" as const, label: "Other", color: "#0ea5e9" },
                  ].map((item) => {
                    const count = closedByType[item.type] ?? 0
                    const percentage = closedRequests > 0 ? ((count / closedRequests) * 100).toFixed(2) : "0.00"
                    return (
                      <div key={item.type} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                        <div className="flex items-center gap-3">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-sm font-medium text-foreground">{item.label}</span>
                        </div>
                        <span className="font-medium text-foreground text-right">
                          {count} ({percentage}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </Section>

      {hasActiveFilters && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">Active filters applied</span>
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="gap-1.5">
            <FilterX className="h-3.5 w-3.5" />
            Clear all
          </Button>
        </div>
      )}

      <Section title="My Support Requests">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID, name, email, mobile..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(v) => {
              const val = v as SupportStatus | "all"
              setStatusFilter(val)
              setSearchParams(val === "all" ? {} : { status: val })
              setPage(1)
            }}
            options={[
              { value: "all", label: "All Statuses" },
              ...SUPPORT_STATUSES.map(s => ({ value: s.value, label: s.label }))
            ]}
            placeholder="All Statuses"
            className="w-full sm:w-[180px]"
          />
          <Select
            value={selectedSupportType}
            onChange={(v) => { setSelectedSupportType(v); setPage(1); }}
            options={SUPPORT_TYPE_OPTIONS}
            className="w-full sm:w-[200px]"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No support requests found</p>
            <p className="text-sm mt-1">You don't have any support tickets yet.</p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[120px]">
                        Ticket ID
                      </th>
                      <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Support Type
                      </th>
                      <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                        Description
                      </th>
                      <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[160px]">
                        Date
                      </th>
                      <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[100px]">
                        Status
                      </th>
                      <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-[80px]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageTickets.map((request) => (
                      <tr
                        key={request.id}
                        className={cn(
                          "border-b border-border transition-colors hover:bg-muted/50",
                          request.status === "open" && "bg-blue-50/50"
                        )}
                      >
                        <td className="p-4 font-mono font-medium text-primary text-sm">
                          {request.support_id}
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="capitalize text-xs">
                            {getSupportTypeLabel(request.support_type)}
                          </Badge>
                        </td>
                        <td className="p-4 hidden md:table-cell">
                          <span className="max-w-[300px] truncate block text-sm" title={request.description}>
                            {truncate(request.description, 80)}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {formatDate(request.created_at)}
                        </td>
                        <td className="p-4">
                          {getStatusBadge(request.status)}
                        </td>
                        <td className="p-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewRequest(request)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </Section>

      <Modal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title={`Support Request: ${selectedRequest?.support_id}`}
        size="xl"
      >
        {selectedRequest && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-semibold text-foreground">Request Information</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Ticket ID</p>
                    <p className="font-mono font-medium text-primary">{selectedRequest.support_id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <Badge variant="outline" className="capitalize">{getSupportTypeLabel(selectedRequest.support_type)}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p>{formatDate(selectedRequest.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p>{getStatusBadge(selectedRequest.status)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-semibold text-foreground">Contact Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{selectedRequest.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{selectedRequest.mobile}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-foreground">Your Message</h4>
              <div className="p-4 bg-muted/50 rounded-lg border">
                <p className="whitespace-pre-wrap text-sm">{selectedRequest.description}</p>
              </div>
            </div>

            {selectedRequest.admin_reply ? (
              <div className="space-y-2 bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="font-semibold text-foreground">Admin Reply</h4>
                <p className="whitespace-pre-wrap text-sm">{selectedRequest.admin_reply}</p>
                <p className="text-xs text-muted-foreground">Replied on {formatDate(selectedRequest.updated_at)}</p>
              </div>
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/10 dark:border-yellow-800/30">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Waiting for support team response.
                  </p>
                </div>
              </div>
            )}

            {selectedRequest.status === "closed" && (
              <div className="pt-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm">This ticket is closed.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </PageLayout>
  )
}
