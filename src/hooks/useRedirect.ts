import { useAuth } from '@clerk/react'
import { useEffect } from 'react'

const allowedOrigins = import.meta.env.VITE_ALLOWED_REDIRECT_ORIGINS?.split(',') ?? []

function hashQuery() {
  const hash = window.location.hash
  const queryIndex = hash.indexOf('?')
  return queryIndex === -1 ? '' : hash.slice(queryIndex + 1)
}

function useRedirect() {
  const { isLoaded, isSignedIn } = useAuth()

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    const target = new URLSearchParams(hashQuery()).get('redirect_url')
      ?? new URLSearchParams(window.location.search).get('redirect_url')

    if (!target) {
      return
    }

    let origin
    try {
      origin = new URL(target).origin
    }
    catch {
      return
    }

    if (!allowedOrigins.includes(origin)) {
      return
    }

    window.location.replace(target)
  }, [isLoaded, isSignedIn])
}

export default useRedirect
