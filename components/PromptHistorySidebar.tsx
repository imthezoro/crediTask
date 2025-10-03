"use client"

import * as React from "react"
import { ChevronDown, ChevronRight, Search, Clock, Trash2 } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// LLM Platform configurations with icons
const LLM_PLATFORMS = [
  {
    id: "promptok",
    name: "PromptOK",
    icon: "⚡",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    icon: "🤖",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950",
  },
  {
    id: "claude",
    name: "Claude",
    icon: "🎭",
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950",
  },
  {
    id: "gemini",
    name: "Gemini",
    icon: "✨",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50 dark:bg-indigo-950",
  },
  {
    id: "perplexity",
    name: "Perplexity",
    icon: "🔍",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50 dark:bg-cyan-950",
  },
  {
    id: "copilot",
    name: "Copilot",
    icon: "🚀",
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950",
  },
]

// Types
interface PromptHistoryItem {
  id: string
  original: string
  enhanced: string
  timestamp: Date
  llmPlatform: string
}

interface PromptHistorySidebarProps {
  onHistoryItemClick?: (item: PromptHistoryItem) => void
}

export function PromptHistorySidebar({ onHistoryItemClick }: PromptHistorySidebarProps) {
  return <PromptHistorySidebarContent onHistoryItemClick={onHistoryItemClick} />
}

function PromptHistorySidebarContent({ onHistoryItemClick }: { onHistoryItemClick?: (item: PromptHistoryItem) => void }) {
  const { state, setOpen } = useSidebar()
  const [expandedLLMs, setExpandedLLMs] = React.useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = React.useState("")
  const [historyData, setHistoryData] = React.useState<Record<string, PromptHistoryItem[]>>({})
  const isCollapsed = state === "collapsed"

  // Load history from API on mount and when prompted
  const fetchHistory = React.useCallback(async () => {
    try {
      const response = await fetch('/api/prompt-history', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      
      if (!response.ok) {
        console.error('[PromptHistorySidebar] Failed to fetch history:', response.status)
        return
      }
      
      const data = await response.json()
      
      if (data.success && data.history) {
        // Convert timestamp strings back to Date objects
        const converted: Record<string, PromptHistoryItem[]> = {}
        Object.keys(data.history).forEach((key) => {
          converted[key] = data.history[key].map((item: {
            id: string
            original: string
            enhanced: string
            timestamp: string
            llmPlatform: string
          }) => ({
            ...item,
            timestamp: new Date(item.timestamp),
          }))
        })
        setHistoryData(converted)
      }
    } catch (error) {
      console.error('[PromptHistorySidebar] Error loading history:', error)
    }
  }, [])

  React.useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Expose refresh function globally for triggering after enhancement
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as Window & { refreshPromptHistory?: () => void }).refreshPromptHistory = fetchHistory
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as Window & { refreshPromptHistory?: () => void }).refreshPromptHistory
      }
    }
  }, [fetchHistory])


  // Toggle LLM history expansion
  const toggleLLM = (llmId: string) => {
    setExpandedLLMs((prev) => {
      const next = new Set(prev)
      if (next.has(llmId)) {
        next.delete(llmId)
      } else {
        next.add(llmId)
      }
      return next
    })
  }

  // Handle LLM icon click when sidebar is collapsed
  const handleCollapsedLLMClick = (llmId: string) => {
    // Expand sidebar and show only this LLM's history
    setOpen(true)
    setExpandedLLMs(new Set([llmId]))
  }

  // Filter history based on search query
  const filterHistory = (items: PromptHistoryItem[]) => {
    if (!searchQuery) return items
    const query = searchQuery.toLowerCase()
    return items.filter(
      (item) =>
        item.original.toLowerCase().includes(query) ||
        item.enhanced.toLowerCase().includes(query)
    )
  }

  // Format timestamp
  const formatTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // Delete history item
  const deleteItem = (llmId: string, itemId: string) => {
    setHistoryData((prev) => {
      const updated = { ...prev }
      updated[llmId] = updated[llmId].filter((item) => item.id !== itemId)
      // Save to localStorage
      localStorage.setItem("promptok-history", JSON.stringify(updated))
      return updated
    })
  }

  // Get history count for an LLM
  const getHistoryCount = (llmId: string) => {
    return historyData[llmId]?.length || 0
  }

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        {/* Header with toggle */}
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="hover:bg-sidebar-accent rounded-md transition-colors duration-200" />
              {!isCollapsed && (
                <h2 className="text-sm font-semibold text-sidebar-foreground">
                  Prompt History
                </h2>
              )}
            </div>
          </div>

          {/* Search bar - only visible when expanded */}
          {!isCollapsed && (
            <div className="px-2 pb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search history..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm bg-sidebar-accent border-sidebar-border focus:ring-sidebar-ring"
                />
              </div>
            </div>
          )}
        </SidebarHeader>

        {/* Content with LLM entries */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {LLM_PLATFORMS.map((llm) => {
                  const isExpanded = expandedLLMs.has(llm.id)
                  const historyItems = historyData[llm.id] || []
                  const filteredItems = filterHistory(historyItems)
                  const historyCount = getHistoryCount(llm.id)

                  return (
                    <SidebarMenuItem key={llm.id}>
                      {/* LLM Header */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SidebarMenuButton
                              onClick={() => {
                                if (isCollapsed) {
                                  handleCollapsedLLMClick(llm.id)
                                } else {
                                  toggleLLM(llm.id)
                                }
                              }}
                              className={cn(
                                "group relative transition-all duration-200",
                                isExpanded && !isCollapsed && llm.bgColor
                              )}
                            >
                              <span className={cn("text-lg leading-none inline-block", llm.color)}>
                                {llm.icon}
                              </span>
                              {!isCollapsed && (
                                <>
                                  <span className="flex-1 font-medium">{llm.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {historyCount}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 transition-transform" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 transition-transform" />
                                  )}
                                </>
                              )}
                            </SidebarMenuButton>
                          </TooltipTrigger>
                          {isCollapsed && (
                            <TooltipContent side="right" className="flex items-center gap-2">
                              <span>{llm.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({historyCount})
                              </span>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>

                      {/* History Items - only visible when expanded */}
                      {isExpanded && !isCollapsed && (
                        <div className="ml-8 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
                          {filteredItems.length === 0 ? (
                            <div className="py-4 px-2 text-xs text-muted-foreground text-center">
                              {searchQuery ? "No matching history" : "No history yet"}
                            </div>
                          ) : (
                            filteredItems.map((item) => (
                              <div
                                key={item.id}
                                className="group/item relative rounded-lg border border-sidebar-border bg-sidebar p-2 hover:bg-sidebar-accent transition-all duration-200 hover:shadow-sm cursor-pointer"
                                onClick={() => onHistoryItemClick?.(item)}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-xs font-medium text-sidebar-foreground line-clamp-2">
                                      {item.original}
                                    </p>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        deleteItem(llm.id, item.id)
                                      }}
                                      className="opacity-0 group-hover/item:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                                      title="Delete"
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>{formatTime(item.timestamp)}</span>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter className="border-t border-sidebar-border">
          {!isCollapsed && (
            <div className="px-4 py-2 text-xs text-muted-foreground">
              Total: {Object.values(historyData).reduce((sum, items) => sum + items.length, 0)}{" "}
              prompts
            </div>
          )}
        </SidebarFooter>
      </Sidebar>
    </>
  )
}

