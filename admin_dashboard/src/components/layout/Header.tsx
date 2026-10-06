import { useState, useRef, useEffect, ReactNode } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { cn, formatRelativeTime } from "../../lib/utils"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"
import { Avatar, AvatarGroup } from "../ui/Avatar"
import { Dropdown, ActionDropdown } from "../ui/Dropdown"
import { Toaster } from "../ui/Toast"
import { api } from "../../lib/api"
import {
  Search, Bell, Moon, Sun, Menu, LogOut, User, Settings, ChevronDown,
  Package, ShoppingCart, Users as UsersIcon, ArrowRight
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"

function SearchSection({
  title,
  icon,
  items,
  count,
  onSeeAll,
  onPick,
}: {
  title: string
  icon: ReactNode
  items: { id: string; label: string; sub: string }[]
  count: number
  onSeeAll: () => void
  onPick: () => void
}) {
  return (
    <div className="p-2">
      <button
        onClick={onSeeAll}
        className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent transition-colors group"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {icon}
          {title}
        </span>
        {count > 0 && (
          <span className="text-xs text-muted-foreground group-hover:text-primary">
            See all ({count}) <ArrowRight className="inline h-3 w-3" />
          </span>
        )}
      </button>
      {items.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">No matching {title.toLowerCase()}</p>
      ) : (
        items.map((item) => (
          <button
            key={`${title}-${item.id}`}
            onClick={onPick}
            className="w-full flex flex-col items-start px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <span className="text-sm font-medium text-foreground">{item.label}</span>
            <span className="text-xs text-muted-foreground truncate">{item.sub}</span>
          </button>
        ))
      )}
    </div>
  )
}

