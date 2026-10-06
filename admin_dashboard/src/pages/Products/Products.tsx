import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "lib/utils"
import { formatCurrency, formatRelativeTime } from "lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "ui/Card"
import { Button } from "ui/Button"
import { Input, Select, Textarea } from "ui/Input"
import { Table } from "ui/Table"
import { Modal, ConfirmModal } from "ui/Modal"
import { Badge } from "ui/Badge"
import { Avatar } from "ui/Avatar"
import { Skeleton, SkeletonTable } from "ui/Skeleton"
import { Tabs, TabsList, TabTrigger, TabContent } from "ui/Tabs"
import { Checkbox } from "ui/Checkbox"
import { Switch } from "ui/Checkbox"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "lib/api"
import type { Product, CreateProductInput, UpdateProductInput, Category } from "lib/types"
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Image,
  Tag,
  Package,
  Star,
  Eye,
  Upload,
  X,
  Check,
} from "lucide-react"
import { useDropzone } from "react-dropzone"

function ImageUpload({ images, onImagesChange, maxImages = 5 }: {
  images: string[]
  onImagesChange: (images: string[]) => void
  maxImages?: number
}) {
  const [previews, setPreviews] = useState<string[]>([])

  const onDrop = (acceptedFiles: File[]) => {
    const newPreviews = acceptedFiles.map((file) => URL.createObjectURL(file))
    setPreviews((prev) => [...prev, ...newPreviews].slice(0, maxImages))
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: maxImages - images.length,
    multiple: true,
  })

  const removeImage = (index: number) => {
    const newPreviews = previews.filter((_, i) => i !== index)
    setPreviews(newPreviews)
  }

  const removeExistingImage = (url: string) => {
    onImagesChange(images.filter((img) => img !== url))
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center transition-colors",
          "hover:border-primary/50",
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          {isDragActive ? "Drop images here..." : "Drag & drop images, or click to select"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Max {maxImages} images · JPG, PNG, WebP · Max 5MB each
        </p>
      </div>

      {(images.length > 0 || previews.length > 0) && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((url, index) => (
            <div key={`existing-${index}`} className="relative h-20 w-20 rounded-lg overflow-hidden flex-shrink-0">
              <img src={url} alt={`Product ${index + 1}`} className="h-full w-full object-cover" />
              <button
                onClick={() => removeExistingImage(url)}
                className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {previews.map((preview, index) => (
            <div key={`preview-${index}`} className="relative h-20 w-20 rounded-lg overflow-hidden flex-shrink-0">
              <img src={preview} alt={`Preview ${index + 1}`} className="h-full w-full object-cover" />
              <button
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function Products() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [stockFilter, setStockFilter] = useState("all")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("basic")
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<CreateProductInput>({
    name: "",
    description: "",
    price: 0,
    rating: 0,
    discount: 0,
    specification: "",
    highlights: "",
    delivery: "",
    delivery_type: "all-india",
    selected_pin_codes: [],
    sizes: ["S", "M", "L", "XL", "XXL"],
    image_url: "",
    images: [],
    stock: 0,
    category: "",
    category_id: undefined,
    featured: false,
  })

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["admin", "products", searchQuery, categoryFilter, stockFilter],
    queryFn: () => api.products.getAll({
      search: searchQuery,
      category: categoryFilter !== "all" ? categoryFilter : undefined,
      limit: 100,
    }),
    select: (data) => data.data,
  })

  const { data: categoriesData } = useQuery({
    queryKey: ["admin", "categories", "all"],
    queryFn: () => api.categories.getAll({ limit: 100 }),
    select: (data) => data.data,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateProductInput) => api.products.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] })
      setIsCreateOpen(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateProductInput }) => api.products.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] })
      setIsEditOpen(false)
      setEditingProduct(null)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.products.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] })
      setIsDeleteOpen(false)
      setDeletingId(null)
    },
  })

  const filteredProducts = productsData?.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter
    const matchesStock = stockFilter === "all" ||
      (stockFilter === "in_stock" && product.stock > 0) ||
      (stockFilter === "low_stock" && product.stock > 0 && product.stock <= 10) ||
      (stockFilter === "out_of_stock" && product.stock === 0)
    return matchesSearch && matchesCategory && matchesStock
  }) || []

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description || "",
      price: product.price,
      rating: product.rating ?? 0,
      discount: product.discount ?? 0,
      specification: product.specification || "",
      highlights: product.highlights || "",
      delivery: product.delivery || "",
      delivery_type: product.delivery_type || "all-india",
      selected_pin_codes: product.selected_pin_codes || [],
      sizes: product.sizes || ["S", "M", "L", "XL", "XXL"],
      image_url: product.image_url || "",
      images: product.images || [],
      stock: product.stock,
      category: product.category,
      category_id: product.category_id,
      featured: product.featured,
    })
    setIsEditOpen(true)
  }

  const handleDelete = (id: number) => {
    setDeletingId(id)
    setIsDeleteOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: 0,
      rating: 0,
      discount: 0,
      specification: "",
      highlights: "",
      delivery: "",
      delivery_type: "all-india",
      selected_pin_codes: [],
      sizes: ["S", "M", "L", "XL", "XXL"],
      image_url: "",
      images: [],
      stock: 0,
      category: "",
      category_id: undefined,
      featured: false,
    })
    setActiveTab("basic")
  }

  const openCreate = () => {
    setEditingProduct(null)
    resetForm()
    setIsCreateOpen(true)
  }

  const columns = [
    {
      key: "image",
      header: "Product",
      render: (row: Product) => (
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
            {row.image_url ? (
              <img src={row.image_url} alt={row.name} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.category}</p>
          </div>
        </div>
      ),
    },
    {
      key: "price",
      header: "Price",
      render: (row: Product) => <span className="font-medium">{formatCurrency(row.price)}</span>,
    },
    {
      key: "rating",
      header: "Rating",
      render: (row: Product) => {
        const count = Number(row.review_count || 0)
        if (count <= 0) {
          return <span className="text-sm text-muted-foreground italic">No ratings yet</span>
        }
        return (
          <span className="inline-flex items-center gap-1 text-sm">
            <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
            {Number(row.rating ?? 0).toFixed(1)} ({count})
          </span>
        )
      },
    },
    {
      key: "discount",
      header: "Discount",
      render: (row: Product) =>
        row.discount ? <Badge variant="success">{row.discount}% off</Badge> : <span className="text-sm text-muted-foreground">—</span>,
    },
    {
      key: "stock",
      header: "Stock",
      render: (row: Product) => (
        <Badge variant={row.stock > 10 ? "success" : row.stock > 0 ? "warning" : "destructive"}>
          {row.stock} left
        </Badge>
      ),
    },
    {
      key: "featured",
      header: "Featured",
      render: (row: Product) => (
        <Badge variant={row.featured ? "success" : "secondary"} className="capitalize">
          {row.featured ? "Yes" : "No"}
        </Badge>
      ),
    },
    {
      key: "delivery_type",
      header: "Delivery",
      render: (row: Product) =>
        row.delivery_type === "selected" ? (
          <Badge variant="warning" className="capitalize">
            {row.selected_pin_codes?.length || 0} PINs
          </Badge>
        ) : (
          <Badge variant="success" className="capitalize">
            All India
          </Badge>
        ),
    },
    {
      key: "created_at",
      header: "Added",
      render: (row: Product) => <span className="text-sm text-muted-foreground">{formatRelativeTime(row.created_at)}</span>,
    },
    {
      key: "actions",
      header: "",
      render: (row: Product) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleEdit(row)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors"
            aria-label={`Edit ${row.name}`}
          >
            <Edit className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
            aria-label={`Delete ${row.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      <Card>
        <CardContent className="p-6 pt-0">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input
              placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => { const v = e.target.value; setSearchQuery(v); setSearchParams(v ? { q: v } : {}, { replace: true }); }}
              className="flex-1 max-w-md"
            />
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: "all", label: "All Categories" },
                ...(categoriesData?.map((c) => ({ value: c.slug, label: c.name })) || []),
              ]}
              className="w-[200px]"
            />
            <Select
              value={stockFilter}
              onChange={setStockFilter}
              options={[
                { value: "all", label: "All Stock" },
                { value: "in_stock", label: "In Stock" },
                { value: "low_stock", label: "Low Stock (1-10)" },
                { value: "out_of_stock", label: "Out of Stock" },
              ]}
              className="w-[200px]"
            />
          </div>

          <Table
            columns={columns}
            data={filteredProducts}
            keyExtractor={(row) => row.id}
            isLoading={isLoading}
            emptyMessage="No products found"
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={isCreateOpen || isEditOpen}
        onClose={() => { setIsCreateOpen(false); setIsEditOpen(false); resetForm(); setEditingProduct(null); }}
        title={editingProduct ? "Edit Product" : "Create Product"}
        description={editingProduct ? "Update the product details" : "Add a new product to your store"}
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabTrigger value="basic">Basic Info</TabTrigger>
              <TabTrigger value="details">Details</TabTrigger>
              <TabTrigger value="images">Images</TabTrigger>
              <TabTrigger value="seo">SEO & Settings</TabTrigger>
            </TabsList>

            <TabContent value="basic" className="space-y-4 pt-4">
              <Input
                label="Product Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter product name"
                required
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Price (₹)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  placeholder="0.00"
                  required
                />
                <Input
                  label="Stock Quantity"
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                  placeholder="0"
                  required
                />
                <Input
                  label="Rating (0 - 5)"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                  placeholder="4.5"
                />
                <Input
                  label="Discount (%)"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.discount}
                  onChange={(e) => setFormData({ ...formData, discount: Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <Select
                label="Category"
                value={formData.category}
                onChange={(value) => setFormData({ ...formData, category: value })}
                options={categoriesData?.map((c) => ({ value: c.slug, label: c.name })) || []}
                placeholder="Select category"
                required
              />
              <Input
                label="Short Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description for listings"
              />
            </TabContent>

            <TabContent value="details" className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Switch
                  id="featured"
                  checked={formData.featured ?? false}
                  onChange={(checked) => setFormData({ ...formData, featured: checked })}
                  label="Featured Product"
                  description="Show on homepage and featured sections"
                />
                <Switch
                  id="visible"
                  checked={true}
                  onChange={() => {}}
                  label="Visible on Store"
                  description="Published and available for purchase"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Full Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={6}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Detailed product description..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Specification</label>
                <textarea
                  value={formData.specification}
                  onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
                  rows={4}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Brand, material, warranty, features..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Product Highlights</label>
                <textarea
                  value={formData.highlights}
                  onChange={(e) => setFormData({ ...formData, highlights: e.target.value })}
                  rows={4}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Key selling points, one per line..."
                />
                <p className="text-xs text-muted-foreground mt-1">One highlight per line. These appear as bullet points on the product page.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Delivery Details</label>
                <textarea
                  value={formData.delivery}
                  onChange={(e) => setFormData({ ...formData, delivery: e.target.value })}
                  rows={4}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Delivery time, shipping, return policy..."
                />
                <p className="text-xs text-muted-foreground mt-1">One line per delivery detail.</p>
              </div>
              <div className="border-t border-border pt-4">
                <label className="block text-sm font-medium text-foreground mb-1.5">Delivery Availability</label>
                <p className="text-xs text-muted-foreground mb-3">
                  "All India" delivers to every valid 6-digit Indian PIN code. "Selected PIN Codes" delivers only to
                  the PIN codes you list below.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Delivery Availability"
                    value={formData.delivery_type || "all-india"}
                    onChange={(value) =>
                      setFormData({ ...formData, delivery_type: value as CreateProductInput["delivery_type"] })
                    }
                    options={[
                      { value: "all-india", label: "All India" },
                      { value: "selected", label: "Selected PIN Codes" },
                    ]}
                  />
                  <div>
                    <span className="block text-sm font-medium text-foreground mb-1.5">Serviceable PIN Codes</span>
                    <div className="flex flex-wrap items-start gap-1.5 min-h-[38px] rounded-lg border border-input bg-background px-3 py-2">
                      {formData.delivery_type !== "selected" ? (
                        <span className="text-sm text-muted-foreground">Available across all valid Indian PIN codes</span>
                      ) : (formData.selected_pin_codes || []).length === 0 ? (
                        <span className="text-sm text-muted-foreground">No PIN codes added yet</span>
                      ) : (
                        (formData.selected_pin_codes || []).map((pin) => (
                          <Badge key={pin} variant="secondary" className="gap-1">
                            {pin}
                            <button
                              type="button"
                              aria-label={`Remove PIN code ${pin}`}
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  selected_pin_codes: (formData.selected_pin_codes || []).filter((p) => p !== pin),
                                })
                              }
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                {formData.delivery_type === "selected" && (
                  <div className="mt-3">
                    <Textarea
                      label="PIN Codes"
                      placeholder="500001, 500002, 500003, 560001"
                      rows={3}
                      hint="Comma, space or newline separated 6-digit Indian PIN codes. Only valid 6-digit PIN codes are saved."
                      value={(formData.selected_pin_codes || []).join(", ")}
                      onChange={(e) => {
                        const pins = e.target.value
                          .split(/[\s,;]+/)
                          .map((s) => s.trim())
                          .filter((s) => /^[0-9]{6}$/.test(s))
                        setFormData({ ...formData, selected_pin_codes: [...new Set(pins)] })
                      }}
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Available Sizes</label>
                <div className="flex flex-wrap gap-2">
                  {["XS", "S", "M", "L", "XL", "XXL", "XXXL"].map((size) => (
                    <label
                      key={size}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={formData.sizes?.includes(size) || false}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const newSizes = formData.sizes || [];
                          if (e.target.checked) {
                            setFormData({ ...formData, sizes: [...newSizes, size] });
                          } else {
                            setFormData({ ...formData, sizes: newSizes.filter((s) => s !== size) });
                          }
                        }}
                        className="w-4 h-4 text-primary border-input rounded focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <span className="text-sm font-medium">{size}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Select available sizes for this product (mainly for clothing).</p>
              </div>
            </TabContent>

            <TabContent value="images" className="space-y-4 pt-4">
              <ImageUpload
                images={formData.images || []}
                onImagesChange={(images) => setFormData({ ...formData, images })}
              />
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFormData({ ...formData, image_url: formData.images?.[0] || "" })}
                >
                  <Check className="h-4 w-4" />
                  Use First as Thumbnail
                </Button>
                <span className="text-sm text-muted-foreground">
                  {formData.images?.length || 0} image(s) uploaded
                </span>
              </div>
            </TabContent>

            <TabContent value="seo" className="space-y-4 pt-4">
              <Input
                label="SEO Title"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Product name for search engines"
              />
              <Input
                label="SEO Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description for search results"
              />
              <Input
                label="SEO Slug"
                value={formData.name.toLowerCase().replace(/\s+/g, "-")}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Auto-generated from name"
              />
            </TabContent>
          </Tabs>

          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); setIsEditOpen(false); resetForm(); setEditingProduct(null); }}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>
              {editingProduct ? "Update Product" : "Create Product"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => { setIsDeleteOpen(false); setDeletingId(null); }}
        onConfirm={() => { if (deletingId) deleteMutation.mutate(deletingId) }}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
