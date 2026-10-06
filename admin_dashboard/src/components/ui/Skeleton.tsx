import { forwardRef, HTMLAttributes } from "react"
import { cn } from "../../lib/utils"

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular"
  width?: string | number
  height?: string | number
  animation?: "pulse" | "wave" | "none"
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = "text", width, height, animation = "pulse", ...props }, ref) => {
    const baseStyles = "bg-muted overflow-hidden"

    const variants = {
      text: "rounded h-4 w-full",
      circular: "rounded-full",
      rectangular: "rounded-lg",
    }

    const animations = {
      pulse: "animate-pulse",
      wave: "animate-[shimmer_2s_infinite] relative overflow-hidden",
      none: "",
    }

    const waveStyle = animation === "wave" ? {
      position: "relative",
      overflow: "hidden",
    } : {}

    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          animations[animation],
          className
        )}
        style={{
          width,
          height: variant === "text" ? undefined : height,
          ...waveStyle,
        } as React.CSSProperties}
        {...props}
      >
        {animation === "wave" && (
          <div
            className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
            }}
          />
        )}
      </div>
    )
  }
)

Skeleton.displayName = "Skeleton"

interface SkeletonCardProps {
  variant?: "default" | "compact"
  className?: string
}

export function SkeletonCard({ variant = "default", className }: SkeletonCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-6 space-y-4", className)}>
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="space-y-2 flex-1">
          <Skeleton variant="text" width="40%" />
          <Skeleton variant="text" width="30%" />
        </div>
      </div>
      {variant === "default" && (
        <div className="space-y-3">
          <Skeleton variant="rectangular" height={120} />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton variant="text" />
            <Skeleton variant="text" />
            <Skeleton variant="text" />
          </div>
        </div>
      )}
    </div>
  )
}

interface SkeletonTableProps {
  rows?: number
  columns?: number
  className?: string
}

export function SkeletonTable({ rows = 5, columns = 5, className }: SkeletonTableProps) {
  return (
    <div className={cn("rounded-lg border border-border overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="p-4 text-left">
                  <Skeleton variant="text" width="80%" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="p-4">
                    <Skeleton variant="text" width="60%" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface SkeletonChartProps {
  height?: number
  className?: string
}

export function SkeletonChart({ height = 300, className }: SkeletonChartProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-6", className)} style={{ height }}>
      <div className="h-full flex items-end justify-center gap-4 p-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            width={30}
            height={`${Math.random() * 80 + 20}%`}
            animation="wave"
            className="rounded-t"
          />
        ))}
      </div>
    </div>
  )
}
