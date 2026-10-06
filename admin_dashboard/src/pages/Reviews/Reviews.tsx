import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Table } from "@/components/ui/Table"
import { ConfirmModal } from "@/components/ui/Modal"
import { Badge } from "@/components/ui/Badge"
import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton"
import { api } from "@/lib/api"
import type { Review } from "@/lib/types"
import { Search, Star, Trash2, MessageSquare, Package } from "lucide-react"

const RATING_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All Ratings" },
  { value: "5", label: "5 Stars" },
  { value: "4", label: "4 Stars" },
  { value: "3", label: "3 Stars" },
  { value: "2", label: "2 Stars" },
  { value: "1", label: "1 Star" },
]

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i <= Math.round(value) ? "text-amber-400 fill-amber-400" : "text-muted-foreground"
          )}
        />
      ))}
      <span className="ml-1 text-sm font-medium">{Number(value).toFixed(1)}</span>
    </span>
  )
}

export function Reviews() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [ratingFilter, setRatingFilter] = useState("all")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["admin", "reviews", searchQuery, ratingFilter],
    queryFn: () =>
      api.reviews.getAll({
        search: searchQuery || undefined,
        rating: ratingFilter !== "all" ? Number(ratingFilter) : undefined,
        sortBy: "created_at",
        sortOrder: "desc",
        limit: 100,
      }),
    select: (data) => data.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.reviews.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] })
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] })
      setDeleteOpen(false)
      setDeletingId(null)
    },
  })

  const handleDelete = (id: number) => {
    setDeletingId(id)
    setDeleteOpen(true)
  }

  const columns = [
    {
      key: "product",
      header: "Product",
      render: (row: Review) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
            {row.product_image ? (
              <img src={row.product_image} alt={row.product_name} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">#{row.product_id} {row.product_name}</p>
            <p className="text-xs text-muted-foreground">{row.is_verified ? "Verified purchase" : "Site review"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (row: Review) => (
        <div className="min-w-0">
          <p className="font-medium text-sm">{row.name || row.user_name || "Guest"}</p>
          <p className="text-xs text-muted-foreground truncate">{row.email || row.user_email || ""}</p>
        </div>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      render: (row: Review) => <Stars value={row.rating} />,
    },
    {
      key: "comment",
      header: "Feedback",
      render: (row: Review) => (
        <p className="text-sm text-muted-foreground max-w-md line-clamp-2 whitespace-pre-line">
          {row.comment || "—"}
        </p>
      ),
    },
    {
      key: "created_at",
      header: "Date",
      render: (row: Review) => <span className="text-sm text-muted-foreground">{formatDate(row.created_at)}</span>,
    },
    {
      key: "actions",
      header: "",
      render: (row: Review) => (
        <button
          onClick={() => handleDelete(row.id)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
          aria-label={`Delete review from ${row.name || "customer"}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Reviews & Ratings</h1>
          <p className="text-muted-foreground">Customer feedback submitted on the storefront, tied to real products</p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          {reviews.length} review{reviews.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <Card>
        <CardContent className="p-6 pt-0">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input
              placeholder="Search product, customer or feedback..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 max-w-md"
            />
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              aria-label="Filter by rating"
              className="h-9 px-3 rounded-lg border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {RATING_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <SkeletonTable rows={5} />
          ) : (
            <Table
              columns={columns}
              data={reviews}
              keyExtractor={(row) => row.id}
              isLoading={false}
              emptyMessage="No reviews found. Reviews appear here as soon as customers submit them on the storefront."
            />
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeletingId(null); }}
        onConfirm={() => { if (deletingId) deleteMutation.mutate(deletingId) }}
        title="Delete Review"
        description="Are you sure you want to delete this review? The product's average rating will be recalculated automatically."
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

export default Reviews