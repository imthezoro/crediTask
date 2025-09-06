'use client'

import { useEffect, useRef } from 'react'

export function useScrollAnimation(threshold = 0.1) {
  const elementRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate')
          } else {
            // Remove animate class when element leaves viewport
            // This allows re-animation when scrolling back
            entry.target.classList.remove('animate')
          }
        })
      },
      {
        threshold,
        rootMargin: '0px 0px -50px 0px'
      }
    )

    observer.observe(element)

    return () => {
      observer.unobserve(element)
    }
  }, [threshold])

  return elementRef
}
