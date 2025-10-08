'use client'

import { Button } from '@/components/ui/button'
import { useSignOut } from '../hooks/use-sign-out'

interface LogoutButtonProps {
  className?: string
  variant?: 'default' | 'outline' | 'ghost' | 'link'
}

/**
 * Logout button component using useSignOut hook
 */
export function LogoutButton({ className, variant = 'ghost' }: LogoutButtonProps) {
  const signOutMutation = useSignOut()

  const handleSignOut = async () => {
    await signOutMutation.mutateAsync()
  }

  return (
    <Button
      onClick={handleSignOut}
      disabled={signOutMutation.isPending}
      variant={variant}
      className={className}
    >
      {signOutMutation.isPending ? 'Signing out...' : 'Sign out'}
    </Button>
  )
}
