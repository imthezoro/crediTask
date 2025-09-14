// @ts-ignore - Deno remote imports are resolved at runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno remote imports are resolved at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
// Declare Deno for IDE type checking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Parse request body
    const requestData = await req.json()
    const { prompt, site } = requestData

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing prompt in request body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from auth token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check user's profile and quota
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('is_guest, usage_count, prompt_limit')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify user profile' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Enforce quota using prompt_limit if set (null means unlimited)
    const limit: number | null = (userProfile as { prompt_limit?: number | null })?.prompt_limit ?? null
    const overLimit = typeof limit === 'number' && userProfile.usage_count >= limit
    if (overLimit) {
      return new Response(
        JSON.stringify({ 
          error: 'Usage limit reached',
          message: `You've reached the limit of ${limit} requests. Please sign up or upgrade to continue.`,
          quota: limit,
          usage: userProfile.usage_count
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Forward the request to the enhance-prompt function
    const enhancePromptUrl = `${supabaseUrl}/functions/v1/enhance-prompt`
    const enhanceResponse = await fetch(enhancePromptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(requestData)
    })

    // Get the response from enhance-prompt
    const enhanceData = await enhanceResponse.json()

    // If the enhance-prompt call was successful, increment usage count atomically
    if (enhanceResponse.ok) {
      // Atomically increment usage with limit enforcement
      const { data: incData, error: rpcError } = await supabaseClient
        .rpc('increment_usage_if_allowed', { p_user_id: user.id, p_increment: 1 })

      if (rpcError) {
        console.error('Error in increment_usage_if_allowed RPC:', rpcError)
      }

      const incRow = Array.isArray(incData) ? incData[0] : null
      if (incRow && incRow.allowed === false) {
        // Another concurrent tab likely consumed the last quota. Deny to enforce limit.
        return new Response(
          JSON.stringify({ 
            error: 'Usage limit reached',
            message: `You've reached the limit of ${incRow.quota} requests. Please sign up or upgrade to continue.`,
            quota: incRow.quota,
            usage: incRow.new_usage ?? userProfile.usage_count
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // Insert prompt session record
      const { error: sessionError } = await supabaseClient
        .from('prompt_sessions')
        .insert({
          user_id: user.id,
          original_prompt: prompt,
          site: site || null,
          base_enhanced_prompt: enhanceData.enhancedPrompt || '',
          nested_options: enhanceData.options || {},
          status: 'completed',
          response_time_ms: enhanceData.responseTime || 0
        })

      if (sessionError) {
        console.error('Error inserting prompt session:', sessionError)
      }

      // Return the enhanced prompt response
      return new Response(
        JSON.stringify({
          ...enhanceData,
          usage_count: (incRow && typeof incRow.new_usage === 'number')
            ? incRow.new_usage
            : (userProfile.usage_count + 1),
          is_guest: userProfile.is_guest,
          quota: limit
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    } else {
      // If enhance-prompt failed, pass through the error
      return new Response(
        JSON.stringify(enhanceData),
        {
          status: enhanceResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
  } catch (error) {
    console.error('Error processing request:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})