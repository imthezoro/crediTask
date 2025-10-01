'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

export default function EnhancePromptClient() {
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string | string[]>>({})
  const [selectionUpdates, setSelectionUpdates] = useState<SelectionUpdate[]>([])
  const [copied, setCopied] = useState(false)
  const [copiedFinal, setCopiedFinal] = useState(false)
  const [usageCount, setUsageCount] = useState<number | null>(null)

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

      if (data.structuredData) {
        const enhanced = data.structuredData.enhanced_prompt || data.structuredData.base_prompt
        setEnhancedPrompt(enhanced || null)
        setQuestions(data.structuredData.questions || [])
        setSelectionUpdates(data.structuredData.selection_updates || [])
      } else if (data.rawResponse) {
        setEnhancedPrompt(data.rawResponse)
      }

      if (typeof data.usageCount === 'number') {
        setUsageCount(data.usageCount)
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
      } else {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
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

  // Generate final prompt based on current selections
  const generateFinalPrompt = (): string | null => {
    if (!enhancedPrompt) return null
    
    // If no questions or no selection updates, return base prompt
    if (questions.length === 0 || selectionUpdates.length === 0) {
      return enhancedPrompt
    }
    
    // Build current selection path from selectedAnswers
    const currentPath: { question_id: string; option: string }[] = []
    questions.forEach(q => {
      const answer = selectedAnswers[q.id]
      if (answer) {
        if (Array.isArray(answer)) {
          // For checkboxes, add each selected option
          answer.forEach(opt => currentPath.push({ question_id: q.id, option: opt }))
        } else {
          // For radio buttons
          currentPath.push({ question_id: q.id, option: answer })
        }
      }
    })
    
    // If no selections made, return base prompt
    if (currentPath.length === 0) {
      return enhancedPrompt
    }
    
    // Find matching selection_update
    // Look for the most specific match (longest matching path)
    let bestMatch: SelectionUpdate | null = null
    let bestMatchLength = 0
    
    for (const update of selectionUpdates) {
      // Check how many items in update.selection_path match currentPath
      let matchCount = 0
      for (const pathItem of update.selection_path) {
        const matches = currentPath.some(
          cp => cp.question_id === pathItem.question_id && cp.option === pathItem.option
        )
        if (matches) matchCount++
      }
      
      // If all items in update.selection_path are matched, and it's more specific than previous best
      if (matchCount === update.selection_path.length && matchCount > bestMatchLength) {
        bestMatch = update
        bestMatchLength = matchCount
      }
    }
    
    return bestMatch ? bestMatch.base_prompt : enhancedPrompt
  }

  const finalPrompt = generateFinalPrompt()

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
    <>
      {/* Header Section - Refined */}
      <div className="text-center mb-8">
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

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900 mb-1">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Split Layout: Questions (Left) | Results (Right) */}
      {enhancedPrompt && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Left Column - Questions (Scrollable) */}
          {visibleQuestions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden flex flex-col">
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 px-6 py-4 border-b border-purple-100">
                <h2 className="text-lg font-semibold text-purple-900 flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  Customize Your Prompt
                </h2>
                <p className="text-sm text-purple-700 mt-1">
                  Select options to refine the final prompt
                </p>
              </div>
              <div className="overflow-y-auto flex-1 p-6 space-y-4 max-h-[calc(100vh-320px)]" style={{scrollbarWidth: 'thin'}}>
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
          <div className={`space-y-5 ${visibleQuestions.length === 0 ? 'lg:col-span-2' : ''}`}>
            {/* Base Enhanced Prompt */}
            <div className="bg-white rounded-2xl shadow-sm border border-blue-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      Base Enhanced Prompt
                    </h2>
                    <p className="text-xs text-blue-700 mt-1">
                      Your optimized starting point
                    </p>
                  </div>
                  <Button
                    onClick={() => handleCopy(false)}
                    variant="outline"
                    size="sm"
                    className="border-blue-300 hover:bg-blue-100 hover:border-blue-400 transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
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
              <div className="p-6">
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-800 max-h-[320px] overflow-y-auto" style={{scrollbarWidth: 'thin'}}>
                  {enhancedPrompt}
                </div>
              </div>
            </div>

            {/* Final Prompt with Selected Options - Always show when selections exist */}
            {Object.keys(selectedAnswers).length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-green-100 overflow-hidden animate-in fade-in duration-300">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-4 border-b border-green-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-green-900 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Final Customized Prompt
                        <span className="text-xs bg-green-200 text-green-800 px-2.5 py-0.5 rounded-full font-medium">Live</span>
                      </h2>
                      <p className="text-xs text-green-700 mt-1">
                        Updated with your selections
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
                <div className="p-6">
                  <div className="bg-gradient-to-br from-green-50 to-white p-5 rounded-xl border border-green-200 whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-800 max-h-[320px] overflow-y-auto" style={{scrollbarWidth: 'thin'}}>
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
        <div className="mb-8 py-16 text-center">
          <div className="inline-flex p-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl mb-4">
            <Sparkles className="w-14 h-14 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            Ready to Enhance Your Prompts
          </h3>
          <p className="text-gray-600 max-w-md mx-auto">
            Type your prompt in the input box below and click "Enhance" to transform it into a powerful, structured instruction
          </p>
        </div>
      )}

      {/* Spacer for fixed input box */}
      <div className="h-36"></div>

      {/* Input Section - Fixed at Bottom (Simpler Style) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-20">
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
    </>
  )
}
