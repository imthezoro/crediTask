import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId, userEmail, isGuest, requestedBy } = await req.json()

    // Validate required fields
    if (!userId || !userEmail || !requestedBy) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the requesting user matches the user to be deleted
    if (userId !== requestedBy) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Cannot delete another user\'s account' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get current timestamp
    const now = new Date().toISOString()
    
    // Calculate block expiration using env var ACCOUNT_BLOCK_DAYS (fallback 30)
    const defaultDays = 10
    const envDays = parseInt(Deno.env.get('ACCOUNT_BLOCK_DAYS') || '')
    const blockDays = Number.isFinite(envDays) && envDays > 0 ? envDays : defaultDays
    const blockUntil = new Date()
    blockUntil.setDate(blockUntil.getDate() + blockDays)
    const blockUntilISO = blockUntil.toISOString()

    console.log(`Soft deleting user: ${userId} (${userEmail})`)

    // Start transaction-like operations
    const operations: string[] = []

    // 1. Soft delete the user profile
    const { error: profileError } = await supabaseClient
      .from('user_profiles')
      .update({
        is_active: false,
        deleted_at: now,
        updated_at: now
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Profile update error:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to deactivate user profile' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    operations.push('Profile deactivated')

    // 2. Add email to blocked_emails table to prevent re-signup
    // Note: Table schema (migration 011) has only: email (pk), blocked_until, created_at
    if (!isGuest && userEmail && !userEmail.includes('@promptok.guest')) {
      const { error: blockError } = await supabaseClient
        .from('blocked_emails')
        .upsert({
          email: userEmail.toLowerCase(),
          blocked_until: blockUntilISO,
        }, { onConflict: 'email' })

      if (blockError) {
        console.error('Block email error:', blockError)
        // Don't fail the entire operation for this
        operations.push('Email blocking failed (non-critical)')
      } else {
        operations.push('Email blocked for 30 days')
      }
    } else {
      operations.push('Guest account - email blocking skipped')
    }

    // 3. Log the deletion for audit purposes
    const { error: logError } = await supabaseClient
      .from('audit_logs')
      .insert({
        user_id: userId,
        action: 'deletion',
        entity_type: 'user_profile',
        entity_id: userId,
        details: {
          deletion_method: 'user_requested',
          deleted_at: now,
          account_type: isGuest ? 'guest' : 'regular'
        },
        user_email: userEmail,
        is_guest: isGuest,
        performed_by: requestedBy,
        performed_at: now
      })

    if (logError) {
      console.error('Deletion log error:', logError)
      // Don't fail for logging errors
      operations.push('Audit logging failed (non-critical)')
    } else {
      operations.push('Deletion logged for audit')
    }

    // 4. Invalidate all user sessions (this will be handled by RLS policies)
    // The user will be automatically signed out when they try to access protected resources

    console.log(`User ${userId} successfully soft deleted. Operations: ${operations.join(', ')}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account has been successfully deactivated',
        operations,
        blocked_until: isGuest ? null : blockUntilISO,
        deleted_at: now
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Soft delete function error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
