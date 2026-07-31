export {}

declare global {
  /** Everything stored about a Discourse group, keyed by group name. */
  interface DiscourseGroup {
    /** Clerk user IDs of the group's owners. */
    owners: string[]
  }

  interface OrganizationPublicMetadata {
    discourse?: {
      domain?: string
      groups?: Record<string, DiscourseGroup>
    }
  }
}
