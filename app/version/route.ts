import { NextResponse } from 'next/server'

// This endpoint returns the current build version
// Used by VersionUpdater component to detect new deployments

export const dynamic = 'force-dynamic'

export async function GET() {
  // Use build time or git commit hash in production
  // For now, use a combination of package.json version and build timestamp
  const version = process.env.NEXT_PUBLIC_APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString()
  
  return new NextResponse(version, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}
