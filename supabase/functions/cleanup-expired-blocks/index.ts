import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create admin client using service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Delete expired email blocks
    const { data: deletedBlocks, error } = await supabaseAdmin
      .from('blocked_emails')
      .delete()
      .lt('blocked_until', new Date().toISOString())
      .select('email, blocked_until')

    if (error) {
      console.error('Failed to cleanup expired blocks:', error)
      return new Response(
        JSON.stringify({ error: 'Cleanup failed', details: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const cleanedCount = deletedBlocks?.length || 0
    console.log(`Cleaned up ${cleanedCount} expired email blocks`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cleaned up ${cleanedCount} expired email blocks`,
        cleaned_blocks: cleanedCount
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Cleanup function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
