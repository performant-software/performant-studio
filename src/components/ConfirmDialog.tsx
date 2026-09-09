import type { ReactNode } from 'react'
import { useEffect, useId, useRef } from 'react'

interface ConfirmDialogProps {
  title: string
  confirmLabel: string
  onConfirm: () => void
  onDismiss: () => void
  children: ReactNode
}

export default function ConfirmDialog({
  title,
  confirmLabel,
  onConfirm,
  onDismiss,
  children,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const dismissRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useEffect(() => {
    dialogRef.current?.showModal()
    dismissRef.current?.focus()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onDismiss()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onDismiss()
        }
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-red-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/60"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-100">
            <span className="size-5 bg-red-600 [mask-image:url(/icons/warning.svg)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]" />
          </span>
          <h2 id={titleId} className="mt-1 text-lg font-semibold text-red-700">{title}</h2>
        </div>

        <div className="flex flex-col gap-3 text-[15px] text-gray-600">{children}</div>

        <div className="flex justify-end gap-3">
          <button
            ref={dismissRef}
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:cursor-pointer hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:cursor-pointer hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
