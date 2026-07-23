import { SignIn as ClerkSignIn } from '@clerk/react'
import Redirect from '../Redirect.tsx'

function SignIn() {
  return (
    <>
      <Redirect />
      <div className="h-screen w-screen flex items-center justify-center">
        <ClerkSignIn
          path="/sign-in"
          routing="path"
        />
      </div>
    </>
  )
}

export default SignIn
