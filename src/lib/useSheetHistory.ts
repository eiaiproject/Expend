import { useCallback, useEffect, useRef } from 'react'

let sheetSequence = 0

/**
 * Membuat satu entri history saat sheet terbuka. Back menutup sheet,
 * dan close() dari UI juga membersihkan entri tersebut.
 *
 * onBack boleh mengembalikan true untuk menahan sheet tetap terbuka
 * (misalnya karena ada perubahan yang belum disimpan).
 */
export function useSheetHistory(
  id: string,
  onClose: () => void,
  onBack?: () => boolean,
): () => void {
  const closeRef = useRef(onClose)
  const backRef = useRef(onBack)
  closeRef.current = onClose
  backRef.current = onBack
  const pushed = useRef(false)

  useEffect(() => {
    const marker = `expend-sheet-${id}-${sheetSequence}`
    sheetSequence += 1

    const push = () => {
      pushed.current = true
      window.history.pushState(
        { ...window.history.state, [marker]: true },
        '',
        window.location.href,
      )
    }

    if (!pushed.current) push()

    const handlePop = () => {
      pushed.current = false
      if (backRef.current?.()) {
        push()
        return
      }
      closeRef.current()
    }
    window.addEventListener('popstate', handlePop)
    return () => {
      window.removeEventListener('popstate', handlePop)
    }
  }, [id])

  return useCallback(() => {
    closeRef.current()
    if (pushed.current) {
      pushed.current = false
      window.history.back()
    }
  }, [])
}
