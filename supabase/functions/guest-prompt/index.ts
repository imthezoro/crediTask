import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Default guest quota
const DEFAULT_GUEST_QUOTA = 10

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
      .select('is_guest, usage_count')
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

    // Check if user is a guest and enforce quota
    if (userProfile.is_guest) {
      if (userProfile.usage_count >= DEFAULT_GUEST_QUOTA) {
        return new Response(
          JSON.stringify({ 
            error: 'Guest quota exceeded', 
            message: `You've reached the limit of ${DEFAULT_GUEST_QUOTA} requests as a guest user. Please sign up for a full account to continue.`,
            quota: DEFAULT_GUEST_QUOTA,
            usage: userProfile.usage_count
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
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

    // If the enhance-prompt call was successful, increment usage count
    if (enhanceResponse.ok) {
      // Update usage count for the user
      const { error: updateError } = await supabaseClient
        .from('user_profiles')
        .update({ usage_count: userProfile.usage_count + 1 })
        .eq('id', user.id)

      if (updateError) {
        console.error('Error updating usage count:', updateError)
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
          usage_count: userProfile.usage_count + 1,
          is_guest: userProfile.is_guest,
          quota: userProfile.is_guest ? DEFAULT_GUEST_QUOTA : null
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