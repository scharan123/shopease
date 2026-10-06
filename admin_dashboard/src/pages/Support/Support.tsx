import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useSearchParams, useLocation } from "react-router-dom"
import { MessageSquare, Search, ChevronRight, ChevronLeft, Mail, Phone, User, AlertCircle, CheckCircle, Send, Loader2, PieChart as PieChartIcon } from "lucide-react"
import { PageLayout, Section } from "@/components/layout"
import { Table } from "@/components/ui/Table"
import { Input, Select, Textarea } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Modal } from "@/components/ui/Modal"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { toast } from "@/components/ui/Toast"
import { api } from "@/lib/api"
import type { SupportRequest, SupportStatus, SupportType } from "@/lib/types"
import { SUPPORT_TYPES, SUPPORT_STATUSES } from "@/lib/types"
import { SupportTypePieChart } from "@/components/charts"

const getSupportTypeLabel = (type: SupportType) => {
  return SUPPORT_TYPES.find(t => t.value === type)?.label || type
}

const getStatusBadge = (status: SupportStatus) => {
  const statusConfig = SUPPORT_STATUSES.find(s => s.value === status)
  if (!statusConfig) return <Badge variant="outline">{status}</Badge>
  
  const colorMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    red: "destructive",
    blue: "secondary",
    purple: "default",
    green: "default",
  }
  
  return <Badge variant={colorMap[statusConfig.color] || "outline"} className="capitalize">{statusConfig.label}</Badge>
}

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

const supportColumns = [
  { key: "support_id", header: "Support ID", className: "w-[100px] font-mono font-medium text-primary" },
  { 
    key: "customer", 
    header: "Customer",
    render: (row: SupportRequest) => (
      <div>
        <p className="font-medium">{row.name}</p>
        <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {row.email}</p>
        <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {row.mobile}</p>
      </div>
    )
  },
  { 
    key: "type", 
    header: "Type", 
    className: "hidden md:table-cell",
    render: (row: SupportRequest) => (
      <Badge variant="outline" className="capitalize">{getSupportTypeLabel(row.support_type).replace(" / ", "/")}</Badge>
    )
  },
  { 
    key: "description", 
    header: "Description",
    render: (row: SupportRequest) => (
      <span className="max-w-[300px] truncate block" title={row.description}>{truncate(row.description, 100)}</span>
    )
  },
  { key: "created_at", header: "Date", className: "w-[160px] text-sm text-muted-foreground", render: (row: SupportRequest) => formatDate(row.created_at) },
  {
    key: "status",
    header: "Status",
    className: "w-[140px]",
    render: (row: SupportRequest) => (
      <div className="flex flex-col items-start gap-1">
        {getStatusBadge(row.status)}
        <Select
          value={row.status}
          onChange={(v) => handleStatusChange(row, v as SupportStatus)}
          options={SUPPORT_STATUSES.map(s => ({ value: s.value, label: s.label }))}
          className="h-8 text-xs w-[110px]"
          aria-label="Change status"
        />
      </div>
    )
  },
  { 
    key: "action", 
    header: "Action", 
    className: "w-[80px]",
    render: (row: SupportRequest) => (
      <Button variant="ghost" size="icon" onClick={() => handleViewRequest(row)} aria-label="View request">
        <ChevronRight className="h-4 w-4" />
      </Button>
    )
  },
]

let handleViewRequest: (request: SupportRequest) => void = () => {}
let handleStatusChange: (request: SupportRequest, newStatus: SupportStatus) => void = () => {}

