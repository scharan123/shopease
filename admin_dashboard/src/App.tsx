import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { AnimatePresence } from "framer-motion"
import { Toaster } from "@/components/ui/Toast"
import { AuthProvider, useAuth } from "@/context/AuthContext"
import { Layout } from "@/components/layout"
import { queryClient } from "@/lib/queryClient"
import { Login } from "@/pages/Login"
import { Dashboard } from "@/pages/Dashboard/Dashboard"
import { Categories } from "@/pages/Categories/Categories"
import { Products } from "@/pages/Products/Products"
import { Orders } from "@/pages/Orders/Orders"
import { Users } from "@/pages/Users/Users"
import { Reviews } from "@/pages/Reviews/Reviews"
import { Analytics } from "@/pages/Analytics/Analytics"
import { Settings } from "@/pages/Settings/Settings"
import { Support } from "@/pages/Support/Support"
import { Coupons } from "@/pages/Coupons/Coupons"

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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="categories" element={<Categories />} />
        <Route path="products" element={<Products />} />
        <Route path="orders" element={<Orders />} />
        <Route path="users" element={<Users />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="support" element={<Support />} />
        <Route path="coupons" element={<Coupons />} />
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