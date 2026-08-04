import { OrganizationSwitcher, Show } from '@clerk/react'
import AppGrid from './components/AppGrid.tsx'
import useRedirect from './hooks/useRedirect.ts'
import './App.css'

function App() {
  useRedirect()

  return (
    <div className="h-full w-full grow flex flex-col bg-gray-100 text-gray-900">
      <Show when="signed-out">
        <div className="grow flex flex-col items-center justify-evenly p-4">
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
        </div>
      </Show>
      <Show when="signed-in">
        <main className="w-full max-w-6xl mx-auto flex flex-col gap-10 px-6 py-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-bold">
              Welcome back
            </h1>
            <OrganizationSwitcher />
          </div>
          <AppGrid />
        </main>
      </Show>
    </div>
  )
}

export default App
