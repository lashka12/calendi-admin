"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { signInAdmin } from "../lib/firebase/auth";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signInAdmin(email, password);
      if (result.success) {
        // Show success state
        setLoading(false);
        setSuccess(true);
        
        // Wait for success animation, then fade out
        setTimeout(() => {
          setExiting(true);
        }, 600);
        
        // Navigate after fade out
        setTimeout(() => {
          router.push("/");
        }, 1000);
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
      className="min-h-screen bg-[#faf9f7] flex flex-col relative overflow-hidden"
      initial={false}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Background orbs - CSS-only (GPU-friendly), no blur. Hidden on mobile for performance. */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none login-orb-mobile-hide md:block">
        <div
          className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-stone-200/60 to-transparent login-orb-1"
          style={{ transformOrigin: "center center" }}
        />
        <div
          className="absolute -bottom-[30%] -right-[20%] w-[70%] h-[70%] rounded-full bg-gradient-to-tl from-stone-200/40 to-transparent login-orb-2"
          style={{ transformOrigin: "center center" }}
        />
        <div
          className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-gradient-to-bl from-stone-200/50 to-transparent login-orb-3"
          style={{ transformOrigin: "center center" }}
        />
      </div>

      {/* Dot pattern - static, low cost */}
      <div 
        className="absolute inset-0 opacity-[0.3] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at center, #d4d2ce 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Main content */}
      <div className="relative flex-1 flex flex-col justify-center px-6 py-12">
        <div className="w-full max-w-sm mx-auto">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="text-center mb-12"
          >
            <div className="relative inline-block">
              <div className="w-20 h-20 bg-gray-900 rounded-3xl flex flex-col items-center justify-center overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                <span className="text-white text-4xl font-bold -mb-1">C</span>
                <div className="flex flex-col gap-1 mt-1">
                  <div className="w-10 h-0.5 bg-white/30 rounded-full" />
                  <div className="w-6 h-0.5 bg-white/20 rounded-full" />
                </div>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mt-6 tracking-tight">
              Calendi
            </h1>
            <p className="text-gray-400 mt-2 text-sm tracking-wide uppercase font-medium">
              Admin Portal
            </p>
          </motion.div>

          {/* Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
            className="bg-white rounded-3xl shadow-xl shadow-stone-200/40 border border-stone-100 p-8"
          >
            <motion.form 
              onSubmit={handleSubmit} 
              className="space-y-5"
              animate={error ? { x: [0, -6, 6, -6, 6, 0] } : {}}
              transition={{ duration: 0.35 }}
            >
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  className={`w-full px-5 py-4 bg-[#f5f4f2] border-2 rounded-2xl text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white transition-all duration-200 text-base ${
                    error ? 'border-red-300 bg-red-50/50' : 'border-stone-200 focus:border-gray-900'
                  }`}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    className={`w-full px-5 py-4 pr-14 bg-[#f5f4f2] border-2 rounded-2xl text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white transition-all duration-200 text-base ${
                      error ? 'border-red-300 bg-red-50/50' : 'border-stone-200 focus:border-gray-900'
                    }`}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-stone-100 transition-all"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Error message - subtle text */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
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
                className="w-full py-4 px-6 mt-4 rounded-2xl font-semibold text-base shadow-lg focus:outline-none focus:ring-4 transition-all duration-200 flex items-center justify-center gap-3 disabled:cursor-not-allowed group bg-gray-900 text-white shadow-gray-900/25 hover:bg-gray-800 focus:ring-gray-900/20 disabled:opacity-50 disabled:shadow-none"
              >
                {success ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="flex items-center gap-2"
                  >
                    <Check className="w-5 h-5" strokeWidth={3} />
                    <span>Welcome back</span>
                  </motion.div>
                ) : loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </motion.button>
            </motion.form>
          </motion.div>

          {/* Bottom text - same animation sequence as form card */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="text-center mt-8 text-gray-400 text-sm"
          >
            Secure access for administrators
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}
