import { forwardRef, HTMLAttributes } from "react"
import { cn } from "../../lib/utils"
import { getInitials } from "../../lib/utils"

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null
  alt?: string
  fallback?: string
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  shape?: "circle" | "square"
}

const sizeClasses = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
}

const shapeClasses = {
  circle: "rounded-full",
  square: "rounded-lg",
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, fallback, size = "md", shape = "circle", ...props }, ref) => {
    const [imageError, setImageError] = useState(false)

    if (src && !imageError) {
      return (
        <div
          ref={ref}
          className={cn("relative inline-flex shrink-0 overflow-hidden bg-muted", sizeClasses[size], shapeClasses[shape], className)}
          {...props}
        >
          <img
            src={src}
            alt={alt || fallback || "Avatar"}
            className="aspect-square h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium bg-primary text-primary-foreground",
          sizeClasses[size],
          shapeClasses[shape],
          className
        )}
        {...props}
      >
        {fallback ? getInitials(fallback) : "?"}
      </div>
    )
  }
)

import { useState } from "react"

Avatar.displayName = "Avatar"
