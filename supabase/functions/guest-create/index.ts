import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Configuration
const MAX_GUESTS_PER_IP = 3 // Maximum number of guest accounts allowed per IP address
const IP_RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const requestData = await req.json()
    console.log("Payload : ", requestData)
    const { device_id } = requestData

    if (!device_id || device_id.trim() === "") {
      return new Response(
        JSON.stringify({ error: 'Missing device_id in request body' }),
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

    // Get client IP address
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

    // Check if this device_id already has a guest account
    const { data: existingDeviceGuest, error: deviceCheckError } = await supabaseClient
      .from('user_profiles')
      .select('id, created_at')
      .eq('device_id', device_id)
      .eq('is_guest', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (deviceCheckError) {
      console.error('Error checking device guest:', deviceCheckError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify device status' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // If device already has a guest account, return it
    if (existingDeviceGuest && existingDeviceGuest.length > 0) {
      return new Response(
        JSON.stringify({
          allowed: true,
          message: 'Device already has a guest account',
          existing_guest_id: existingDeviceGuest[0].id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Optional IP rate limiting
    // Check how many guest accounts this IP has created recently
    const { data: ipGuests, error: ipCheckError } = await supabaseClient
      .from('user_profiles')
      .select('id, created_at, ip_address')
      .eq('ip_address', clientIp)
      .eq('is_guest', true)
      .gte('created_at', new Date(Date.now() - IP_RATE_LIMIT_WINDOW).toISOString())

    if (ipCheckError) {
      console.error('Error checking IP rate limit:', ipCheckError)
      // Continue without IP check if there's an error
    } else if (ipGuests && ipGuests.length >= MAX_GUESTS_PER_IP) {
      // IP has created too many guest accounts recently
      return new Response(
        JSON.stringify({
          allowed: false,
          error: 'IP rate limit exceeded',
          message: `Too many guest accounts created from this IP address. Please try again later or sign up for a full account.`,
        }),
        {
          status: 429, // Too Many Requests
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // All checks passed, allow guest creation
    return new Response(
      JSON.stringify({
        allowed: true,
        message: 'Guest account creation allowed',
        ip_address: clientIp, // Return IP for logging purposes
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
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