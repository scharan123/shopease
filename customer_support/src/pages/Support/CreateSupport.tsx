import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Send, Loader2, Mail, Phone, User, MessageSquare } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { PageLayout } from "@/components/layout"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input, Textarea, Select } from "@/components/ui/Input"
import { toast } from "@/components/ui/Toast"
import { api } from "@/lib/api"
import { SUPPORT_TYPES } from "@/lib/types"

export function CreateSupport() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    support_type: "",
    description: "",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const createMutation = useMutation({
    mutationFn: api.support.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["customer-support"] })
      queryClient.invalidateQueries({ queryKey: ["customer-support-stats"] })
      queryClient.invalidateQueries({ queryKey: ["customer-notifications"] })
      toast.success(`Support request created! ID: ${data.support_id}`)
      navigate("/support")
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create support request")
    },
  })

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!form.name.trim()) newErrors.name = "Name is required"
    if (!form.email.trim()) newErrors.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = "Invalid email address"
    if (!form.mobile.trim()) newErrors.mobile = "Mobile number is required"
    else if (!/^[0-9+\-\s]{10,15}$/.test(form.mobile.replace(/\s/g, ""))) newErrors.mobile = "Invalid mobile number"
    if (!form.support_type) newErrors.support_type = "Please select a support type"
    if (!form.description.trim()) newErrors.description = "Description is required"
    else if (form.description.trim().length < 10) newErrors.description = "Description must be at least 10 characters"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    createMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      mobile: form.mobile.trim(),
      support_type: form.support_type,
      description: form.description.trim(),
    })
  }

  return (
    <PageLayout
      title="Create Support Request"
      description="Describe your issue and our team will assist you"
      actions={
        <Button variant="outline" onClick={() => navigate("/support")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Support
        </Button>
      }
    >
      <div className="max-w-2xl">
        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Enter your full name"
                    className={cn(
                      "flex h-10 w-full rounded-lg border bg-background pl-10 pr-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors hover:border-primary/50",
                      errors.name ? "border-destructive focus-visible:ring-destructive" : "border-input"
                    )}
                  />
                </div>
                {errors.name && <p className="mt-1.5 text-sm text-destructive">{errors.name}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Enter your email address"
                    className={cn(
                      "flex h-10 w-full rounded-lg border bg-background pl-10 pr-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors hover:border-primary/50",
                      errors.email ? "border-destructive focus-visible:ring-destructive" : "border-input"
                    )}
                  />
                </div>
                {errors.email && <p className="mt-1.5 text-sm text-destructive">{errors.email}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="mobile" className="block text-sm font-medium text-foreground mb-1.5">
                  Mobile Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    id="mobile"
                    type="tel"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    placeholder="Enter your mobile number"
                    className={cn(
                      "flex h-10 w-full rounded-lg border bg-background pl-10 pr-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors hover:border-primary/50",
                      errors.mobile ? "border-destructive focus-visible:ring-destructive" : "border-input"
                    )}
                  />
                </div>
                {errors.mobile && <p className="mt-1.5 text-sm text-destructive">{errors.mobile}</p>}
              </div>

              <div>
                <Select
                  label="Support Type"
                  value={form.support_type}
                  onChange={(v) => setForm({ ...form, support_type: v })}
                  options={SUPPORT_TYPES.map(t => ({ value: t.value, label: t.label }))}
                  placeholder="Select support type"
                  error={errors.support_type}
                />
              </div>
            </div>

            <div>
              <Textarea
                label="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe your issue in detail..."
                rows={5}
                error={errors.description}
                className="min-h-[120px]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/support")}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="gap-2"
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {createMutation.isPending ? "Sending..." : "Send Message"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </PageLayout>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
