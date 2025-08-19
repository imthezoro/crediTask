import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get yesterday's date
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]

    // Get start and end of yesterday
    const startOfDay = new Date(dateStr + 'T00:00:00.000Z')
    const endOfDay = new Date(dateStr + 'T23:59:59.999Z')

    // Aggregate prompt sessions for yesterday
    const { data: promptSessions, error: promptError } = await supabase
      .from('prompt_sessions')
      .select('id, status')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())

    if (promptError) {
      throw new Error(`Failed to fetch prompt sessions: ${promptError.message}`)
    }

    const promptsProcessed = promptSessions?.length || 0
    const failedCalls = promptSessions?.filter(p => p.status === 'failed').length || 0

    // Get new signups for yesterday
    const { data: newUsers, error: userError } = await supabase
      .from('user_profiles')
      .select('id')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())

    if (userError) {
      throw new Error(`Failed to fetch new users: ${userError.message}`)
    }

    const newSignups = newUsers?.length || 0

    // Get revenue for yesterday
    const { data: payments, error: paymentError } = await supabase
      .from('payments')
      .select('amount_cents')
      .eq('status', 'completed')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())

    if (paymentError) {
      throw new Error(`Failed to fetch payments: ${paymentError.message}`)
    }

    const revenueCents = payments?.reduce((sum, p) => sum + p.amount_cents, 0) || 0

    // Insert or update daily metrics
    const { error: metricsError } = await supabase
      .from('daily_metrics')
      .upsert({
        date: dateStr,
        prompts_processed: promptsProcessed,
        failed_calls: failedCalls,
        new_signups: newSignups,
        revenue_cents: revenueCents,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'date'
      })

    if (metricsError) {
      throw new Error(`Failed to upsert daily metrics: ${metricsError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: dateStr,
        metrics: {
          prompts_processed: promptsProcessed,
          failed_calls: failedCalls,
          new_signups: newSignups,
          revenue_cents: revenueCents
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error aggregating daily metrics:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
