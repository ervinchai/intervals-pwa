import jsQR from 'jsqr'
import { CheckCircle2, QrCode, ScanLine, SwitchCamera, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { screenFromScan, useRouter } from '@/app/router'
import { Button, Heading, Row, Stack, Text } from '@/components/ui'

type Status =
  | { kind: 'starting' }
  | { kind: 'scanning' }
  | { kind: 'denied' }
  | { kind: 'unsupported' }

// The popup shown the moment a code is decoded, layered over the live camera.
type Popup =
  | { kind: 'success' }
  | { kind: 'error'; payload: string }

// How long the success popup lingers before we route away, so the confirmation
// is actually seen rather than flashing past.
const SUCCESS_POPUP_MS = 700

type Facing = 'environment' | 'user'

// A frame is treated as "black" when its mean luminance sits below this (0–255).
// Sensor noise on a covered lens still reads a few counts above zero, so we leave
// headroom rather than testing against a literal 0.
const BLACK_LUMA_THRESHOLD = 10
// Consecutive black frames before we assume the camera is dead and auto-flip.
// At ~60fps this is roughly half a second — long enough to ride out a single
// dark frame while the camera exposes, short enough to feel automatic.
const BLACK_FRAMES_BEFORE_FLIP = 30
// Remembers the camera the user last landed on, across visits and reloads.
const FACING_STORAGE_KEY = 'intervals.scan.facing'

function loadFacing(): Facing {
  try {
    return localStorage.getItem(FACING_STORAGE_KEY) === 'user'
      ? 'user'
      : 'environment'
  } catch {
    return 'environment'
  }
}

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
  const [facing, setFacing] = useState<Facing>(loadFacing)
  const [popup, setPopup] = useState<Popup | null>(null)

  // Held in a ref so the rAF loop can stop itself the instant it finds a code,
  // without waiting for a state-driven re-render.
  const activeRef = useRef(true)

  // Gates the decode loop while a popup is up, so one held-up code doesn't
  // re-fire the popup every frame.
  const popupOpenRef = useRef(false)

  // Flip to whichever camera we aren't using, and remember the choice so the
  // next visit opens on the same camera. Used by the manual button; the
  // auto-flip below moves in one direction only.
  const flipCamera = useCallback(() => {
    setFacing((f) => {
      const next = f === 'environment' ? 'user' : 'environment'
      try {
        localStorage.setItem(FACING_STORAGE_KEY, next)
      } catch {
        // Private mode / storage disabled — flipping still works this session.
      }
      return next
    })
  }, [])

  // We only ever auto-flip once. If the front camera also comes back black a
  // second automatic flip would just ping-pong forever, so after the first
  // attempt we leave further flips to the user.
  const autoFlippedRef = useRef(false)

  const handlePayload = useCallback(
    (payload: string) => {
      // Freeze the decode loop and pop the confirmation the instant we read a
      // code — both outcomes surface a popup so a scan never fails silently.
      popupOpenRef.current = true
      const target = screenFromScan(payload)
      if (target) {
        setPopup({ kind: 'success' })
        // Hold the tick, let the tick loop keep the preview alive, then route.
        window.setTimeout(() => {
          activeRef.current = false
          navigate(target)
        }, SUCCESS_POPUP_MS)
      } else {
        // A stray QR on a package shouldn't wedge the screen — show why nothing
        // happened and wait for a tap to resume scanning.
        setPopup({ kind: 'error', payload })
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
    let blackFrames = 0
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

        // Watch for a dead (black) feed on the *rear* camera and fall forward to
        // the front one. We only rescue this direction: the rear lens is what
        // gets covered on a docked device, while the front camera is rarely
        // obstructed — so a black front feed is left alone rather than bounced
        // back to a rear camera we already know is dark. Sample every Nth pixel;
        // a full-frame average is needless work.
        if (
          !autoFlippedRef.current &&
          facing === 'environment' &&
          isFrameBlack(image.data)
        ) {
          blackFrames += 1
          if (blackFrames >= BLACK_FRAMES_BEFORE_FLIP) {
            autoFlippedRef.current = true
            flipCamera()
            return
          }
        } else {
          blackFrames = 0
        }

        // Skip decoding while a popup is up — the frame's still drawn to keep the
        // preview live, we just don't act on it until the popup is cleared.
        if (!popupOpenRef.current) {
          const result = jsQR(image.data, image.width, image.height, {
            inversionAttempts: 'dontInvert',
          })
          if (result?.data) {
            handlePayload(result.data)
          }
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
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
  }, [handlePayload, facing, flipCamera])

  // Clear the error popup and let the decode loop pick codes up again.
  const dismissPopup = useCallback(() => {
    setPopup(null)
    popupOpenRef.current = false
  }, [])

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
            <button
              type="button"
              onClick={() => {
                // A manual flip is a fresh decision, so re-arm auto-flip.
                autoFlippedRef.current = false
                flipCamera()
              }}
              aria-label="Flip camera"
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"
            >
              <SwitchCamera className="h-5 w-5" />
            </button>
            <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center">
              <span className="flex items-center gap-2 rounded-md bg-black/50 px-4 py-2 text-sm text-white">
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

        {popup ? (
          <ScanPopup popup={popup} onDismiss={dismissPopup} />
        ) : null}
      </div>
    </Stack>
  )
}

/**
 * The result popup layered over the camera. Success is a brief, non-interactive
 * confirmation before routing; error dims the preview and waits for a tap so the
 * unrecognised payload can actually be read.
 */
function ScanPopup({
  popup,
  onDismiss,
}: {
  popup: Popup
  onDismiss: () => void
}) {
  if (popup.kind === 'success') {
    return (
      <div 
        className="pointer-events-none fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-black/40"
        style={{ height: '100vh' }}
      >
        <div className="flex flex-col items-center gap-3 rounded-card bg-base/95 px-8 py-6 text-center shadow-lg">
          <CheckCircle2 className="h-12 w-12 text-ember" />
          <Text>Scanned</Text>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-black/60 p-8"
      style={{ height: '100vh' }}
      role="alertdialog"
      aria-modal="true"
    >
      <Stack gap="md" className="max-w-sm rounded-card bg-base/95 p-6 text-center shadow-lg">
        <XCircle className="mx-auto h-12 w-12 text-clay" />
        <Text>That code isn’t a Intervals link.</Text>
        <Text tone="faint" className="break-all">
          {popup.payload}
        </Text>
        <Button variant="secondary" onClick={onDismiss}>
          Scan again
        </Button>
      </Stack>
    </div>
  )
}

/**
 * Mean luminance of a subsampled RGBA buffer, tested against the black
 * threshold. Steps across the pixels (every 40th, i.e. every 10th pixel) so the
 * check stays cheap even at full sensor resolution.
 */
function isFrameBlack(data: Uint8ClampedArray): boolean {
  const stride = 40 // 4 channels × 10 pixels
  let total = 0
  let samples = 0
  for (let i = 0; i < data.length; i += stride) {
    // Rec. 601 luma. Integer-weighted to skip the float multiply per pixel.
    total += (data[i] * 3 + data[i + 1] * 6 + data[i + 2]) / 10
    samples += 1
  }
  if (samples === 0) return false
  return total / samples < BLACK_LUMA_THRESHOLD
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
    default:
      return null
  }
}
