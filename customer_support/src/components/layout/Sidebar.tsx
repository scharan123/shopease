import { NavLink, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "../../lib/utils"
import {
  LayoutDashboard,
  MessageSquare,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Headphones,
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: "Support", href: "/support", icon: <MessageSquare className="h-5 w-5" /> },
  { label: "Profile", href: "/profile", icon: <User className="h-5 w-5" /> },
]

export function Sidebar({ isCollapsed, onToggle }: { isCollapsed: boolean; onToggle: () => void }) {
  const location = useLocation()
  const { logout } = useAuth()

  return (
    <motion.aside
      initial={{ width: isCollapsed ? 72 : 260 }}
      animate={{ width: isCollapsed ? 72 : 260 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-card border-r border-border",
        "flex flex-col transition-all duration-300",
        isCollapsed ? "w-18" : "w-64"
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-border">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn("flex items-center gap-3", isCollapsed && "justify-center")}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground flex-shrink-0">
            <Headphones className="h-5 w-5" />
          </div>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                key="title"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="font-display font-bold text-xl text-foreground whitespace-nowrap"
              >
                ShopEase
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
        <button
          onClick={onToggle}
          className={cn(
            "p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent",
            "transition-colors duration-200",
            isCollapsed && "mx-auto"
          )}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1" aria-label="Navigation">
        <AnimatePresence mode="popLayout">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== "/" && location.pathname.startsWith(item.href))

            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: 0.05 }}
              >
                <NavLink
                  to={item.href}
                  className={({ isActive: active }) => cn(
                    "relative flex items-center gap-3 px-3 py-2.5 rounded-xl",
                    "text-sm font-medium transition-all duration-200",
                    "hover:bg-accent hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground",
                    isCollapsed && "justify-center px-2"
                  )}
                  title={isCollapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="flex-shrink-0" aria-hidden="true">{item.icon}</span>
                  <AnimatePresence mode="wait">
                    {!isCollapsed && (
                      <motion.span
                        key="label"
                        initial={{ opacity: 0, width: 0, x: -10 }}
                        animate={{ opacity: 1, width: "auto", x: 0 }}
                        exit={{ opacity: 0, width: 0, x: -10 }}
                        className="whitespace-nowrap overflow-hidden"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </NavLink>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </nav>

      <div className="p-4 border-t border-border">
        <button
          onClick={logout}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl",
            "text-sm font-medium transition-all duration-200",
            "text-destructive hover:bg-destructive/10 hover:text-destructive",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isCollapsed && "justify-center px-2"
          )}
          title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                key="label"
                initial={{ opacity: 0, width: 0, x: -10 }}
                animate={{ opacity: 1, width: "auto", x: 0 }}
                exit={{ opacity: 0, width: 0, x: -10 }}
                className="whitespace-nowrap overflow-hidden"
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  )
}
