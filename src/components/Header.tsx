import { UserButton, useUser } from '@clerk/react'
import { Link } from '@tanstack/react-router'

export default function Header() {
  const { user } = useUser()

  return (
    <header className="w-full bg-white shadow-md">
      <div className="flex items-center justify-between px-6 h-14">
        <Link to="/">
          <img src="/header.svg" alt="Performant Studio" className="h-8" />
        </Link>

        { !user && (
          <a href="/sign-in" className="text-sm text-gray-700 hover:text-gray-900 transition-colors">Sign In</a>
        )}

        { user && (
          <div className="relative">
            <UserButton
              showName
            />
          </div>
        )}
      </div>
    </header>
  )
}
