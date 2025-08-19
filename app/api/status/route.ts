import { createServerClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createServerClient()

    // Get current incidents
    const { data: incidents } = await supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    // Get daily metrics for last 24h
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const { data: dailyMetrics } = await supabase
      .from('daily_metrics')
      .select('*')
      .gte('date', yesterday.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(1)

    // Get prompt sessions for last 24h
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

    return NextResponse.json({
      incidents: incidents || [],
      metrics
    })
  } catch (error) {
    console.error('Status API error:', error)
    return NextResponse.json(
      { 
        incidents: [],
        metrics: {
          prompts_last_24h: 0,
          success_rate: 100,
          avg_response_time: 0,
          failed_calls: 0
        }
      },
      { status: 500 }
    )
  }
}
