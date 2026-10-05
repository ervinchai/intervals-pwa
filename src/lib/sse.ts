/** One Server-Sent Event: its `event:` name (default "message") and joined `data:` lines. */
export interface SseMessage {
  event: string
  data: string
}

/**
 * Parse a `text/event-stream` body into messages. `EventSource` can't POST, so
 * callers that need a request body read the stream themselves with `fetch()`.
 * Comment lines (`: ping`) are skipped. A trailing event with no blank line
 * after it is dropped, since the stream was cut mid-event.
 */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseMessage> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      buffer += decoder.decode(value, { stream: true })
      let end: number
      while ((end = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const block = buffer.slice(0, end)
        buffer = buffer.slice(end).replace(/^\r?\n\r?\n/, '')
        const message = parseBlock(block)
        if (message) yield message
      }
    }
  } finally {
    void reader.cancel().catch(() => {})
  }
}

function parseBlock(block: string): SseMessage | null {
  let event = 'message'
  const data: string[] = []
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith(':')) continue
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
  }
  return data.length ? { event, data: data.join('\n') } : null
}
