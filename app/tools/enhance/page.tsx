import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getHeaderData } from '@/lib/header-utils'
import EnhancePromptClientWrapper from './EnhancePromptClientWrapper'

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

  return <EnhancePromptClientWrapper user={user} isAdmin={isAdmin} />
}
