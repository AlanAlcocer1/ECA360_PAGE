import clsx from 'clsx'

/**
 * Marquesina infinita (estilo Magic UI), adaptada al proyecto.
 */
export default function Marquee({
  className,
  reverse = false,
  pauseOnHover = false,
  children,
  vertical = false,
  repeat = 4,
  ...props
}) {
  return (
    <div
      {...props}
      className={clsx(
        'marquee group flex overflow-hidden p-2 [--duration:40s] [--gap:1rem]',
        vertical ? 'flex-col' : 'flex-row',
        className,
      )}
      style={{ gap: 'var(--gap)', ...(props.style || {}) }}
    >
      {Array.from({ length: repeat }, (_, i) => (
        <div
          key={i}
          className={clsx(
            'flex shrink-0 justify-around',
            vertical ? 'marquee__track--vertical flex-col' : 'marquee__track flex-row',
            pauseOnHover && 'marquee__track--pause',
            reverse && 'marquee__track--reverse',
          )}
          style={{ gap: 'var(--gap)' }}
        >
          {children}
        </div>
      ))}
    </div>
  )
}
