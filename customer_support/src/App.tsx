import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { AnimatePresence } from "framer-motion"
import { Toaster } from "@/components/ui/Toast"
import { AuthProvider, useAuth } from "@/context/AuthContext"
import { Layout } from "@/components/layout"
import { queryClient } from "@/lib/queryClient"
import { Login } from "@/pages/Login/Login"
import { ForgotPassword } from "@/pages/Login/ForgotPassword"
import { Register } from "@/pages/Register/Register"
import { Dashboard } from "@/pages/Dashboard/Dashboard"
import { Support } from "@/pages/Support/Support"
import { CreateSupport } from "@/pages/Support/CreateSupport"
import { OrderDetails } from "@/pages/Orders/OrderDetails"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <h2 className="text-2xl font-display font-bold text-foreground mb-2">{title}</h2>
      <p>This page is coming soon.</p>
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="orders/:id" element={<OrderDetails />} />
        <Route path="support" element={<Support />} />
        <Route path="support/create" element={<CreateSupport />} />
        <Route path="profile" element={<PlaceholderPage title="Profile" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AnimatePresence mode="wait">
            <AppRoutes />
          </AnimatePresence>
          <Toaster />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
