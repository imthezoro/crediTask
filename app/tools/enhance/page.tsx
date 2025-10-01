import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getHeaderData } from '@/lib/header-utils'
import Header from '@/components/Header'
import EnhancePromptClient from './EnhancePromptClient'

// User enhance page is personalized content
export const dynamic = 'force-dynamic'

export default async function EnhancePromptPage() {
  const supabase = await createClient()
  const { user, isAdmin } = await getHeaderData()
  
  if (!user) {
    redirect('/auth/signin')
  }
  
  // Validate user profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('is_active')
    .eq('id', user.id)
    .single()
  
  if (profileError || !profile?.is_active) {
    redirect('/auth/signin?error=Account is not active')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Header user={user} isAdmin={isAdmin} pageTitle="Prompt Enhancer" />
      <div className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
        <EnhancePromptClient />
      </div>
    </div>
  )
}
