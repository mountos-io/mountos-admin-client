import { toast } from 'svelte-sonner'

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading'

export interface ToastOptions {
  duration?: number
  description?: string
  action?: { label: string; onClick: () => void }
  onDismiss?: () => void
  onAutoClose?: () => void
}

const DURATIONS: Record<ToastType, number> = {
  success: 3000, error: 5000, warning: 4000, info: 3000, loading: Infinity,
}

function show(type: ToastType, message: string, options: ToastOptions = {}): string | number {
  const opts = { ...options, duration: options.duration ?? DURATIONS[type] }
  switch (type) {
    case 'success': return toast.success(message, opts)
    case 'error': return toast.error(message, opts)
    case 'warning': return toast.warning(message, opts)
    case 'info': return toast.info(message, opts)
    case 'loading': return toast.loading(message, opts)
  }
}

export function showSuccessToast(message: string, options?: ToastOptions) { return show('success', message, options) }
export function showErrorToast(message: string, options?: ToastOptions) { return show('error', message, options) }
export function showWarningToast(message: string, options?: ToastOptions) { return show('warning', message, options) }
export function showInfoToast(message: string, options?: ToastOptions) { return show('info', message, options) }
export function showLoadingToast(message: string, options?: ToastOptions) { return show('loading', message, options) }
export function showToast(type: ToastType, message: string, options?: ToastOptions) { return show(type, message, options) }

export function dismissToast(id: string | number) { toast.dismiss(id) }
export function dismissAllToasts() { toast.dismiss() }

export function updateToast(id: string | number, type: ToastType, message: string, options: ToastOptions = {}) {
  const opts = { ...options, id, duration: options.duration ?? DURATIONS[type] }
  switch (type) {
    case 'success': toast.success(message, opts); break
    case 'error': toast.error(message, opts); break
    case 'warning': toast.warning(message, opts); break
    case 'info': toast.info(message, opts); break
    case 'loading': toast.loading(message, opts); break
  }
}

export function handleApiError(error: unknown, fallback = 'An error occurred', options?: ToastOptions) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : fallback
  return showErrorToast(message, options)
}

export function showLoadingToastWithUpdate(message: string, options?: ToastOptions) {
  const id = showLoadingToast(message, options)
  return {
    id,
    success: (msg: string, opts?: ToastOptions) => updateToast(id, 'success', msg, opts),
    error: (msg: string, opts?: ToastOptions) => updateToast(id, 'error', msg, opts),
    dismiss: () => dismissToast(id),
  }
}
