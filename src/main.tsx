import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ClerkProvider } from '@clerk/react'

const redirectOrigins = import.meta.env.VITE_ALLOWED_REDIRECT_ORIGINS?.split(",")

console.log(redirectOrigins)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      allowedRedirectOrigins={redirectOrigins}
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
    >
      <App />
    </ClerkProvider>
  </StrictMode>,
)
