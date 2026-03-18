import { createRoute } from '@tanstack/react-router'
import Sso from '../components/Sso'
import { rootRoute } from './__root.tsx'

export const ssoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sso',
  component: Sso,
})
