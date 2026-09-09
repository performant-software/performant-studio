import type { AppCardLink } from './AppCard.tsx'
import { useOrganization, useUser } from '@clerk/react'
import { useMemo } from 'react'
import { ownedGroupNames } from '../lib/organizations.ts'
import AppCard from './AppCard.tsx'

const APPS = [
  {
    name: 'FairData',
    description: 'Model, create and manage data about People, Places, Events, and relate them together.',
    icon: '/icons/fairdata.svg',
    links: [{
      label: 'Open',
      href: import.meta.env.VITE_FAIRDATA_URL,
    }],
  },
  {
    name: 'FairCopy',
    description: 'Mark up your text documents with identifiers from FairData.',
    icon: '/icons/faircopy.svg',
    links: [{
      label: 'Open',
      href: import.meta.env.VITE_FAIRCOPY_SERVER_URL,
    }],
  },
]

export default function AppGrid() {
  const orgStatus = useOrganization()
  const { user } = useUser()

  const discourseDomain = orgStatus.organization?.publicMetadata?.discourse?.domain

  const canManageGroups = useMemo(() => {
    if (!discourseDomain) {
      return false
    }

    return orgStatus.membership?.role === 'org:admin'
      || ownedGroupNames(orgStatus.organization, user?.id).length > 0
  }, [discourseDomain, orgStatus.membership?.role, orgStatus.organization, user?.id])

  const discourseLinks: AppCardLink[] = useMemo(() => {
    const result: AppCardLink[] = []

    if (discourseDomain) {
      result.push({ label: 'Open', href: `https://${discourseDomain}` })
    }

    if (canManageGroups) {
      result.push({ label: 'Manage groups', href: '/discourse' })
    }

    return result
  }, [canManageGroups, discourseDomain])

  return (
    <section>
      <h2 className="text-lg font-semibold">Your Apps</h2>
      <div className="mt-4 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {APPS.map(app => (
          <AppCard key={app.name} {...app} />
        ))}
        {discourseDomain && (
          <AppCard
            name="Discourse"
            description="Discuss your work with your team and community in a forum that shares your Performant Studio sign-in."
            icon="/icons/discourse.svg"
            links={discourseLinks}
          />
        )}
      </div>
    </section>
  )
}
