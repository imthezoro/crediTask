import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the user from the request
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Parse request body
    const { prompt, enhancementType } = await req.json()

    if (!prompt || !enhancementType) {
      return new Response(
        JSON.stringify({ error: 'Missing prompt or enhancementType' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check user's plan and usage based on your schema
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('plan, usage_count, plan_valid_until')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify user plan' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if user has valid plan (implement your business logic here)
    if (!userProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Basic plan validation - adjust based on your business logic
    const isPaidPlan = userProfile.plan !== 'free'
    const isFreeWithLowUsage = userProfile.plan === 'free' && userProfile.usage_count < 10 // Allow 10 free uses
    
    if (!isPaidPlan && !isFreeWithLowUsage) {
      return new Response(
        JSON.stringify({ error: 'Usage limit reached. Please upgrade your plan.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Enhancement prompts
    const ENHANCEMENT_PROMPTS = {
      tone: `You are a professional prompt enhancement assistant. The user has provided a prompt and wants to improve its tone. 

Please enhance the following prompt to have a more professional, clear, and effective tone while maintaining the original intent:

Original prompt: "${prompt}"

Enhanced prompt:`,

      length: `You are a professional prompt enhancement assistant. The user has provided a prompt and wants to make it more detailed and comprehensive.

Please enhance the following prompt to be more detailed, specific, and comprehensive while maintaining the original intent:

Original prompt: "${prompt}"

Enhanced prompt:`,

      audience: `You are a professional prompt enhancement assistant. The user has provided a prompt and wants to make it more suitable for their target audience.

Please enhance the following prompt to be more appropriate for the intended audience, clearer in communication, and more engaging:

Original prompt: "${prompt}"

Enhanced prompt:`,

      clarity: `You are a professional prompt enhancement assistant. The user has provided a prompt and wants to make it clearer and more specific.

Please enhance the following prompt to be clearer, more specific, and easier to understand while maintaining the original intent:

Original prompt: "${prompt}"

Enhanced prompt:`,

      structure: `You are a professional prompt enhancement assistant. The user has provided a prompt and wants to improve its structure and organization.

Please enhance the following prompt to be better structured, well-organized, and more logical in its flow:

Original prompt: "${prompt}"

Enhanced prompt:`
    }

    const enhancementPrompt = ENHANCEMENT_PROMPTS[enhancementType as keyof typeof ENHANCEMENT_PROMPTS]
    if (!enhancementPrompt) {
      return new Response(
        JSON.stringify({ error: 'Invalid enhancement type' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Call OpenRouter API
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY')
    if (!openrouterApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenRouter API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const openrouterResponse = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openrouterApiKey}`,
          'HTTP-Referer': 'https://promptok.com',
          'X-Title': 'PromptOK',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-r1:free',
          messages: [
            {
              role: 'user',
              content: enhancementPrompt
            }
          ]
        }),
      }
    )

    if (!openrouterResponse.ok) {
      const errorData = await openrouterResponse.json().catch(() => ({}))
      console.error('OpenRouter API error:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to enhance prompt' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const openrouterData = await openrouterResponse.json()
    const enhancedText = openrouterData.choices?.[0]?.message?.content

    if (!enhancedText) {
      return new Response(
        JSON.stringify({ error: 'Invalid response from OpenRouter API' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Update usage count and save session
    const { error: updateError } = await supabaseClient
      .from('user_profiles')
      .update({ 
        usage_count: userProfile.usage_count + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating user usage:', updateError)
      // Continue anyway - don't fail the request for usage update issues
    }

    // Save prompt session for history
    const { error: sessionError } = await supabaseClient
      .from('prompt_sessions')
      .insert({
        user_id: user.id,
        original_prompt: prompt,
        base_enhanced_prompt: enhancedText.trim(),
        site: 'extension'
      })

    if (sessionError) {
      console.error('Error saving prompt session:', sessionError)
      // Continue anyway - don't fail the request for session save issues
    }

    return new Response(
      JSON.stringify({ 
        enhancedPrompt: enhancedText.trim(),
        usageCount: userProfile.usage_count + 1
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
