import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { register, Counter, Gauge, collectDefaultMetrics } from 'prom-client'

// Initialize default metrics
collectDefaultMetrics()

// Create custom metrics
const promptsProcessedTotal = new Counter({
  name: 'prompts_processed_total',
  help: 'Total number of prompts processed',
  labelNames: ['status']
})

const promptFailuresTotal = new Counter({
  name: 'prompt_failures_total',
  help: 'Total number of prompt processing failures'
})

const activeUsers = new Gauge({
  name: 'active_users',
  help: 'Number of active users in the last 24 hours'
})

const responseTimeHistogram = new Gauge({
  name: 'prompt_response_time_seconds',
  help: 'Response time for prompt processing in seconds'
})

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()

    // Update metrics with current data
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    // Get prompt sessions data
    const { data: promptSessions } = await supabase
      .from('prompt_sessions')
      .select('status, created_at, response_time_ms')
      .gte('created_at', yesterday.toISOString())

    // Get active users (users who made requests in last 24h)
    const { data: activeUserData } = await supabase
      .from('prompt_sessions')
      .select('user_id')
      .gte('created_at', yesterday.toISOString())

    const uniqueActiveUsers = new Set(activeUserData?.map(p => p.user_id)).size

    // Update metrics
    const successfulPrompts = promptSessions?.filter(p => p.status === 'completed').length || 0
    const failedPrompts = promptSessions?.filter(p => p.status === 'failed').length || 0
    
    // Reset counters (since they're cumulative)
    promptsProcessedTotal.reset()
    promptFailuresTotal.reset()
    
    // Set current values
    promptsProcessedTotal.inc({ status: 'success' }, successfulPrompts)
    promptsProcessedTotal.inc({ status: 'failed' }, failedPrompts)
    promptFailuresTotal.inc(failedPrompts)
    activeUsers.set(uniqueActiveUsers)

    // Calculate average response time
    const avgResponseTime = promptSessions?.length 
      ? promptSessions.reduce((sum, p) => sum + (p.response_time_ms || 0), 0) / promptSessions.length / 1000
      : 0
    responseTimeHistogram.set(avgResponseTime)

    // Return metrics in Prometheus format
    const metrics = await register.metrics()
    
    return new NextResponse(metrics, {
      headers: {
        'Content-Type': register.contentType
      }
    })

  } catch (error) {
    console.error('Prometheus metrics error:', error)
    return NextResponse.json(
      { error: 'Failed to generate metrics' },
      { status: 500 }
    )
  }
}
