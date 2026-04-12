import type { ReactNode } from 'react'

interface SectionCardProps {
  children: ReactNode
  className?: string
  description?: string
  eyebrow?: string
  footer?: ReactNode
  title: string
  tone?: 'default' | 'accent' | 'soft'
}

export function SectionCard({
  children,
  className,
  description,
  eyebrow,
  footer,
  title,
  tone = 'default',
}: SectionCardProps) {
  const cardClassName = ['section-card', `section-card--${tone}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={cardClassName}>
      <header className="section-card__header">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2 className="section-card__title">{title}</h2>
        {description ? (
          <p className="section-card__description">{description}</p>
        ) : null}
      </header>

      {children}

      {footer ? <div className="section-card__footer">{footer}</div> : null}
    </section>
  )
}
