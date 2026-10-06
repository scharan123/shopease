import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "../../lib/utils"
import {
  LayoutDashboard,
  Box,
  Package,
  ShoppingCart,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Plus,
  Download,
  MessageSquare,
  Star,
  Tag,
} from "lucide-react"

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: string | number
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: "Categories", href: "/categories", icon: <Box className="h-5 w-5" /> },
  { label: "Products", href: "/products", icon: <Package className="h-5 w-5" /> },
  { label: "Orders", href: "/orders", icon: <ShoppingCart className="h-5 w-5" /> },
  { label: "Users", href: "/users", icon: <Users className="h-5 w-5" /> },
  { label: "Reviews", href: "/reviews", icon: <Star className="h-5 w-5" /> },
  { label: "Analytics", href: "/analytics", icon: <BarChart3 className="h-5 w-5" /> },
  { label: "Coupons", href: "/coupons", icon: <Tag className="h-5 w-5" /> },
  { label: "Support", href: "/support", icon: <MessageSquare className="h-5 w-5" /> },
  { label: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" /> },
]

export function Sidebar({ isCollapsed, onToggle }: { isCollapsed: boolean; onToggle: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()

  const handleAddProduct = () => {
    navigate("/products?action=create")
  }

  const handleAddCategory = () => {
    navigate("/categories?action=create")
  }

  const handleExport = () => {
    // Create a simple CSV export of current page data
    const csvData = "Type,Action,Timestamp\nExport,Dashboard,\"" + new Date().toLocaleString("en-IN") + "\""
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `export_${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleSettings = () => {
    navigate("/settings")
  }

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
            <BarChart3 className="h-5 w-5" />
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
                AdminPanel
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
                  {item.badge && !isCollapsed && (
                    <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary-foreground rounded-full">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </nav>

      <div className="p-4 border-t border-border">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-xs text-muted-foreground"
            >
              <p className="font-semibold text-foreground mb-2 text-xs uppercase tracking-wider">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleAddProduct}
                  className="p-2 rounded-lg bg-muted hover:bg-accent hover:text-foreground transition-colors text-left flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium text-xs">Product</span>
                </button>
                <button
                  onClick={handleAddCategory}
                  className="p-2 rounded-lg bg-muted hover:bg-accent hover:text-foreground transition-colors text-left flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium text-xs">Category</span>
                </button>
                <button
                  onClick={handleExport}
                  className="p-2 rounded-lg bg-muted hover:bg-accent hover:text-foreground transition-colors text-left flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5 text-green-500" />
                  <span className="font-medium text-xs">Export</span>
                </button>
                <button
                  onClick={handleSettings}
                  className="p-2 rounded-lg bg-muted hover:bg-accent hover:text-foreground transition-colors text-left flex items-center gap-1.5"
                >
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium text-xs">Settings</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  )
}