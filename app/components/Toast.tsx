"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { Check, X, AlertCircle, Info, AlertTriangle, Sparkles } from "lucide-react";

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
      gradient: "from-emerald-500 to-teal-600",
      iconBg: "bg-white/20",
      icon: Check,
      glow: "shadow-emerald-500/25",
    },
    error: {
      gradient: "from-red-500 to-rose-600",
      iconBg: "bg-white/20",
      icon: X,
      glow: "shadow-red-500/25",
    },
    info: {
      gradient: "from-blue-500 to-indigo-600",
      iconBg: "bg-white/20",
      icon: Info,
      glow: "shadow-blue-500/25",
    },
    warning: {
      gradient: "from-amber-500 to-orange-600",
      iconBg: "bg-white/20",
      icon: AlertTriangle,
      glow: "shadow-amber-500/25",
    },
  };

  const { gradient, iconBg, icon: Icon, glow } = config[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ 
        opacity: 0, 
        scale: 0.9, 
        x: 0,
        transition: { duration: 0.2 } 
      }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: 1.02 }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: 30,
        mass: 1
      }}
      className={`
        relative overflow-hidden cursor-grab active:cursor-grabbing
        bg-gradient-to-r ${gradient}
        rounded-2xl shadow-xl ${glow} shadow-2xl
        backdrop-blur-xl
        w-full max-w-[340px]
      `}
    >
      {/* Inner content */}
      <div className="relative flex items-center gap-3 px-4 py-3.5">
        {/* Icon */}
        <motion.div 
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 500, damping: 25 }}
          className={`flex-shrink-0 w-8 h-8 ${iconBg} rounded-full flex items-center justify-center`}
        >
          <Icon className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
        </motion.div>
        
        {/* Message */}
        <p className="flex-1 text-[14px] font-medium text-white leading-snug pr-2">
          {toast.message}
        </p>
        
        {/* Close button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onRemove(toast.id)}
          className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <X className="w-3.5 h-3.5 text-white/80" />
        </motion.button>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/10">
        <motion.div 
          className="h-full bg-white/40"
          initial={{ width: "100%" }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.016, ease: "linear" }}
        />
      </div>

      {/* Subtle shine effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
    </motion.div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export const ToastContainer = ({ toasts, onRemove }: ToastContainerProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-[200] pointer-events-none pb-safe">
      {/* Mobile: Bottom of screen */}
      <div className="md:hidden flex flex-col items-center gap-2 p-4 pb-24">
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
