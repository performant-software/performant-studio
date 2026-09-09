import type { AppCardLink } from './AppCard.tsx'
import { useOrganization, useUser } from '@clerk/react'
import { useCallback, useMemo } from 'react'
import { ownedGroupNames } from '../lib/organizations.ts'
import AppCard from './AppCard.tsx'

const APPS = [
  {
    name: 'FairData',
    description: 'Model, create and manage data about People, Places, Events, and relate them together.',
    icon: '/icons/fairdata.svg',
  },
  {
    name: 'FairCopy Cloud',
    description: 'Mark up your text documents with identifiers from FairData.',
    icon: '/icons/faircopy.svg',
  },
  {
    name: 'FairImage',
    description: 'Upload media and use them in IIIF manifests.',
    icon: '/icons/fairimage.svg',
  },
]

export default function AppGrid() {
  const orgStatus = useOrganization()
  const { user } = useUser()

  const discourseDomain = orgStatus.organization?.publicMetadata?.discourse?.domain

  // get the first (and most likely only) Discourse group the user is in
  const getFirstUserGroup = useCallback(() => {
    if (!user?.id) {
      return null
    }

    const discourseMeta = orgStatus.organization?.publicMetadata?.discourse

    if (discourseMeta?.groups) {
      return Object.values(discourseMeta.groups)
        .find(group => group.members.includes(user.id))
    }

    return null
  }, [orgStatus.organization?.publicMetadata?.discourse, user?.id])

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
      const href = new URL('/session/sso', `https://${discourseDomain}`)

      // if admin
      if (orgStatus.membership?.role === 'org:admin') {
        href.searchParams.set('return_path', `/categories`)
      }
      else {
        const userGroup = getFirstUserGroup()
        if (userGroup) {
          href.searchParams.set('return_path', `/c/${userGroup.groupName}`)
        }
      }

      result.push({ label: 'Open', href: href.toString() })
    }

    if (canManageGroups) {
      result.push({ label: 'Manage groups', href: '/discourse' })
    }

    return result
  }, [canManageGroups, discourseDomain, getFirstUserGroup, orgStatus.membership?.role])

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
