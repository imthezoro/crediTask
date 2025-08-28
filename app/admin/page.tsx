import { createClient, isUserAdmin } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

async function checkAdminAccess() {
  const supabase = await createClient()
  
  // Get the current user
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    redirect('/auth/signin')
  }
  
  // Check admin privileges
  if (!(await isUserAdmin(user.id))) {
    redirect('/dashboard')
  }
}

export default async function AdminPage() {
  await checkAdminAccess()
  
  // Redirect to admin dashboard
  redirect('/admin/dashboard')
}
