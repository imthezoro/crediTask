import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getClientIP, isValidDeviceId } from '@/lib/rateLimit';

// Initialize Supabase clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to generate device ID (kept locally; format unchanged)
function generateDeviceId(): string {
  return 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Rate limiting is checked via internal endpoint /api/auth/check-guest-creation

export async function POST(req: NextRequest) {
  try {
    // Get device ID from request body or generate one
    const requestData = await req.json().catch(() => ({}));
    let deviceId: string = requestData.device_id;
    if (!deviceId || !isValidDeviceId(deviceId)) {
      deviceId = generateDeviceId();
    }
    
    // Get client IP address
    const clientIp = getClientIP(req);
    
    console.log('Guest login attempt:', { deviceId, clientIp });
    
    // Check server-side rate limiting via internal endpoint (single source of truth)
    const url = new URL('/api/auth/check-guest-creation', req.url);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: deviceId })
    });
    const check = await resp.json().catch(() => ({} as any));
    if (!resp.ok) {
      // Surface 429 with the same semantics
      const msg = check?.error || 'Guest creation not allowed';
      return NextResponse.json({ error: msg }, { status: resp.status });
    }
    
    let data, error;
    
    // If device has existing guest account, reuse it
    if (check.existing_guest_id) {
      console.log('Reusing existing guest account:', check.existing_guest_id);
      
      // Get existing user's email from auth.users table
      const { data: existingUser, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(
        check.existing_guest_id
      );
      
      console.log('Existing user fetch result:', { 
        hasUser: !!existingUser?.user, 
        email: existingUser?.user?.email,
        fetchError: fetchError?.message 
      });
      
      if (existingUser?.user?.email) {
        // Check if the existing user account is soft-deleted/inactive
        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .select('is_active, deleted_at')
          .eq('id', check.existing_guest_id)
          .single();

        if (profileError || !profileData || !profileData.is_active) {
          console.log('Existing guest account is deactivated, creating new account');
          // Don't reuse deactivated account, create new one instead
          data = null;
          error = null;
        } else {
          // Generate a new temporary password for the session
          const tempPassword = Math.random().toString(36).substring(2, 15) + 
                              Math.random().toString(36).substring(2, 15);
          
          console.log('Updating existing user password...');
          // Update the user's password and sign them in
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            check.existing_guest_id,
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
        }
      } else {
        console.error('Could not find existing user email');
        error = new Error('Could not find existing user');
      }
    }
    
    // If we need to create a new guest user (either no existing account or existing was deactivated)
    if (!data || !data.session) {
      console.log('Creating new guest user...');
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
    const isExistingSession = !!check.existing_guest_id;
    
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