"use client"

import { Toaster as SonnerToaster, toast, type ToastOptions } from "sonner"
import { cn } from "../../lib/utils"

type ToastType = "default" | "success" | "error" | "warning" | "info"

interface ToastConfig extends ToastOptions {
  type?: ToastType
}

const toastStyles = {
  default: "bg-background text-foreground border-border",
  success: "bg-green-50 text-green-900 border-green-200 dark:bg-green-900/30 dark:text-green-100 dark:border-green-800",
  error: "bg-red-50 text-red-900 border-red-200 dark:bg-red-900/30 dark:text-red-100 dark:border-red-800",
  warning: "bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-100 dark:border-yellow-800",
  info: "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/30 dark:text-blue-100 dark:border-blue-800",
}

export function useToast() {
  const showToast = (message: string, config: ToastConfig = {}) => {
    const { type = "default", ...options } = config

    const baseOptions: ToastOptions = {
      className: cn("border", toastStyles[type]),
      description: options.description,
      duration: options.duration ?? (type === "error" ? 6000 : 4000),
      position: "top-right",
      closeButton: true,
      richColors: true,
      ...options,
    }

    switch (type) {
      case "success":
        return toast.success(message, baseOptions)
      case "error":
        return toast.error(message, baseOptions)
      case "warning":
        return toast.warning(message, baseOptions)
      case "info":
        return toast.info(message, baseOptions)
      default:
        return toast(message, baseOptions)
    }
  }

  return {
    toast: showToast,
    success: (message: string, options?: ToastOptions) => showToast(message, { ...options, type: "success" }),
    error: (message: string, options?: ToastOptions) => showToast(message, { ...options, type: "error" }),
    warning: (message: string, options?: ToastOptions) => showToast(message, { ...options, type: "warning" }),
    info: (message: string, options?: ToastOptions) => showToast(message, { ...options, type: "info" }),
    dismiss: toast.dismiss,
    dismissAll: toast.dismissAll,
  }
}

export function Toaster() {
  return (
    <SonnerToaster
      theme="system"
      className="toaster-group"
      toastOptions={{
        className: "border",
        style: {
          background: "var(--popover)",
          color: "var(--popover-foreground)",
          borderColor: "var(--border)",
        },
        success: {
          iconTheme: {
            primary: "var(--ring)",
            secondary: "var(--primary-foreground)",
          },
        },
        error: {
          iconTheme: {
            primary: "var(--destructive)",
            secondary: "var(--destructive-foreground)",
          },
        },
      }}
    />
  )
}

export { toast }
