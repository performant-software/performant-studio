export function isDiscourse(organization: any) {
  return !!organization.publicMetadata?.discourse?.domain
}

// Mirrors the slug the groups edge function gives each Discourse category.
function slugify(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

export function groupUrl(organization: any, name: string): string | null {
  const domain = organization?.publicMetadata?.discourse?.domain

  return domain ? `https://${domain}/c/${slugify(name)}` : null
}

export function ownedGroupNames(organization: any, userId?: string | null): string[] {
  if (!userId) {
    return []
  }

  const groups: Record<string, DiscourseGroup> = organization?.publicMetadata?.discourse?.groups ?? {}

  return Object.keys(groups).filter(name => groups[name].owners.includes(userId))
}
