import { Fragment, ReactNode, useRef, useEffect, useState } from "react"
import { ChevronDown, Check } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "../../lib/utils"
import { Button } from "./Button"
import { Checkbox } from "./Checkbox"

interface DropdownItem {
  label: string
  onClick: () => void
  icon?: ReactNode
  disabled?: boolean
  danger?: boolean
  shortcut?: string
}

interface DropdownProps {
  trigger: ReactNode
  items: DropdownItem[]
  align?: "start" | "end"
  className?: string
}

export function Dropdown({ trigger, items, align = "end", className }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
          setIsOpen(false)
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleItemClick = (item: DropdownItem) => {
    if (!item.disabled) {
      item.onClick()
      setIsOpen(false)
    }
  }

  return (
    <div className={cn("relative inline-block", className)}>
      <div ref={triggerRef}>
        {typeof trigger === "function" ? trigger({ isOpen, onToggle: () => setIsOpen(!isOpen) }) : trigger}
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className={cn(
              "fixed z-50 mt-1.5 min-w-[180px] bg-popover border border-border rounded-lg shadow-lg",
              "py-1.5",
              align === "end" && "right-0",
              align === "start" && "left-0"
            )}
            role="menu"
            aria-orientation="vertical"
          >
            {items.map((item, index) => (
              <button
                key={item.label}
                onClick={() => handleItemClick(item)}
                disabled={item.disabled}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm text-popover-foreground",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:outline-none focus:bg-accent focus:text-accent-foreground",
                  "disabled:opacity-50 disabled:pointer-events-none",
                  "transition-colors duration-150",
                  item.danger && "text-destructive focus:text-destructive",
                  "relative"
                )}
                role="menuitem"
                tabIndex={-1}
                style={{ animationDelay: `${index * 0.02}s` }}
              >
                {item.icon && <span className="h-4 w-4 flex-shrink-0">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
                {item.shortcut && (
                  <kbd className="text-xs text-muted-foreground font-mono px-1.5 py-0.5 rounded bg-muted">
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface SelectDropdownProps {
  value: string
  onChange: (value: string) => void
  items: { value: string; label: string; icon?: ReactNode }[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function SelectDropdown({
  value,
  onChange,
  items,
  placeholder,
  disabled,
  className,
}: SelectDropdownProps) {
  const selectedItem = items.find((item) => item.value === value)

  return (
    <Dropdown
      className={className}
      trigger={({ isOpen, onToggle }) => (
        <Button
          ref={onToggle as unknown as React.Ref<HTMLButtonElement>}
          variant="outline"
          onClick={onToggle}
          disabled={disabled}
          className="w-full justify-between"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={cn("truncate", !selectedItem && "text-muted-foreground")}>
            {selectedItem?.label || placeholder || "Select..."}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 flex-shrink-0 ml-2 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
            aria-hidden="true"
          />
        </Button>
      )}
      items={items.map((item) => ({
        label: item.label,
        icon: item.icon,
        onClick: () => onChange(item.value),
      }))}
    />
  )
}

interface ActionDropdownProps {
  onEdit: () => void
  onDelete: () => void
  onView?: () => void
  onDuplicate?: () => void
  disabled?: boolean
  className?: string
}

export function ActionDropdown({
  onEdit,
  onDelete,
  onView,
  onDuplicate,
  disabled,
  className,
}: ActionDropdownProps) {
  const items: DropdownItem[] = [
    ...(onView ? [{ label: "View", onClick: onView, icon: <Eye className="h-4 w-4" /> }] : []),
    { label: "Edit", onClick: onEdit, icon: <Edit className="h-4 w-4" /> },
    ...(onDuplicate ? [{ label: "Duplicate", onClick: onDuplicate, icon: <Copy className="h-4 w-4" /> }] : []),
    { label: "Delete", onClick: onDelete, icon: <Trash2 className="h-4 w-4" />, danger: true },
  ]

  return (
    <Dropdown
      className={className}
      align="end"
      trigger={({ onToggle }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          disabled={disabled}
          aria-label="More actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      )}
      items={items}
    />
  )
}

import { Eye, Edit, Copy, Trash2, MoreHorizontal } from "lucide-react"