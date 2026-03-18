import { SignIn as ClerkSignIn } from '@clerk/react'

function SignIn() {
  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <ClerkSignIn />
    </div>
  )
}

export default SignIn
