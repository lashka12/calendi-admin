"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import Portal from "./Portal";
import { useTranslation } from "../i18n";
import { useScrollLock } from "@/app/lib/hooks/useScrollLock";

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
  const { t } = useTranslation();
  useScrollLock(isOpen);
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
    <Portal>
      <AnimatePresence>
        {isOpen && (
          <div 
            className="fixed inset-0 z-[10001] flex flex-col justify-end pointer-events-none"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            {/* Backdrop - extends above safe area to cover status bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={onClose}
              className="absolute inset-0 bg-gray-900/60 pointer-events-auto touch-none"
              style={{ 
                height: '140vh', 
                top: '-20vh',
                WebkitBackdropFilter: 'blur(8px)'
              }}
            />

            {/* Modal - Bottom sheet on mobile, centered on desktop */}
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              onPointerDown={(e) => e.stopPropagation()}
              className="relative w-full lg:fixed lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-full lg:max-w-md z-[10002] bg-white rounded-t-[32px] lg:rounded-2xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden touch-none"
              style={{ backgroundColor: 'white' }}
            >
              <div className="flex flex-col h-full overflow-hidden touch-auto">
                {/* Handle bar for mobile */}
                <div 
                  className="lg:hidden flex justify-center pt-4 pb-2 flex-shrink-0"
                  style={{ touchAction: 'none' }}
                >
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full" />
                </div>

                {/* Content */}
                <div className="px-6 py-6 lg:py-6 flex-1 overflow-y-auto touch-auto">
                  {/* Icon and Title */}
                  <div className="flex flex-col items-center text-center mb-6">
                    <div className={`w-16 h-16 ${styles.iconBg} rounded-full flex items-center justify-center mb-4 ${styles.iconColor}`}>
                      {icon || defaultIcon}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {title}
                    </h3>
                    <p className="text-sm text-gray-500 font-medium leading-relaxed max-w-sm">
                      {message}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div 
                  className="px-6 pb-6 lg:pb-6 flex flex-col gap-3 flex-shrink-0"
                  style={{ touchAction: 'none' }}
                >
                  <button
                    onClick={onConfirm}
                    disabled={isLoading}
                    className={`w-full h-12 inline-flex items-center justify-center gap-2 px-5 ${styles.buttonBg} text-white text-sm font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t ? t('common.processing') : 'Processing...'}
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
                    className="w-full h-12 px-5 border-2 border-gray-100 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancelText}
                  </button>
                </div>

                {/* Safe Area Spacer Filler */}
                <div className="flex-shrink-0 h-[env(safe-area-inset-bottom,20px)] bg-white w-full lg:hidden" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}










