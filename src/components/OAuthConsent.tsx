import { OAuthConsent, Show } from '@clerk/react'

// The OAuth consent screen shown when an app such as the pstudio CLI requests
// access. OAuthConsent reads client_id, scope, and redirect_uri from the query
// string and loads the app name and requested scopes from Clerk, so the page
// always reflects what is actually being requested. It renders only for
// signed-in users; Clerk sends signed-out users through sign-in first.
function OAuthConsentPage() {
  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <Show when="signed-in">
        <OAuthConsent />
      </Show>
    </div>
  )
}

export default OAuthConsentPage
