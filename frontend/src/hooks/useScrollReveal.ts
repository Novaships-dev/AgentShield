'use client'

import { useEffect } from 'react'

/**
 * Observes all elements with [data-reveal] and adds .is-visible
 * when they enter the viewport. Runs once per mount.
 */
export default function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]')
    if (!els.length) return

    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            ;(e.target as HTMLElement).classList.add('is-visible')
            io.unobserve(e.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )

    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
}
