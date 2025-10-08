import { createAdminClient } from '@/lib/supabase/server'
import { REACTIVATION_BLOCK } from '@/lib/auth-constants'

export interface SoftDeleteOptions {
  reason?: string
  blockDurationDays?: number
  performedBy?: string
  ipAddress?: string
  userAgent?: string
}

export class SoftDeleteService {
  private admin = createAdminClient()

  /**
   * Soft delete a user account by setting is_active=false and blocking email
   * This preserves data while preventing account access
   */
  async softDeleteUser(userId: string, options: SoftDeleteOptions = {}): Promise<{ success: boolean; blockedEmail: string }> {
    const {
      reason = 'Account deletion',
      blockDurationDays = REACTIVATION_BLOCK.hardDeleteDays,
      performedBy = 'system',
      ipAddress,
      userAgent
    } = options

    try {
      // Resolve user email from profile
      let userEmail: string | null = null
      const { data: profile } = await this.admin
        .from('user_profiles')
        .select('email, is_active')
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

      // Check if already soft deleted
      if (profile && !profile.is_active) {
        throw new Error('Account already deactivated')
      }

      // 1. Soft delete user profile (set is_active=false, deleted_at=now)
      const { error: updateError } = await this.admin
        .from('user_profiles')
        .update({
          is_active: false,
          deleted_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        console.error('Failed to soft delete user profile:', updateError)
        throw new Error('Failed to deactivate account')
      }

      // 2. Block email to prevent reuse
      await this.blockEmail(userEmail, blockDurationDays, reason)

      // 3. Revoke all active sessions (sign out user)
      await this.revokeUserSessions(userId)

      // 4. Log the deletion for audit
      await this.logDeletion(userId, userEmail, reason, performedBy, ipAddress, userAgent)

      return { success: true, blockedEmail: userEmail }

    } catch (error) {
      console.error('Soft delete failed:', error)
      throw error
    }
  }

  /**
   * Reactivate a soft-deleted account
   */
  async reactivateUser(userId: string): Promise<{ success: boolean }> {
    try {
      // Check if account is soft deleted
      const { data: profile } = await this.admin
        .from('user_profiles')
        .select('email, is_active, deleted_at')
        .eq('id', userId)
        .single()

      if (!profile) {
        throw new Error('User not found')
      }

      if (profile.is_active) {
        throw new Error('Account is already active')
      }

      if (!profile.deleted_at) {
        throw new Error('Account was not soft deleted')
      }

      // Reactivate the account
      const { error: updateError } = await this.admin
        .from('user_profiles')
        .update({
          is_active: true,
          deleted_at: null
        })
        .eq('id', userId)

      if (updateError) {
        console.error('Failed to reactivate user:', updateError)
        throw new Error('Failed to reactivate account')
      }

      // Remove email block if it exists
      if (profile.email) {
        await this.admin
          .from('blocked_emails')
          .delete()
          .eq('email', profile.email.toLowerCase())
      }

      return { success: true }

    } catch (error) {
      console.error('Reactivation failed:', error)
      throw error
    }
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
   * Revoke all user sessions to sign them out immediately
   */
  private async revokeUserSessions(userId: string) {
    try {
      // Sign out the user from all devices
      await this.admin.auth.admin.signOut(userId, 'global')
    } catch (error) {
      console.warn('Failed to revoke sessions:', error)
      // Non-critical - continue
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
          action: 'soft_delete',
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

  /**
   * Get soft deleted users (for admin purposes)
   */
  async getSoftDeletedUsers(limit: number = 100) {
    const { data, error } = await this.admin
      .from('user_profiles')
      .select('id, email, deleted_at, is_active')
      .eq('is_active', false)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Failed to fetch soft deleted users:', error)
      return []
    }

    return data || []
  }
}

export const softDeleteService = new SoftDeleteService()
