import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import type { User } from "../lib/types"
import { api } from "../lib/api"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: { name: string; email: string; password: string }) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const userData = await api.auth.me()
      setUser(userData)
    } catch {
      setUser(null)
      localStorage.removeItem("customer_token")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("customer_token")
    if (token) {
      refreshUser()
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const { user: userData, token } = await api.auth.login(email, password)
    localStorage.setItem("customer_token", token)
    setUser(userData)
  }

  // Register creates the account only; the customer is sent to the Login page
  // afterwards and signs in with the same credentials (no auto-login).
  const register = async (data: { name: string; email: string; password: string }) => {
    await api.auth.register(data)
  }

  const logout = () => {
    localStorage.removeItem("customer_token")
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
