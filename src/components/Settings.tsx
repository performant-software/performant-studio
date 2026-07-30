import { OrganizationSwitcher, Show, useOrganization } from '@clerk/react'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

const TABS = [
  { id: 'discourse', label: 'Discourse' },
] as const

type TabId = typeof TABS[number]['id']

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabId>('discourse')
  const { isLoaded, membership } = useOrganization()
  const navigate = useNavigate()

  const isAdmin = membership?.role === 'org:admin'

  useEffect(() => {
    if (isLoaded && !isAdmin) {
      void navigate({ to: '/', replace: true })
    }
  }, [isAdmin, isLoaded, navigate])

  if (!isLoaded || !isAdmin) {
    return null
  }

  return (
    <div className="h-full w-full grow flex flex-col bg-gray-100 text-gray-900">
      <Show when="signed-in">
        <main className="w-full max-w-6xl mx-auto flex flex-col gap-10 px-6 py-10">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Organization Settings</h1>
            <OrganizationSwitcher />
          </div>
          <section>
            <div className="border-b border-gray-300" role="tablist" aria-label="Settings">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`${tab.id}-tab`}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`${tab.id}-panel`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'border-performant text-performant'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {TABS.map(tab => (
              <div
                key={tab.id}
                role="tabpanel"
                id={`${tab.id}-panel`}
                aria-labelledby={`${tab.id}-tab`}
                hidden={activeTab !== tab.id}
                className="py-8"
              >
              </div>
            ))}
          </section>
        </main>
      </Show>
    </div>
  )
}
