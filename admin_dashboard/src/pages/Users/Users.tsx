import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { cn } from "lib/utils"
import { formatRelativeTime, formatDate, formatCurrency } from "lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "ui/Card"
import { Button } from "ui/Button"
import { Input } from "ui/Input"
import { Select } from "ui/Input"
import { Table } from "ui/Table"
import { Modal, ConfirmModal } from "ui/Modal"
import { Badge } from "ui/Badge"
import { Dropdown, ActionDropdown } from "ui/Dropdown"
import { Avatar } from "ui/Avatar"
import { Skeleton, SkeletonTable } from "ui/Skeleton"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "lib/api"
import type { User } from "lib/types"
import {
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Shield,
  User as UserIcon,
  Mail,
  Calendar,
  DollarSign,
  Download,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

export function Users() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "")
  const [roleFilter, setRoleFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [newRole, setNewRole] = useState<"admin" | "user">("user")
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["admin", "users", { search: searchQuery, role: roleFilter, page, limit: pageSize }],
    queryFn: () => api.users.getAll({
      search: searchQuery,
      role: roleFilter !== "all" ? roleFilter : undefined,
      page,
      limit: pageSize,
      sortBy: "created_at",
      sortOrder: "desc",
    }),
  })

  const users = usersData?.data || []
  const totalPages = usersData?.pagination.totalPages || 1
  const totalUsers = usersData?.pagination.total || 0

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: "admin" | "user" }) => api.users.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      setIsRoleModalOpen(false)
      setSelectedUser(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.users.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] })
      setIsDeleteOpen(false)
      setDeletingId(null)
    },
  })

  const handleView = (user: User) => {
    setSelectedUser(user)
    setIsDetailModalOpen(true)
  }

  const handleRoleChange = (user: User) => {
    setSelectedUser(user)
    setNewRole(user.role === "admin" ? "user" : "admin")
    setIsRoleModalOpen(true)
  }

  const handleDelete = (id: number) => {
    setDeletingId(id)
    setIsDeleteOpen(true)
  }

  const columns = [
    {
      key: "avatar",
      header: "User",
      render: (row: User) => (
        <div className="flex items-center gap-3">
          <Avatar
            size="sm"
            fallback={row.name}
            src={row.email ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.email}` : undefined}
          />
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (row: User) => (
        <Badge variant={row.role === "admin" ? "default" : "secondary"}>
          {row.role === "admin" ? <Shield className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
          {row.role?.charAt(0).toUpperCase() + row.role?.slice(1)}
        </Badge>
      ),
    },
    {
      key: "order_count",
      header: "Orders",
      render: (row: User) => (
        <span className="font-medium">{row.order_count || 0}</span>
      ),
    },
    {
      key: "total_spent",
      header: "Total Spent",
      render: (row: User) => (
        <span className="font-medium">{formatCurrency(row.total_spent || 0)}</span>
      ),
    },
    {
      key: "created_at",
      header: "Joined",
      render: (row: User) => (
        <div>
          <p className="text-sm text-muted-foreground">{formatRelativeTime(row.created_at)}</p>
          <p className="text-xs text-muted-foreground">{formatDate(row.created_at)}</p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (row: User) => (
        <Dropdown
          trigger={({ onToggle }) => (
            <Button variant="ghost" size="icon" onClick={onToggle}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
          items={[
            { label: "View Details", onClick: () => handleView(row), icon: <Eye className="h-4 w-4" /> },
            { label: "Edit Role", onClick: () => handleRoleChange(row), icon: <Shield className="h-4 w-4" /> },
            { label: "Delete", onClick: () => handleDelete(row.id), icon: <Trash2 className="h-4 w-4" />, danger: true },
          ]}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground">Manage customer accounts</p>
        </div>
        <Button variant="outline" onClick={() => console.log("Export users")}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      <Card>
        <CardContent className="p-6 pt-0">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => { const v = e.target.value; setSearchQuery(v); setPage(1); setSearchParams(v ? { q: v } : {}, { replace: true }); }}
              className="flex-1 max-w-md"
            />
            <Select
              value={roleFilter}
              onChange={(value) => { setRoleFilter(value); setPage(1); }}
              options={[
                { value: "all", label: "All Roles" },
                { value: "admin", label: "Admins" },
                { value: "user", label: "Customers" },
              ]}
              className="w-[160px]"
            />
          </div>

          <Table
            columns={columns}
            data={users}
            keyExtractor={(row) => row.id}
            isLoading={isLoading}
            emptyMessage="No users found"
            pagination={{
              page,
              pageSize,
              total: totalUsers,
              onPageChange: setPage,
              onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
            }}
          />
        </CardContent>
      </Card>

      <UserDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setSelectedUser(null); }}
        user={selectedUser}
        onChangeRole={handleRoleChange}
      />

      <RoleChangeModal
        isOpen={isRoleModalOpen}
        onClose={() => { setIsRoleModalOpen(false); setSelectedUser(null); }}
        onSubmit={() => { if (selectedUser) updateRoleMutation.mutate({ id: selectedUser.id, role: newRole }) }}
        user={selectedUser}
        role={newRole}
        setRole={setNewRole}
        isLoading={updateRoleMutation.isPending}
      />

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => { setIsDeleteOpen(false); setDeletingId(null); }}
        onConfirm={() => { if (deletingId) deleteMutation.mutate(deletingId) }}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

function UserDetailModal({ isOpen, onClose, user, onChangeRole }: { isOpen: boolean; onClose: () => void; user: User | null; onChangeRole: (user: User) => void }) {
  if (!user) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={user.name} size="lg">
      <div className="space-y-6">
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
          <Avatar
            size="xl"
            fallback={user.name}
            src={user.email ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}` : undefined}
          />
          <div>
            <h3 className="text-lg font-semibold">{user.name}</h3>
            <p className="text-muted-foreground">{user.email}</p>
            <Badge variant={user.role === "admin" ? "default" : "secondary"} className="mt-2">
              {user.role === "admin" ? <Shield className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
              {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-muted/50 rounded-xl text-center">
            <p className="text-2xl font-bold">{user.order_count || 0}</p>
            <p className="text-sm text-muted-foreground">Total Orders</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-xl text-center">
            <p className="text-2xl font-bold">{formatCurrency(user.total_spent || 0)}</p>
            <p className="text-sm text-muted-foreground">Total Spent</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-xl text-center">
            <p className="text-2xl font-bold">{formatRelativeTime(user.created_at)}</p>
            <p className="text-sm text-muted-foreground">Member Since</p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border">
          <h4 className="font-semibold">Account Information</h4>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">User ID</dt>
              <dd className="font-mono font-medium">#{user.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{user.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Role</dt>
              <dd><Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Joined</dt>
              <dd>{formatDate(user.created_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Orders</dt>
              <dd className="font-medium">{user.order_count || 0}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total Spent</dt>
              <dd className="font-medium">{formatCurrency(user.total_spent || 0)}</dd>
            </div>
          </dl>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => onChangeRole(user)}>Change Role</Button>
        </div>
      </div>
    </Modal>
  )
}

function RoleChangeModal({ isOpen, onClose, onSubmit, user, role, setRole, isLoading }: {
  isOpen: boolean
  onClose: () => void
  onSubmit: () => void
  user: User | null
  role: "admin" | "user"
  setRole: (role: "admin" | "user") => void
  isLoading: boolean
}) {
  if (!user) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change User Role" size="sm">
      <div className="space-y-4">
        <p className="text-muted-foreground">
          Change role for <span className="font-medium">{user.name}</span> ({user.email})
        </p>
        
        <div className="space-y-3">
          {["admin", "user"].map((r) => (
            <label
              key={r}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                role === r ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              )}
            >
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r as "admin" | "user")}
                className="sr-only"
              />
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", role === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {r === "admin" ? <Shield className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
              </div>
              <div>
                <p className="font-medium">{r.charAt(0).toUpperCase() + r.slice(1)}</p>
                <p className="text-sm text-muted-foreground">
                  {r === "admin" ? "Full access to admin panel" : "Standard customer account"}
                </p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button onClick={onSubmit} isLoading={isLoading}>Update Role</Button>
        </div>
      </div>
    </Modal>
  )
}
