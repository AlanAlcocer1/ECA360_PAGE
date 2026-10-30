/** Preferencia local: modal de opinión al entrar al evento — solo 1ª vez. */

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
    // omit (cerró X) | done (envió) → no volver a mostrar
    if (data?.status === 'omit' || data?.status === 'done' || data?.status === 'later') {
      return false
    }
    return true
  } catch {
    return true
  }
}

export function dismissReviewPrompt(eventId, status = 'omit') {
  if (eventId == null || eventId === '') return
  try {
    localStorage.setItem(key(eventId), JSON.stringify({ status, at: Date.now() }))
  } catch {
    /* private mode / quota */
  }
}
