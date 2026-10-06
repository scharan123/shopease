import { jsPDF } from "jspdf"
import type { Order, OrderItem, OrderStatus, PaymentMethod } from "./types"

export const INVOICE_FILE_NAME_PREFIX = "ShopEase_Invoice_"

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN_LEFT = 16
const MARGIN_RIGHT = 16
const MARGIN_TOP = 18
const MARGIN_BOTTOM = 20
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN_BOTTOM

const C = {
  primary: [25, 118, 210] as const,
  dark: [15, 23, 42] as const,
  slate700: [51, 65, 85] as const,
  slate600: [71, 85, 105] as const,
  slate500: [100, 116, 139] as const,
  slate400: [148, 163, 184] as const,
  slate300: [203, 213, 225] as const,
  slate200: [226, 232, 240] as const,
  slate100: [241, 245, 249] as const,
  white: [255, 255, 255] as const,
  green: [22, 163, 74] as const,
  red: [220, 38, 38] as const,
  orange: [249, 115, 22] as const,
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

function drawLine(doc: jsPDF, x1: number, y: number, x2: number) {
  setDraw(doc, C.slate200)
  doc.setLineWidth(0.3)
  doc.line(x1, y, x2, y)
  doc.setLineWidth(0.2)
}

function drawDashedLine(doc: jsPDF, x1: number, y: number, x2: number) {
  setDraw(doc, C.slate300 || C.slate400)
  doc.setLineWidth(0.2)
  doc.setLineDashPattern([2, 2], 0)
  doc.line(x1, y, x2, y)
  doc.setLineDashPattern([], 0)
  doc.setLineWidth(0.2)
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on Delivery",
  card: "Credit/Debit Card",
  upi: "UPI",
  wallet: "Wallet",
  bank_transfer: "Bank Transfer",
}

function getStatusColor(status: OrderStatus): readonly number[] {
  switch (status) {
    case "pending":
      return C.orange
    case "processing":
      return C.primary
    case "shipped":
      return [139, 92, 246]
    case "delivered":
      return C.green
    case "cancelled":
      return C.red
    default:
      return C.slate600
  }
}

function renderHeader(ctx: PdfCtx, order: Order) {
  const { doc } = ctx

  setFill(doc, C.primary)
  doc.roundedRect(MARGIN_LEFT, MARGIN_TOP, CONTENT_WIDTH, 28, 4, 4, "F")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  setColor(doc, C.white)
  doc.text("ShopEase", MARGIN_LEFT + 10, MARGIN_TOP + 12)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  setColor(doc, C.white)
  doc.text("Premium Online Shopping", MARGIN_LEFT + 10, MARGIN_TOP + 19)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  setColor(doc, C.white)
  doc.text("INVOICE", PAGE_WIDTH - MARGIN_RIGHT - 10, MARGIN_TOP + 12, { align: "right" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  setColor(doc, C.white)
  doc.text(`Order ID: ${order.id}`, PAGE_WIDTH - MARGIN_RIGHT - 10, MARGIN_TOP + 19, { align: "right" })

  ctx.y = MARGIN_TOP + 36
}

function renderOrderInfo(ctx: PdfCtx, order: Order) {
  const { doc } = ctx

  usePage(ctx, 50)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  setColor(doc, C.dark)
  doc.text("Order Information", MARGIN_LEFT, ctx.y)
  ctx.y += 5

  const info = [
    { label: "Order ID", value: `#${order.id}` },
    { label: "Order Date", value: formatDateTime(order.created_at) },
    { label: "Payment Method", value: PAYMENT_METHOD_LABELS[order.payment_method] || order.payment_method },
    { label: "Order Status", value: STATUS_LABELS[order.status] || order.status },
  ]

  const labelWidth = 45
  const startX = MARGIN_LEFT

  info.forEach((item, index) => {
    usePage(ctx, 7)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.5)
    setColor(doc, C.slate600)
    doc.text(item.label, startX, ctx.y)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    setColor(doc, C.dark)
    doc.text(item.value, startX + labelWidth, ctx.y)

    if (item.label === "Order Status") {
      const statusColor = getStatusColor(order.status)
      const textWidth = doc.getTextWidth(item.value)
      const badgeX = startX + labelWidth - 2
      const badgeY = ctx.y - 3.5
      const badgeW = textWidth + 7
      const badgeH = 5

      setFill(doc, [statusColor[0], statusColor[1], statusColor[2], 0.15])
      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, "F")
      setColor(doc, statusColor)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(7.5)
      doc.text(item.value, badgeX + badgeW / 2, badgeY + 3, { align: "center" })
      setColor(doc, C.dark)
    }

    ctx.y += 6
  })

  ctx.y += 3
  drawLine(doc, MARGIN_LEFT, ctx.y, PAGE_WIDTH - MARGIN_RIGHT)
  ctx.y += 5
}

function renderCustomerInfo(ctx: PdfCtx, order: Order) {
  const { doc } = ctx

  usePage(ctx, 60)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  setColor(doc, C.dark)
  doc.text("Customer / Shipping Address", MARGIN_LEFT, ctx.y)
  ctx.y += 5

  const customerName = order.user?.name || "Guest Customer"
  const customerEmail = order.user?.email || "N/A"

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  setColor(doc, C.slate600)
  doc.text("Customer Name:", MARGIN_LEFT, ctx.y)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  setColor(doc, C.dark)
  doc.text(customerName, MARGIN_LEFT + 42, ctx.y)
  ctx.y += 5

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8.5)
  setColor(doc, C.slate600)
  doc.text("Email:", MARGIN_LEFT, ctx.y)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  setColor(doc, C.dark)
  doc.text(customerEmail, MARGIN_LEFT + 42, ctx.y)
  ctx.y += 5

  const addressLines = order.shipping_address.split("\n").filter(Boolean)
  if (addressLines.length > 0) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    setColor(doc, C.slate600)
    doc.text("Shipping Address:", MARGIN_LEFT, ctx.y)
    ctx.y += 4

    addressLines.forEach((line) => {
      usePage(ctx, 5)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8.5)
      setColor(doc, C.dark)
      doc.text(line, MARGIN_LEFT + 4, ctx.y)
      ctx.y += 4.5
    })
  }

  ctx.y += 3
  drawLine(doc, MARGIN_LEFT, ctx.y, PAGE_WIDTH - MARGIN_RIGHT)
  ctx.y += 5
}

