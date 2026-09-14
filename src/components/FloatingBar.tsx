import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

interface FloatingBarProps {
  children: ReactNode
  label?: string
  show?: boolean
}

export default function FloatingBar({ children, label, show = true }: FloatingBarProps) {
  const [isMounted, setIsMounted] = useState(show)

  // Keeps the bar on screen through its exit animation, still showing whatever
  // it held when it was dismissed rather than flickering to a new state.
  const lastChildrenRef = useRef(children)

  useEffect(() => {
    if (show) {
      lastChildrenRef.current = children
    }
  }, [children, show])

  if (show && !isMounted) {
    setIsMounted(true)
  }

  if (!isMounted) {
    return null
  }

  return (
    <>
      <div aria-hidden="true" className="h-14" />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-6 pb-6">
        <div
          role={label ? 'region' : undefined}
          aria-label={label}
          onAnimationEnd={() => {
            if (!show) {
              setIsMounted(false)
            }
          }}
          className={`mx-auto flex w-full max-w-6xl flex-wrap items-center justify-end gap-4 rounded-xl border border-gray-200 bg-white/90 px-5 py-3 shadow-lg backdrop-blur-sm ${
            show ? 'pointer-events-auto animate-fade-in-up' : 'animate-fade-out-down'
          }`}
        >
          {show ? children : lastChildrenRef.current}
        </div>
      </div>
    </>
  )
}
