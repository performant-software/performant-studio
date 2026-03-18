import { createRoute } from '@tanstack/react-router'
import SignIn from '../components/SignIn'
import { rootRoute } from './__root'

export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  component: SignIn,
})
