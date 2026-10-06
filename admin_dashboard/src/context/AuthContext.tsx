import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import type { User } from "../lib/types"
import { api } from "../lib/api"
import { queryClient } from "../lib/queryClient"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
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
      localStorage.removeItem("admin_token")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("admin_token")
    if (token) {
      refreshUser()
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const { user: userData, token } = await api.auth.login(email, password)
    localStorage.setItem("admin_token", token)
    setUser(userData)
    queryClient.invalidateQueries()
  }

  const logout = async () => {
    try {
      await api.auth.logout()
    } catch {
    } finally {
      localStorage.removeItem("admin_token")
      setUser(null)
      queryClient.clear()
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
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