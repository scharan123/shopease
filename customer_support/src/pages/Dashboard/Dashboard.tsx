import { useState, type ComponentType } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import {
  MessageSquare, AlertCircle, CheckCircle, Plus, ArrowRight, Clock,
  Loader2, Mail, Phone, Package, Truck, CreditCard, RotateCcw, HelpCircle, Layers,
  Printer, XCircle,
} from "lucide-react"
import { PageLayout } from "@/components/layout"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Modal } from "@/components/ui/Modal"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { SupportRequest, SupportStatus, SupportType } from "@/lib/types"
import { SUPPORT_STATUSES } from "@/lib/types"

const SUPPORT_TYPE_FILTERS: { value: SupportType | "all"; label: string; icon: ComponentType<{ className?: string }>; color: string }[] = [
  { value: "all", label: "All Support Types", icon: Layers, color: "text-emerald-400" },
  { value: "order_issue", label: "Order Issue", icon: Package, color: "text-blue-400" },
  { value: "delivery_issue", label: "Delivery Issue", icon: Truck, color: "text-orange-400" },
  { value: "payment_issue", label: "Payment Issue", icon: CreditCard, color: "text-purple-400" },
  { value: "return_refund", label: "Return & Refund", icon: RotateCcw, color: "text-red-400" },
  { value: "other", label: "Other", icon: HelpCircle, color: "text-zinc-400" },
]

const getSupportTypeLabel = (type: SupportType) => {
  return SUPPORT_TYPE_FILTERS.find(t => t.value === type)?.label || type
}

