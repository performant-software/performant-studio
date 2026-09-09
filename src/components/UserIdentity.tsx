export interface User {
  userId: string
  name: string
  email: string
  imageUrl: string
}

interface UserIdentityProps {
  user: User
  size?: 'sm' | 'md'
}

export default function UserIdentity({ user, size = 'md' }: UserIdentityProps) {
  const avatarClasses = `${size === 'sm' ? 'size-6' : 'size-8'} shrink-0 rounded-full`

  return (
    <span className="flex min-w-0 items-center gap-3">
      {user.imageUrl
        ? <img src={user.imageUrl} alt="" className={`${avatarClasses} object-cover`} />
        : <span aria-hidden="true" className={`${avatarClasses} bg-gray-200`} />}
      <span className="flex min-w-0 flex-col">
        <span
          title={user.name}
          // People we only know by id are not in the organization, so set them apart.
          className={`truncate text-sm font-semibold ${user.imageUrl ? 'text-gray-900' : 'text-gray-500 italic'}`}
        >
          {user.name}
        </span>
        {user.email && (
          <span title={user.email} className="truncate text-xs text-gray-500">
            {user.email}
          </span>
        )}
      </span>
    </span>
  )
}
