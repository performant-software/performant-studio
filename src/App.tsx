import { OrganizationSwitcher, Show } from '@clerk/react'
import './App.css'

function App() {
  return (
    <div className="h-full w-full grow flex flex-col items-center justify-evenly bg-gray-100 text-gray-900 p-4">
      <h1 className="text-6xl font-bold text-performant mb-2">Performant Studio</h1>
      <Show when="signed-out">
        <a href="/sign-in">You're not logged in.</a>
      </Show>
      <Show when="signed-in">
        <div className="flex flex-col items-center gap-4">
          Organizations:
          <OrganizationSwitcher />
        </div>
      </Show>
    </div>
  )
}

export default App