function renderOrderItems(ctx: PdfCtx, order: Order) {
  const { doc } = ctx
  const items = order.items || []

  usePage(ctx, 45)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  setColor(doc, C.dark)
  doc.text("Order Items", MARGIN_LEFT, ctx.y)
  ctx.y += 6

  const colWidths = {
    num: CONTENT_WIDTH * 0.08,
    product: CONTENT_WIDTH * 0.42,
    qty: CONTENT_WIDTH * 0.12,
    price: CONTENT_WIDTH * 0.19,
    total: CONTENT_WIDTH * 0.19,
  }

  const colX = {
    num: MARGIN_LEFT,
    product: MARGIN_LEFT + colWidths.num,
    qty: MARGIN_LEFT + colWidths.num + colWidths.product,
    price: MARGIN_LEFT + colWidths.num + colWidths.product + colWidths.qty,
    total: MARGIN_LEFT + colWidths.num + colWidths.product + colWidths.qty + colWidths.price,
  }

  const colTextX = {
    num: colX.num + colWidths.num / 2,
    product: colX.product + 2,
    qty: colX.qty + colWidths.qty / 2,
    price: colX.price + colWidths.price - 2,
    total: colX.total + colWidths.total - 2,
  }

  const headerHeight = 9
  const cellVPadding = 3.5
  const lineHeight = 4

  function drawTableHeader() {
    setFill(doc, C.primary)
    doc.roundedRect(MARGIN_LEFT, ctx.y, CONTENT_WIDTH, headerHeight, 2, 2, "F")

    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    setColor(doc, C.white)
    const headerVCenter = ctx.y + headerHeight / 2 + 0.5
    doc.text("#", colTextX.num, headerVCenter, { align: "center" })
    doc.text("Product", colTextX.product, headerVCenter)
    doc.text("Qty", colTextX.qty, headerVCenter, { align: "center" })
    doc.text("Price", colTextX.price, headerVCenter, { align: "right" })
    doc.text("Total", colTextX.total, headerVCenter, { align: "right" })

    ctx.y += headerHeight
  }

  function drawVerticalLines(y: number, height: number) {
    setDraw(doc, C.slate200)
    doc.setLineWidth(0.15)
    const gridX = [
      colX.product,
      colX.qty,
      colX.price,
      colX.total,
    ]
    gridX.forEach(x => {
      doc.line(x, y, x, y + height)
    })
  }

  drawTableHeader()
  drawVerticalLines(ctx.y - headerHeight, headerHeight)

  items.forEach((item, index) => {
    const productName = item.product?.name || "Unknown Product"
    const quantity = item.quantity
    const unitPrice = item.price
    const itemTotal = unitPrice * quantity

    const maxProductWidth = colWidths.product - 4
    const nameLines = doc.splitTextToSize(productName, maxProductWidth) as string[]
    const rowHeight = Math.max(11, nameLines.length * lineHeight + cellVPadding * 2)

    usePage(ctx, rowHeight + 3)

    if (ctx.y + rowHeight > CONTENT_BOTTOM) {
      nextPage(ctx)
      drawTableHeader()
      drawVerticalLines(ctx.y - headerHeight, headerHeight)
    }

    const bgColor = index % 2 === 0 ? C.white : C.slate100
    setFill(doc, bgColor)
    doc.rect(MARGIN_LEFT, ctx.y, CONTENT_WIDTH, rowHeight, "F")

    setDraw(doc, C.slate200)
    doc.setLineWidth(0.15)
    doc.line(MARGIN_LEFT, ctx.y + rowHeight, PAGE_WIDTH - MARGIN_RIGHT, ctx.y + rowHeight)
    drawVerticalLines(ctx.y, rowHeight)

    const rowVCenter = ctx.y + rowHeight / 2 + 0.5

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    setColor(doc, C.dark)

    nameLines.forEach((line, i) => {
      const lineY = ctx.y + cellVPadding + i * lineHeight
      doc.text(line, colTextX.product, lineY)
    })

    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    setColor(doc, C.dark)
    doc.text(String(index + 1), colTextX.num, rowVCenter, { align: "center" })

    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    setColor(doc, C.dark)
    doc.text(String(quantity), colTextX.qty, rowVCenter, { align: "center" })

    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    setColor(doc, C.dark)
    doc.text(formatCurrency(unitPrice), colTextX.price, rowVCenter, { align: "right" })

    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    setColor(doc, C.dark)
    doc.text(formatCurrency(itemTotal), colTextX.total, rowVCenter, { align: "right" })

    ctx.y += rowHeight
  })

  setDraw(doc, C.slate200)
  doc.setLineWidth(0.3)
  doc.line(MARGIN_LEFT, ctx.y, PAGE_WIDTH - MARGIN_RIGHT, ctx.y)
  ctx.y += 5
}

