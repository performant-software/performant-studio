export {}

declare global {
  /** Everything stored about a Discourse group, keyed by group name. */
  interface DiscourseGroup {
    owners: string[]
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
