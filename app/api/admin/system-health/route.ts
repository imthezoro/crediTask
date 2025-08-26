import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, isUserAdmin } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !(await isUserAdmin(user.id))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check database connectivity
    const dbStart = Date.now()
    const { error: dbError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)
    const dbLatency = Date.now() - dbStart

    // Check recent errors in prompt sessions
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const { count: recentErrors } = await supabase
      .from('prompt_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', oneHourAgo.toISOString())

    // Check recent activity
    const { count: recentSessions } = await supabase
      .from('prompt_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString())

    // Check active incidents
    const { count: activeIncidents } = await supabase
      .from('incidents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')

    // Normalize nullable counts
    const safeRecentErrors = recentErrors ?? 0
    const safeRecentSessions = recentSessions ?? 0
    const safeActiveIncidents = activeIncidents ?? 0

    // Determine health status
    const getHealthStatus = (metric: string, value: number) => {
      switch (metric) {
        case 'database':
          if (dbError) return { status: 'error', message: 'Connection Failed' }
          if (dbLatency > 1000) return { status: 'warning', message: 'Slow Response' }
          return { status: 'healthy', message: 'Operational' }
        
        case 'api':
          const errorRate = safeRecentSessions > 0 ? safeRecentErrors / safeRecentSessions : 0
          if (errorRate > 0.1) return { status: 'error', message: 'High Error Rate' }
          if (errorRate > 0.05) return { status: 'warning', message: 'Elevated Errors' }
          return { status: 'healthy', message: 'Operational' }
        
        case 'incidents':
          if (safeActiveIncidents > 5) return { status: 'error', message: 'Multiple Issues' }
          if (safeActiveIncidents > 0) return { status: 'warning', message: `${safeActiveIncidents} Active` }
          return { status: 'healthy', message: 'No Issues' }
        
        case 'processing':
          if (safeRecentSessions === 0) return { status: 'warning', message: 'No Activity' }
          if (safeRecentErrors > 10) return { status: 'error', message: 'Processing Issues' }
          return { status: 'healthy', message: 'Normal' }
        
        default:
          return { status: 'healthy', message: 'OK' }
      }
    }

    const healthData = {
      database: getHealthStatus('database', dbLatency),
      api: getHealthStatus('api', safeRecentErrors),
      incidents: getHealthStatus('incidents', safeActiveIncidents),
      processing: getHealthStatus('processing', safeRecentSessions),
      metrics: {
        dbLatency,
        recentErrors: safeRecentErrors,
        recentSessions: safeRecentSessions,
        activeIncidents: safeActiveIncidents
      }
    }

    return NextResponse.json(healthData)
  } catch (error) {
    console.error('System health check error:', error)
    return NextResponse.json({ error: 'Failed to check system health' }, { status: 500 })
  }
}
