import { forwardRef, HTMLAttributes } from "react"
import { cn } from "../../lib/utils"

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
  size?: "default" | "sm" | "lg"
  dot?: boolean
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", size = "default", dot, children, ...props }, ref) => {
    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary/80",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/80",
      outline: "text-foreground border border-border",
      success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    }

    const sizes = {
      default: "px-2.5 py-0.5 text-xs",
      sm: "px-2 py-0.5 text-[10px]",
      lg: "px-3 py-1 text-sm",
    }

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 font-medium rounded-full",
          "transition-colors duration-200",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              "relative flex h-1.5 w-1.5 rounded-full",
              variant === "default" && "bg-primary-foreground",
              variant === "secondary" && "bg-secondary-foreground",
              variant === "destructive" && "bg-destructive-foreground",
              variant === "outline" && "bg-foreground",
              variant === "success" && "bg-green-500",
              variant === "warning" && "bg-yellow-500",
              variant === "info" && "bg-blue-500"
            )}
          />
        )}
        {children}
      </span>
    )
  }
)

Badge.displayName = "Badge"

export { Badge }
