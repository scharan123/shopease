"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, Check } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./Button"

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectTriggerProps {
  value?: string
  placeholder?: string
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  className?: string
  children: React.ReactNode
}

interface SelectContentProps {
  children: React.ReactNode
  position?: "popper" | "item-aligned"
  sideOffset?: number
  className?: string
}

interface SelectItemProps {
  value: string
  disabled?: boolean
  className?: string
  children: React.ReactNode
}

interface SelectValueProps {
  placeholder?: string
  children?: React.ReactNode
}

const SelectContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  triggerRef: React.RefObject<HTMLButtonElement>
  contentRef: React.RefObject<HTMLDivElement>
  open: boolean
  setOpen: (open: boolean) => void
} | null>(null)

function useSelectContext() {
  const context = React.useContext(SelectContext)
  if (!context) {
    throw new Error("Select components must be used within Select")
  }
  return context
}

export function Select({ children }: { children: React.ReactNode }) {
  const [value, setValue] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)

  const onValueChange = React.useCallback((newValue: string) => {
    setValue(newValue)
    setOpen(false)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  return (
    <SelectContext.Provider value={{ value, onValueChange, disabled: false, triggerRef, contentRef, open, setOpen }}>
      <div className="relative inline-block w-full" onKeyDown={handleKeyDown}>
        {children}
      </div>
    </SelectContext.Provider>
  )
}

export function SelectTrigger({ 
  value, 
  placeholder, 
  onOpenChange, 
  disabled, 
  className, 
  children 
}: SelectTriggerProps) {
  const { value: contextValue, onValueChange, triggerRef, setOpen, open } = useSelectContext()
  const displayValue = value || contextValue

  const handleClick = () => {
    if (disabled) return
    const newOpen = !open
    setOpen(newOpen)
    onOpenChange?.(newOpen)
  }

  return (
    <Button
      ref={triggerRef}
      type="button"
      variant="outline"
      onClick={handleClick}
      disabled={disabled}
      className={cn("w-full justify-between", className)}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-disabled={disabled}
    >
      <span className={cn("truncate flex-1", !displayValue && "text-muted-foreground")}>
        {displayValue ? children : (placeholder || "Select...")}
      </span>
      {open ? <ChevronUp className="h-4 w-4 flex-shrink-0 ml-2" /> : <ChevronDown className="h-4 w-4 flex-shrink-0 ml-2" />}
    </Button>
  )
}

export function SelectContent({ children, className, position = "popper", sideOffset = 4 }: SelectContentProps) {
  const { open, contentRef, setOpen, value, onValueChange } = useSelectContext()

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open, setOpen, contentRef])

  if (!open) return null

  return (
    <div
      ref={contentRef}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95 duration-200",
        className
      )}
      style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: sideOffset }}
      role="listbox"
      aria-orientation="vertical"
    >
      <div className="max-h-[300px] overflow-y-auto p-1">
        {children}
      </div>
    </div>
  )
}

export function SelectItem({ value, disabled, className, children }: SelectItemProps) {
  const { value: currentValue, onValueChange, disabled: contextDisabled, setOpen } = useSelectContext()
  const isSelected = currentValue === value
  const isDisabled = disabled || contextDisabled

  const handleClick = () => {
    if (!isDisabled) {
      onValueChange(value)
      setOpen(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={isDisabled}
      role="option"
      aria-selected={isSelected}
      aria-disabled={isDisabled}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        isSelected && "bg-accent text-accent-foreground",
        isDisabled && "opacity-50",
        className
      )}
      tabIndex={-1}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && <Check className="h-4 w-4" />}
      </span>
      <span className="truncate">{children}</span>
    </button>
  )
}

export function SelectValue({ placeholder, children }: SelectValueProps) {
  const { value } = useSelectContext()
  return (
    <span className={cn("truncate", !value && "text-muted-foreground")}>
      {value ? children : (placeholder || "Select...")}
    </span>
  )
}

Select.displayName = "Select"
SelectTrigger.displayName = "SelectTrigger"
SelectContent.displayName = "SelectContent"
SelectItem.displayName = "SelectItem"
SelectValue.displayName = "SelectValue"