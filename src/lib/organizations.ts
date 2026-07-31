export function isDiscourse(organization: any) {
  return !!organization.publicMetadata?.discourse?.domain
}
