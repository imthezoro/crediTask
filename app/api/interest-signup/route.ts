import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const { email, usage, feedback, rating } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Try to map to current user if logged in
    let user_id: string | null = null
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user?.id) user_id = user.id
    } catch {}

    // Coerce and validate numeric fields
    const usageInt = Number.isFinite(Number(usage)) ? Math.max(0, Math.floor(Number(usage))) : null
    const normalizedRating = Math.max(1, Math.min(5, Number(rating || 0))) || null

    if (usageInt === null) {
      return NextResponse.json({ error: 'Expected usage must be a number' }, { status: 400 })
    }

    // Store the interest signup in the database
    const { error } = await supabase
      .from('signups')
      .insert({
        user_id,
        email,
        expected_usage: usageInt,
        feedback,
        rating: normalizedRating,
        created_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Error storing interest signup:', error)
      return NextResponse.json(
        { error: 'Failed to store signup' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Interest registered successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Interest signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
