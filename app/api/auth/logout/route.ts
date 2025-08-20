import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const cookieStore = cookies()
  
  // Clear the access token cookie
  cookieStore.delete('sb-access-token')
  
  // Redirect to signin page
  return NextResponse.redirect(new URL('/auth/signin', request.url))
}
