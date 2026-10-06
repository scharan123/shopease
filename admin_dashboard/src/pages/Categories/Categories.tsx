import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "lib/utils"
import { formatRelativeTime } from "lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "ui/Card"
import { Button } from "ui/Button"
import { Input } from "ui/Input"
import { Table } from "ui/Table"
import { Modal, ConfirmModal } from "ui/Modal"
import { Badge } from "ui/Badge"
import { Skeleton, SkeletonTable } from "ui/Skeleton"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "lib/api"
import type { Category, CreateCategoryInput, UpdateCategoryInput } from "lib/types"
import {
  Plus,
  Edit,
  Trash2,
  GripVertical,
} from "lucide-react"
import { SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"

function CategoryRow({ category, onEdit, onDelete }: {
  category: Category
  onEdit: (category: Category) => void
  onDelete: (id: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-all duration-200 border-b border-border last:border-0",
        isDragging && "bg-primary/5 shadow-lg"
      )}
    >
      <td className="p-4 w-10">
        <button
          {...attributes}
          {...listeners}
          className="p-1 hover:bg-accent rounded-lg text-muted-foreground cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-5 w-5" />
        </button>
      </td>
      <td className="p-4">
        <div className="flex items-center gap-3">
          {category.icon ? (
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium overflow-hidden shrink-0">
              <span className="truncate px-1" role="img" aria-label={category.name}>{category.icon}</span>
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium uppercase shrink-0">
              {category.name.substring(0, 2)}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium truncate">{category.name}</p>
            <p className="text-xs text-muted-foreground truncate">{category.slug}</p>
          </div>
        </div>
      </td>
      <td className="p-4">
        <Badge variant="secondary">{category.product_count || 0} products</Badge>
      </td>
      <td className="p-4 font-medium text-sm">{category.display_order}</td>
      <td className="p-4 text-sm text-muted-foreground">{formatRelativeTime(category.created_at || new Date())}</td>
      <td className="p-4">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEdit(category)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors"
            aria-label={`Edit ${category.name}`}
          >
            <Edit className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={() => onDelete(category.id)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
            aria-label={`Delete ${category.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}

function SortableTable({ categories, onReorder, isLoading, onEdit, onDelete }: {
  categories: Category[]
  onReorder: (items: { id: number; display_order: number }[]) => void
  isLoading: boolean
  onEdit: (category: Category) => void
  onDelete: (id: number) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: { active: { id: string }; over: { id: string } | null }) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = categories.findIndex((c) => c.id === Number(active.id))
    const newIndex = categories.findIndex((c) => c.id === Number(over.id))

    const newCategories = Array.from(categories)
    const [removed] = newCategories.splice(oldIndex, 1)
    newCategories.splice(newIndex, 0, removed)

    const reorderItems = newCategories.map((cat, index) => ({
      id: cat.id,
      display_order: index + 1,
    }))

    onReorder(reorderItems)
  }

  if (isLoading) {
    return <SkeletonTable rows={5} columns={6} />
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No categories found</p>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={categories.map((c) => String(c.id))}>
        <div className="overflow-x-auto">
          <table className="w-full" role="grid">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="p-4 w-10" />
                <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Products</th>
                <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Order</th>
                <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</th>
                <th className="p-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      </SortableContext>
    </DndContext>
  )
}

export function Categories() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<CreateCategoryInput>({
    name: "",
    slug: "",
    icon: "",
    display_order: 0,
    image_url: "",
  })

  const { data: categoriesData, isLoading } = useQuery({
    queryKey: ["admin", "categories", searchQuery],
    queryFn: () => api.categories.getAll({ search: searchQuery, limit: 100 }),
    select: (data) => data.data,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateCategoryInput) => api.categories.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] })
      setIsCreateOpen(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCategoryInput }) => api.categories.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] })
      setIsEditOpen(false)
      setEditingCategory(null)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.categories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] })
      setIsDeleteOpen(false)
      setDeletingId(null)
    },
  })

  const reorderMutation = useMutation({
    mutationFn: (items: { id: number; display_order: number }[]) => api.categories.reorder(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] })
    },
  })

  const filteredCategories = categoriesData?.filter((cat) =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.slug.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      slug: category.slug,
      icon: category.icon || "",
      display_order: category.display_order,
      image_url: category.image_url || "",
    })
    setIsEditOpen(true)
  }

  const handleDelete = (id: number) => {
    setDeletingId(id)
    setIsDeleteOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Auto-generate slug from name if not provided
    const slugValue = formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
    const dataToSubmit = { ...formData, slug: slugValue }
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: dataToSubmit })
    } else {
      createMutation.mutate(dataToSubmit)
    }
  }

  const resetForm = () => {
    setFormData({ name: "", slug: "", icon: "", display_order: 0, image_url: "" })
  }

  const openCreate = () => {
    setEditingCategory(null)
    resetForm()
    setIsCreateOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Categories</h1>
          <p className="text-muted-foreground">Manage product categories</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      <Card>
        <CardContent className="p-6 pt-0">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input
              placeholder="Search categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 max-w-md"
              label="Search"
            />
          </div>

          <SortableTable
            categories={filteredCategories}
            onReorder={reorderMutation.mutate}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={isCreateOpen || isEditOpen}
        onClose={() => { setIsCreateOpen(false); setIsEditOpen(false); resetForm(); setEditingCategory(null); }}
        title={editingCategory ? "Edit Category" : "Create Category"}
        description={editingCategory ? "Update the category details" : "Add a new category to your store"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => {
              const name = e.target.value
              const autoSlug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
              setFormData({ ...formData, name, slug: autoSlug })
            }}
            placeholder="Category name"
            required
          />
          <Input
            label="Slug"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
            placeholder="URL-friendly slug"
            required
            hint="Auto-generated from name if left empty"
          />
          <Input
            label="Icon (emoji or class)"
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            placeholder="📦 or custom-icon"
          />
          <Input
            label="Display Order"
            type="number"
            value={formData.display_order}
            onChange={(e) => setFormData({ ...formData, display_order: Number(e.target.value) })}
            required
          />
          <Input
            label="Image URL"
            value={formData.image_url}
            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
            placeholder="https://example.com/image.jpg"
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); setIsEditOpen(false); resetForm(); setEditingCategory(null); }}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>
              {editingCategory ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => { setIsDeleteOpen(false); setDeletingId(null); }}
        onConfirm={() => { if (deletingId) deleteMutation.mutate(deletingId) }}
        title="Delete Category"
        description="Are you sure you want to delete this category? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
