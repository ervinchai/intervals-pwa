import jsQR from 'jsqr'
import { QrCode, ScanLine } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { screenFromScan, useRouter } from '@/app/router'
import { Heading, Row, Stack, Text } from '@/components/ui'

type Status =
  | { kind: 'starting' }
  | { kind: 'scanning' }
  | { kind: 'denied' }
  | { kind: 'unsupported' }
  | { kind: 'unrecognised'; payload: string }

/**
 * In-app QR scanner. The docked iPad runs Intervals as an installed PWA, and the
 * Camera app would kick a scanned link out to Safari — so we scan inside the
 * app instead, decoding frames straight off the rear camera and routing on a
 * hit. No round-trip through the browser.
 *
 * Decoding runs on a `requestAnimationFrame` loop against an offscreen canvas;
 * jsQR is pure JS and works in the iOS standalone WebView, where the native
 * `BarcodeDetector` is unavailable.
 */
export function Scan() {
  const { navigate } = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<Status>({ kind: 'starting' })

  // Held in a ref so the rAF loop can stop itself the instant it finds a code,
  // without waiting for a state-driven re-render.
  const activeRef = useRef(true)

  const handlePayload = useCallback(
    (payload: string) => {
      const target = screenFromScan(payload)
      if (target) {
        activeRef.current = false
        navigate(target)
      } else {
        // Keep scanning — a stray QR on a package shouldn't wedge the screen —
        // but tell the user why nothing happened.
        setStatus({ kind: 'unrecognised', payload })
      }
    },
    [navigate],
  )

  useEffect(() => {
    activeRef.current = true

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus({ kind: 'unsupported' })
      return
    }

    let stream: MediaStream | null = null
    let rafId = 0
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const tick = () => {
      if (!activeRef.current || !video || !ctx) return
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const result = jsQR(image.data, image.width, image.height, {
          inversionAttempts: 'dontInvert',
        })
        if (result?.data) {
          handlePayload(result.data)
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (!activeRef.current) {
          // Unmounted while the permission prompt was open.
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        if (video) {
          video.srcObject = stream
          await video.play()
        }
        setStatus({ kind: 'scanning' })
        rafId = requestAnimationFrame(tick)
      } catch {
        setStatus({ kind: 'denied' })
      }
    })()

    return () => {
      activeRef.current = false
      cancelAnimationFrame(rafId)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [handlePayload])

  return (
    <Stack gap="lg" className="h-full">
      <Row>
        <Heading role="hero" level={1}>
          Scan
        </Heading>
      </Row>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-card bg-raised">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
        />

        {status.kind === 'scanning' ? (
          <>
            {/* A framing reticle so it's clear where to hold the code. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="aspect-square h-1/2 rounded-2xl border-2 border-white/70" />
            </div>
            <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center">
              <span className="flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm text-white">
                <ScanLine className="h-4 w-4" />
                Point the camera at a Intervals QR code
              </span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <StatusMessage status={status} />
          </div>
        )}
      </div>
    </Stack>
  )
}

function StatusMessage({ status }: { status: Status }) {
  switch (status.kind) {
    case 'starting':
      return <Text tone="faint">Starting camera…</Text>
    case 'denied':
      return (
        <Stack gap="sm" className="max-w-sm text-center">
          <QrCode className="mx-auto h-10 w-10 text-ink-faint" />
          <Text>
            Camera access is blocked. Allow camera access for Intervals in your
            device settings, then reopen this screen.
          </Text>
        </Stack>
      )
    case 'unsupported':
      return (
        <Text tone="faint" className="max-w-sm text-center">
          This device or browser can’t open the camera.
        </Text>
      )
    case 'unrecognised':
      return (
        <Stack gap="sm" className="max-w-sm text-center">
          <Text>That code isn’t a Intervals link. Still scanning…</Text>
          <Text tone="faint" className="break-all">
            {status.payload}
          </Text>
        </Stack>
      )
    default:
      return null
  }
}
