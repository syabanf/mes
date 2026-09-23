import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { cn } from '../lib/cn'
import { useElementSize } from '../lib/use-element-size'
import { Button } from './button'

type Point = { x: number; y: number }

export type SignaturePadProps = {
  value: string | null
  /** Receives a PNG data URL after each stroke, or null when cleared. */
  onChange: (dataUrl: string | null) => void
  className?: string
  disabled?: boolean
}

function drawStroke(ctx: CanvasRenderingContext2D, points: Point[]) {
  const [first, ...rest] = points
  if (!first) return
  ctx.beginPath()
  ctx.moveTo(first.x, first.y)
  // A single tap still leaves a round dot.
  if (rest.length === 0) ctx.lineTo(first.x + 0.01, first.y)
  for (const point of rest) ctx.lineTo(point.x, point.y)
  ctx.stroke()
}

export function SignaturePad({ value, onChange, className, disabled = false }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [boxRef, size] = useElementSize<HTMLDivElement>()
  const strokes = useRef<Point[][]>([])
  const drawing = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  // After a remount the strokes are gone, so show the saved image until the user clears it.
  const showSaved = !hasDrawn && value !== null

  // Match the bitmap to the box at device pixel ratio. Resizing wipes a canvas, so repaint the strokes.
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || size.width === 0) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size.width * dpr)
    canvas.height = Math.round(size.height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--color-ink').trim() || '#101112'
    for (const stroke of strokes.current) drawStroke(ctx, stroke)
  }, [size.width, size.height])

  function wipe() {
    strokes.current = []
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
    }
    setHasDrawn(false)
  }

  // The parent reset the value (a form reset, for example): drop the local drawing too.
  useEffect(() => {
    if (value === null && strokes.current.length > 0 && !drawing.current) wipe()
  }, [value])

  function toPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
    const rect = canvas.getBoundingClientRect()
    const scale = rect.width > 0 ? size.width / rect.width : 1
    return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale }
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || showSaved || event.button !== 0) return
    const canvas = event.currentTarget
    canvas.setPointerCapture(event.pointerId)
    drawing.current = true
    const stroke = [toPoint(canvas, event.clientX, event.clientY)]
    strokes.current.push(stroke)
    const ctx = canvas.getContext('2d')
    if (ctx) drawStroke(ctx, stroke)
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const stroke = strokes.current[strokes.current.length - 1]
    const last = stroke?.[stroke.length - 1]
    const canvas = event.currentTarget
    const ctx = canvas.getContext('2d')
    if (!drawing.current || !stroke || !last || !ctx) return
    const native = event.nativeEvent
    const coalesced = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    for (const sample of coalesced.length > 0 ? coalesced : [native]) {
      const point = toPoint(canvas, sample.clientX, sample.clientY)
      stroke.push(point)
      ctx.lineTo(point.x, point.y)
    }
    ctx.stroke()
  }

  function onPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    drawing.current = false
    setHasDrawn(true)
    onChange(event.currentTarget.toDataURL('image/png'))
  }

  function clear() {
    wipe()
    onChange(null)
  }

  return (
    <div ref={boxRef} className={cn('relative h-40 w-full rounded-2xl bg-surface', disabled && 'opacity-60', className)}>
      {/* Signature line under a transparent canvas, so strokes paint over it. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-9 h-px bg-border" />
      <canvas
        ref={canvasRef}
        aria-label="Signature pad"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cn(
          'absolute inset-0 size-full touch-none rounded-2xl',
          !disabled && !showSaved && 'cursor-crosshair',
        )}
      />
      {showSaved && (
        <img src={value} alt="Saved signature" className="pointer-events-none absolute inset-0 size-full object-contain" />
      )}
      {!hasDrawn && value === null && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">
          Sign here
        </span>
      )}
      {(hasDrawn || value !== null) && !disabled && (
        <Button type="button" variant="ghost" size="sm" onClick={clear} className="absolute right-2 top-2">
          Clear
        </Button>
      )}
    </div>
  )
}
