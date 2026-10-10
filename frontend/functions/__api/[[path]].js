/**
 * Same-origin proxy → Coolify API.
 * Avoids browser CORS while api.eca360.com.mx CORS_ORIGINS is updated.
 */
const API_ORIGIN = 'https://api.eca360.com.mx'

export async function onRequest(context) {
  const incoming = new URL(context.request.url)
  const suffix = incoming.pathname.replace(/^\/__api/, '') || '/'
  const target = new URL(suffix + incoming.search, API_ORIGIN)

  const headers = new Headers(context.request.headers)
  headers.set('Host', new URL(API_ORIGIN).host)
  headers.delete('cf-connecting-ip')
  headers.delete('cf-ipcountry')
  headers.delete('cf-ray')
  headers.delete('cf-visitor')
  headers.delete('x-forwarded-proto')
  headers.delete('x-real-ip')

  const init = {
    method: context.request.method,
    headers,
    redirect: 'manual',
  }

  if (!['GET', 'HEAD'].includes(context.request.method)) {
    init.body = context.request.body
    init.duplex = 'half'
  }

  const upstream = await fetch(target, init)
  const outHeaders = new Headers(upstream.headers)
  outHeaders.delete('content-encoding')
  outHeaders.delete('transfer-encoding')

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  })
}
