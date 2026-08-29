import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Feather, CheckCircle2, Zap, Shield, Search, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export function LoginPage() {
  const { devLogin, isDevLoggingIn } = useAuth();
  const [demoEmail, setDemoEmail] = useState('demo@reachinbox.ai');
  const [demoName, setDemoName] = useState('Sarah Jenkins');
  const [errorMessage, setErrorMessage] = useState('');

  const handleGoogleLogin = async () => {
    // For the demo, we bypass the actual Google OAuth flow so it works seamlessly 
    // without requiring you to set up Google Cloud credentials.
    setErrorMessage('');
    try {
      await devLogin({ email: demoEmail, name: demoName });
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to sign in';
      setErrorMessage(msg);
    }
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      await devLogin({ email: demoEmail, name: demoName });
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message || 'Failed to sign in';
      setErrorMessage(msg);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-100 overflow-hidden">
        
        {/* Left Side: Brand & Feature Highlights */}
        <div className="bg-gradient-to-b from-purple-900 to-purple-950 p-10 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Subtle background accent */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 transform translate-x-1/2 -translate-y-1/2"></div>
          
          <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-10">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-300 to-yellow-600 flex items-center justify-center text-purple-950 shadow-lg shadow-amber-500/20">
                <Feather className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">ReachInbox</h1>
              </div>
            </div>

            <h2 className="text-2xl font-medium leading-snug mb-8 text-white/95">
              Production-Grade Email Scheduling & Delivery System
            </h2>

            <div className="space-y-4 text-sm text-purple-200">
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 rounded-full bg-purple-800 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span>BullMQ delayed queues with backend restart persistence</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 rounded-full bg-purple-800 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <span>Redis-backed hourly rate limiting & auto-rescheduling</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 rounded-full bg-purple-800 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <span>Strict idempotency & atomic DB claiming</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-5 h-5 rounded-full bg-purple-800 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <Search className="w-3.5 h-3.5" />
                </div>
                <span>Elasticsearch full-text search across recipients & body</span>
              </div>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-purple-800/50 text-xs text-purple-300 relative z-10">
            <span>Built with TypeScript • PostgreSQL • Redis • BullMQ • React</span>
          </div>
        </div>

        {/* Right Side: Authentication Actions */}
        <div className="p-10 flex flex-col justify-center bg-white">
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-gray-900">Welcome Back</h3>
            <p className="text-sm text-gray-500 mt-1">Sign in to schedule and monitor your email queues</p>
          </div>

          {errorMessage && (
            <div className="mb-5 flex items-start space-x-2.5 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Primary: Real Google OAuth Button */}
          <div className="space-y-6">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center space-x-3 py-3 px-4 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-700 font-medium shadow-sm transition-all duration-200"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center text-xs uppercase font-medium">
                <span className="bg-white px-3 text-gray-400 tracking-wider">
                  Or Demo Quick-Access
                </span>
              </div>
            </div>

            {/* Dev Demo Login Form */}
            <form onSubmit={handleDevLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Email Address</label>
                <input
                  type="email"
                  value={demoEmail}
                  onChange={(e) => setDemoEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Full Name</label>
                <input
                  type="text"
                  value={demoName}
                  onChange={(e) => setDemoName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-colors"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isDevLoggingIn}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-purple-900 hover:bg-purple-950 text-white font-medium text-sm rounded-lg shadow-sm shadow-purple-900/20 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isDevLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Demo Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