const normalizeStatus = (status: string): SupportStatus => {
  const normalized = status.toLowerCase().trim()
  if (normalized === "open") return "open"
  if (normalized === "closed") return "closed"
  return "open"
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

export function Dashboard() {
  const navigate = useNavigate()

  const [selectedSupportType, setSelectedSupportType] = useState<SupportType | "all">("all")
  const [selectedStatus, setSelectedStatus] = useState<SupportStatus | "all">("all")
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null)

  const { data: ticketsData, isLoading: ticketsLoading } = useQuery({
    queryKey: ["customer-support", ""],
    queryFn: () => api.support.getMy({ page: 1, limit: 500 }),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 30000,
  })

  const tickets = ticketsData?.data ?? []

  // Single source of truth: compute ALL stats from tickets array
  const totalCount = ticketsData?.pagination?.total ?? tickets.length
  const openCount = tickets.filter(t => normalizeStatus(t.status) === "open").length
  const closedCount = tickets.filter(t => normalizeStatus(t.status) === "closed").length

  const supportTypeCounts = tickets.reduce(
    (acc, ticket) => {
      acc[ticket.support_type] = (acc[ticket.support_type] || 0) + 1
      return acc
    },
    {} as Record<SupportType, number>
  )

  const ticketsLoaded = !ticketsLoading && ticketsData !== undefined
  const cardsReady = ticketsLoaded

  const getTypeCount = (type: SupportType | "all") => {
    if (type === "all") return totalCount
    return supportTypeCounts[type] || 0
  }

  const filteredByType = selectedSupportType === "all"
    ? tickets
    : tickets.filter(t => t.support_type === selectedSupportType)

  const filteredByStatus = selectedStatus === "all"
    ? filteredByType
    : filteredByType.filter(t => normalizeStatus(t.status) === selectedStatus)

  const displayTickets = filteredByStatus.slice(0, 5)

  const handleViewRequest = async (request: SupportRequest) => {
    const freshData = await api.support.getMyOne(request.id)
    setSelectedRequest(freshData)
  }

  const handlePrint = () => {
    if (!selectedRequest) return
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    printWindow.document.write(`
      <html><head><title>Support Ticket ${selectedRequest.support_id}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        h1 { font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 8px; }
        .field { margin: 10px 0; }
        .label { font-weight: bold; color: #666; }
        .value { margin-top: 2px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        .badge-open { background: #dbeafe; color: #1d4ed8; }
        .badge-closed { background: #dcfce7; color: #16a34a; }
        .section { margin-top: 16px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; }
        .reply { background: #f0f9ff; border: 1px solid #bae6fd; }
      </style></head><body>
      <h1>Support Ticket: ${selectedRequest.support_id}</h1>
      <div class="field"><span class="label">Ticket ID:</span><div class="value">${selectedRequest.support_id}</div></div>
      <div class="field"><span class="label">Support Type:</span><div class="value">${getSupportTypeLabel(selectedRequest.support_type)}</div></div>
      <div class="field"><span class="label">Status:</span><div class="value">${selectedRequest.status === "open" ? "Open" : "Closed"}</div></div>
      <div class="field"><span class="label">Created:</span><div class="value">${formatDate(selectedRequest.created_at)}</div></div>
      <div class="field"><span class="label">Email:</span><div class="value">${selectedRequest.email}</div></div>
      <div class="field"><span class="label">Mobile:</span><div class="value">${selectedRequest.mobile}</div></div>
      <div class="section"><span class="label">Your Message:</span><div class="value">${selectedRequest.description}</div></div>
      ${selectedRequest.admin_reply ? `<div class="section reply"><span class="label">Admin Reply:</span><div class="value">${selectedRequest.admin_reply}</div><div style="font-size:11px;color:#888;margin-top:6px;">Replied on ${formatDate(selectedRequest.updated_at)}</div></div>` : ""}
      </body></html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <PageLayout
      title="Dashboard"
      description="Welcome to your support dashboard"
      actions={
        <Button onClick={() => navigate("/support/create")} className="gap-2">
          <Plus className="h-4 w-4" />
          New Support Request
        </Button>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          className={cn(
            "flex items-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors",
            selectedStatus === "all" && selectedSupportType === "all" && "ring-2 ring-primary/60"
          )}
          onClick={() => { setSelectedStatus("all"); setSelectedSupportType("all") }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {!cardsReady ? <span className="inline-block h-7 w-8 bg-muted animate-pulse rounded" /> : totalCount}
            </p>
            <p className="text-sm text-muted-foreground">Total Requests</p>
          </div>
        </Card>
        <Card
          className={cn(
            "flex items-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors",
            selectedStatus === "open" && "ring-2 ring-blue-500/60"
          )}
          onClick={() => setSelectedStatus("open")}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {!cardsReady ? <span className="inline-block h-7 w-8 bg-muted animate-pulse rounded" /> : openCount}
            </p>
            <p className="text-sm text-muted-foreground">Open Requests</p>
          </div>
        </Card>
        <Card
          className={cn(
            "flex items-center gap-4 cursor-pointer hover:bg-muted/50 transition-colors",
            selectedStatus === "closed" && "ring-2 ring-green-500/60"
          )}
          onClick={() => setSelectedStatus("closed")}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-500">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {!cardsReady ? <span className="inline-block h-7 w-8 bg-muted animate-pulse rounded" /> : closedCount}
            </p>
            <p className="text-sm text-muted-foreground">Closed Requests</p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Support Types</h2>
          <p className="text-sm text-muted-foreground">Filter your tickets by support type</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {SUPPORT_TYPE_FILTERS.map((option) => {
            const Icon = option.icon
            const isActive = selectedSupportType === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setSelectedSupportType(option.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer",
                  isActive
                    ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                    : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                <Icon className={cn("h-4 w-4", option.color)} />
                {option.label} ({getTypeCount(option.value as SupportType)})
              </button>
            )
          })}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Recent Support Requests</h2>
            <p className="text-sm text-muted-foreground">Your latest support tickets</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/support")}
            className="gap-1"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {ticketsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : displayTickets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No support requests yet</p>
            <Button onClick={() => navigate("/support/create")} className="mt-3 gap-2" size="sm">
              <Plus className="h-4 w-4" />
              Create your first request
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayTickets.map((request) => (
              <div
                key={request.id}
                onClick={() => handleViewRequest(request)}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-medium text-primary">{request.support_id}</p>
                    <p className="text-xs text-muted-foreground capitalize">{getSupportTypeLabel(request.support_type)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(request.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={request.status === "open" ? "info" : "success"}
                    className="capitalize text-xs"
                  >
                    {request.status}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

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

            <div className="flex justify-end pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageLayout>
  )
}
