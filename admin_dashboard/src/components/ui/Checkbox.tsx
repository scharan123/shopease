import { forwardRef, LabelHTMLAttributes } from "react"
import { cn } from "../../lib/utils"

interface CheckboxProps extends LabelHTMLAttributes<HTMLLabelElement> {
  checked?: boolean
  onChange?: (checked: boolean) => void
  id: string
  label: string
  description?: string
  disabled?: boolean
}

export const Checkbox = forwardRef<HTMLLabelElement, CheckboxProps>(
  ({ className, checked, onChange, id, label, description, disabled, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "flex items-start gap-3 cursor-pointer select-none",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        {...props}
      >
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => !disabled && onChange?.(e.target.checked)}
          disabled={disabled}
          className={cn(
            "mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2",
            "disabled:opacity-50 transition-colors duration-200",
            "border-input bg-background"
          )}
          aria-describedby={description ? `${id}-desc` : undefined}
        />
        <div className="text-sm leading-5">
          <span className="font-medium text-foreground">{label}</span>
          {description && (
            <p id={`${id}-desc`} className="text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
        </div>
      </label>
    )
  }
)

Checkbox.displayName = "Checkbox"

interface SwitchProps extends Omit<CheckboxProps, "label" | "description"> {
  label: string
  description?: string
}

export const Switch = forwardRef<HTMLLabelElement, SwitchProps>(
  ({ className, checked, onChange, id, label, description, disabled, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "flex items-center gap-3 cursor-pointer select-none",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        {...props}
      >
        <span
          className={cn(
            "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border-2 border-transparent",
            "transition-colors duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            checked ? "bg-primary" : "bg-input"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white shadow",
              "transition-transform duration-200 ease-in-out",
              checked ? "translate-x-5" : "translate-x-0"
            )}
            aria-hidden="true"
          />
        </span>
        <div className="text-sm leading-5">
          <span className="font-medium text-foreground">{label}</span>
          {description && (
            <p id={`${id}-desc`} className="text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
        </div>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => !disabled && onChange?.(e.target.checked)}
          disabled={disabled}
          className="sr-only"
          aria-describedby={description ? `${id}-desc` : undefined}
        />
      </label>
    )
  }
)

Switch.displayName = "Switch"