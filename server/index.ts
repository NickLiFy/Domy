import type { IncomingMessage, ServerResponse } from 'node:http'
import { sendApiResponse } from './lib/http.js'
import { apiPathPrefix, resolveApiRoute } from './router.js'

type NextFunction = (error?: Error) => void

/**
 * Connect-style middleware serving `/api/*`. Kept free of Vite imports so the same
 * handler can be mounted on a plain Node server when the app runs outside Vite.
 */
export const apiMiddleware = (request: IncomingMessage, response: ServerResponse, next: NextFunction) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  if (!requestUrl.pathname.startsWith(apiPathPrefix)) {
    next()
    return
  }

  if (request.method === 'OPTIONS') {
    response.statusCode = 204
    response.setHeader('Allow', 'GET, OPTIONS')
    response.end()
    return
  }

  void resolveApiRoute(request.method ?? 'GET', requestUrl.pathname, requestUrl.searchParams)
    .then((result) => sendApiResponse(response, result))
    .catch(() => {
      sendApiResponse(response, {
        status: 500,
        body: { data: null, warnings: [], error: { code: 'internal_error', message: 'Neočekávaná chyba API.' } },
      })
    })
}
