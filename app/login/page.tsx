"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { signInAdmin } from "../lib/firebase/auth";
import { useTheme } from "../context/ThemeContext";

export default function LoginPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Preload both logos so theme switch is instant too
  useEffect(() => {
    const light = new window.Image();
    const dark = new window.Image();
    light.src = '/icons/logo-light.png';
    dark.src = '/icons/logo-dark.png';
    const onLoad = () => setLogoLoaded(true);
    if (resolvedTheme === 'dark') {
      dark.onload = onLoad;
      // preload the other in background
    } else {
      light.onload = onLoad;
    }
    // fallback if image is already cached
    if (dark.complete && resolvedTheme === 'dark') setLogoLoaded(true);
    if (light.complete && resolvedTheme !== 'dark') setLogoLoaded(true);
  }, [resolvedTheme]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signInAdmin(email, password);
      if (result.success) {
        setLoading(false);
        setSuccess(true);
        setTimeout(() => setExiting(true), 600);
        setTimeout(() => router.push("/"), 1000);
      } else {
        setError(result.error || "Invalid credentials");
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="min-h-screen theme-bg-primary flex flex-col"
      initial={false}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Main content — vertically centered */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12">
        <div className="w-full max-w-[320px] mx-auto">

          {/* Logo — waits for image to load, then fades in smoothly */}
          <div className="flex justify-center mb-14" style={{ minHeight: 220 }}>
            <motion.img
              src={resolvedTheme === 'dark' ? '/icons/logo-dark.png' : '/icons/logo-light.png'}
              alt="Calendi"
              width={220}
              height={220}
              className="select-none pointer-events-none"
              draggable={false}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: logoLoaded ? 1 : 0, scale: logoLoaded ? 1 : 0.96 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: logoLoaded ? 1 : 0, y: logoLoaded ? 0 : 16 }}
            transition={{ duration: 0.5, delay: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-4"
          >
            {/* Email */}
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                className={`w-full px-4 py-3.5 theme-bg-secondary border rounded-xl theme-text-primary placeholder:theme-text-tertiary focus:outline-none transition-all duration-200 text-[15px] ${
                  error ? 'border-red-400/60' : 'theme-border focus:border-current'
                }`}
                style={!error ? { borderColor: 'var(--color-border-primary)' } : undefined}
                placeholder="Email address"
                autoComplete="email"
                required
              />
            </div>

            {/* Password */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                className={`w-full px-4 py-3.5 pr-12 theme-bg-secondary border rounded-xl theme-text-primary placeholder:theme-text-tertiary focus:outline-none transition-all duration-200 text-[15px] ${
                  error ? 'border-red-400/60' : 'theme-border focus:border-current'
                }`}
                style={!error ? { borderColor: 'var(--color-border-primary)' } : undefined}
                placeholder="Password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg theme-text-tertiary hover:theme-text-secondary transition-colors"
              >
                {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="text-red-500 text-sm text-center font-medium"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading || success || !email || !password}
              whileTap={{ scale: 0.98 }}
              animate={success ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 0.25 }}
              className="w-full py-3.5 mt-2 rounded-xl font-semibold text-[15px] focus:outline-none transition-all duration-200 flex items-center justify-center gap-2.5 disabled:cursor-not-allowed group btn-action disabled:opacity-40"
            >
              {success ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2"
                >
                  <Check className="w-[18px] h-[18px]" strokeWidth={3} />
                  <span>Welcome back</span>
                </motion.div>
              ) : loading ? (
                <>
                  <Loader2 className="w-[18px] h-[18px] animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-[18px] h-[18px] group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </motion.button>
          </motion.form>

          {/* Footer text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: logoLoaded ? 1 : 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="text-center mt-8 theme-text-tertiary text-xs tracking-wide"
          >
            Secure admin access
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}
