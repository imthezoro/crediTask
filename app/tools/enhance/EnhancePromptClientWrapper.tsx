'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import EnhancePromptClient from './EnhancePromptClient'
import { PromptHistorySidebar } from '@/components/PromptHistorySidebar'

interface PromptHistoryItem {
  id: string
  original: string
  enhanced: string
  timestamp: Date
  llmPlatform: string
}

interface EnhancePromptClientWrapperProps {
  user: {
    id: string
    email?: string
  }
  isAdmin: boolean
}

export default function EnhancePromptClientWrapper({ user, isAdmin }: EnhancePromptClientWrapperProps) {
  const [loadedPrompt, setLoadedPrompt] = useState<{ original: string; enhanced: string } | null>(null)

  const handleHistoryItemClick = (item: PromptHistoryItem) => {
    setLoadedPrompt({
      original: item.original,
      enhanced: item.enhanced
    })
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <PromptHistorySidebar onHistoryItemClick={handleHistoryItemClick} />
      <div className="flex-1 h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
        <Header user={user} isAdmin={isAdmin} pageTitle="Prompt Enhancer" offsetWithSidebar={true} />
        <div className="flex-1 overflow-y-auto relative">
          <div className="container mx-auto px-4 h-full max-w-5xl pt-24 md:pt-28">
            <EnhancePromptClient loadedPrompt={loadedPrompt} onPromptLoaded={() => setLoadedPrompt(null)} />
          </div>
        </div>
      </div>
    </div>
  )
}
