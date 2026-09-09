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

const CARD_CLASS = 'flex flex-col items-center rounded-xl bg-white p-8 text-center shadow-sm'

const isInternalLink = (href: string) => href.startsWith('/')

export default function AppCard({ name, description, icon, links }: AppCardProps) {
  const body = (
    <>
      <span className="flex size-14 items-center justify-center rounded-xl">
        <img src={icon} alt={name} />
      </span>
      <h3 className="mt-4 text-xl font-semibold">{name}</h3>
      <p className="mt-3 text-[15px] leading-relaxed text-gray-600">{description}</p>
    </>
  )

  // make the entire card clickable if there is exactly one link
  if (links?.length === 1) {
    const [link] = links
    const className = `${CARD_CLASS} outline-2 outline-offset-2 outline-transparent transition hover:shadow-md hover:outline-performant focus-visible:outline-performant`

    return isInternalLink(link.href)
      ? (
          <Link to={link.href} className={className}>
            {body}
          </Link>
        )
      : (
          <a href={link.href} target="_blank" rel="noreferrer" className={className}>
            {body}
          </a>
        )
  }

  return (
    <article className={CARD_CLASS}>
      {body}
      {links?.length
        ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              {links.map(link => (
                isInternalLink(link.href)
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
