export {}

declare global {
  interface DiscourseGroup {
    owners: string[]
    members: string[]
    groupId?: number
    groupName?: string
    moderatorsGroupId?: number
    moderatorsGroupName?: string
    categoryId?: number
  }

  interface OrganizationPublicMetadata {
    discourse?: {
      domain?: string
      groups?: Record<string, DiscourseGroup>
    }
  }

  interface OrganizationPrivateMetadata {
    discourse?: {
      apiKey?: string
      secret?: string
    }
  }
}
