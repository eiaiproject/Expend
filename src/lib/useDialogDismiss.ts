import { useEffect, useRef, type RefObject } from 'react'

export function useDialogDismiss(
  dialogRef: RefObject<HTMLDialogElement | null>,
  onDismiss: () => void,
) {
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleClick = (event: MouseEvent) => {
      if (event.target === dialog) dismissRef.current()
    }

    dialog.addEventListener('click', handleClick)
    return () => dialog.removeEventListener('click', handleClick)
  }, [dialogRef])
}