export function Header({ onMenuClick, isSidebarCollapsed }: { onMenuClick: () => void; isSidebarCollapsed: boolean }) {
  const [searchQuery, setSearchQuery] = useState("")
  const [showGlobalResults, setShowGlobalResults] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [debouncedQuery, setDebouncedQuery] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const trimmed = debouncedQuery

  const { data: productResults } = useQuery({
    queryKey: ["global-search", "products", trimmed],
    queryFn: () => api.products.getAll({ search: trimmed, limit: 5, page: 1 }),
    enabled: trimmed.length > 0,
  })

  const { data: orderResults } = useQuery({
    queryKey: ["global-search", "orders", trimmed],
    queryFn: () => api.orders.getAll({ search: trimmed, limit: 5, page: 1 }),
    enabled: trimmed.length > 0,
  })

  const { data: userResults } = useQuery({
    queryKey: ["global-search", "users", trimmed],
    queryFn: () => api.users.getAll({ search: trimmed, limit: 5, page: 1 }),
    enabled: trimmed.length > 0,
  })

  const goToPage = (path: string) => {
    navigate(`${path}?q=${encodeURIComponent(searchQuery.trim())}`)
    setSearchQuery("")
    setDebouncedQuery("")
    setShowGlobalResults(false)
  }

  useEffect(() => {
    const handleSearchClickOutside = (e: MouseEvent) => {
      const panel = document.getElementById("global-search-panel")
      const inputWrap = document.getElementById("global-search-input")
      if (panel && inputWrap && !panel.contains(e.target as Node) && !inputWrap.contains(e.target as Node)) {
        setShowGlobalResults(false)
      }
    }
    document.addEventListener("mousedown", handleSearchClickOutside)
    return () => document.removeEventListener("mousedown", handleSearchClickOutside)
  }, [])

  useEffect(() => {
    setShowGlobalResults(trimmed.length > 0)
  }, [trimmed])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const shouldBeDark = savedTheme ? savedTheme === "dark" : prefersDark
    setIsDark(shouldBeDark)
    document.documentElement.classList.toggle("dark", shouldBeDark)
  }, [])

  const toggleTheme = () => {
    const newTheme = !isDark
    setIsDark(newTheme)
    localStorage.setItem("theme", newTheme ? "dark" : "light")
    document.documentElement.classList.toggle("dark", newTheme)
  }

  // Live notifications from real data
  const { data: recentOrders } = useQuery({
    queryKey: ["header-notifs", "recent-orders"],
    queryFn: () => api.orders.getAll({ limit: 3, page: 1, sortBy: "created_at", sortOrder: "desc" }),
    select: (data) => data.data || [],
    refetchInterval: 30000,
  })

  const { data: recentProducts } = useQuery({
    queryKey: ["header-notifs", "low-stock"],
    queryFn: () => api.products.getAll({ limit: 50, page: 1, sortBy: "stock", sortOrder: "asc" }),
    select: (data) => data.data || [],
    refetchInterval: 30000,
  })

  type HeaderNotification = {
    id: string
    title: string
    message: string
    time: string
    unread: boolean
    link?: string
    dbId?: number
  }

  // Real, persistent support-ticket notifications stored in the database. The
  // bell polls the backend so new tickets appear live without a page reload.
  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.notifications.getAll(),
    refetchInterval: 15000,
  })

  // Tracks notifications the admin has read in this session; POSTs to the
  // backend persist the state so it survives a refresh / other admins.
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  const backendNotifications: HeaderNotification[] = (notifData?.data ?? []).map((n) => ({
    id: `db-${n.id}`,
    dbId: n.id,
    title: n.title,
    message: n.message ?? "",
    time: n.created_at ? formatRelativeTime(n.created_at) : "just now",
    unread: !n.is_read,
    link: n.link ?? undefined,
  }))

  const liveSystem: HeaderNotification[] = []

  ;(recentOrders || []).forEach((o) => {
    liveSystem.push({
      id: `new-order-${o.id}`,
      title: "New Order",
      message: `Order #${o.id} · ${o.user?.name || "Guest"} · ${o.total_amount ? "₹" + o.total_amount : ""}`,
      time: o.created_at ? formatRelativeTime(o.created_at) : "just now",
      unread: true,
      link: `/orders`,
    })
  })

  ;(recentProducts || [])
    .filter((p) => p.stock <= 10)
    .slice(0, 2)
    .forEach((p) => {
      liveSystem.push({
        id: `low-stock-${p.id}`,
        title: "Low Stock",
        message: `${p.name} only ${p.stock} left`,
        time: "now",
        unread: true,
        link: "/products",
      })
    })

  const notifications: HeaderNotification[] = [
    ...backendNotifications.map((n) => (readIds.has(n.id) ? { ...n, unread: false } : n)),
    ...liveSystem,
  ]

  const unreadCount = notifications.filter((n) => n.unread).length

  const markAsRead = (notification: HeaderNotification) => {
    setReadIds((prev) => {
      const next = new Set(prev)
      next.add(notification.id)
      return next
    })
    if (notification.dbId != null) {
      api.notifications.markRead(notification.dbId).catch(() => {})
    }
  }

  const markAllRead = () => {
    const unreadIds = notifications.filter((n) => n.unread).map((n) => n.id)
    setReadIds((prev) => {
      const next = new Set(prev)
      unreadIds.forEach((id) => next.add(id))
      return next
    })
    if ((notifData?.unread_count ?? 0) > 0) {
      api.notifications.markAllRead().catch(() => {})
    }
  }

  const handleNotificationClick = (notification: HeaderNotification) => {
    if (notification.unread) markAsRead(notification)
    setShowNotifications(false)
    if (notification.link) navigate(notification.link)
  }

  const handleViewAllNotifications = () => {
    setShowNotifications(false)
    navigate("/settings")
  }

  return (
    <header
      className={cn(
        "fixed top-0 z-30 h-16 bg-background/80 backdrop-blur-xl border-b border-border",
        "flex items-center justify-between px-4 lg:px-6",
        "transition-all duration-300",
        isSidebarCollapsed ? "left-18" : "left-64"
      )}
      role="banner"
    >
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="relative hidden sm:block w-72 md:w-96" id="global-search-input">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products, orders, users..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowGlobalResults(true); }}
            onFocus={() => { if (searchQuery.trim()) setShowGlobalResults(true); }}
            onKeyDown={(e) => { if (e.key === "Enter" && searchQuery.trim()) goToPage("/products"); }}
            className="pl-10 h-10 text-sm bg-muted/50 border-border/50 focus:border-primary focus:ring-primary/20"
            aria-label="Global search"
          />
          <AnimatePresence>
            {showGlobalResults && (
              <motion.div
                id="global-search-panel"
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                className="absolute left-0 right-0 top-full mt-2 w-full bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50"
              >
                <div className="max-h-96 overflow-y-auto">
                  <SearchSection
                    title="Products"
                    icon={<Package className="h-4 w-4 text-primary" />}
                    count={productResults?.pagination?.total ?? 0}
                    items={(productResults?.data ?? []).map((p) => ({ id: String(p.id), label: p.name, sub: `₹${p.price}` }))}
                    onSeeAll={() => goToPage("/products")}
                    onPick={() => goToPage("/products")}
                  />
                  <SearchSection
                    title="Orders"
                    icon={<ShoppingCart className="h-4 w-4 text-primary" />}
                    count={orderResults?.pagination?.total ?? 0}
                    items={(orderResults?.data ?? []).map((o) => ({
                      id: String(o.id),
                      label: `#${o.id}`,
                      sub: o.user?.name || "Guest order",
                    }))}
                    onSeeAll={() => goToPage("/orders")}
                    onPick={() => goToPage("/orders")}
                  />
                  <SearchSection
                    title="Users"
                    icon={<UsersIcon className="h-4 w-4 text-primary" />}
                    count={userResults?.pagination?.total ?? 0}
                    items={(userResults?.data ?? []).map((u) => ({ id: String(u.id), label: u.name, sub: u.email }))}
                    onSeeAll={() => goToPage("/users")}
                    onPick={() => goToPage("/users")}
                  />
                  {!trimmed ? null : (
                    <button
                      onClick={() => goToPage("/products")}
                      className="w-full flex items-center justify-center gap-2 p-3 text-sm font-medium text-primary hover:bg-accent transition-colors border-t border-border"
                    >
                      View all results <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="relative"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <div className="relative" ref={notificationsRef}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
            aria-expanded={showNotifications}
            className="relative"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-xl shadow-lg overflow-hidden"
                role="menu"
              >
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Notifications</h3>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={markAllRead}>
                      Mark all read
                    </Button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={cn(
                        "w-full p-4 hover:bg-accent transition-colors text-left",
                        "border-b border-border last:border-0",
                        notification.unread && "bg-muted/50"
                      )}
                      role="menuitem"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                          notification.unread ? "bg-primary" : "bg-transparent"
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground">{notification.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{notification.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{notification.time}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="p-3 border-t border-border">
                  <Button variant="outline" className="w-full text-sm" onClick={handleViewAllNotifications}>
                    View all notifications
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative" ref={userMenuRef}>
          <Button
            variant="ghost"
            className="gap-2 pr-3"
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="User menu"
            aria-expanded={showUserMenu}
            aria-haspopup="true"
          >
            <Avatar
              src={user?.email ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}` : undefined}
              fallback={user?.name || "Admin"}
              size="sm"
            />
            <AnimatePresence mode="wait">
              {!isSidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="hidden sm:block text-sm font-medium text-foreground whitespace-nowrap"
                >
                  {user?.name || "Admin"}
                </motion.span>
              )}
            </AnimatePresence>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-xl shadow-lg overflow-hidden"
                role="menu"
              >
                <div className="px-4 py-3 border-b border-border">
                  <p className="font-medium text-foreground">{user?.name || "Admin"}</p>
                  <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                </div>
                <button
                  role="menuitem"
                  onClick={() => { setShowUserMenu(false); navigate("/settings"); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  <User className="h-4 w-4" />
                  Profile
                </button>
                <button
                  role="menuitem"
                  onClick={() => { setShowUserMenu(false); navigate("/settings"); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
                <hr className="my-1 border-border" />
                <button
                  role="menuitem"
                  onClick={() => { setShowUserMenu(false); logout(); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-destructive hover:bg-accent transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Toaster />
    </header>
  )
}