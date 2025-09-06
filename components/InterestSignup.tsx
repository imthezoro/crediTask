"use client"

import React, { useState } from 'react'
import { Check, Mail, MessageSquare } from 'lucide-react'

interface InterestSignupProps {
  title?: string
  description?: string
  buttonText?: string
  type?: string
  className?: string
}

export default function InterestSignup({ 
  title = "Stay Updated", 
  description = "Get notified about PromptOK updates and new features",
  buttonText = "Get Updates",
  type = "waiting",
  className = ""
}: InterestSignupProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  return (
    <div className={`space-y-6 ${className}`}>
      {(title || description) && (
        <div className="text-center mb-8">
          {title && <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>}
          {description && <p className="text-slate-300 text-lg">{description}</p>}
        </div>
      )}

      {isSuccess ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-white" />
          </div>
          <h4 className="text-xl font-bold text-white mb-2">Thank you!</h4>
          <p className="text-slate-300">We'll keep you updated on our latest features and improvements.</p>
        </div>
      ) : (
        <form
          className="space-y-6"
          onSubmit={async (e) => {
            e.preventDefault()
            setIsSubmitting(true)
            const form = e.target as HTMLFormElement
            const formData = new FormData(form)

            // Normalize and validate inputs
            const emailRaw = (formData.get('email') ?? '').toString().trim()
            const feedbackRaw = (formData.get('feedback') ?? '').toString().trim()

            if (!emailRaw) {
              alert('Please provide a valid email address.')
              setIsSubmitting(false)
              return
            }

            try {
              const response = await fetch('/api/interest-signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: emailRaw,
                  feedback: feedbackRaw,
                  type: type,
                }),
              })
              if (response.ok) {
                setIsSuccess(true)
                form.reset()
              } else {
                alert('Something went wrong. Please try again.')
              }
            } catch {
              alert('Something went wrong. Please try again.')
            } finally {
              setIsSubmitting(false)
            }
          }}
        >
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="email"
              id="email"
              name="email"
              className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
              placeholder="Enter your email address"
              required
            />
          </div>

          <div className="relative">
            <div className="absolute top-4 left-0 pl-4 flex items-start pointer-events-none">
              <MessageSquare className="h-5 w-5 text-slate-400" />
            </div>
            <textarea
              id="feedback"
              name="feedback"
              rows={3}
              className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 resize-none"
              placeholder="Any suggestions or features you'd like to see? (Optional)"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-gray-500 disabled:to-gray-600 text-white py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-xl"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Submitting...
              </div>
            ) : (
              buttonText
            )}
          </button>
        </form>
      )}
    </div>
  )
}
