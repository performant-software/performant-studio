import { Link } from '@tanstack/react-router'

export interface AppCardLink {
  label: string
  href: string
}

interface AppCardProps {
  name: string
  description: string
  icon: string
  links?: AppCardLink[]
}

export default function AppCard({ name, description, icon, links }: AppCardProps) {
  return (
    <article className="flex flex-col items-center rounded-xl bg-white p-8 text-center shadow-sm">
      <span className="flex size-14 items-center justify-center rounded-xl text-white">
        <img src={icon} alt={name} />
      </span>
      <h3 className="mt-4 text-xl font-semibold">{name}</h3>
      <p className="mt-3 text-[15px] leading-relaxed text-gray-600">{description}</p>
      {links?.length
        ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              {links.map(link => (
                link.href.startsWith('/')
                  ? (
                      <Link
                        key={link.label}
                        to={link.href}
                        className="text-sm font-semibold text-performant hover:underline"
                      >
                        {link.label}
                      </Link>
                    )
                  : (
                      <a
                        key={link.label}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-performant hover:underline"
                      >
                        {link.label}
                      </a>
                    )
              ))}
            </div>
          )
        : null}
    </article>
  )
}
