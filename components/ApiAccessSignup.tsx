"use client"

import React from 'react'

export default function ApiAccessSignup() {
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    try {
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
        alert("Thanks! We'll notify you when API access is available.")
        form.reset()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data?.error || 'Something went wrong. Please try again.')
      }
    } catch {
      alert('Network error. Please try again.')
    }
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={onSubmit}>
      <div>
        <label htmlFor="api-email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="api-email"
          name="email"
          type="email"
          required
          placeholder="your@email.com"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label htmlFor="api-note" className="block text-sm font-medium text-gray-700 mb-1">
          Note (optional)
        </label>
        <textarea
          id="api-note"
          name="note"
          rows={2}
          placeholder="Tell us briefly how you plan to use the API"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <button
        type="submit"
        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
      >
        Request API Access
      </button>
    </form>
  )
}
