import { useState } from 'react'
import { Star } from 'lucide-react'

const GOLD = '#E8B923'
const GOLD_EMPTY = 'rgba(232, 185, 35, 0.35)'

/** Estrellas 1–5 doradas. Vacías hasta elegir; se rellenan al seleccionar. */
export default function StarRating({
  value = 0,
  onChange,
  interactive = false,
  size = 18,
  className = '',
  label = 'Calificación',
}) {
  const stars = [1, 2, 3, 4, 5]
  const clamped = Math.min(5, Math.max(0, Number(value) || 0))
  const [hover, setHover] = useState(0)
  const shown = interactive && hover > 0 ? hover : clamped

  return (
    <div
      className={`star-rating inline-flex items-center gap-0.5 ${className}`.trim()}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={interactive ? label : `${clamped} de 5 estrellas`}
      onMouseLeave={interactive ? () => setHover(0) : undefined}
    >
      {stars.map((n) => {
        const filled = n <= shown
        if (!interactive) {
          return (
            <Star
              key={n}
              size={size}
              color={filled ? GOLD : GOLD_EMPTY}
              fill={filled ? GOLD : 'none'}
              strokeWidth={1.6}
              aria-hidden
            />
          )
        }
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === clamped}
            aria-label={`${n} estrella${n === 1 ? '' : 's'}`}
            onClick={() => onChange?.(n)}
            onMouseEnter={() => setHover(n)}
            className="rounded p-0.5 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8B923]"
          >
            <Star
              size={size}
              color={filled ? GOLD : GOLD_EMPTY}
              fill={filled ? GOLD : 'none'}
              strokeWidth={1.6}
            />
          </button>
        )
      })}
    </div>
  )
}
