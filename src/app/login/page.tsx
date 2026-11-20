'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Receipt,
  FileText,
  Package,
  ShieldCheck,
  Printer,
  Check,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      setClock(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('Username සහ Password ඇතුළත් කරන්න.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          remember,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('Server connection failed. Please make sure the POS server is running.');
      setLoading(false);
    }
  };

  const quickBadges = [
    { icon: Receipt, label: 'Invoices & POS' },
    { icon: FileText, label: 'Quotations' },
    { icon: Package, label: 'Stock & GRN' },
    { icon: ShieldCheck, label: 'Warranty Lookup' },
    { icon: Printer, label: 'A4 / Half A4 / POS80' },
  ];

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#eef4ff] via-[#fdf2f5] to-[#f2eeff] p-4 sm:p-8 select-none">
      {/* Soft Pastel Ambient Blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -left-24 h-[28rem] w-[28rem] rounded-full bg-sky-200/60 blur-[100px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-24 h-[26rem] w-[26rem] rounded-full bg-rose-200/55 blur-[100px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 left-1/3 h-[28rem] w-[28rem] rounded-full bg-violet-200/55 blur-[110px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-20 h-[24rem] w-[24rem] rounded-full bg-pink-200/50 blur-[100px]"
      />

      {/* Delicate Pastel Topographic Contour Wave Lines */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-55"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          <linearGradient id="pastelWaveBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#c4b5fd" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#fda4af" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="pastelWaveRose" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fda4af" stopOpacity="0.8" />
            <stop offset="55%" stopColor="#c4b5fd" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.75" />
          </linearGradient>
        </defs>
        {/* Left Contour Waves */}
        <path d="M-120 40 C 120 200, 40 420, 260 600 C 420 730, 180 860, 80 960" stroke="url(#pastelWaveBlue)" strokeWidth="1.4" />
        <path d="M-80 0 C 180 180, 90 400, 320 580 C 490 715, 240 850, 150 960" stroke="url(#pastelWaveBlue)" strokeWidth="1.2" />
        <path d="M-30 -40 C 240 160, 150 380, 390 560 C 560 695, 310 835, 220 960" stroke="url(#pastelWaveBlue)" strokeWidth="1" />
        <path d="M40 -60 C 310 140, 220 360, 460 540 C 630 675, 390 820, 300 960" stroke="url(#pastelWaveBlue)" strokeWidth="0.9" />
        {/* Right Contour Waves */}
        <path d="M1040 -60 C 1180 120, 1360 200, 1540 340" stroke="url(#pastelWaveRose)" strokeWidth="1.4" />
        <path d="M980 -60 C 1130 150, 1320 240, 1540 410" stroke="url(#pastelWaveRose)" strokeWidth="1.2" />
        <path d="M920 -60 C 1080 180, 1280 290, 1540 490" stroke="url(#pastelWaveRose)" strokeWidth="1" />
        <path d="M1100 960 C 1220 760, 1340 680, 1540 580" stroke="url(#pastelWaveRose)" strokeWidth="1.2" />
        <path d="M1020 960 C 1160 740, 1290 640, 1540 520" stroke="url(#pastelWaveRose)" strokeWidth="1" />
      </svg>

      {/* Main Pastel Card */}
      <div className="relative z-10 w-full max-w-[940px] animate-modal-in">
        <div
          className="relative rounded-3xl overflow-hidden border border-white/90 shadow-[0_28px_80px_-18px_rgba(99,102,241,0.18)] backdrop-blur-xl"
          style={{
            background:
              'radial-gradient(circle at 8% 10%, rgba(219, 234, 254, 0.85) 0%, rgba(255, 255, 255, 0.92) 45%, rgba(255, 241, 244, 0.88) 100%)',
          }}
        >
          {/* Subtle Pastel Top-Right Rose Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-rose-200/40 blur-3xl"
          />

          {/* Card Top Header Bar */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-6 sm:px-10 pt-6 sm:pt-7 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-extrabold tracking-tight text-slate-800">
                Tokiko Engineering <span className="text-indigo-500">(Pvt) Ltd</span>
              </span>
            </div>

            <div className="flex items-center gap-4 sm:gap-5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              <span className="hidden sm:inline text-indigo-400">POS</span>
              <span className="hidden sm:inline">INVOICE</span>
              <span className="hidden sm:inline">INVENTORY</span>
              {clock && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50/90 border border-indigo-100 text-indigo-500 font-mono tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {clock}
                </span>
              )}
            </div>
          </div>

          {/* Card Body: Left Form + Right Circular Logo Emblem */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 items-center gap-8 px-6 sm:px-10 py-8 sm:py-11">
            {/* Left Column: Login Form */}
            <div className="md:col-span-6 space-y-5">
              <div>
                <h1 className="text-2xl sm:text-[28px] font-black uppercase tracking-[0.06em] bg-gradient-to-r from-indigo-500 via-blue-500 to-rose-400 bg-clip-text text-transparent">
                  WELCOME BACK!
                </h1>
                <p className="text-xs sm:text-[13px] text-slate-500 mt-1.5 font-medium">
                  Tokiko Engineering (Pvt) Ltd •{' '}
                  <span className="text-rose-500 font-semibold">පද්ධතියට පිවිසෙන්න</span>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 pt-1">
                {error && (
                  <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Username Field */}
                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-xs font-bold text-slate-600 mb-2 ml-1 tracking-wide"
                  >
                    Username
                  </label>
                  <input
                    id="login-username"
                    type="text"
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full px-5 py-3 rounded-full bg-white/90 border-[1.5px] border-indigo-200/90 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-indigo-100/80 outline-none transition-all select-text shadow-xs"
                  />
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-2 ml-1">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-bold text-slate-600 tracking-wide"
                    >
                      Password
                    </label>
                    {capsLockOn && (
                      <span className="text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                        Caps Lock ON
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                      placeholder="••••••••"
                      className="w-full pl-5 pr-12 py-3 rounded-full bg-white/90 border-[1.5px] border-indigo-200/90 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-indigo-100/80 outline-none transition-all select-text shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 p-1.5 rounded-full transition cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Row */}
                <div className="flex items-center justify-between pt-1 px-1">
                  <label className="inline-flex items-center gap-2.5 text-xs font-medium text-slate-600 cursor-pointer group">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={remember}
                      onClick={() => setRemember((v) => !v)}
                      className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                        remember
                          ? 'bg-gradient-to-br from-indigo-400 to-rose-400 border-indigo-300 shadow-[0_0_8px_rgba(129,140,248,0.45)]'
                          : 'bg-white border-slate-300'
                      }`}
                    >
                      {remember && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                    </button>
                    <span className="group-hover:text-slate-900 transition-colors">Remember me</span>
                  </label>
                  <span className="text-[11px] font-semibold text-indigo-400">
                    7 Days Session
                  </span>
                </div>

                {/* Pill Sign In Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-6 rounded-full border border-white/60 bg-gradient-to-r from-indigo-400 via-blue-400 to-rose-400 hover:from-indigo-500 hover:via-blue-500 hover:to-rose-500 disabled:opacity-60 text-white font-bold text-sm tracking-wide shadow-[0_12px_28px_-6px_rgba(99,102,241,0.42)] hover:shadow-[0_14px_32px_-6px_rgba(244,63,94,0.4)] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <span>Sign In</span>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Circular Seamless Tokiko Emblem + Vertical Pastel Badges */}
            <div className="md:col-span-6 flex items-center justify-center md:justify-end gap-5 sm:gap-7">
              {/* Circular Emblem with Seamless Logo & Curved Text */}
              <div className="relative flex items-center justify-center">
                {/* Soft Pastel Outer Glow */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-4 rounded-full bg-gradient-to-tr from-sky-200/75 via-violet-200/50 to-rose-200/75 blur-xl"
                />

                {/* Outer Pastel Gradient Ring */}
                <div className="relative w-64 h-64 sm:w-76 sm:h-76 rounded-full p-[4px] bg-gradient-to-br from-blue-300 via-violet-200 to-rose-300 shadow-[0_18px_45px_-12px_rgba(99,102,241,0.28)]">
                  {/* Pure White Seamless Inner Circle */}
                  <div className="relative w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                    {/* Inner Delicate Decorative Ring */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-2.5 rounded-full border border-dashed border-indigo-200/80"
                    />

                    {/* Curved Circular SVG Text Around the Emblem */}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 260 260"
                      className="pointer-events-none absolute inset-0 w-full h-full"
                    >
                      <defs>
                        <path
                          id="tokikoTopArc"
                          d="M 32,130 A 98,98 0 0,1 228,130"
                        />
                        <path
                          id="tokikoBottomArc"
                          d="M 24,130 A 106,106 0 0,0 236,130"
                        />
                      </defs>
                      <text
                        fill="#6366f1"
                        fontSize="10.5"
                        fontWeight="800"
                        letterSpacing="3.2"
                      >
                        <textPath href="#tokikoTopArc" startOffset="50%" textAnchor="middle">
                          • TOKIKO ENGINEERING •
                        </textPath>
                      </text>
                      <text
                        fill="#f43f5e"
                        fontSize="10"
                        fontWeight="800"
                        letterSpacing="3"
                      >
                        <textPath href="#tokikoBottomArc" startOffset="50%" textAnchor="middle">
                          (PVT) LTD • SMART POS
                        </textPath>
                      </text>
                    </svg>

                    {/* Seamless Logo (mix-blend-multiply removes the white rectangle completely) */}
                    <div className="relative z-10 w-[78%] flex items-center justify-center px-2">
                      <img
                        src="/tokiko-logo.png"
                        alt="Tokiko Engineering (Pvt) Ltd Logo"
                        className="w-full h-auto object-contain mix-blend-multiply"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Vertical Stack of Circular Pastel Accent Badges */}
              <div className="hidden sm:flex flex-col items-center gap-3">
                {quickBadges.map(({ icon: Icon, label }, idx) => (
                  <div
                    key={label}
                    title={label}
                    className={`w-9 h-9 rounded-full flex items-center justify-center border shadow-xs transition-all hover:scale-110 ${
                      idx % 2 === 0
                        ? 'bg-indigo-100/90 border-indigo-200/80 text-indigo-500'
                        : 'bg-rose-100/90 border-rose-200/80 text-rose-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Subtle Bottom Bar */}
          <div className="relative z-10 px-6 sm:px-10 pb-5 pt-1 flex items-center justify-between text-[11px] font-medium text-slate-400">
            <span>Tokiko Engineering (Pvt) Ltd</span>
            <span>Smart POS • Local MySQL Edition</span>
          </div>
        </div>
      </div>
    </div>
  );
}
