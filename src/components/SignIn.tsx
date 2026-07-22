import { SignIn as ClerkSignIn, useAuth } from '@clerk/react'
import { useEffect } from 'react'

const allowedOrigins = import.meta.env.VITE_ALLOWED_REDIRECT_ORIGINS?.split(',') ?? []

function useSatelliteRedirect() {
  const { isLoaded, isSignedIn } = useAuth()

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return
    }

    const hash = window.location.hash
    const queryIndex = hash.indexOf('?')
    if (queryIndex === -1) {
      return
    }

    const target = new URLSearchParams(hash.slice(queryIndex + 1)).get('redirect_url')
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

function SignIn() {
  useSatelliteRedirect()

  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <ClerkSignIn
        path="/sign-in"
        routing="path"
      />
    </div>
  )
}

export default SignIn
