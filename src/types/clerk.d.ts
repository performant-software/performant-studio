export {}

declare global {
  interface OrganizationPublicMetadata {
    discourse?: {
      domain?: string
      groups?: string[]
    }
  }
}
