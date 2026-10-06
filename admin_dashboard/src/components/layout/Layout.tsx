import { useState, ReactNode } from "react"
import { Outlet } from "react-router-dom"
import { motion } from "framer-motion"
import { cn } from "../../lib/utils"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"

export function Layout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed)
  }

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={toggleSidebar}
      />
      
      <Header
        onMenuClick={handleMobileMenuToggle}
        isSidebarCollapsed={isSidebarCollapsed}
      />

      <main
        className={cn(
          "pt-16 min-h-screen transition-all duration-300",
          "lg:pl-64",
          isSidebarCollapsed ? "lg:pl-18" : "",
          isMobileMenuOpen ? "lg:pl-64" : ""
        )}
        role="main"
      >
        <div className="p-4 lg:p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="animate-in fade-in slide-in-from-bottom-4 duration-300"
          >
            <Outlet />
          </motion.div>
        </div>
      </main>

      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-35 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export function PageLayout({ children, title, description, actions }: {
  children: ReactNode
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2">{actions}</div>
        )}
      </div>
      {children}
    </div>
  )
}

export function Section({ title, description, children, action }: {
  title?: string
  description?: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}