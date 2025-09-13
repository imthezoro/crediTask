"use client"

import React, { useState } from 'react'
import { Mail, MessageSquare, Check } from 'lucide-react'

export default function ApiAccessSignup() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    try {
      setIsSubmitting(true)
      const res = await fetch('/api/interest-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email'),
          feedback: formData.get('note') || undefined,
          type: 'api_access',
        }),
      })
      if (res.ok) {
        setIsSuccess(true)
        form.reset()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data?.error || 'Something went wrong. Please try again.')
      }
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mt-4 space-y-6">
      {isSuccess ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-white" />
          </div>
          <h4 className="text-xl font-bold text-white mb-2">Thank you!</h4>
          <p className="text-slate-300">We&apos;ll notify you as soon as API access becomes available.</p>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-slate-400" />
            </div>
            <input
              id="api-email"
              name="email"
              type="email"
              required
              placeholder="Enter your email address"
              className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
            />
          </div>

          <div className="relative">
            <div className="absolute top-4 left-0 pl-4 flex items-start pointer-events-none">
              <MessageSquare className="h-5 w-5 text-slate-400" />
            </div>
            <textarea
              id="api-note"
              name="note"
              rows={3}
              placeholder="Tell us briefly how you plan to use the API (Optional)"
              className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 resize-none"
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
              'Request API Access'
            )}
          </button>
        </form>
      )}
    </div>
  )
}
