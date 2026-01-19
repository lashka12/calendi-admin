"use client";

import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  isVisible: boolean;
}

export default function SplashScreen({ isVisible }: SplashScreenProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-50"
        >
          {/* Content */}
          <motion.div 
            className="flex flex-col items-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {/* Logo - dark on light background */}
            <div className="w-20 h-20 bg-gray-900 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-4xl font-bold text-white">C</span>
            </div>
            
            {/* Brand name */}
            <h1 className="mt-5 text-2xl font-bold text-gray-900 tracking-tight">
              Calendi
            </h1>

            {/* Simple loading dots */}
            <div className="mt-8 flex gap-2">
              <motion.div
                className="w-2 h-2 bg-gray-300 rounded-full"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0 }}
              />
              <motion.div
                className="w-2 h-2 bg-gray-300 rounded-full"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
              />
              <motion.div
                className="w-2 h-2 bg-gray-300 rounded-full"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
