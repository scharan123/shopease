import { jsPDF } from "jspdf"
import { api } from "./api"
import type { SupportRequest, SupportType } from "./types"

export const PDF_FILE_NAME = "ShopEase_All_Support_Tickets.pdf"
export const CSV_FILE_NAME = "ShopEase_All_Support_Tickets.csv"

const SUPPORT_TYPE_LABELS: Record<SupportType, string> = {
  order_issue: "Order Issue",
  delivery_issue: "Delivery Issue",
  payment_issue: "Payment Issue",
  return_refund: "Return & Refund",
  other: "Other",
}

const getSupportTypeLabel = (type: SupportType) => SUPPORT_TYPE_LABELS[type] || type

function formatDateOnly(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatTimeOnly(dateString: string) {
  return new Date(dateString).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export async function fetchAllSupportTickets(): Promise<SupportRequest[]> {
  const pageSize = 100
  const all: SupportRequest[] = []
  let page = 1

  while (true) {
    const res = await api.support.getMy({ page, limit: pageSize })
    if (res?.data?.length) {
      all.push(...res.data)
    }
    const total = res?.pagination?.total ?? all.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    if (!res?.data?.length || page >= totalPages || all.length >= total) {
      break
    }
    page += 1
  }

  return all
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function buildSupportTicketsCSV(tickets: SupportRequest[]): string {
  const header = [
    "Ticket ID",
    "Customer Name",
    "Customer Email",
    "Support Type",
    "Subject",
    "Description",
    "Status",
    "Created Date",
    "Created Time",
    "Messages",
  ]

  const rows = tickets.map((ticket) => [
    ticket.support_id,
    ticket.name,
    ticket.email,
    getSupportTypeLabel(ticket.support_type),
    "",
    ticket.description,
    ticket.status === "open" ? "Open" : "Closed",
    formatDateOnly(ticket.created_at),
    formatTimeOnly(ticket.created_at),
    ticket.admin_reply || "",
  ])

  const escaped = [header, ...rows].map((row) => row.map(escapeCSV).join(","))
  return `\uFEFF${escaped.join("\r\n")}`
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadSupportTicketsCSV(tickets: SupportRequest[]) {
  const csv = buildSupportTicketsCSV(tickets)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  triggerBlobDownload(blob, CSV_FILE_NAME)
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN_LEFT = 16
const MARGIN_RIGHT = 16
const MARGIN_TOP = 18
const MARGIN_BOTTOM = 20
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN_BOTTOM

const C = {
  primary: [46, 95, 235] as const,
  slate900: [15, 23, 42] as const,
  slate700: [51, 65, 85] as const,
  slate600: [71, 85, 105] as const,
  slate400: [148, 163, 184] as const,
  slate200: [226, 232, 240] as const,
  slate100: [241, 245, 249] as const,
  white: [255, 255, 255] as const,
  blueBg: [239, 246, 255] as const,
  blueText: [29, 78, 216] as const,
  greenBg: [220, 252, 231] as const,
  greenText: [22, 101, 52] as const,
}

interface PdfCtx {
  doc: jsPDF
  y: number
}

function nextPage(ctx: PdfCtx) {
  ctx.doc.addPage()
  ctx.y = MARGIN_TOP
}

function usePage(ctx: PdfCtx, extraHeight = 0) {
  if (ctx.y + extraHeight > CONTENT_BOTTOM) {
    nextPage(ctx)
  }
}

function setColor(doc: jsPDF, color: readonly number[]) {
  doc.setTextColor(color[0], color[1], color[2])
}

function setFill(doc: jsPDF, color: readonly number[]) {
  doc.setFillColor(color[0], color[1], color[2])
}

function setDraw(doc: jsPDF, color: readonly number[]) {
  doc.setDrawColor(color[0], color[1], color[2])
}

function drawLineSeparator(doc: jsPDF, y: number) {
  setDraw(doc, C.slate200)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y)
  doc.setLineWidth(0.2)
}

interface TicketSummaryRow {
  label: string
  count: number
}

function renderHeader(ctx: PdfCtx, generatedAt: string) {
  const { doc } = ctx
  doc.setPage(1)

  setFill(doc, C.primary)
  doc.roundedRect(MARGIN_LEFT, MARGIN_TOP, CONTENT_WIDTH, 30, 4, 4, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  setColor(doc, C.white)
  doc.text("ShopEase", MARGIN_LEFT + 8, MARGIN_TOP + 12)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(12)
  setColor(doc, C.white)
  doc.text("Customer Support Tickets", MARGIN_LEFT + 8, MARGIN_TOP + 21)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  setColor(doc, C.white)
  doc.text(`Generated on ${generatedAt}`, PAGE_WIDTH - MARGIN_RIGHT - 8, MARGIN_TOP + 12, { align: "right" })

  ctx.y = MARGIN_TOP + 42
}

function renderSummary(ctx: PdfCtx, tickets: SupportRequest[]) {
  const { doc } = ctx

  const total = tickets.length
  const open = tickets.filter((t) => t.status === "open").length
  const closed = tickets.filter((t) => t.status === "closed").length

  const typeCounts: TicketSummaryRow[] = (
    ["order_issue", "delivery_issue", "payment_issue", "return_refund", "other"] as SupportType[]
  ).map((type) => ({
    label: SUPPORT_TYPE_LABELS[type],
    count: tickets.filter((t) => t.support_type === type).length,
  }))

  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  setColor(doc, C.slate900)
  doc.text("Summary", MARGIN_LEFT, ctx.y)
  ctx.y += 3

  const statGap = 4
  const statWidth = (CONTENT_WIDTH - statGap * 2) / 3
  const statHeight = 20

  const stats: { label: string; value: number; color: readonly number[]; bg: readonly number[] }[] = [
    { label: "Total Tickets", value: total, color: C.slate900, bg: C.slate100 },
    { label: "Open Tickets", value: open, color: C.blueText, bg: C.blueBg },
    { label: "Closed Tickets", value: closed, color: C.greenText, bg: C.greenBg },
  ]

  ctx.y += 2
  usePage(ctx, statHeight + 4)
  stats.forEach((stat, i) => {
    const x = MARGIN_LEFT + i * (statWidth + statGap)
    setFill(doc, stat.bg)
    doc.roundedRect(x, ctx.y, statWidth, statHeight, 3, 3, "F")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(17)
    setColor(doc, stat.color)
    doc.text(String(stat.value), x + statWidth / 2, ctx.y + 10, { align: "center" })

    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    setColor(doc, C.slate600)
    doc.text(stat.label, x + statWidth / 2, ctx.y + statHeight - 4, { align: "center" })
  })
  ctx.y += statHeight + 8

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  setColor(doc, C.slate900)
  doc.text("Support Type Summary", MARGIN_LEFT, ctx.y)
  ctx.y += 5

  usePage(ctx, typeCounts.length * 6 + 6)
  typeCounts.forEach((row) => {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9.5)
    setColor(doc, C.slate700)
    doc.text(row.label, MARGIN_LEFT + 4, ctx.y)
    doc.setFont("helvetica", "bold")
    setColor(doc, C.slate900)
    doc.text(String(row.count), PAGE_WIDTH - MARGIN_RIGHT - 4, ctx.y, { align: "right" })
    ctx.y += 2
    drawLineSeparator(doc, ctx.y)
    ctx.y += 4.4
  })

  ctx.y += 4
}

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

interface TableColumn {
  header: string
  key: string
  width: number
  align?: "left" | "center" | "right"
}

const TABLE_COLUMNS: TableColumn[] = [
  { header: "Ticket ID", key: "support_id", width: 38, align: "left" },
  { header: "Support Type", key: "support_type", width: 34, align: "left" },
  { header: "Description", key: "description", width: 70, align: "left" },
  { header: "Date", key: "date", width: 30, align: "left" },
  { header: "Status", key: "status", width: 20, align: "center" },
]

const ROW_HEIGHT = 7
const HEADER_HEIGHT = 8
const TABLE_TOP_MARGIN = 6

function renderTableHeader(doc: jsPDF, y: number) {
  let x = MARGIN_LEFT

  setFill(doc, C.primary)
  doc.roundedRect(MARGIN_LEFT, y, CONTENT_WIDTH, HEADER_HEIGHT, 0, 0, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  setColor(doc, C.white)

  TABLE_COLUMNS.forEach((col) => {
    const align = col.align ?? "left"
    if (align === "center") {
      doc.text(col.header, x + col.width / 2, y + 5.5, { align: "center" })
    } else if (align === "right") {
      doc.text(col.header, x + col.width - 2, y + 5.5, { align: "right" })
    } else {
      doc.text(col.header, x + 2, y + 5.5)
    }
    x += col.width
  })

  return y + HEADER_HEIGHT
}

function renderTicketRow(
  doc: jsPDF,
  ticket: SupportRequest,
  y: number,
  rowIndex: number,
): number {
  const descLines = doc.splitTextToSize(ticket.description || "-", TABLE_COLUMNS[2].width - 4) as string[]
  const maxLines = 2
  const wrappedDesc = descLines.slice(0, maxLines)
  if (descLines.length > maxLines) {
    wrappedDesc[maxLines - 1] = wrappedDesc[maxLines - 1].slice(0, -3) + "..."
  }
  const cellHeight = Math.max(ROW_HEIGHT, wrappedDesc.length * 4 + 3)

  const bgColor = rowIndex % 2 === 0 ? C.white : C.slate100
  setFill(doc, bgColor)
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, cellHeight, "F")

  setDraw(doc, C.slate200)
  doc.setLineWidth(0.15)
  doc.line(MARGIN_LEFT, y + cellHeight, MARGIN_LEFT + CONTENT_WIDTH, y + cellHeight)

  let x = MARGIN_LEFT

  // Ticket ID
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7.5)
  setColor(doc, C.primary)
  const idText = ticket.support_id.length > 20 ? ticket.support_id.slice(0, 18) + "..." : ticket.support_id
  doc.text(idText, x + 2, y + 5)
  x += TABLE_COLUMNS[0].width

  // Support Type
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  setColor(doc, C.slate700)
  const typeLabel = getSupportTypeLabel(ticket.support_type)
  doc.text(typeLabel, x + 2, y + 5)
  x += TABLE_COLUMNS[1].width

  // Description
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  setColor(doc, C.slate700)
  wrappedDesc.forEach((line, i) => {
    doc.text(line, x + 2, y + 4 + i * 4)
  })
  x += TABLE_COLUMNS[2].width

  // Date
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  setColor(doc, C.slate600)
  doc.text(formatDateOnly(ticket.created_at), x + 2, y + 5)
  x += TABLE_COLUMNS[3].width

  // Status
  const isOpen = ticket.status === "open"
  const statusLabel = isOpen ? "Open" : "Closed"
  const bg = isOpen ? C.blueBg : C.greenBg
  const fg = isOpen ? C.blueText : C.greenText

  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  const textW = doc.getTextWidth(statusLabel)
  const padX = 2
  const badgeW = textW + padX * 2
  const badgeH = 4.5
  const badgeX = x + (TABLE_COLUMNS[4].width - badgeW) / 2

  setFill(doc, bg)
  doc.roundedRect(badgeX, y + (cellHeight - badgeH) / 2, badgeW, badgeH, 1.5, 1.5, "F")
  setColor(doc, fg)
  doc.text(statusLabel, badgeX + badgeW / 2, y + (cellHeight + 2) / 2, { align: "center" })
  setFill(doc, C.white)

  return cellHeight
}

export function downloadSupportTicketsPDF(tickets: SupportRequest[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const ctx: PdfCtx = { doc, y: MARGIN_TOP }

  const generatedAt = new Date().toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  renderHeader(ctx, generatedAt)
  renderSummary(ctx, tickets)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  setColor(doc, C.slate900)
  usePage(ctx, 10)
  doc.text("All Support Tickets", MARGIN_LEFT, ctx.y)
  ctx.y += 2

  if (tickets.length === 0) {
    usePage(ctx, 12)
    doc.setFont("helvetica", "italic")
    doc.setFontSize(10)
    setColor(doc, C.slate600)
    doc.text("No support tickets found.", MARGIN_LEFT, ctx.y)
    ctx.y += 12
  } else {
    ctx.y += TABLE_TOP_MARGIN

    // Draw table header on first page
    let currentY = renderTableHeader(doc, ctx.y)
    ctx.y = currentY

    tickets.forEach((ticket, index) => {
      const descLines = doc.splitTextToSize(ticket.description || "-", TABLE_COLUMNS[2].width - 4) as string[]
      const maxLines = 2
      const wrappedDesc = descLines.slice(0, maxLines)
      if (descLines.length > maxLines) {
        wrappedDesc[maxLines - 1] = wrappedDesc[maxLines - 1].slice(0, -3) + "..."
      }
      const cellHeight = Math.max(ROW_HEIGHT, wrappedDesc.length * 4 + 3)

      // Check if we need a new page
      if (ctx.y + cellHeight >= CONTENT_BOTTOM) {
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        setColor(doc, C.slate400)
        doc.text(`Continued on next page...`, MARGIN_LEFT, PAGE_HEIGHT - 10)

        const totalPages = doc.getNumberOfPages()
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i)
          doc.setFont("helvetica", "normal")
          doc.setFontSize(8)
          setColor(doc, C.slate400)
          doc.text("ShopEase - Customer Support Export", MARGIN_LEFT, PAGE_HEIGHT - 8)
          doc.text(`Page ${i} of ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 8, { align: "right" })
        }

        nextPage(ctx)

        // Add border at top of new page
        setDraw(doc, C.slate200)
        doc.setLineWidth(0.3)
        doc.line(MARGIN_LEFT, ctx.y, PAGE_WIDTH - MARGIN_RIGHT, ctx.y)

        ctx.y += 2

        // Repeat table header on new page
        currentY = renderTableHeader(doc, ctx.y)
        ctx.y = currentY
      }

      const rowHeight = renderTicketRow(doc, ticket, ctx.y, index)
      ctx.y += rowHeight
    })
  }

  // Add page numbers to all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    setColor(doc, C.slate400)
    doc.text("ShopEase - Customer Support Export", MARGIN_LEFT, PAGE_HEIGHT - 8)
    doc.text(`Page ${i} of ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 8, { align: "right" })
  }

  const blob = doc.output("blob")
  triggerBlobDownload(blob, PDF_FILE_NAME)
}