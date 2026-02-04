import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react";

/**
 * Shadcn UI Toast Wrapper
 * Provides a consistent API for showing toast notifications using Sonner
 * All toasts now use Shadcn UI styling and components
 */

type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
    type?: ToastType;
    duration?: number;
    description?: string;
}

/**
 * Show a toast notification using Shadcn UI styling
 * @param message - The main message to display
 * @param options - Optional configuration (type, duration, description)
 */
export const showCustomToast = (
    message: string,
    options?: number | ToastOptions
) => {
    // Handle backward compatibility with duration-only parameter
    const opts: ToastOptions = typeof options === 'number'
        ? { duration: options, type: 'default' }
        : { duration: 4000, type: 'default', ...options };

    const { type = 'default', duration = 4000, description } = opts;

    // Map toast types to sonner methods
    switch (type) {
        case 'success':
            toast.success(message, {
                description,
                duration,
                icon: <CheckCircle2 className="h-4 w-4" />,
            });
            break;

        case 'error':
            toast.error(message, {
                description,
                duration,
                icon: <XCircle className="h-4 w-4" />,
            });
            break;

        case 'warning':
            toast.warning(message, {
                description,
                duration,
                icon: <AlertCircle className="h-4 w-4" />,
            });
            break;

        case 'info':
            toast.info(message, {
                description,
                duration,
                icon: <Info className="h-4 w-4" />,
            });
            break;

        default:
            toast(message, {
                description,
                duration,
            });
    }
};

/**
 * Convenience methods for specific toast types
 */
export const showSuccessToast = (message: string, description?: string, duration = 4000) => {
    showCustomToast(message, { type: 'success', description, duration });
};

export const showErrorToast = (message: string, description?: string, duration = 4000) => {
    showCustomToast(message, { type: 'error', description, duration });
};

export const showWarningToast = (message: string, description?: string, duration = 4000) => {
    showCustomToast(message, { type: 'warning', description, duration });
};

export const showInfoToast = (message: string, description?: string, duration = 4000) => {
    showCustomToast(message, { type: 'info', description, duration });
};
