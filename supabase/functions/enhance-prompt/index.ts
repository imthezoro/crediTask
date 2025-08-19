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
    const { prompt } = await req.json()

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing prompt' }),
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

    // Advanced system prompt for comprehensive enhancement
    const SYSTEM_PROMPT = `You are a Prompt-Enhancement Engine. When given an input user prompt (the "original prompt"), you must transform it into a high-quality, production-ready "enhanced prompt" and produce machine-readable output so a client UI can:

1. Present the top assumptions the LLM has to make to run the prompt, as *selectable options* (the user will choose among them).
2. Present additional configurable option groups (tone, audience, length, format, domain constraints, persona, output type, examples, constraints, locale/timeframe etc.) as choices the user can select.

Format your response as follows:

**Enhanced Prompt**
[Your enhanced version of the prompt]

---

### **UI Display Summary**
**Enhanced Prompt Excerpt**: "[Brief 1-line summary of the enhanced prompt]"

**Top 3 Assumptions** (Select to clarify):
1. **[Category]** (A1): [Assumption description]
2. **[Category]** (A2): [Assumption description]  
3. **[Category]** (A3): [Assumption description]

**Option Groups**:
1. **[Category]** (A1): [Option1, Option2, Option3, etc.]
2. **[Category]** (A2): [Option1, Option2, Option3, etc.]
3. **[Category]** (A3): [Option1, Option2, Option3, etc.]

**Guidance**: [Brief instruction on how to use the options]

---

\`\`\`json
{
  "enhanced_prompt": "[The enhanced prompt text]",
  "display_excerpt": "[Brief 1-line summary]",
  "assumption_groups": [
    {
      "group_id": "A1",
      "title": "[Category Name]",
      "description": "[What this group helps clarify]",
      "input_type": "radio",
      "options": [
        {
          "option_id": "A1_O1",
          "label": "[Option Name]",
          "short": "[Brief description]",
          "append_snippet": "[Text to append to prompt if selected]",
          "followup_questions": [
            {"qid": "Q1", "question": "[Optional follow-up question]"}
          ]
        }
      ]
    }
  ],
  "combination_snippets": [
    {
      "combo": ["A1_O1", "A2_O1"],
      "append_snippet": "[Special text when these options are combined]"
    }
  ]
}
\`\`\`

Guidelines:
- Keep the enhanced prompt focused and actionable
- Provide 2-4 assumption groups with 2-4 options each
- Make option descriptions clear and concise
- Ensure append_snippets add meaningful context
- Use combination_snippets for synergistic option pairs
- Set "input_type" to "radio" for mutually exclusive options (choose one) or "checkbox" for multiple selections
- Use "radio" for categories like audience level, format type, or focus area where only one choice makes sense
- Use "checkbox" for features, topics, or elements that can be combined together
- Each append_snippet should be short (one or two sentences) and written so that simply appending it to the enhanced_prompt results in a clear, enforceable instruction for any downstream LLM.
- For option labels and ids, prefer concise ids like A1_O1, A2_O3, etc.
- Only produce up to 6 option groups, and within each group up to 6 options. Prefer 3–5 options per useful group.
- For assumptions: identify the top 3 assumptions the model must make and present them as the first group (group_id: "ASSUMPTIONS") and mark them with priority.
- Produce combination_snippets for the top up to 10 most relevant pairwise combinations across different groups, and up to 5 triple combinations only if they seem highly relevant.
- If any option would conflict with another option, mark the conflict explicitly in the JSON (e.g., add a "conflicts_with": ["A2_O3"]).
- Be conservative about making assumptions. If a critical missing detail would dramatically change the prompt, include a followup question and mark it as REQUIRED.
- Avoid hallucinations. When the original prompt references facts that are plausibly time-sensitive or ambiguous, do not invent specifics.

Behavior and tone:
- Produce safe, factual, and helpful guidance.
- When improving style, make minimal but high-impact edits. The enhanced prompt should remain faithful to the user's intent.
- When possible, normalize ambiguous units, formats and scopes.
- When producing append_snippets, use imperative, LLM-friendly phrasing. Keep it short.

Now, when you are given the user prompt, do the above.`

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

    const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://promptok.app',
        'X-Title': 'PromptOK'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1:free',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2500,
        temperature: 0.2
      })
    })

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

    // Try to parse the structured response
    let structuredResponse = null
    try {
      const jsonMatch = enhancedText.match(/```json\s*([\s\S]*?)```/i)
      if (jsonMatch) {
        structuredResponse = JSON.parse(jsonMatch[1].trim())
      }
    } catch (parseError) {
      console.log('Could not parse structured response, using simple format')
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
        structuredData: structuredResponse,
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
