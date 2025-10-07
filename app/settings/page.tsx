import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DeleteAccountButton, ChangePasswordButton } from '@/features/auth'
import { getHeaderData } from '@/lib/header-utils'
import Header from '@/components/Header'

// User settings are personalized content
export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { user, isAdmin } = await getHeaderData()
  
  if (!user) {
    redirect('/auth/signin')
  }
  
  // Get user profile with optimized query (select only needed fields)
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('plan, usage_count, is_active')
    .eq('id', user.id)
    .single()
  
  if (profileError || !profile?.is_active) {
    redirect('/auth/signin?error=Account is not active')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} isAdmin={isAdmin} pageTitle="Settings" />

      <div className="container mx-auto px-4 py-8 pt-24 max-w-2xl">
        <div className="space-y-6">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>View your account details and current plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={user.email?.includes('@promptok.guest') ? 'Guest Account' : (user.email || '')}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="plan">Current Plan</Label>
                <Input
                  id="plan"
                  value={profile?.plan || 'Free'}
                  disabled
                  className="bg-muted capitalize"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="usage">Usage Count</Label>
                <Input
                  id="usage"
                  type="number"
                  value={profile?.usage_count || 0}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="pt-4">
                <Button asChild>
                  <Link href="/billing">
                    Manage Plan
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Account Actions</CardTitle>
              <CardDescription>Manage your account settings and data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <ChangePasswordButton 
                  userEmail={user.email || ''}
                  isGuest={Boolean(user.email?.includes('@promptok.guest'))}
                />
              </div>
              
              <div>
                <DeleteAccountButton 
                  userEmail={user.email || ''}
                  isGuest={Boolean(user.email?.includes('@promptok.guest'))}
                />
              </div>
            </CardContent>
          </Card>

          
        </div>
      </div>
    </div>
  )
}
