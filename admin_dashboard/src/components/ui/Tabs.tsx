import { forwardRef, HTMLAttributes, useState, ReactNode, createContext, useContext, ButtonHTMLAttributes, MouseEventHandler } from "react"
import { cn } from "../../lib/utils"
import { motion } from "framer-motion"

type TabsVariant = "default" | "underline" | "pills"

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  variant: TabsVariant
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext() {
  const ctx = useContext(TabsContext)
  if (!ctx) {
    throw new Error("Tabs components must be used within a <Tabs>")
  }
  return ctx
}

interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  children: ReactNode
  variant?: TabsVariant
  className?: string
}

const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ defaultValue, value: controlledValue, onValueChange, children, variant = "default", className, ...props }, ref) => {
    const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "")
    const value = controlledValue ?? uncontrolled

    const handleValueChange = (newValue: string) => {
      if (controlledValue === undefined) {
        setUncontrolled(newValue)
      }
      onValueChange?.(newValue)
    }

    return (
      <TabsContext.Provider value={{ value, onValueChange: handleValueChange, variant }}>
        <div
          ref={ref}
          className={cn("flex flex-col gap-4", className)}
          {...props}
        >
          {children}
        </div>
      </TabsContext.Provider>
    )
  }
)

Tabs.displayName = "Tabs"

interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  variant?: TabsVariant
  children: ReactNode
}

const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ variant, children, className, ...props }, ref) => {
    const ctx = useTabsContext()
    const activeVariant = variant ?? ctx.variant

    return (
      <div
        ref={ref}
        role="tablist"
        aria-orientation="horizontal"
        className={cn(
          "flex gap-1",
          activeVariant === "default" && "bg-muted p-1 rounded-lg",
          activeVariant === "underline" && "border-b border-border",
          activeVariant === "pills" && "gap-2",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

TabsList.displayName = "TabsList"

interface TabTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
  children: ReactNode
}

const TabTrigger = forwardRef<HTMLButtonElement, TabTriggerProps>(
  ({ value, children, className, onClick, ...props }, ref) => {
    const { value: activeValue, onValueChange, variant } = useTabsContext()
    const isActiveTab = activeValue === value

    const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
      onClick?.(event)
      onValueChange(value)
    }

    const variants: Record<TabsVariant, string> = {
      default: cn(
        "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActiveTab
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-background/50",
        props.disabled && "opacity-50 pointer-events-none"
      ),
      underline: cn(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActiveTab
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50",
        props.disabled && "opacity-50 pointer-events-none"
      ),
      pills: cn(
        "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isActiveTab
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
        props.disabled && "opacity-50 pointer-events-none"
      ),
    }

    return (
      <button
        ref={ref}
        role="tab"
        aria-selected={isActiveTab}
        aria-controls={`panel-${value}`}
        id={`tab-${value}`}
        onClick={handleClick}
        disabled={props.disabled}
        className={cn(variants[variant], className)}
        {...props}
      >
        {children}
      </button>
    )
  }
)

TabTrigger.displayName = "TabTrigger"

interface TabContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string
  forceMount?: boolean
  children: ReactNode
  className?: string
}

const TabContent = forwardRef<HTMLDivElement, TabContentProps>(
  ({ value, forceMount, children, className, ...props }, ref) => {
    const { value: activeValue } = useTabsContext()
    const isActive = activeValue === value

    if (!forceMount && !isActive) {
      return null
    }

    return (
      <motion.div
        ref={ref}
        role="tabpanel"
        aria-labelledby={`tab-${value}`}
        id={`panel-${value}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={cn("animate-in fade-in-0 zoom-in-95 duration-200", className)}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)

TabContent.displayName = "TabContent"

export { Tabs, TabsList, TabTrigger, TabContent }
