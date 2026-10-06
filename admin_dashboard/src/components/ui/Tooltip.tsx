import { forwardRef, HTMLAttributes, useState, useRef, useEffect, ReactNode, Children, cloneElement, ReactElement } from "react"
import { cn } from "../../lib/utils"
import { motion, AnimatePresence } from "framer-motion"

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  delay?: number
  className?: string
}

export function Tooltip({ content, children, side = "top", align = "center", delay = 200, className }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const tooltipRef = useRef<HTMLDivElement>(null)
  const childRef = useRef<HTMLElement>(null)

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const sideClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }

  const alignClasses = {
    start: side === "top" || side === "bottom" ? "-translate-x-0 left-0" : "-translate-y-0 top-0",
    center: side === "top" || side === "bottom" ? "-translate-x-1/2 left-1/2" : "-translate-y-1/2 top-1/2",
    end: side === "top" || side === "bottom" ? "-translate-x-full right-0" : "-translate-y-full bottom-0",
  }

  const arrowClasses = {
    top: "border-t-background",
    bottom: "border-b-background",
    left: "border-l-background",
    right: "border-r-background",
  }

  const child = Children.only(children)

  return (
    <div
      ref={childRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      className="relative inline-block"
    >
      {cloneElement(child as ReactElement, {
        ref: childRef,
        "aria-describedby": isVisible ? "tooltip-content" : undefined,
      })}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.9, y: side === "top" ? 4 : side === "bottom" ? -4 : 0, x: side === "left" ? 4 : side === "right" ? -4 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: side === "top" ? 4 : side === "bottom" ? -4 : 0, x: side === "left" ? 4 : side === "right" ? -4 : 0 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "fixed z-50 pointer-events-none",
              sideClasses[side],
              alignClasses[align],
              className
            )}
            id="tooltip-content"
            role="tooltip"
          >
            <div className={cn(
              "bg-popover text-popover-foreground text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg",
              "whitespace-nowrap max-w-[200px] truncate"
            )}>
              {content}
            </div>
            <div
              className={cn(
                "absolute w-0 h-0 border-4 border-transparent",
                side === "top" && "top-full border-t-background",
                side === "bottom" && "bottom-full border-b-background",
                side === "left" && "left-full border-l-background",
                side === "right" && "right-full border-r-background",
                "left-1/2 -translate-x-1/2",
                side === "left" || side === "right" ? "top-1/2 -translate-y-1/2 left-auto right-auto" : ""
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}

export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
    <div
      ref={ref}
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn(
        "bg-border",
        orientation === "horizontal" ? "h-px w-full" : "w-px h-full",
        className
      )}
      {...props}
    />
  )
)

Separator.displayName = "Separator"