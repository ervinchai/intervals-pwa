import type { ZodType } from 'zod'

import { getConfig } from '@/lib/config'

/**
 * A call to the Rails API that failed. `message` is written for the person looking at the
 * screen (the error states and forms print it as is); `status` and `code` are for code.
 * `code` is the API's `error` value (`bean_not_found`, `invalid_request`, …), or one of
 * `not_configured`, `network`, `contract` and `http` for failures before or after the API spoke.
 * `retryAfter` is the seconds the API asked us to wait, when it did.
 */
export class RailsError extends Error {
  status: number
  code: string
  retryAfter: number | undefined

  constructor(message: string, status: number, code: string, retryAfter?: number) {
    super(message)
    this.name = 'RailsError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

type ErrorBody = { error?: unknown; retryAfter?: unknown; fields?: unknown }

/** The words shown for an API error. */
function messageFor(status: number, code: string, fields: unknown): string {
  switch (code) {
    case 'bean_not_found':
      return 'That bean is not in the catalog.'
    case 'brew_not_found':
      return 'That brew is not in this bean’s log.'
    case 'invalid_request': {
      const names = fields && typeof fields === 'object' ? Object.keys(fields) : []
      return names.length ? `Some details were not accepted: ${names.join(', ')}.` : 'Some details were not accepted.'
    }
    case 'llm_not_configured':
      return 'The server has no AI model set up (GEMINI_API_KEY).'
    case 'analysis_failed':
      return 'The AI could not read this shot. Try again.'
    case 'not_found':
      return 'That record is not on the server.'
    case 'file_missing':
      return 'Choose a PDF first.'
    case 'file_too_large':
      return 'That file is too large (15 MB at most).'
    case 'not_a_pdf':
      return 'That file is not a PDF.'
    case 'password_required':
      return 'This PDF is protected. Enter its password.'
    case 'wrong_password':
      return 'That password did not open the PDF.'
    case 'unreadable_pdf':
      return 'The PDF could not be read.'
    case 'no_text':
      return 'The PDF has no text to read (a scan?).'
    case 'not_in_review':
      return 'That statement is not waiting for review.'
    case 'not_failed':
      return 'That statement did not fail.'
    default:
      return `The server answered ${status}. Try again.`
  }
}

export async function errorFrom(res: Response): Promise<RailsError> {
  let body: ErrorBody = {}
  try {
    body = (await res.json()) as ErrorBody
  } catch {
    // Not JSON (a proxy's error page, say): fall through to the status.
  }
  const code = typeof body.error === 'string' ? body.error : 'http'
  // The body carries the wait because a browser cannot read Retry-After across origins.
  const header = Number(res.headers.get('Retry-After'))
  const retryAfter =
    typeof body.retryAfter === 'number' ? body.retryAfter : Number.isFinite(header) && header > 0 ? header : undefined
  return new RailsError(messageFor(res.status, code, body.fields), res.status, code, retryAfter)
}

/**
 * Call the Rails API with a JSON body and check the reply against its contract.
 * Throws a `RailsError` for anything that goes wrong.
 */
export async function railsRequest<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  schema: ZodType<T>,
  body?: unknown,
): Promise<T> {
  return send(method, path, schema, body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

/**
 * Upload a file (multipart) to the Rails API and check the reply against its contract. The
 * browser sets the multipart boundary, so no Content-Type is given.
 */
export async function railsUpload<T>(path: string, schema: ZodType<T>, form: FormData): Promise<T> {
  return send('POST', path, schema, { body: form })
}

async function send<T>(
  method: string,
  path: string,
  schema: ZodType<T>,
  init: { headers?: Record<string, string>; body?: BodyInit },
): Promise<T> {
  const { railsBaseUrl } = getConfig()
  if (!railsBaseUrl) {
    throw new RailsError('The server address is not set.', 0, 'not_configured')
  }

  let res: Response
  try {
    res = await fetch(`${railsBaseUrl}${path}`, { method, ...init })
  } catch (err) {
    console.error(`[intervals] ${method} ${path} could not reach the server`, err)
    throw new RailsError('Could not reach the server. Check the connection and try again.', 0, 'network')
  }

  if (!res.ok) throw await errorFrom(res)

  // Validate at the boundary, as with Windmill: a drifted API should surface as a named
  // error here, not as a crash three components deep.
  const parsed = schema.safeParse(await res.json())
  if (!parsed.success) {
    console.error(`[intervals] ${method} ${path} failed its contract`, parsed.error.issues)
    throw new RailsError('The server sent something unexpected.', res.status, 'contract')
  }
  return parsed.data
}
