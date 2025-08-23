import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Rate limiting configuration
const MAX_GUESTS_PER_IP = 3;
const MAX_GUESTS_PER_DEVICE = 1;
const IP_RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
const DEVICE_RATE_LIMIT_WINDOW = 7 * 24 * 60 * 60 * 1000; // 7 days

// Input validation
function isValidDeviceId(deviceId: string): boolean {
  if (typeof deviceId !== 'string') return false;
  const deviceIdPattern = /^(dev_|temp_)[a-zA-Z0-9]{10,50}$/;
  return deviceIdPattern.test(deviceId);
}

function getClientIP(request: NextRequest): string {
  // Try multiple headers for IP detection
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP.trim();
  }
  if (cfConnectingIP) {
    return cfConnectingIP.trim();
  }
  
  return 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const { device_id } = body;

    if (!device_id || !isValidDeviceId(device_id)) {
      return NextResponse.json(
        { 
          allowed: false, 
          error: 'Invalid or missing device_id' 
        },
        { status: 400 }
      );
    }

    // Get client IP
    const clientIP = getClientIP(request);

    // Create Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return NextResponse.json(
        { 
          allowed: false, 
          error: 'Server configuration error' 
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if device already has a guest account
    const { data: existingDeviceGuest, error: deviceCheckError } = await supabase
      .from('user_profiles')
      .select('id, created_at, device_id')
      .eq('device_id', device_id)
      .eq('is_guest', true)
      .gte('created_at', new Date(Date.now() - DEVICE_RATE_LIMIT_WINDOW).toISOString())
      .order('created_at', { ascending: false })
      .limit(MAX_GUESTS_PER_DEVICE);

    if (deviceCheckError) {
      console.error('Error checking device guest accounts:', deviceCheckError);
      return NextResponse.json(
        { 
          allowed: false, 
          error: 'Failed to verify device status' 
        },
        { status: 500 }
      );
    }

    // If device already has maximum allowed guest accounts
    if (existingDeviceGuest && existingDeviceGuest.length >= MAX_GUESTS_PER_DEVICE) {
      return NextResponse.json({
        allowed: true, // Allow existing device to use existing account
        message: 'Device already has a guest account',
        existing_guest_id: existingDeviceGuest[0].id,
      });
    }

    // Check IP-based rate limiting (only if creating new account)
    if (clientIP !== 'unknown') {
      const { data: ipGuests, error: ipCheckError } = await supabase
        .from('user_profiles')
        .select('id, created_at, ip_address')
        .eq('ip_address', clientIP)
        .eq('is_guest', true)
        .gte('created_at', new Date(Date.now() - IP_RATE_LIMIT_WINDOW).toISOString());

      if (ipCheckError) {
        console.error('Error checking IP rate limit:', ipCheckError);
        // Continue without IP check if there's an error (fail open for availability)
      } else if (ipGuests && ipGuests.length >= MAX_GUESTS_PER_IP) {
        return NextResponse.json(
          {
            allowed: false,
            error: 'IP rate limit exceeded',
            message: `Too many guest accounts created from this IP address. Please try again later or sign up for a full account.`,
            retry_after: IP_RATE_LIMIT_WINDOW / 1000, // seconds
          },
          { status: 429 }
        );
      }
    }

    // Additional security checks
    const now = Date.now();
    const recentWindow = 5 * 60 * 1000; // 5 minutes

    // Check for suspicious rapid creation patterns
    const { data: recentGuests, error: recentCheckError } = await supabase
      .from('user_profiles')
      .select('id, created_at')
      .eq('is_guest', true)
      .gte('created_at', new Date(now - recentWindow).toISOString());

    if (!recentCheckError && recentGuests && recentGuests.length > 10) {
      // Too many guest accounts created recently across all IPs
      return NextResponse.json(
        {
          allowed: false,
          error: 'System rate limit exceeded',
          message: 'Too many guest accounts being created. Please try again later.',
          retry_after: 300, // 5 minutes
        },
        { status: 429 }
      );
    }

    // All checks passed
    return NextResponse.json({
      allowed: true,
      message: 'Guest account creation allowed',
      ip_address: clientIP,
      device_id: device_id,
    });

  } catch (error) {
    console.error('Error in guest creation check:', error);
    return NextResponse.json(
      { 
        allowed: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
