import { createAdminClient } from '@/lib/supabase-server'
import { REACTIVATION_BLOCK } from '@/lib/auth-constants'

export interface HardDeleteOptions {
  reason?: string
  blockDurationDays?: number
  performedBy?: string
  ipAddress?: string
  userAgent?: string
}

export class HardDeleteService {
  private admin = createAdminClient()

  /**
   * Completely deletes a user account and blocks the email
   */
  async hardDeleteUser(userId: string, options: HardDeleteOptions = {}): Promise<{ success: boolean; blockedEmail: string }> {
    const {
      reason = 'Account deletion',
      blockDurationDays = REACTIVATION_BLOCK.hardDeleteDays,
      performedBy = 'system',
      ipAddress,
      userAgent
    } = options

    try {
      // Resolve user email (prefer user_profiles.email, fallback to auth.users)
      let userEmail: string | null = null
      const { data: profile } = await this.admin
        .from('user_profiles')
        .select('email')
        .eq('id', userId)
        .single()
      userEmail = typeof profile?.email === 'string' ? profile.email.toLowerCase() : null

      if (!userEmail) {
        const { data: authUser } = await this.admin.auth.admin.getUserById(userId)
        userEmail = authUser?.user?.email?.toLowerCase() || null
      }

      if (!userEmail) {
        throw new Error('User not found or email missing')
      }

      // Start transaction-like operations
      const operations = []

      // 1. Delete from all user-related tables
      operations.push(
        this.deleteUserData(userId),
        this.blockEmail(userEmail, blockDurationDays, reason),
        this.deleteAuthUser(userId),
        this.logDeletion(userId, userEmail, reason, performedBy, ipAddress, userAgent)
      )

      await Promise.all(operations)

      return { success: true, blockedEmail: userEmail }

    } catch (error) {
      console.error('Hard delete failed:', error)
      throw error
    }
  }

  /**
   * Delete user data from specified tables only
   * Per requirements: only prompt_sessions and user_profiles
   */
  private async deleteUserData(userId: string) {
    // Delete in order to respect foreign key constraints
    const deletions = [
      // Delete prompt sessions first (has FK to user_profiles)
      this.admin.from('prompt_sessions').delete().eq('user_id', userId),
      
      // Delete user profile last
      this.admin.from('user_profiles').delete().eq('id', userId)
    ]

    const results = await Promise.allSettled(deletions)
    
    // Log any failures but don't stop the process
    results.forEach((result, index) => {
      const tableName = index === 0 ? 'prompt_sessions' : 'user_profiles'
      if (result.status === 'rejected') {
        console.warn(`Failed to delete from ${tableName}:`, result.reason)
      }
    })
  }

  /**
   * Block email with expiry time
   */
  private async blockEmail(email: string, blockDurationDays: number, reason: string) {
    const blockedUntil = new Date(Date.now() + blockDurationDays * 24 * 60 * 60 * 1000)

    const { error } = await this.admin
      .from('blocked_emails')
      .upsert({
        email,
        blocked_until: blockedUntil.toISOString(),
        reason,
        created_at: new Date().toISOString()
      }, { onConflict: 'email' })

    if (error) {
      console.error('Failed to block email:', error)
      throw new Error('Failed to block email')
    }
  }

  /**
   * Delete user from auth.users table
   */
  private async deleteAuthUser(userId: string) {
    try {
      // Hard delete from auth.users (true = actually delete the user record)
      const { error } = await this.admin.auth.admin.deleteUser(userId, true)
      
      if (error) {
        console.error('Failed to delete auth user:', error)
        throw new Error('Failed to delete user from auth system')
      }
    } catch (error) {
      console.error('Auth user deletion failed:', error)
      throw error
    }
  }

  /**
   * Log the deletion for audit purposes
   */
  private async logDeletion(
    userId: string,
    email: string,
    reason: string,
    performedBy: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      await this.admin
        .from('audit_logs')
        .insert({
          user_id: userId,
          action: 'hard_delete',
          details: {
            email,
            reason,
            performed_by: performedBy,
            ip_address: ipAddress,
            user_agent: userAgent,
            timestamp: new Date().toISOString()
          }
        })
    } catch (error) {
      console.warn('Failed to log deletion:', error)
      // Non-critical - continue
    }
  }

  /**
   * Check if an email is currently blocked
   */
  async isEmailBlocked(email: string): Promise<{ blocked: boolean; blockedUntil?: Date; reason?: string }> {
    const { data: blockedEmail } = await this.admin
      .from('blocked_emails')
      .select('blocked_until, reason')
      .eq('email', email.toLowerCase())
      .gt('blocked_until', new Date().toISOString())
      .single()

    if (blockedEmail) {
      return {
        blocked: true,
        blockedUntil: new Date(blockedEmail.blocked_until),
        reason: blockedEmail.reason
      }
    }

    return { blocked: false }
  }

  /**
   * Clean up expired email blocks
   */
  async cleanupExpiredBlocks() {
    const { error } = await this.admin
      .from('blocked_emails')
      .delete()
      .lt('blocked_until', new Date().toISOString())

    if (error) {
      console.warn('Failed to cleanup expired blocks:', error)
    }
  }
}

export const hardDeleteService = new HardDeleteService()
