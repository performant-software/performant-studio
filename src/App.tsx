import { Show, SignIn, UserButton } from '@clerk/react'
import './App.css'

function App() {
  return (
    <div className="min-h-screen min-w-screen flex flex-col items-center justify-center bg-gray-100 text-gray-900 p-4">
      <header className="bg-white shadow-md rounded-lg p-8 max-w-md w-full flex flex-col items-center gap-6">
        <h1 className="text-2xl font-bold text-blue-600 mb-2">Performant Studio</h1>
        <p className="text-gray-600 text-center mb-4">
          Welcome to Performant Studio.
        </p>
        <Show when="signed-out">
          <SignIn />
        </Show>
        <Show when="signed-in">
          <div className="flex flex-col items-center gap-4">
            <span className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
              Successfully Signed In
            </span>
            <UserButton />
          </div>
        </Show>
      </header>
    </div>
  )
}

export default App
