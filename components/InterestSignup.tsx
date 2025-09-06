"use client"

import React from 'react'

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
  return (
    <div className={`space-y-4 ${className}`}>
      {(title || description) && (
        <div className="text-center mb-6">
          {title && <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>}
          {description && <p className="text-gray-600">{description}</p>}
        </div>
      )}

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const form = e.target as HTMLFormElement
          const formData = new FormData(form)

          // Normalize and validate inputs
          const emailRaw = (formData.get('email') ?? '').toString().trim()
          const feedbackRaw = (formData.get('feedback') ?? '').toString().trim()

          if (!emailRaw) {
            alert('Please provide a valid email address.')
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
              alert("Thank you for your interest! We'll be in touch soon.")
              form.reset()
            } else {
              alert('Something went wrong. Please try again.')
            }
          } catch {
            alert('Something went wrong. Please try again.')
          }
        }}
      >
        <div>
          <input
            type="email"
            id="email"
            name="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="email"
            required
          />
        </div>

        <div>
          <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-1">
            Suggestions (Optional)
          </label>
          <textarea
            id="feedback"
            name="feedback"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Any suggestions or features you'd like to see?"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          {buttonText}
        </button>
      </form>
    </div>
  )
}