export function Support() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<SupportStatus | "all">("all")
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null)
  const [replyText, setReplyText] = useState("")
  const [isReplying, setIsReplying] = useState(false)

  handleViewRequest = async (request: SupportRequest) => {
    const freshData = await api.support.getOne(request.id)
    setSelectedRequest(freshData)
  }

  const [searchParams] = useSearchParams()
  const location = useLocation()

  // When the admin clicks a support-ticket notification in the header bell it
  // navigates to /support?id=<ticketId>. Open that ticket automatically here.
  useEffect(() => {
    const rawId = searchParams.get("id")
    if (!rawId) return
    const ticketId = Number(rawId)
    if (!Number.isInteger(ticketId) || ticketId <= 0) return
    let cancelled = false
    ;(async () => {
      try {
        const fresh = await api.support.getOne(ticketId)
        if (!cancelled) setSelectedRequest(fresh)
      } catch {
        if (!cancelled) toast.error("Could not load the requested support ticket")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [searchParams, location.key])

  const { data, isLoading } = useQuery({
    queryKey: ["support", page, search, statusFilter],
    queryFn: () => api.support.getAll({ page, limit: 20, search, status: statusFilter === "all" ? undefined : statusFilter }),
  })

  const { data: stats } = useQuery({
    queryKey: ["support-stats"],
    queryFn: () => api.support.getStats(),
    refetchInterval: 30000,
  })

  const supportTypeData = stats?.support_types || {
    order_issue: 0,
    delivery_issue: 0,
    payment_issue: 0,
    return_refund: 0,
    other: 0,
  }

  const openSupportTypeData = stats?.open_support_types || {
    order_issue: 0,
    delivery_issue: 0,
    payment_issue: 0,
    return_refund: 0,
    other: 0,
  }

  const totalTickets = stats?.total || 0
  const totalOpenTickets = stats?.open || 0

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: SupportStatus }) => api.support.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support"] })
      queryClient.invalidateQueries({ queryKey: ["support-stats"] })
    },
    onError: () => toast.error("Failed to update status"),
  })

  const replyMutation = useMutation({
    mutationFn: ({ id, admin_reply }: { id: number; admin_reply: string }) => api.support.reply(id, admin_reply),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["support"] })
      queryClient.invalidateQueries({ queryKey: ["support-stats"] })
      setSelectedRequest(data)
      setReplyText("")
      setIsReplying(false)
      toast.success("Reply sent successfully. Ticket has been closed.")
    },
    onError: () => toast.error("Failed to send reply"),
  })

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim() || !selectedRequest) return
    setIsReplying(true)
    await replyMutation.mutateAsync({ id: selectedRequest.id, admin_reply: replyText.trim() })
  }

  handleStatusChange = (request: SupportRequest, newStatus: SupportStatus) => {
    updateStatusMutation.mutate({ id: request.id, status: newStatus })
  }

  const handleCloseModal = () => {
    setSelectedRequest(null)
    setReplyText("")
  }

  const modalContent = selectedRequest ? (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-semibold text-foreground">Customer Information</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{selectedRequest.name}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>{selectedRequest.email}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{selectedRequest.mobile}</span>
            </div>
            {selectedRequest.user_id && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Registered User (ID: {selectedRequest.user_id})</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-semibold text-foreground">Request Information</h4>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-muted-foreground">Support ID</p>
              <p className="font-mono font-medium text-primary">{selectedRequest.support_id}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Type</p>
              <p><Badge variant="outline" className="capitalize">{getSupportTypeLabel(selectedRequest.support_type)}</Badge></p>
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
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-foreground">Customer Message</h4>
        <div className="p-4 bg-muted/50 rounded-lg border">
          <p className="whitespace-pre-wrap text-sm">{selectedRequest.description}</p>
        </div>
      </div>

      {selectedRequest.admin_reply && (
        <div className="space-y-2 bg-primary/5 border border-primary/20 rounded-lg p-4">
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <Send className="h-4 w-4" />
            Admin Reply
          </h4>
          <p className="whitespace-pre-wrap text-sm">{selectedRequest.admin_reply}</p>
          <p className="text-xs text-muted-foreground">Replied on {formatDate(selectedRequest.updated_at)}</p>
        </div>
      )}

      {selectedRequest.status === "open" && (
        <div className="space-y-2 pt-4 border-t">
          <h4 className="font-semibold text-foreground">Send Reply</h4>
          <form onSubmit={handleReply}>
            <Textarea
              placeholder="Type your reply to the customer..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={4}
              className="mb-3"
              required
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleCloseModal}>Cancel</Button>
              <Button type="submit" disabled={isReplying || !replyText.trim()}>
                {isReplying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isReplying ? "Sending..." : "Send Reply"}
              </Button>
            </div>
          </form>

          <div className="flex items-center gap-3 pt-4 border-t">
              <span className="text-sm text-muted-foreground">Change Status:</span>
              <Select
                value={selectedRequest.status}
                onChange={(v) => handleStatusChange(selectedRequest, v as SupportStatus)}
                options={SUPPORT_STATUSES.map(s => ({ value: s.value, label: s.label }))}
                className="w-full sm:w-[180px]"
              />
            </div>
        </div>
      )}

      {selectedRequest.status === "closed" && (
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm">This ticket is closed. No further replies can be sent.</span>
          </div>
        </div>
      )}
    </div>
  ) : null

  return (
    <PageLayout
      title="Customer Support"
      description="Manage customer support requests and inquiries"
      actions={
        stats && (
          <Badge variant="secondary" className="gap-1">
            <AlertCircle className="h-3 w-3 text-destructive" />
            {stats.open} open of {stats.total} total
          </Badge>
        )
      }
    >
      <Section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-center p-6">
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Support Request Types
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-6 px-6">
            {totalTickets === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No support requests yet</p>
              </div>
            ) : (
              <SupportTypePieChart data={supportTypeData} openData={openSupportTypeData} totalOpen={totalOpenTickets} total={totalTickets} height={300} />
            )}
          </CardContent>
        </Card>
      </Section>

      <Section>
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
            onChange={(v) => { setStatusFilter(v as SupportStatus | "all"); setPage(1); }}
            options={[
              { value: "all", label: "All Statuses" },
              ...SUPPORT_STATUSES.map(s => ({ value: s.value, label: s.label }))
            ]}
            placeholder="All Statuses"
            className="w-full sm:w-[180px]"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : data?.data.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No support requests found</p>
            <p className="text-sm">Customer inquiries will appear here</p>
          </div>
        ) : (
          <>
            <Table
              columns={supportColumns}
              data={data?.data || []}
              keyExtractor={(row) => row.id}
              rowClassName={(row) => row.status === "open" ? "bg-destructive/5 font-medium" : ""}
            />

            {data && data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {data.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={page === data.pagination.totalPages}
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
        onClose={handleCloseModal}
        title={`Support Request: ${selectedRequest?.support_id}`}
        size="xl"
      >
        {modalContent}
      </Modal>
    </PageLayout>
  )
}