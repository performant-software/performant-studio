export function isDiscourse(organization: any) {
  return !!organization.publicMetadata?.discourse?.domain
}

export function ownedGroupNames(organization: any, userId?: string | null): string[] {
  if (!userId) {
    return []
  }

  const groups: Record<string, DiscourseGroup> = organization?.publicMetadata?.discourse?.groups ?? {}

  return Object.keys(groups).filter(name => groups[name].owners.includes(userId))
}
