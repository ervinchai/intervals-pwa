import { Bold, Italic, Underline } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'

import { cn } from '@/lib/cn'

type RichCaptionEditorProps = {
  /** Current caption as HTML (the editor's own `innerHTML`). */
  value: string
  /** Fires with the editor's HTML whenever the content changes. */
  onChange: (html: string) => void
  placeholder?: string
}

type Command = 'bold' | 'italic' | 'underline'

const TOOLBAR: { command: Command; label: string; Icon: typeof Bold }[] = [
  { command: 'bold', label: 'Bold', Icon: Bold },
  { command: 'italic', label: 'Italic', Icon: Italic },
  { command: 'underline', label: 'Underline', Icon: Underline },
]

/**
 * A minimal rich-text caption editor: a `contentEditable` surface with a
 * bold / italic / underline toolbar. It emits its raw HTML, which
 * {@link htmlToRichText} turns into styled runs for canvas rendering. We use the
 * (deprecated but universally supported) `execCommand` because the label only
 * needs inline weight/slant/underline, not a full document model.
 */
export function RichCaptionEditor({
  value,
  onChange,
  placeholder,
}: RichCaptionEditorProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Keep the DOM in sync when `value` is changed from outside (e.g. reset),
  // without clobbering the caret while the user is actively typing.
  useEffect(() => {
    const el = ref.current
    if (el && el.innerHTML !== value) el.innerHTML = value
  }, [value])

  const emit = useCallback(() => {
    if (ref.current) onChange(ref.current.innerHTML)
  }, [onChange])

  const applyCommand = useCallback(
    (command: Command) => {
      ref.current?.focus()
      document.execCommand(command)
      emit()
    },
    [emit],
  )

  return (
    <div className="rounded-card border border-line bg-surface focus-within:border-ember">
      <div className="flex gap-1 border-b border-line px-2 py-1.5">
        {TOOLBAR.map(({ command, label, Icon }) => (
          <button
            key={command}
            type="button"
            aria-label={label}
            title={label}
            // Keep the selection: apply on mousedown before focus leaves the editor.
            onMouseDown={(e) => {
              e.preventDefault()
              applyCommand(command)
            }}
            className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-line hover:text-ink"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emit}
        className={cn(
          'min-h-[6rem] w-full px-4 py-3',
          'text-ink focus:outline-none',
          'whitespace-pre-wrap break-words',
          // Placeholder for the empty editor.
          'empty:before:text-ink-faint empty:before:content-[attr(data-placeholder)]',
        )}
      />
    </div>
  )
}
