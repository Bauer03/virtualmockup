declare module 'react-hot-toast' {
  export interface Toast {
    id: string;
    type: 'success' | 'error' | 'loading' | 'blank' | 'custom';
    message: string;
    icon?: string;
    duration?: number;
    position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    className?: string;
    style?: React.CSSProperties;
    iconTheme?: {
      primary: string;
      secondary: string;
    };
    ariaProps?: {
      role: string;
      'aria-live': string;
    };
  }

  export interface ToastOptions {
    id?: string;
    icon?: string | React.ReactNode;
    duration?: number;
    position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    className?: string;
    style?: React.CSSProperties;
    iconTheme?: {
      primary: string;
      secondary: string;
    };
    ariaProps?: {
      role: string;
      'aria-live': string;
    };
  }

  export type ToastType = 'success' | 'error' | 'loading' | 'blank' | 'custom';
  export type Message = string | React.ReactNode;

  export interface DefaultToastOptions {
    className?: string;
    style?: React.CSSProperties;
    duration?: number;
    position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  }

  export function toast(message: Message, options?: ToastOptions): string;
  export namespace toast {
    function success(message: Message, options?: ToastOptions): string;
    function error(message: Message, options?: ToastOptions): string;
    function loading(message: Message, options?: ToastOptions): string;
    function custom(message: Message, options?: ToastOptions): string;
    function dismiss(toastId?: string): void;
    function remove(toastId?: string): void;
    function promise<T>(
      promise: Promise<T> | (() => Promise<T>),
      msgs: {
        loading: Message;
        success: Message | ((data: T) => Message);
        error: Message | ((err: any) => Message);
      },
      opts?: DefaultToastOptions
    ): Promise<T>;
  }

  export function useToaster(): {
    toasts: Toast[];
    handlers: {
      startPause: () => void;
      endPause: () => void;
      updateHeight: (toastId: string, height: number) => void;
      updateToast: (toast: Toast) => void;
    };
  };

  export function Toaster(props: {
    position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    toastOptions?: DefaultToastOptions;
    reverseOrder?: boolean;
    gutter?: number;
    containerStyle?: React.CSSProperties;
    containerClassName?: string;
    children?: (toast: Toast) => React.ReactNode;
  }): JSX.Element;

  export default toast;
} 