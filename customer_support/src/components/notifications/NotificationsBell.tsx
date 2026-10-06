import { useState, useRef, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, Check, Clock, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { api } from "@/lib/api"
import type { Notification, NotificationsResponse } from "@/lib/types"
import { createPortal } from "react-dom"

const NOTIFICATIONS_QUERY_KEY = ["customer-notifications"]

export function getNotificationsQueryKey() {
  return NOTIFICATIONS_QUERY_KEY
}

interface NotificationsBellProps {
  isOpen?: boolean
  onClose?: () => void
  onOpen?: () => void
}

function timeAgo(dateString: string) {
  const date = new Date(dateString)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (isNaN(date.getTime()) || seconds < 0) return "Just now"
  if (seconds < 60) return "Just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`

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

export function NotificationsBell({ isOpen: controlledIsOpen, onClose, onOpen }: NotificationsBellProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  const isOpen = controlledIsOpen ?? internalIsOpen
  const setIsOpen = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    if (controlledIsOpen === undefined) {
      setInternalIsOpen(value)
    }
    if (typeof value === "function") {
      const newValue = value(internalIsOpen)
      if (newValue && onOpen) onOpen()
      if (!newValue && onClose) onClose()
    } else {
      if (value && onOpen) onOpen()
      if (!value && onClose) onClose()
    }
  }, [controlledIsOpen, internalIsOpen, onClose, onOpen])

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => api.notifications.getMy({ limit: 30 }),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  })

  const notifications = data?.data ?? []
  const unreadCount = data?.unread_count ?? 0

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [setIsOpen])

  const applyLocalRead = (id: number, read: boolean) => {
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
  }

  const markRead = (id: number) => {
    const item = notifications.find((n) => n.id === id)
    if (!item || item.is_read) return
    applyLocalRead(id, true)
    api.notifications.markRead(id).catch(() => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
    })
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) markRead(notification.id)
    setIsOpen(false)
    if (notification.link) {
      navigate(notification.link)
    }
  }

  const handleMarkAllRead = () => {
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
    api.notifications.markAllRead().catch(() => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
    })
  }

  const handleBellClick = () => {
    setIsOpen((prev) => !prev)
  }

  const dropdownContent = (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed right-4 mt-2 w-80 sm:w-96 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-[100]"
      role="dialog"
      aria-label="Notifications"
      style={{ top: "64px" }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Check className="h-3.5 w-3.5" />
            Mark all as read
          </button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Clock className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Bell className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium text-foreground text-center">No notifications</p>
            <p className="text-xs mt-1 text-center">You don't have any notifications yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((notification) => {
              const unread = !notification.is_read
              const ticketId = getTicketId(notification)
              return (
                <li key={notification.id}>
                  <button
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                      unread && "bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 flex h-2 w-2 flex-shrink-0 rounded-full",
                        unread ? "bg-primary" : "bg-transparent"
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
                          {timeAgo(notification.created_at)}
                        </span>
                      </span>
                      {ticketId && (
                        <span className="block text-xs font-mono font-medium text-primary mt-0.5">
                          Ticket #{ticketId}
                        </span>
                      )}
                      <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.message}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </motion.div>
  )

  return (
    <div className="relative" ref={bellRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleBellClick}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={isOpen}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground shadow-sm"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
        {unreadCount > 0 && (
          <span className="sr-only">{unreadCount} unread notifications</span>
        )}
      </Button>

      <AnimatePresence>
        {isOpen && createPortal(dropdownContent, document.body)}
      </AnimatePresence>
    </div>
  )
}