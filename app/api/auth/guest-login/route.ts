import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Initialize Supabase clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to generate device ID
function generateDeviceId(): string {
  return 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Rate limiting configuration
const MAX_GUESTS_PER_IP = 3;
const MAX_GUESTS_PER_DEVICE = 1;
const IP_RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
const DEVICE_RATE_LIMIT_WINDOW = 7 * 24 * 60 * 60 * 1000; // 7 days

// Server-side rate limiting check
async function checkGuestCreationAllowed(deviceId: string, ipAddress: string): Promise<{ allowed: boolean; error?: string; existingGuestId?: string }> {
  try {
    if (!supabaseServiceKey) {
      console.warn('Missing SUPABASE_SERVICE_ROLE_KEY - rate limiting disabled');
      return { allowed: true };
    }

    // Check if device already has a guest account
    const { data: existingDeviceGuest, error: deviceCheckError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, created_at, device_id')
      .eq('device_id', deviceId)
      .eq('is_guest', true)
      .gte('created_at', new Date(Date.now() - DEVICE_RATE_LIMIT_WINDOW).toISOString())
      .order('created_at', { ascending: false })
      .limit(MAX_GUESTS_PER_DEVICE);

    if (deviceCheckError) {
      console.error('Error checking device guest accounts:', deviceCheckError);
      return { allowed: true }; // Fail open
    }

    // If device already has a guest account, allow reuse
    if (existingDeviceGuest && existingDeviceGuest.length >= MAX_GUESTS_PER_DEVICE) {
      return {
        allowed: true,
        existingGuestId: existingDeviceGuest[0].id,
        error: 'Device already has a guest account'
      };
    }

    // Check IP-based rate limiting
    if (ipAddress && ipAddress !== 'unknown' && ipAddress !== '::1' && ipAddress !== '127.0.0.1') {
      const { data: ipGuests, error: ipCheckError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, created_at, ip_address')
        .eq('ip_address', ipAddress)
        .eq('is_guest', true)
        .gte('created_at', new Date(Date.now() - IP_RATE_LIMIT_WINDOW).toISOString());

      if (ipCheckError) {
        console.error('Error checking IP rate limit:', ipCheckError);
        // Continue without IP check if there's an error (fail open)
      } else if (ipGuests && ipGuests.length >= MAX_GUESTS_PER_IP) {
        return {
          allowed: false,
          error: `Too many guest accounts created from this IP address. Please try again later or sign up for a full account.`
        };
      }
    }

    return { allowed: true };
  } catch (error) {
    console.error('Failed to check guest creation rate limit:', error);
    return { allowed: true }; // Fail open for availability
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get device ID from request body or generate one
    const requestData = await req.json().catch(() => ({}));
    const deviceId = requestData.device_id || generateDeviceId();
    
    // Get client IP address
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    console.log('Guest login attempt:', { deviceId, clientIp });
    
    // Check server-side rate limiting first
    const rateLimitCheck = await checkGuestCreationAllowed(deviceId, clientIp);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({ 
        error: rateLimitCheck.error || 'Guest creation not allowed' 
      }, { status: 429 });
    }
    
    let data, error;
    
    // If device has existing guest account, reuse it
    if (rateLimitCheck.existingGuestId) {
      console.log('Reusing existing guest account:', rateLimitCheck.existingGuestId);
      
      // Get existing user's email from auth.users table
      const { data: existingUser, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(
        rateLimitCheck.existingGuestId
      );
      
      console.log('Existing user fetch result:', { 
        hasUser: !!existingUser?.user, 
        email: existingUser?.user?.email,
        fetchError: fetchError?.message 
      });
      
      if (existingUser?.user?.email) {
        // Generate a new temporary password for the session
        const tempPassword = Math.random().toString(36).substring(2, 15) + 
                            Math.random().toString(36).substring(2, 15);
        
        console.log('Updating existing user password...');
        // Update the user's password and sign them in
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          rateLimitCheck.existingGuestId,
          { password: tempPassword }
        );
        
        console.log('Password update result:', { updateError: updateError?.message });
        
        if (!updateError) {
          console.log('Signing in existing user with new password...');
          // Sign in with the updated password
          const signInResult = await supabase.auth.signInWithPassword({
            email: existingUser.user.email,
            password: tempPassword
          });
          
          console.log('Sign in result:', { 
            hasSession: !!signInResult.data?.session,
            hasUser: !!signInResult.data?.user,
            error: signInResult.error?.message 
          });
          
          data = signInResult.data;
          error = signInResult.error;
        } else {
          console.error('Failed to update existing user password:', updateError);
          error = updateError;
        }
      } else {
        console.error('Could not find existing user email');
        error = new Error('Could not find existing user');
      }
    } else {
      // Create new guest user
      const randomId = Math.random().toString(36).substring(2, 15);
      const email = `guest_${randomId}_${deviceId}@promptok.guest`;
      const password = Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 15);
      
      // Sign up the guest user
      const signUpResult = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            device_id: deviceId
          }
        }
      });
      
      data = signUpResult.data;
      error = signUpResult.error;
    }
    
    console.log('Guest signup response:', { 
      hasSession: !!data?.session, 
      error: error?.message,
      userId: data?.user?.id
    });
    
    if (error) {
      console.error('Guest creation error:', error);
      return NextResponse.json({ 
        error: error.message || 'Failed to create guest user' 
      }, { status: 400 });
    }
    
    if (!data?.session) {
      console.error('No session returned from guest creation');
      return NextResponse.json({ error: 'Failed to create guest user session' }, { status: 500 });
    }
    
    // Mark the user as a guest in the user_profiles table
    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ 
        is_guest: true,
        device_id: deviceId || null,
        ip_address: clientIp || null
      })
      .eq('id', data.user?.id);
    
    if (updateError) {
      console.error('Failed to mark user as guest:', updateError);
    }
    
    // Check if this is reusing an existing device account
    const isExistingSession = !!rateLimitCheck.existingGuestId;
    
    // Set cookies
    const cookieStore = cookies();
    cookieStore.set('accessToken', data.session.access_token, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
    
    cookieStore.set('refreshToken', data.session.refresh_token || '', {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    
    cookieStore.set('isGuest', 'true', {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
    
    // Return the session data
    return NextResponse.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user_id: data.session.user.id,
      email: data.session.user.email,
      is_guest: true,
      existing_session: isExistingSession,
      device_id: deviceId
    });
    
  } catch (error: any) {
    console.error('Guest login error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}