function renderPriceSummary(ctx: PdfCtx, order: Order) {
  const { doc } = ctx
  const items = order.items || []

  const subtotal = order.subtotal ?? items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const couponDiscount = order.coupon_discount ?? 0
  const quantityDiscount = order.quantity_discount ?? 0
  const offerDiscount = order.offer_discount ?? 0
  const shipping = order.shipping_charge ?? 0
  const tax = order.tax ?? 0
  const total = order.total_amount

  usePage(ctx, 80)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  setColor(doc, C.dark)
  doc.text("Price Summary", MARGIN_LEFT, ctx.y)
  ctx.y += 6

  const colWidths = {
    num: CONTENT_WIDTH * 0.08,
    product: CONTENT_WIDTH * 0.42,
    qty: CONTENT_WIDTH * 0.12,
    price: CONTENT_WIDTH * 0.19,
    total: CONTENT_WIDTH * 0.19,
  }

  const colX = {
    num: MARGIN_LEFT,
    product: MARGIN_LEFT + colWidths.num,
    qty: MARGIN_LEFT + colWidths.num + colWidths.product,
    price: MARGIN_LEFT + colWidths.num + colWidths.product + colWidths.qty,
    total: MARGIN_LEFT + colWidths.num + colWidths.product + colWidths.qty + colWidths.price,
  }

  const colTextX = {
    num: colX.num + colWidths.num / 2,
    product: colX.product + 2,
    qty: colX.qty + colWidths.qty / 2,
    price: colX.price + colWidths.price - 2,
    total: colX.total + colWidths.total - 2,
  }

  const summaryLabelX = colTextX.price
  const summaryValueX = colTextX.total

  const rows = [
    { label: "Subtotal", value: formatCurrency(subtotal), color: C.dark, bold: false },
    { label: "Coupon Discount", value: `-${formatCurrency(couponDiscount)}`, color: C.green, bold: false, show: couponDiscount > 0 },
    { label: "Quantity Discount", value: `-${formatCurrency(quantityDiscount)}`, color: C.green, bold: false, show: quantityDiscount > 0 },
    { label: "Offer Discount", value: `-${formatCurrency(offerDiscount)}`, color: C.orange, bold: false, show: offerDiscount > 0 },
    { label: "Shipping", value: shipping === 0 ? "Free" : formatCurrency(shipping), color: C.dark, bold: false },
    { label: "Tax", value: formatCurrency(tax), color: C.dark, bold: false, show: tax > 0 },
  ]

  rows.forEach((row) => {
    if (!row.show) return
    usePage(ctx, 7)
    doc.setFont("helvetica", row.bold ? "bold" : "normal")
    doc.setFontSize(9.5)
    setColor(doc, row.color)
    doc.text(row.label, summaryLabelX, ctx.y, { align: "right" })
    doc.text(row.value, summaryValueX, ctx.y, { align: "right" })
    ctx.y += 6
  })

  ctx.y += 2

  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  setColor(doc, C.primary)
  doc.text("TOTAL", summaryLabelX, ctx.y, { align: "right" })
  doc.text(formatCurrency(total), summaryValueX, ctx.y, { align: "right" })
  ctx.y += 8
}

function renderFooter(ctx: PdfCtx) {
  const { doc } = ctx

  usePage(ctx, 15)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  setColor(doc, C.slate500)
  doc.text("Thank you for shopping with ShopEase!", MARGIN_LEFT, ctx.y, { align: "center" })
  ctx.y += 4
  doc.text("For any queries, contact support@shopease.com", MARGIN_LEFT, ctx.y, { align: "center" })
}

function addPageNumbers(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    setColor(doc, C.slate400)
    doc.text("ShopEase - Invoice", MARGIN_LEFT, PAGE_HEIGHT - 8)
    doc.text(`Page ${i} of ${totalPages}`, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 8, { align: "right" })
  }
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

export function downloadInvoicePDF(order: Order) {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const ctx: PdfCtx = { doc, y: MARGIN_TOP }

  renderHeader(ctx, order)
  renderOrderInfo(ctx, order)
  renderCustomerInfo(ctx, order)
  renderOrderItems(ctx, order)
  renderPriceSummary(ctx, order)
  renderFooter(ctx)
  addPageNumbers(doc)

  const filename = `${INVOICE_FILE_NAME_PREFIX}${order.id}.pdf`
  const blob = doc.output("blob")
  triggerBlobDownload(blob, filename)
}