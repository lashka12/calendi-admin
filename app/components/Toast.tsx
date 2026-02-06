"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Check, X, Info, AlertTriangle } from "lucide-react";
import { useTranslation } from "../i18n";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastComponent = ({ toast, onRemove }: ToastProps) => {
  const { isRTL } = useTranslation();
  const [progress, setProgress] = useState(100);
  const duration = toast.duration || 4000;

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      
      if (remaining <= 0) {
        clearInterval(interval);
        onRemove(toast.id);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [toast.id, duration, onRemove]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 100 || Math.abs(info.velocity.x) > 500) {
      onRemove(toast.id);
    }
  };

  const config = {
    success: {
      icon: Check,
      iconColor: "text-white",
    },
    error: {
      icon: X,
      iconColor: "text-white",
    },
    info: {
      icon: Info,
      iconColor: "text-white",
    },
    warning: {
      icon: AlertTriangle,
      iconColor: "text-white",
    },
  };

  const { icon: Icon } = config[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ 
        opacity: 0, 
        scale: 0.95, 
        transition: { duration: 0.15 } 
      }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.02 }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: 30,
      }}
      className="relative overflow-hidden cursor-grab active:cursor-grabbing bg-gray-900 rounded-2xl shadow-lg w-full max-w-[320px]"
    >
      {/* Inner content */}
      <div className={`relative flex items-center gap-3 px-4 py-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {/* Icon */}
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 500, damping: 25 }}
          className="flex-shrink-0 w-7 h-7 bg-white/15 rounded-full flex items-center justify-center"
        >
          <Icon className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
        </motion.div>
        
        {/* Message */}
        <p className={`flex-1 text-[13px] font-medium text-white leading-snug ${isRTL ? 'text-right' : ''}`}>
          {toast.message}
        </p>
        
        {/* Close button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onRemove(toast.id)}
          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </motion.button>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10">
        <motion.div 
          className={`h-full bg-white/30 ${isRTL ? 'ml-auto' : ''}`}
          initial={{ width: "100%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.016, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export const ToastContainer = ({ toasts, onRemove }: ToastContainerProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[200] pointer-events-none">
      {/* Mobile: Just above nav bar */}
      <div 
        className="md:hidden flex flex-col items-center gap-2 px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 60px)' }}
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastComponent toast={toast} onRemove={onRemove} />
            </div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Desktop: Top right */}
      <div className="hidden md:block fixed top-4 right-4 z-[200]">
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {toasts.map((toast) => (
              <div key={toast.id} className="pointer-events-auto">
                <ToastComponent toast={toast} onRemove={onRemove} />
              </div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
