/** Preferencia local: no molestar de nuevo con el prompt de reseña por evento. */

const PREFIX = 'eca360:review-prompt:'

function key(eventId) {
  return `${PREFIX}${eventId}`
}

export function shouldShowReviewPrompt(eventId) {
  if (eventId == null || eventId === '') return false
  try {
    const raw = localStorage.getItem(key(eventId))
    if (!raw) return true
    const data = JSON.parse(raw)
    // later | omit | done → no volver a mostrar
    if (data?.status === 'later' || data?.status === 'omit' || data?.status === 'done') {
      return false
    }
    return true
  } catch {
    return true
  }
}

export function dismissReviewPrompt(eventId, status = 'later') {
  if (eventId == null || eventId === '') return
  try {
    localStorage.setItem(
      key(eventId),
      JSON.stringify({ status, at: Date.now() }),
    )
  } catch {
    /* private mode / quota */
  }
}
