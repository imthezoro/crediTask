'use client'

import { useState } from 'react'

export default function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // TODO: Wire to your backend/helpdesk API
    console.log('Form submission placeholder')
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false)
      alert('Thank you for your message! This is a placeholder response.')
    }, 1000)
  }

  return (
    <div className="rounded-lg border p-6">
      <h2 className="text-xl font-medium">Submit a Request</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Use this form as a placeholder. Wire it to your preferred backend or helpdesk later.
      </p>
      <form className="mt-6 grid grid-cols-1 gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-1">
          <label className="text-sm font-medium" htmlFor="name">
            Full Name
          </label>
          <input 
            id="name" 
            name="name" 
            required
            className="h-10 rounded-md border border-gray-300 px-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" 
            placeholder="Jane Doe" 
          />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input 
            id="email" 
            name="email" 
            type="email" 
            required
            className="h-10 rounded-md border border-gray-300 px-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" 
            placeholder="jane@example.com" 
          />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium" htmlFor="subject">
            Subject
          </label>
          <input 
            id="subject" 
            name="subject" 
            required
            className="h-10 rounded-md border border-gray-300 px-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" 
            placeholder="Billing question" 
          />
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium" htmlFor="message">
            Message
          </label>
          <textarea 
            id="message" 
            name="message" 
            required
            className="min-h-[120px] rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" 
            placeholder="Describe your issue or request..." 
          />
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Sending...' : 'Send Message'}
          </button>
          <a 
            className="text-sm text-gray-600 underline hover:text-blue-600" 
            href="mailto:support@yourdomain.com?subject=Support%20Request"
          >
            or email us directly
          </a>
        </div>
      </form>
    </div>
  )
}
