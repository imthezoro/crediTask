'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles, Copy, Check, AlertCircle } from 'lucide-react'

interface Question {
  id: string
  text: string
  options: string[]
  type: 'radio' | 'checkbox'
  trigger?: {
    question_id: string
    answer: string
  }
}

interface SelectionUpdate {
  selection_path: { question_id: string; option: string }[]
  base_prompt: string
}

interface EnhancedResponse {
  success: boolean
  structuredData?: {
    enhanced_prompt?: string
    base_prompt?: string
    questions?: Question[]
    selection_updates?: SelectionUpdate[]
  }
  rawResponse?: string
  usageCount?: number
  error?: string
  message?: string
}

interface EnhancePromptClientProps {
  loadedPrompt?: { original: string; enhanced: string } | null
  onPromptLoaded?: () => void
}

export default function EnhancePromptClient({ loadedPrompt = null, onPromptLoaded }: EnhancePromptClientProps = {}) {
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string | string[]>>({})
  const [copiedFinal, setCopiedFinal] = useState(false)
  const [usageCount, setUsageCount] = useState<number | null>(null)

  // Load prompt from history when clicked
  useEffect(() => {
    if (loadedPrompt) {
      setPrompt(loadedPrompt.original)
      setError(null)
      
      // Use the same parsing logic as live enhancement
      const jsonText = extractJsonFromResponse(loadedPrompt.enhanced)
      
      if (jsonText) {
        try {
          const parsed = JSON.parse(jsonText)
          
          // Validate the parsed data structure
          if (validateParsedData(parsed)) {
            const enhanced = parsed.base_prompt || parsed.enhanced_prompt
            setEnhancedPrompt(enhanced || null)
            setQuestions(parsed.questions || [])
            setSelectedAnswers({})
            onPromptLoaded?.()
            return
          }
        } catch (parseError) {
          console.error('[EnhanceClient] Failed to parse history JSON:', parseError)
        }
      }
      
      // Fallback: use as plain text
      setEnhancedPrompt(loadedPrompt.enhanced)
      setQuestions([])
      setSelectedAnswers({})
      onPromptLoaded?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedPrompt, onPromptLoaded])

  // Robust JSON extraction from AI response
  const extractJsonFromResponse = (responseText: string): string | null => {
    if (!responseText || typeof responseText !== 'string') {
      return null
    }

    // 1) Try to parse entire response as JSON
    try {
      const trimmed = responseText.trim()
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        JSON.parse(trimmed)
        return trimmed
      }
    } catch { /* ignore */ }

    // 2) Try to find fenced ```json blocks
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/i)
    if (jsonMatch && jsonMatch[1]) {
      return jsonMatch[1].trim()
    }

    // 3) Try any fenced ``` block and see if it parses
    const genericMatch = responseText.match(/```\s*([\s\S]*?)```/i)
    if (genericMatch && genericMatch[1]) {
      const candidate = genericMatch[1].trim()
      try {
        JSON.parse(candidate)
        return candidate
      } catch { /* ignore */ }
    }

    // 4) Heuristic: take substring from first '{' to last '}' and try parse
    try {
      const first = responseText.indexOf('{')
      const last = responseText.lastIndexOf('}')
      if (first !== -1 && last !== -1 && last > first) {
        const candidate = responseText.substring(first, last + 1).trim()
        JSON.parse(candidate)
        return candidate
      }
    } catch { /* ignore */ }

    // 5) Truncated fenced json (no closing backticks)
    const truncMatch = responseText.match(/```json\s*([\s\S]*?)$/i)
    if (truncMatch && truncMatch[1]) {
      const jsonText = truncMatch[1].trim()
      const lastCompleteObject = findLastCompleteJson(jsonText)
      if (lastCompleteObject) return lastCompleteObject
    }

    // Nothing structured found
    return null
  }

  const findLastCompleteJson = (jsonText: string): string | null => {
    try {
      // Try parsing as-is first
      JSON.parse(jsonText)
      return jsonText
    } catch {
      // Try to find the last complete structure
      let braceCount = 0
      let lastValidIndex = -1

      for (let i = 0; i < jsonText.length; i++) {
        if (jsonText[i] === '{') {
          braceCount++
        } else if (jsonText[i] === '}') {
          braceCount--
          if (braceCount === 0) {
            lastValidIndex = i
          }
        }
      }

      if (lastValidIndex > 0) {
        const truncated = jsonText.substring(0, lastValidIndex + 1)
        try {
          JSON.parse(truncated)
          return truncated
        } catch {
          console.warn('Could not repair truncated JSON')
        }
      }
    }

    return null
  }

  const validateParsedData = (parsed: unknown): boolean => {
    // Support new format: base_prompt OR enhanced_prompt + questions
    if (!parsed || typeof parsed !== 'object') {
      console.warn('Invalid JSON structure - not an object', parsed)
      return false
    }

    // Check for base_prompt (new format) or enhanced_prompt (also acceptable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasPrompt = (parsed as any).base_prompt || (parsed as any).enhanced_prompt
    if (!hasPrompt || typeof hasPrompt !== 'string') {
      console.warn('Invalid JSON structure - missing prompt field', parsed)
      return false
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!Array.isArray((parsed as any).questions)) {
      console.warn('Invalid JSON structure - questions must be an array', parsed)
      return false
    }

    console.log('[EnhanceClient] Valid data format detected')
    return true
  }

  const handleEnhance = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt to enhance')
      return
    }

    setLoading(true)
    setError(null)
    setEnhancedPrompt(null)
    setQuestions([])
    setSelectedAnswers({})

    try {
      const response = await fetch('/api/enhance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          metadata: {
            user_settings: {
              verbosity: 'balanced'
            }
          }
        }),
      })

      const data: EnhancedResponse = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/signin')
          return
        }
        const errorMsg = typeof data.message === 'string' ? data.message : 
                        typeof data.error === 'string' ? data.error : 
                        'Failed to enhance prompt'
        throw new Error(errorMsg)
      }

      if (!data.success) {
        throw new Error(data.message || 'Enhancement failed')
      }

      // Try to use structuredData if available
      if (data.structuredData) {
        const enhanced = data.structuredData.base_prompt || data.structuredData.enhanced_prompt
        setEnhancedPrompt(enhanced || null)
        setQuestions(data.structuredData.questions || [])
      } else if (data.rawResponse) {
        // Fallback: Try to extract JSON from raw response
        const jsonText = extractJsonFromResponse(data.rawResponse)
        
        if (jsonText) {
          try {
            const parsed = JSON.parse(jsonText)
            
            if (validateParsedData(parsed)) {
              const enhanced = parsed.base_prompt || parsed.enhanced_prompt
              setEnhancedPrompt(enhanced || null)
              setQuestions(parsed.questions || [])
            } else {
              setEnhancedPrompt(data.rawResponse)
            }
          } catch (parseError) {
            console.error('[EnhanceClient] Failed to parse JSON:', parseError)
            setEnhancedPrompt(data.rawResponse)
          }
        } else {
          setEnhancedPrompt(data.rawResponse)
        }
      }

      if (typeof data.usageCount === 'number') {
        setUsageCount(data.usageCount)
      }

      // History is automatically saved to database by the API
      // Refresh the sidebar history after successful enhancement
      if (typeof window !== 'undefined' && (window as Window & { refreshPromptHistory?: () => void }).refreshPromptHistory) {
        setTimeout(() => {
          (window as Window & { refreshPromptHistory?: () => void }).refreshPromptHistory?.()
        }, 500)
      }

    } catch (err) {
      console.error('Enhancement error:', err)
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage.slice(0, 500))
    } finally {
      setLoading(false)
    }
  }

  // Build final prompt with questions and answers appended (like extension)
  const buildPromptWithQuestions = (): string => {
    if (!enhancedPrompt) return ''
    
    // If no selections, return base prompt
    if (Object.keys(selectedAnswers).length === 0) {
      return enhancedPrompt
    }
    
    // Build Q&A text from selections
    const selectedParts: string[] = []
    
    visibleQuestions.forEach(question => {
      const answer = selectedAnswers[question.id]
      if (answer) {
        if (Array.isArray(answer) && answer.length > 0) {
          // Checkbox - multiple answers
          answer.forEach(opt => {
            selectedParts.push(`${question.text}: ${opt}`)
          })
        } else if (typeof answer === 'string' && answer) {
          // Radio - single answer
          selectedParts.push(`${question.text}: ${answer}`)
        }
      }
    })
    
    // Append Q&A to base prompt
    if (selectedParts.length > 0) {
      return enhancedPrompt + '\n\n' + selectedParts.join('\n')
    }
    
    return enhancedPrompt
  }

  const handleCopy = async (isFinal: boolean = false) => {
    const textToCopy = isFinal ? buildPromptWithQuestions() : enhancedPrompt
    if (!textToCopy) return
    
    try {
      await navigator.clipboard.writeText(textToCopy)
      if (isFinal) {
        setCopiedFinal(true)
        setTimeout(() => setCopiedFinal(false), 2000)
      }
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleAnswerChange = (questionId: string, answer: string | string[]) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  // Handle radio deselection on re-click (like extension)
  const handleRadioClick = (questionId: string, value: string, currentValue: string | string[] | undefined) => {
    if (currentValue === value) {
      // Already selected - deselect it
      setSelectedAnswers(prev => {
        const newAnswers = { ...prev }
        delete newAnswers[questionId]
        return newAnswers
      })
    } else {
      // Select new value
      handleAnswerChange(questionId, value)
    }
  }

  // Final prompt is derived on demand via buildPromptWithQuestions()

  const getVisibleQuestions = () => {
    return questions.filter(q => {
      if (!q.trigger) return true
      
      const parentAnswer = selectedAnswers[q.trigger.question_id]
      if (Array.isArray(parentAnswer)) {
        return parentAnswer.includes(q.trigger.answer)
      }
      return parentAnswer === q.trigger.answer
    })
  }

  const visibleQuestions = getVisibleQuestions()

  return (
    <div className="h-full flex flex-col relative">
      {/* Header Section - Refined (hidden after first enhancement) */}
      {!enhancedPrompt && (
        <div className="text-center py-6 flex-shrink-0 px-4 bg-white/50 backdrop-blur-sm">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="p-2 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl">
              <Sparkles className="w-7 h-7 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
              Prompt Enhancer
            </h1>
          </div>
          <p className="text-gray-600 text-base max-w-2xl mx-auto">
            Transform your prompts into powerful, structured instructions with AI
          </p>
          {usageCount !== null && (
            <div className="inline-flex items-center gap-2 mt-3 px-4 py-1.5 bg-blue-50 rounded-full">
              <span className="text-sm text-gray-600">Enhancements used:</span>
              <span className="font-semibold text-blue-600">{usageCount}</span>
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex-shrink-0">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900 mb-1">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State - Robust, accessible spinner; hide other sections while enhancing */}
      {loading && (
        <div className="flex-1 flex items-center justify-center pb-40" role="status" aria-live="polite" aria-busy="true">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin" />
            </div>
            <p className="text-sm text-gray-600">Enhancing your prompt...</p>
          </div>
        </div>
      )}

      {/* Split Layout: Questions (Left) | Results (Right) */}
      {enhancedPrompt && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 overflow-hidden min-h-0 pb-40">
          {/* Left Column - Questions (Scrollable) */}
          {visibleQuestions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden flex flex-col h-full min-h-0">
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-6 py-4 border-b border-purple-100">
                <h2 className="text-lg font-semibold text-purple-900 flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  Customize Your Prompt
                </h2>
                <p className="text-sm text-purple-700 mt-1">
                  Select options to refine the final prompt
                </p>
              </div>
              <div className="overflow-y-auto flex-1 p-6 pb-24 space-y-4 min-h-0" style={{scrollbarWidth: 'thin'}}>
                {visibleQuestions.map((question) => (
                  <div key={question.id} className="p-4 bg-gradient-to-br from-purple-50 to-white rounded-xl border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="font-semibold text-gray-900 mb-3 text-sm">{question.text}</h4>
                    <div className="space-y-2">
                      {question.type === 'radio' ? (
                        question.options.map((option) => (
                          <label 
                            key={option} 
                            className="flex items-center gap-3 p-3 bg-white hover:bg-purple-50 rounded-lg cursor-pointer transition-all border border-transparent hover:border-purple-200"
                            onClick={(e) => {
                              e.preventDefault()
                              handleRadioClick(question.id, option, selectedAnswers[question.id])
                            }}
                          >
                            <input
                              type="radio"
                              name={question.id}
                              value={option}
                              checked={selectedAnswers[question.id] === option}
                              onChange={() => {}} // Controlled by label click
                              className="w-4 h-4 text-purple-600 focus:ring-2 focus:ring-purple-500 pointer-events-none"
                            />
                            <span className="text-gray-800 text-sm flex-1">{option}</span>
                          </label>
                        ))
                      ) : (
                        question.options.map((option) => (
                          <label key={option} className="flex items-center gap-3 p-3 bg-white hover:bg-purple-50 rounded-lg cursor-pointer transition-all border border-transparent hover:border-purple-200">
                            <input
                              type="checkbox"
                              value={option}
                              checked={Array.isArray(selectedAnswers[question.id]) && selectedAnswers[question.id].includes(option)}
                              onChange={(e) => {
                                const current = (selectedAnswers[question.id] as string[]) || []
                                const updated = e.target.checked
                                  ? [...current, option]
                                  : current.filter(v => v !== option)
                                handleAnswerChange(question.id, updated)
                              }}
                              className="w-4 h-4 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
                            />
                            <span className="text-gray-800 text-sm flex-1">{option}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Right Column - Prompts (Scrollable) */}
          <div className={`flex flex-col h-full min-h-0 ${visibleQuestions.length === 0 ? 'lg:col-span-2' : ''}`}>
            {/* Final Customized Prompt - Always visible */}
            {enhancedPrompt && (
              <div className="bg-white rounded-2xl shadow-sm border border-green-100 overflow-hidden flex flex-col h-full min-h-0">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-green-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-green-900 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Enhanced Prompt
                        {Object.keys(selectedAnswers).length > 0 && (
                          <span className="text-xs bg-green-200 text-green-800 px-2.5 py-0.5 rounded-full font-medium">Live</span>
                        )}
                      </h2>
                      <p className="text-xs text-green-700 mt-1">
                        {Object.keys(selectedAnswers).length > 0 ? 'Updated with your selections' : 'Your optimized prompt'}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleCopy(true)}
                      variant="outline"
                      size="sm"
                      className="border-green-300 hover:bg-green-100 hover:border-green-400 transition-colors"
                    >
                      {copiedFinal ? (
                        <>
                          <Check className="mr-1.5 h-3.5 w-3.5 text-green-600" />
                          <span className="text-xs font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          <span className="text-xs font-medium">Copy</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="p-6 flex-1 overflow-hidden flex flex-col min-h-0">
                  <div className="bg-gradient-to-br from-green-50 to-white p-5 rounded-xl border border-green-200 whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-800 overflow-y-auto flex-1 pb-24 min-h-0" style={{scrollbarWidth: 'thin'}}>
                    {buildPromptWithQuestions()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State - Only show if no enhancement yet */}
      {!enhancedPrompt && !loading && !error && (
        <div className="flex-1 flex items-center justify-center pb-32">
          <div className="text-center">
            <div className="inline-flex p-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl mb-4">
              <Sparkles className="w-14 h-14 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Ready to Enhance Your Prompts
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Type your prompt in the input box below and click &quot;Enhance&quot; to transform it into a powerful, structured instruction
            </p>
          </div>
        </div>
      )}

      {/* Input Section - Fixed at Bottom (Simpler Style) */}
      <div className="fixed bottom-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 transition-all duration-200" style={{ left: 'var(--sidebar-current-width, 0px)' }}>
        <div className="container mx-auto px-4 py-4 max-w-5xl">
          <div className="flex items-center gap-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt here (e.g., Write a blog post about AI safety...)"
              className="flex-1 min-h-[80px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all text-sm"
              disabled={loading}
              maxLength={10000}
              aria-label="Prompt input"
            />
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleEnhance}
                disabled={loading || !prompt.trim()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold whitespace-nowrap"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Enhancing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Enhance
                  </>
                )}
              </Button>
              <span className="text-xs text-gray-500 text-center">
                {prompt.length}/10k
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
