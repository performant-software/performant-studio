import { OrganizationSwitcher, Show } from '@clerk/react'
import useRedirect from './hooks/useRedirect.ts'
import './App.css'

function App() {
  useRedirect()

  return (
    <div className="h-full w-full grow flex flex-col items-center justify-evenly bg-gray-100 text-gray-900 p-4">
      <Show when="signed-out">
        <h1 className="text-6xl font-bold text-performant mb-2">Performant Studio</h1>
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg">You're not logged in.</p>
          <a
            href="/sign-in"
            className="rounded-md bg-performant px-4 py-2 font-semibold text-white shadow-sm transition-colors hover:bg-performant/90 focus:outline-none focus:ring-2 focus:ring-performant focus:ring-offset-2"
          >
            Click here to sign in.
          </a>
        </div>
      </Show>
      <Show when="signed-in">
        <div className="flex flex-col items-center gap-12">
          <h1 className="text-3xl font-bold">
            Welcome back
          </h1>
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-xl">Your organizations:</h2>
            <OrganizationSwitcher />
          </div>
        </div>
      </Show>
    </div>
  )
}

export default App
