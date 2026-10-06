import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "../../lib/utils"
import { Button } from "../ui/Button"
import { Avatar } from "../ui/Avatar"
import { Bell, Check, Moon, Sun, Menu, LogOut, User, Settings, ChevronDown, MessageSquare } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import { api } from "../../lib/api"
import type { Notification, NotificationsResponse } from "../../lib/types"

const NOTIFICATIONS_QUERY_KEY = ["customer-notifications"]

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (isNaN(date.getTime()) || seconds < 0) return "Just now"
  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  return new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function getTicketId(notification: Notification) {
  const data = notification.data as Record<string, unknown> | null
  const supportId = data?.support_id
  if (typeof supportId === "string" && supportId) return supportId
  const match = /#(\S+)/.exec(notification.message || "")
  return match ? match[1] : null
}

export function Header({ onMenuClick, isSidebarCollapsed }: { onMenuClick: () => void; isSidebarCollapsed: boolean }) {
  const [isDark, setIsDark] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    const savedTheme = localStorage.getItem("customer_theme")
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const shouldBeDark = savedTheme ? savedTheme === "dark" : prefersDark
    setIsDark(shouldBeDark)
    document.documentElement.classList.toggle("dark", shouldBeDark)
  }, [])

  const toggleTheme = () => {
    const newTheme = !isDark
    setIsDark(newTheme)
    localStorage.setItem("customer_theme", newTheme ? "dark" : "light")
    document.documentElement.classList.toggle("dark", newTheme)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const openUserMenu = () => {
    setShowUserMenu(true)
    setShowNotifications(false)
  }

  const closeUserMenu = () => setShowUserMenu(false)

  // Notifications data fetching (same pattern as Admin Dashboard)
  const { data: notifData, isLoading } = useQuery<NotificationsResponse>({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => api.notifications.getMy({ limit: 30 }),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  })

  const backendNotifications = (notifData?.data ?? []).map((n) => ({
    ...n,
    unread: !n.is_read,
  }))

  const unreadCount = backendNotifications.filter((n) => n.unread).length

  const applyLocalRead = useCallback((id: number, read: boolean) => {
    queryClient.setQueryData<NotificationsResponse>(NOTIFICATIONS_QUERY_KEY, (old) => {
      if (!old) return old
      return {
        ...old,
        unread_count: Math.max(0, old.unread_count + (read ? -1 : 1)),
        data: old.data.map((n) =>
          n.id === id ? { ...n, is_read: read ? 1 : 0 } : n
        ),
      }
    })
  }, [queryClient])

  const markAsRead = (notification: Notification & { unread: boolean }) => {
    if (!notification.unread) return
    applyLocalRead(notification.id, true)
    api.notifications.markRead(notification.id).catch(() => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
    })
  }

  const markAllRead = () => {
    if (unreadCount === 0) return
    queryClient.setQueryData<NotificationsResponse>(NOTIFICATIONS_QUERY_KEY, (old) =>
      old
        ? {
            ...old,
            unread_count: 0,
            data: old.data.map((n) => ({ ...n, is_read: 1 })),
          }
        : old
    )
    if ((notifData?.unread_count ?? 0) > 0) {
      api.notifications.markAllRead().catch(() => {
        queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
      })
    }
  }

  const handleNotificationClick = (notification: Notification & { unread: boolean }) => {
    if (notification.unread) markAsRead(notification)
    setShowNotifications(false)
    if (notification.link) {
      navigate(notification.link)
    }
  }

  const handleViewAllNotifications = () => {
    setShowNotifications(false)
    navigate("/support")
  }

  return (
    <header
      className={cn(
        "fixed top-0 z-30 h-16 bg-background/80 backdrop-blur-xl border-b border-border",
        "flex items-center justify-between px-4 lg:px-6",
        "transition-all duration-300",
        isSidebarCollapsed ? "left-18" : "left-64",
        "right-0"
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
        <div>
          <h1 className="text-lg font-display font-bold text-foreground">Customer Support</h1>
          <p className="text-xs text-muted-foreground">Manage your support requests</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <div className="relative" ref={notificationsRef}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
            aria-expanded={showNotifications}
            className="relative"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground shadow-sm">
                {unreadCount > 99 ? "99+" : unreadCount}
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
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <h3 className="font-semibold text-foreground">Notifications</h3>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs" onClick={markAllRead}>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Mark all read
                    </Button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                      <span className="text-sm">Loading notifications...</span>
                    </div>
                  ) : backendNotifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <Bell className="h-10 w-10 mb-3 opacity-40" />
                      <p className="text-sm font-medium text-foreground text-center">No notifications</p>
                      <p className="text-xs mt-1 text-center">You don't have any notifications yet.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {backendNotifications.map((notification) => (
                        <li key={notification.id}>
                          <button
                            onClick={() => handleNotificationClick(notification)}
                            className={cn(
                              "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                              notification.unread && "bg-muted/50"
                            )}
                            role="menuitem"
                          >
                            <span
                              className={cn(
                                "mt-1.5 flex h-2 w-2 flex-shrink-0 rounded-full",
                                notification.unread ? "bg-primary" : "bg-transparent"
                              )}
                              aria-hidden="true"
                            />
                            <span className="flex-1 min-w-0">
                              <span className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                                  <span className="text-sm font-medium text-foreground truncate">
                                    {notification.title}
                                  </span>
                                </span>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {formatRelativeTime(notification.created_at)}
                                </span>
                              </span>
                              {getTicketId(notification) && (
                                <span className="block text-xs font-mono font-medium text-primary mt-0.5">
                                  Ticket #{getTicketId(notification)}
                                </span>
                              )}
                              <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                {notification.message}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
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
            onClick={openUserMenu}
            aria-label="User menu"
            aria-expanded={showUserMenu}
            aria-haspopup="true"
          >
            <Avatar
              src={user?.email ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}` : undefined}
              fallback={user?.name || "Customer"}
              size="sm"
            />
            <span className="hidden sm:block text-sm font-medium text-foreground whitespace-nowrap">
              {user?.name || "Customer"}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50"
                role="menu"
              >
                <div className="px-4 py-3 border-b border-border">
                  <p className="font-medium text-foreground">{user?.name || "Customer"}</p>
                  <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                </div>
                <button
                  role="menuitem"
                  onClick={() => { closeUserMenu(); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  <User className="h-4 w-4" />
                  Profile
                </button>
                <button
                  role="menuitem"
                  onClick={() => { closeUserMenu(); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
                <hr className="my-1 border-border" />
                <button
                  role="menuitem"
                  onClick={() => { closeUserMenu(); logout(); }}
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
    </header>
  )
}
