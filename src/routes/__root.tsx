import { createRootRoute, Outlet } from '@tanstack/react-router'
import Header from '../components/Header.tsx'

export const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen min-w-screen flex flex-col">
      <Header />
      <Outlet />
    </div>
  ),
})
