import { forwardRef, HTMLAttributes } from "react"
import { cn } from "../../lib/utils"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "elevated"
  padding?: "none" | "sm" | "md" | "lg"
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", padding = "md", children, ...props }, ref) => {
    const variants = {
      default: "bg-card text-card-foreground border border-border shadow-sm",
      glass: "bg-background/80 backdrop-blur-xl border border-border/50 shadow-xl",
      elevated: "bg-card text-card-foreground border border-border shadow-xl",
    }

    const paddings = {
      none: "",
      sm: "p-4",
      md: "p-6",
      lg: "p-8",
    }

    return (
      <div
        ref={ref}
        className={cn("rounded-xl", variants[variant], paddings[padding], className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = "Card"

export { Card }
