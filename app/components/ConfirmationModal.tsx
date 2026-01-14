"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
  variant?: "danger" | "warning" | "info";
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  icon,
  isLoading = false,
  variant = "danger",
}: ConfirmationModalProps) {
  const variantStyles = {
    danger: {
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      buttonBg: "bg-red-600 hover:bg-red-700",
    },
    warning: {
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      buttonBg: "bg-amber-600 hover:bg-amber-700",
    },
    info: {
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      buttonBg: "bg-blue-600 hover:bg-blue-700",
    },
  };

  const styles = variantStyles[variant];
  const defaultIcon = <AlertTriangle className="w-8 h-8" />;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={onClose}
            className="fixed inset-0 bg-gray-900/60 z-[10001]"
          />

          {/* Modal - Bottom sheet on mobile, centered on desktop */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="fixed bottom-0 left-0 right-0 lg:inset-auto lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-full lg:max-w-md z-[10002] bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl flex flex-col"
          >
            {/* Handle bar for mobile */}
            <div className="lg:hidden flex justify-center pt-4 pb-2">
              <div className="w-16 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Content */}
            <div className="px-6 py-6 lg:py-6">
              {/* Icon and Title */}
              <div className="flex flex-col items-center text-center mb-6">
                <div className={`w-16 h-16 ${styles.iconBg} rounded-full flex items-center justify-center mb-4 ${styles.iconColor}`}>
                  {icon || defaultIcon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed max-w-sm">
                  {message}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 lg:pb-6 flex flex-col gap-3">
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3 ${styles.buttonBg} text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : variant === "danger" ? (
                  <>
                    <Trash2 className="w-4 h-4" />
                    {confirmText}
                  </>
                ) : (
                  confirmText
                )}
              </button>
              <button
                onClick={onClose}
                disabled={isLoading}
                className="w-full px-5 py-3 border-2 border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelText}
              </button>
            </div>

            {/* Safe area padding for iPhone */}
            <div className="h-8 lg:hidden flex-shrink-0"></div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}










