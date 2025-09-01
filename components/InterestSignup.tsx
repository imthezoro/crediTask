"use client"

import React, { useState } from 'react'

export default function InterestSignup() {
  const [rating, setRating] = useState<number>(5)
  const [hover, setHover] = useState<number | null>(null)
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg shadow p-6 border-2 border-dashed border-blue-300">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Need More Credits?</h3>
        <p className="text-gray-600">Let us know you&apos;re interested in higher limits</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const form = e.target as HTMLFormElement
          const formData = new FormData(form)

          // Normalize and validate inputs
          const emailRaw = (formData.get('email') ?? '').toString().trim()
          const usageRaw = (formData.get('usage') ?? '').toString().trim()
          const feedbackRaw = (formData.get('feedback') ?? '').toString().trim()
          const ratingRaw = (formData.get('rating') ?? '').toString().trim()

          // Coerce to correct types
          const usage = Number(usageRaw)
          const ratingVal = Number(ratingRaw)

          if (!emailRaw) {
            alert('Please provide a valid email address.')
            return
          }
          if (!Number.isFinite(usage) || usage < 0) {
            alert('Please provide a valid non-negative number for usage.')
            return
          }
          if (!Number.isFinite(ratingVal) || ratingVal < 1 || ratingVal > 5) {
            alert('Please select a rating between 1 and 5.')
            return
          }

          try {
            const response = await fetch('/api/interest-signup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: emailRaw,
                usage,
                feedback: feedbackRaw,
                rating: ratingVal,
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
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="your@email.com"
            required
          />
        </div>

        <div>
          <label htmlFor="usage" className="block text-sm font-medium text-gray-700 mb-1">
            Expected Weekly Usage (number)
          </label>
          <input
            type="number"
            id="usage"
            name="usage"
            min={0}
            step={1}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. 250"
            required
          />
        </div>

        <div>
          <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-1">
            Feedback (Optional)
          </label>
          <textarea
            id="feedback"
            name="feedback"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="What would make PromptOK more useful for you?"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rating
          </label>
          <div className="flex items-center gap-1">
            {[1,2,3,4,5].map((star) => (
              <button
                type="button"
                key={star}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setRating(star)}
                aria-label={`Rate ${star} star${star>1?'s':''}`}
                className={`transition-transform duration-150 ${ (hover ?? rating) >= star ? 'text-yellow-400' : 'text-gray-300' } hover:scale-110`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-7 h-7">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.035a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.802-2.035a1 1 0 00-1.175 0L6.659 16.28c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L3.024 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.025-3.292z" />
                </svg>
              </button>
            ))}
          </div>
          {/* Hidden input to submit rating value */}
          <input type="hidden" name="rating" value={rating} />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Express Interest
        </button>
      </form>
    </div>
  )
}
