import { SignIn as ClerkSignIn } from '@clerk/react'

function SignIn() {
  return (
    <>
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
