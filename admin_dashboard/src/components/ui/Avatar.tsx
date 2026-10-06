import { forwardRef, HTMLAttributes, ImgHTMLAttributes, Children, cloneElement, ReactElement } from "react"
import { cn } from "../../lib/utils"
import { getInitials } from "../../lib/utils"

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null
  alt?: string
  fallback?: string
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl"
  shape?: "circle" | "square"
}

const sizeClasses = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
  "2xl": "h-24 w-24 text-xl",
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

interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  max?: number
  size?: AvatarProps["size"]
  children: React.ReactNode
}

export const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, max = 5, size = "md", children, ...props }, ref) => {
    const childArray = Children.toArray(children)
    const visibleChildren = childArray.slice(0, max)
    const remainingCount = childArray.length - max

    return (
      <div ref={ref} className={cn("flex -space-x-2", className)} {...props}>
        {visibleChildren.map((child, index) =>
          cloneElement(child as ReactElement, {
            className: cn(
              "border-2 border-background",
              "shadow-sm",
              index === visibleChildren.length - 1 && remainingCount > 0 && "z-10"
            ),
            size,
          })
        )}
        {remainingCount > 0 && (
          <div
            className={cn(
              "inline-flex items-center justify-center font-medium bg-muted text-muted-foreground border-2 border-background",
              "shadow-sm",
              sizeClasses[size],
              "rounded-full"
            )}
          >
            +{remainingCount}
          </div>
        )}
      </div>
    )
  }
)

AvatarGroup.displayName = "AvatarGroup"