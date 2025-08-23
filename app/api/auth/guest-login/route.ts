import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { AuthService } from '@/lib/auth-service';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize auth service
const authService = new AuthService();

export async function POST(req: NextRequest) {
  try {
    // Create a guest user
    const guestAuthResponse = await authService.createGuestUser();
    
    if (!guestAuthResponse || !guestAuthResponse.session) {
      return NextResponse.json({ error: 'Failed to create guest user' }, { status: 500 });
    }
    
    // Set cookies
    const cookieStore = cookies();
    cookieStore.set('accessToken', guestAuthResponse.session.access_token, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
    
    cookieStore.set('refreshToken', guestAuthResponse.session.refresh_token || '', {
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
      access_token: guestAuthResponse.session.access_token,
      refresh_token: guestAuthResponse.session.refresh_token,
      user_id: guestAuthResponse.user?.id,
      email: guestAuthResponse.user?.email,
      is_guest: true
    });
    
  } catch (error: any) {
    console.error('Guest login error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}