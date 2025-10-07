import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Use edge runtime for global performance
export const runtime = 'edge'

// Cache status data briefly for performance
export const revalidate = 30

export async function GET() {
  try {
    const supabase = await createClient()

    // Get current incidents
    const { data: incidents } = await supabase
      .from('incidents')
      .select('id, title, description, severity, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    // Get prompt sessions for last 24h
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const { data: promptSessions } = await supabase
      .from('prompt_sessions')
      .select('id, created_at, status')
      .gte('created_at', yesterday.toISOString())

    const totalPrompts = promptSessions?.length || 0
    const failedPrompts = promptSessions?.filter(p => p.status === 'failed').length || 0
    const successRate = totalPrompts > 0 ? ((totalPrompts - failedPrompts) / totalPrompts) * 100 : 100

    // Calculate average response time (mock data for now)
    const avgResponseTime = Math.floor(Math.random() * 500) + 200

    const metrics = {
      prompts_last_24h: totalPrompts,
      success_rate: Math.round(successRate * 10) / 10,
      avg_response_time: avgResponseTime,
      failed_calls: failedPrompts
    }

    return new NextResponse(JSON.stringify({
      incidents: incidents || [],
      metrics
    }), {
      headers: {
        'Content-Type': 'application/json',
        // Edge cache for 30 seconds, allow 5 minutes stale while revalidating
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('Status API error:', error)
    return new NextResponse(JSON.stringify({ 
      incidents: [],
      metrics: {
        prompts_last_24h: 0,
        success_rate: 100,
        avg_response_time: 0,
        failed_calls: 0
      }
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        // Don't cache error responses
        'Cache-Control': 'no-cache',
      },
    })
  }
}
