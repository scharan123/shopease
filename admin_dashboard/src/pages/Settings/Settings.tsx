import { useState, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { cn } from "lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "ui/Card"
import { Button } from "ui/Button"
import { Input } from "ui/Input"
import { Switch } from "ui/Checkbox"
import { Avatar } from "ui/Avatar"
import { Tabs, TabsList, TabTrigger, TabContent } from "ui/Tabs"
import { useAuth } from "context/AuthContext"
import { api } from "lib/api"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  User,
  Mail,
  Lock,
  Bell,
  Moon,
  Sun,
  Monitor,
  Save,
  Camera,
  CheckCircle,
  XCircle,
} from "lucide-react"

export function Settings() {
  const { user, logout, refreshUser } = useAuth()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState("profile")
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [profileSaved, setProfileSaved] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [profileError, setProfileError] = useState("")
  const [passwordError, setPasswordError] = useState("")

  // Profile form state — fully controlled
  const [profileForm, setProfileForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
  })

  // Password form state — fully controlled
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  // Notification preferences state
  const [notifForm, setNotifForm] = useState({
    emailOrders: true,
    emailMarketing: false,
    emailSecurity: true,
    pushOrders: true,
    pushMarketing: false,
  })

  // Appearance state
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark" | "system">(() => {
    return (localStorage.getItem("theme") as "light" | "dark" | "system") || "system"
  })
  const [compactMode, setCompactMode] = useState(false)

  // ── Avatar Upload ──────────────────────────────────────────────
  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setProfileError("Image size must be less than 5MB")
      return
    }
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setAvatarPreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
    setProfileError("")
  }

  // ── Save Profile Mutation ──────────────────────────────────────
  const profileMutation = useMutation({
    mutationFn: (data: { name: string; email: string }) =>
      api.auth.updateProfile({ name: data.name, email: data.email }),
    onSuccess: async () => {
      setProfileSaved(true)
      setProfileError("")
      setAvatarFile(null)
      setAvatarPreview(null)
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] })
      await refreshUser()
      setTimeout(() => setProfileSaved(false), 3000)
    },
    onError: (err: unknown) => {
      setProfileError((err as { message?: string })?.message || "Failed to save profile. Please try again.")
    },
  })

  // ── Save Password Mutation ─────────────────────────────────────
  const passwordMutation = useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      api.auth.changePassword({ current_password: data.current_password, new_password: data.new_password }),
    onSuccess: () => {
      setPasswordSaved(true)
      setPasswordError("")
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
      setTimeout(() => setPasswordSaved(false), 3000)
    },
    onError: (err: unknown) => {
      setPasswordError((err as { message?: string })?.message || "Failed to update password. Check your current password and try again.")
    },
  })

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!profileForm.name.trim()) {
      setProfileError("Name is required")
      return
    }
    if (!profileForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email)) {
      setProfileError("Please enter a valid email address")
      return
    }
    profileMutation.mutate({ name: profileForm.name, email: profileForm.email })
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordForm.currentPassword) {
      setPasswordError("Current password is required")
      return
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters")
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match")
      return
    }
    passwordMutation.mutate({
      current_password: passwordForm.currentPassword,
      new_password: passwordForm.newPassword,
    })
  }

  const handleThemeChange = (theme: "light" | "dark" | "system") => {
    setCurrentTheme(theme)
    localStorage.setItem("theme", theme)
    if (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }

  const avatarSrc = avatarPreview ||
    (user?.email ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}` : undefined)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabTrigger value="profile">Profile</TabTrigger>
          <TabTrigger value="notifications">Notifications</TabTrigger>
          <TabTrigger value="appearance">Appearance</TabTrigger>
        </TabsList>

        {/* ── PROFILE TAB ──────────────────────────────────────── */}
        <TabContent value="profile" className="space-y-6 pt-6">

          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleProfileSubmit} className="space-y-6 max-w-2xl">

                {/* Avatar Upload */}
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <Avatar
                      size="2xl"
                      fallback={profileForm.name || user?.name || "U"}
                      src={avatarSrc}
                      className="ring-4 ring-border"
                    />
                    <button
                      type="button"
                      onClick={handleAvatarClick}
                      className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Change avatar"
                    >
                      <Camera className="h-6 w-6 text-white" />
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <div>
                    <h4 className="font-semibold">Profile Picture</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload your own photo — PNG, JPG or WebP · Max 5MB
                    </p>
                    <Button type="button" variant="outline" onClick={handleAvatarClick}>
                      <Camera className="h-4 w-4" />
                      {avatarPreview ? "Change Photo" : "Upload Photo"}
                    </Button>
                    {avatarPreview && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" />
                        New photo ready — save to apply
                      </p>
                    )}
                  </div>
                </div>

                {/* Name & Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Full Name"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    placeholder="Enter your name"
                    required
                    leftIcon={<User className="h-4 w-4" />}
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    placeholder="Enter your email"
                    required
                    leftIcon={<Mail className="h-4 w-4" />}
                  />
                </div>

                {/* Error / Success feedback */}
                {profileError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    <XCircle className="h-4 w-4 flex-shrink-0" />
                    {profileError}
                  </div>
                )}
                {profileSaved && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    Profile saved successfully!
                  </div>
                )}

                <div className="flex justify-end pt-2 border-t border-border">
                  <Button type="submit" isLoading={profileMutation.isPending}>
                    <Save className="h-4 w-4" />
                    Save Profile
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Current Password"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    placeholder="Enter current password"
                    leftIcon={<Lock className="h-4 w-4" />}
                  />
                  <Input
                    label="New Password"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Min 8 characters"
                    leftIcon={<Lock className="h-4 w-4" />}
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Confirm new password"
                    leftIcon={<Lock className="h-4 w-4" />}
                  />
                </div>

                {/* Password strength hint */}
                {passwordForm.newPassword && (
                  <div className="text-xs text-muted-foreground">
                    Password strength:{" "}
                    <span className={cn(
                      "font-medium",
                      passwordForm.newPassword.length < 8 ? "text-red-500" :
                      passwordForm.newPassword.length < 12 ? "text-yellow-500" : "text-green-500"
                    )}>
                      {passwordForm.newPassword.length < 8 ? "Weak" :
                       passwordForm.newPassword.length < 12 ? "Fair" : "Strong"}
                    </span>
                  </div>
                )}

                {/* Error / Success feedback */}
                {passwordError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    <XCircle className="h-4 w-4 flex-shrink-0" />
                    {passwordError}
                  </div>
                )}
                {passwordSaved && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                    Password updated successfully!
                  </div>
                )}

                <div className="flex justify-end pt-2 border-t border-border">
                  <Button type="submit" isLoading={passwordMutation.isPending}>
                    <Lock className="h-4 w-4" />
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabContent>

        {/* ── NOTIFICATIONS TAB ────────────────────────────────── */}
        <TabContent value="notifications" className="space-y-6 pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "emailOrders" as const, label: "Order Updates", description: "Receive emails for order confirmations, shipping updates, and delivery" },
                { key: "emailMarketing" as const, label: "Marketing Emails", description: "Get notified about sales, new products, and promotions" },
                { key: "emailSecurity" as const, label: "Security Alerts", description: "Get notified about login attempts and account changes" },
              ].map((item) => (
                <Switch
                  key={item.key}
                  id={item.key}
                  checked={notifForm[item.key]}
                  onChange={(checked) => setNotifForm({ ...notifForm, [item.key]: checked })}
                  label={item.label}
                  description={item.description}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Push Notifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "pushOrders" as const, label: "Order Updates", description: "Receive push notifications for order status changes" },
                { key: "pushMarketing" as const, label: "Marketing", description: "Get push notifications for sales and promotions" },
              ].map((item) => (
                <Switch
                  key={item.key}
                  id={item.key}
                  checked={notifForm[item.key]}
                  onChange={(checked) => setNotifForm({ ...notifForm, [item.key]: checked })}
                  label={item.label}
                  description={item.description}
                />
              ))}
            </CardContent>
          </Card>
        </TabContent>

        {/* ── APPEARANCE TAB ───────────────────────────────────── */}
        <TabContent value="appearance" className="space-y-6 pt-6">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { value: "light" as const, label: "Light", icon: <Sun className="h-5 w-5" />, description: "Always use light mode" },
                { value: "dark" as const, label: "Dark", icon: <Moon className="h-5 w-5" />, description: "Always use dark mode" },
                { value: "system" as const, label: "System", icon: <Monitor className="h-5 w-5" />, description: "Match your system preference" },
              ].map((theme) => (
                <label
                  key={theme.value}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all",
                    currentTheme === theme.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  )}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={theme.value}
                    checked={currentTheme === theme.value}
                    onChange={() => handleThemeChange(theme.value)}
                    className="sr-only"
                  />
                  <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", currentTheme === theme.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {theme.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{theme.label}</p>
                    <p className="text-sm text-muted-foreground">{theme.description}</p>
                  </div>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Display</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Switch
                id="compactMode"
                checked={compactMode}
                onChange={setCompactMode}
                label="Compact Mode"
                description="Reduce spacing and padding for more content on screen"
              />
            </CardContent>
          </Card>
        </TabContent>
      </Tabs>
    </div>
  )
}
