import { createRoute } from '@tanstack/react-router'
import Discourse from '../components/Discourse'
import { rootRoute } from './__root'

export const discourseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/discourse',
  component: Discourse,
})
