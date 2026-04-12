/**
 * useToast Hook
 *
 * A hook for managing toast notifications.
 *
 * @module components/ui/Toast/useToast
 *
 * @example
 * ```tsx
 * const { toast, dismiss, toasts } = useToast();
 *
 * // Show a toast
 * toast({
 *   title: "Success",
 *   description: "Operation completed.",
 *   variant: "success",
 * });
 *
 * // Dismiss a specific toast
 * dismiss(toastId);
 *
 * // Dismiss all toasts
 * dismiss();
 * ```
 */

'use client';

import * as React from 'react';
import type { ToastActionElement } from './Toast';

/**
 * Maximum number of toasts to show at once
 */
const TOAST_LIMIT = 5;

/**
 * Default toast duration in milliseconds
 */
const TOAST_REMOVE_DELAY = 5000;

/**
 * Toast data interface
 */
export interface ToastData {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'destructive';
  duration?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Action types for toast reducer
 */
type ActionType =
  | { type: 'ADD_TOAST'; toast: ToastData }
  | { type: 'UPDATE_TOAST'; toast: Partial<ToastData> & Pick<ToastData, 'id'> }
  | { type: 'DISMISS_TOAST'; toastId?: string }
  | { type: 'REMOVE_TOAST'; toastId?: string };

/**
 * Toast state interface
 */
interface State {
  toasts: ToastData[];
}

/**
 * Map of toast IDs to their removal timeouts
 */
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Add toast to removal queue
 */
const addToRemoveQueue = (toastId: string, duration: number) => {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: 'REMOVE_TOAST', toastId });
  }, duration);

  toastTimeouts.set(toastId, timeout);
};

/**
 * Toast reducer
 */
export const reducer = (state: State, action: ActionType): State => {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case 'UPDATE_TOAST':
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case 'DISMISS_TOAST': {
      const { toastId } = action;

      if (toastId) {
        addToRemoveQueue(toastId, TOAST_REMOVE_DELAY);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id, TOAST_REMOVE_DELAY);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? { ...t, open: false }
            : t
        ),
      };
    }

    case 'REMOVE_TOAST':
      if (action.toastId === undefined) {
        return { ...state, toasts: [] };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };

    default:
      return state;
  }
};

/**
 * Listeners for state changes
 */
const listeners: Array<(state: State) => void> = [];

/**
 * Memory state
 */
let memoryState: State = { toasts: [] };

/**
 * Dispatch function
 */
function dispatch(action: ActionType) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

/**
 * Generate unique ID
 */
let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

/**
 * Toast function type
 */
type Toast = Omit<ToastData, 'id'>;

/**
 * Toast function interface with convenience methods
 */
interface ToastFunction {
  (props: Toast): { id: string; dismiss: () => void; update: (props: Partial<ToastData>) => void };
  success: (message: string, props?: Omit<Toast, 'variant' | 'description'>) => ReturnType<ToastFunction>;
  error: (message: string, props?: Omit<Toast, 'variant' | 'description'>) => ReturnType<ToastFunction>;
  warning: (message: string, props?: Omit<Toast, 'variant' | 'description'>) => ReturnType<ToastFunction>;
  info: (message: string, props?: Omit<Toast, 'variant' | 'description'>) => ReturnType<ToastFunction>;
}

/**
 * Create a toast
 */
const toast = function(props: Toast) {
  const id = genId();

  const update = (props: Partial<ToastData>) =>
    dispatch({ type: 'UPDATE_TOAST', toast: { ...props, id } });

  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id });

  dispatch({
    type: 'ADD_TOAST',
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  // Auto dismiss after duration
  const duration = props.duration ?? TOAST_REMOVE_DELAY;
  if (duration > 0) {
    setTimeout(dismiss, duration);
  }

  return {
    id,
    dismiss,
    update,
  };
}

/**
 * useToast hook
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
  };
}

// Add convenience methods to toast
toast.success = (message: string, props?: Omit<Toast, 'variant' | 'description'>) => {
  return toast({ ...props, description: message, variant: 'success' });
};

toast.error = (message: string, props?: Omit<Toast, 'variant' | 'description'>) => {
  return toast({ ...props, description: message, variant: 'error' });
};

toast.warning = (message: string, props?: Omit<Toast, 'variant' | 'description'>) => {
  return toast({ ...props, description: message, variant: 'warning' });
};

toast.info = (message: string, props?: Omit<Toast, 'variant' | 'description'>) => {
  return toast({ ...props, description: message, variant: 'info' });
};

export { useToast, toast as toast };
