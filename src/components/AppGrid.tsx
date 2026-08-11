import type { AppCardLink } from './AppCard.tsx'
import { useOrganization } from '@clerk/react'
import { useMemo } from 'react'
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

  const domain = orgStatus.organization?.publicMetadata?.discourse?.domain

  const discourseLinks: AppCardLink[] = useMemo(() => {
    const result: AppCardLink[] = []

    if (domain) {
      result.push({ label: 'Open', href: `https://${domain}` })
    }

    if (orgStatus.membership?.role === 'org:admin') {
      result.push({ label: 'Manage groups', href: '/settings' })
    }

    return result
  }, [domain, orgStatus.membership?.role])

  return (
    <section>
      <h2 className="text-lg font-semibold">Your Apps</h2>
      <div className="mt-4 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {APPS.map(app => (
          <AppCard key={app.name} {...app} />
        ))}
        {domain && (
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
