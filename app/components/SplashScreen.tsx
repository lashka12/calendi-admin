"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  isVisible: boolean;
}

export default function SplashScreen({ isVisible }: SplashScreenProps) {
  // Remove the static HTML splash once React takes over
  useEffect(() => {
    const el = document.getElementById('app-splash');
    if (el) {
      el.style.transition = 'opacity 0.2s ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 200);
    }
  }, []);

  // Remove static splash immediately when we're done
  useEffect(() => {
    if (!isVisible) {
      const el = document.getElementById('app-splash');
      if (el) el.remove();
    }
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ backgroundColor: 'var(--color-bg-primary)' }}
        >
          <div className="flex flex-col items-center">
            <div 
              className="w-[72px] h-[72px] rounded-[22px] flex flex-col items-center justify-center overflow-hidden"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              <span 
                className="text-[34px] font-bold -mb-0.5"
                style={{ color: 'var(--color-bg-primary)' }}
              >
                C
              </span>
              <div className="flex flex-col gap-[3px] mt-0.5">
                <div className="w-8 h-[2px] rounded-full" style={{ backgroundColor: 'var(--color-bg-primary)', opacity: 0.3 }} />
                <div className="w-5 h-[2px] rounded-full" style={{ backgroundColor: 'var(--color-bg-primary)', opacity: 0.2 }} />
              </div>
            </div>
            
            <p
              className="mt-5 text-[15px] font-semibold tracking-wide"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Calendi
            </p>
          </div>

          {/* Loading dots */}
          <div className="absolute bottom-20 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: 'var(--color-text-tertiary)' }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
