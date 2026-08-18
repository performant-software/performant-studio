import { OrganizationSwitcher, Show, useOrganization, useUser } from '@clerk/react'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { ownedGroupNames } from '../lib/organizations.ts'
import DiscourseGroups from './DiscourseGroups'

export default function Discourse() {
  const { isLoaded, membership, organization } = useOrganization()
  const { isLoaded: isUserLoaded, user } = useUser()
  const navigate = useNavigate()

  const canManage = membership?.role === 'org:admin'
    || ownedGroupNames(organization, user?.id).length > 0

  const isReady = isLoaded && isUserLoaded

  useEffect(() => {
    if (isReady && !canManage) {
      void navigate({ to: '/', replace: true })
    }
  }, [canManage, isReady, navigate])

  if (!isReady || !canManage) {
    return null
  }

  return (
    <div className="h-full w-full grow flex flex-col bg-gray-100 text-gray-900">
      <Show when="signed-in">
        <main className="w-full max-w-6xl mx-auto flex flex-col gap-10 px-6 py-10">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Discourse</h1>
            <OrganizationSwitcher />
          </div>
          <DiscourseGroups key={organization?.id} />
        </main>
      </Show>
    </div>
  )
}
