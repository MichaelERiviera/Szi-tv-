import { useState, FormEvent, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle2, Tv, X } from "lucide-react";

interface LoginScreenProps {
  onClose?: () => void;
  initialTab?: "login" | "register" | "forgot";
  isModal?: boolean;
}

export default function LoginScreen({ onClose, initialTab = "login", isModal = false }: LoginScreenProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [activeTab, setActiveTab] = useState<"login" | "register" | "forgot">(initialTab);

  // Sync tab with initialTab prop if it changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Input states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Load remembered email on Mount
  useEffect(() => {
    const savedEmail = localStorage.getItem("sazi_tv_saved_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const clearMessages = () => {
    setErrorMsg("");
    setInfoMsg("");
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email.trim() || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem("sazi_tv_saved_email", email.trim());
      } else {
        localStorage.removeItem("sazi_tv_saved_email");
      }
      await signInWithEmail(email.trim(), password);
      onClose?.();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearMessages();

    const trimmedName = displayName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!trimmedEmail) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await signUpWithEmail(trimmedEmail, password, trimmedName);
      onClose?.();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Registration failed. This email may be taken.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email.trim()) {
      setErrorMsg("Please provide your email address.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim());
      setInfoMsg("A password reset link has been sent to your email address!");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthClick = async () => {
    clearMessages();
    setLoading(true);
    try {
      await signInWithGoogle();
      onClose?.();
    } catch (err: any) {
      console.error("OAuth error:", err);
      if (err.message?.includes("popup-closed-by-user") || err.code === "auth/popup-closed-by-user") {
        setErrorMsg(
          "Popup Closed: Google sign-in was canceled. If the sign-in window is blocked or blank, click 'Open in new tab' at the top-right of your screen to bypass iframe security constraints."
        );
      } else if (err.message?.includes("popup-blocked") || err.code === "auth/popup-blocked") {
        setErrorMsg(
          "Popup Blocked: Browser blocked the authentication popup. Please allow popups, or use the 'Open in new tab' button at the top-right."
        );
      } else {
        setErrorMsg(err.message || "An error occurred during Google Sign-In.");
      }
    } finally {
      setLoading(false);
    }
  };

  const isCancellable = !!onClose;

  return (
    <div className={isModal ? "fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#04040a]/85 backdrop-blur-md font-sans" : "min-h-[85vh] flex items-center justify-center p-4 relative z-10 font-sans"}>
      {isModal && <div className="absolute inset-0 cursor-default" onClick={onClose} />}
      
      {/* Background soft ambient neon blur glow */}
      {!isModal && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      )}

      {/* Premium Minimal Container Card */}
      <div className="w-full max-w-md bg-[#08080c]/95 border border-cyan-500/20 rounded-2xl p-8 shadow-2xl relative overflow-hidden z-10 animate-in fade-in zoom-in duration-200">
        {isCancellable && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors p-1.5 hover:bg-zinc-850 rounded-lg cursor-pointer z-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}
        {/* Neon blue top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400" />

        {/* Large Premium Logo Header Portion */}
        <div className="text-center mb-8 select-none">
          <div className="inline-flex items-center gap-3 justify-center text-white mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.25)]">
              <Tv className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-widest text-white leading-none">
                SAZI <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">TV</span>
              </h1>
              <p className="text-[10px] tracking-[0.3em] text-[#818cf8] font-semibold mt-1">STREAMING PORTAL</p>
            </div>
          </div>
          <p className="text-xs text-zinc-400 font-sans max-w-xs mx-auto mt-2">
            {activeTab === "login" && "Access your premium live streams and custom playlists"}
            {activeTab === "register" && "Create an account to start bookmarking your live feeds"}
            {activeTab === "forgot" && "Recover your password to re-enter your dashboard"}
          </p>
        </div>

        {/* Form Alerts */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl p-3.5 mb-6 flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMsg}</p>
          </div>
        )}

        {infoMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl p-3.5 mb-6 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">{infoMsg}</p>
          </div>
        )}

        {/* LOGIN FORM */}
        {activeTab === "login" && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-350 tracking-wide block">Email Address</label>
              <div className="relative">
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0d0d12] text-zinc-100 placeholder-zinc-650 border border-zinc-800 focus:border-cyan-500 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all text-sm font-sans"
                />
                <Mail className="absolute left-3.5 top-3.5 text-zinc-500" size={16} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-zinc-350 tracking-wide block">Password</label>
                <button
                  type="button"
                  id="forgot-pwd-trigger"
                  onClick={() => {
                    setActiveTab("forgot");
                    clearMessages();
                  }}
                  className="text-xs text-sky-400 hover:text-sky-300 transition-colors font-semibold"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0d0d12] text-zinc-100 placeholder-zinc-650 border border-zinc-800 focus:border-cyan-500 rounded-xl py-3 pl-10 pr-10 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all text-sm font-sans"
                />
                <Lock className="absolute left-3.5 top-3.5 text-zinc-500" size={16} />
                <button
                  type="button"
                  id="login-toggle-pass"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pb-2">
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                <input
                  id="login-remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-zinc-800 text-cyan-500 focus:ring-offset-black bg-zinc-950"
                />
                Remember Me
              </label>
            </div>

            <button
              type="submit"
              id="login-submit"
              disabled={loading}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-[#040406] font-bold tracking-wider text-sm uppercase rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? "Logging in..." : "Log In"}
            </button>

            <div className="text-center pt-2">
              <p className="text-xs text-zinc-400">
                Don't have an account?{" "}
                <button
                  type="button"
                  id="register-trigger"
                  onClick={() => {
                    setActiveTab("register");
                    clearMessages();
                  }}
                  className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors"
                >
                  Sign Up
                </button>
              </p>
            </div>
          </form>
        )}

        {/* SIGNUP FORM */}
        {activeTab === "register" && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-350 tracking-wide block">Full Name</label>
              <div className="relative">
                <input
                  id="register-name"
                  type="text"
                  required
                  placeholder="Full Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#0d0d12] text-zinc-100 placeholder-zinc-650 border border-zinc-800 focus:border-cyan-500 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all text-sm font-sans"
                />
                <User className="absolute left-3.5 top-3.5 text-zinc-500" size={16} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-350 tracking-wide block">Email Address</label>
              <div className="relative">
                <input
                  id="register-email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0d0d12] text-zinc-100 placeholder-zinc-650 border border-zinc-800 focus:border-cyan-500 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all text-sm font-sans"
                />
                <Mail className="absolute left-3.5 top-3.5 text-zinc-500" size={16} />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-350 tracking-wide block">Password</label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Choose Password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0d0d12] text-zinc-100 placeholder-zinc-650 border border-zinc-800 focus:border-cyan-500 rounded-xl py-3 pl-10 pr-10 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all text-sm font-sans"
                />
                <Lock className="absolute left-3.5 top-3.5 text-zinc-500" size={16} />
                <button
                  type="button"
                  id="register-toggle-pass"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-350 tracking-wide block">Confirm Password</label>
              <div className="relative">
                <input
                  id="register-confirm"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#0d0d12] text-zinc-100 placeholder-zinc-650 border border-zinc-800 focus:border-cyan-500 rounded-xl py-3 pl-10 pr-10 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all text-sm font-sans"
                />
                <Lock className="absolute left-3.5 top-3.5 text-zinc-500" size={16} />
              </div>
            </div>

            <button
              type="submit"
              id="register-submit"
              disabled={loading}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 text-[#040406] font-bold tracking-wider text-sm uppercase rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.35)] transition-all cursor-pointer"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>

            <div className="text-center pt-2">
              <p className="text-xs text-zinc-400">
                Already have an account?{" "}
                <button
                  type="button"
                  id="login-trigger"
                  onClick={() => {
                    setActiveTab("login");
                    clearMessages();
                  }}
                  className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors"
                >
                  Log In
                </button>
              </p>
            </div>
          </form>
        )}

        {/* FORGOT PASSWORD FORM */}
        {activeTab === "forgot" && (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-350 tracking-wide block">Email Address</label>
              <div className="relative">
                <input
                  id="forgot-email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0d0d12] text-zinc-100 placeholder-zinc-650 border border-zinc-800 focus:border-cyan-500 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all text-sm font-sans"
                />
                <Mail className="absolute left-3.5 top-3.5 text-zinc-500" size={16} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                id="forgot-submit"
                disabled={loading}
                className="flex-grow py-3 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold tracking-wider text-xs uppercase rounded-xl transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              >
                {loading ? "Sending..." : "Reset"}
              </button>
              <button
                type="button"
                id="forgot-back"
                onClick={() => {
                  setActiveTab("login");
                  clearMessages();
                }}
                className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 text-zinc-300 font-bold text-xs uppercase rounded-xl transition-colors cursor-pointer"
              >
                Back
              </button>
            </div>
          </form>
        )}

        {/* SOCIAL SIGN IN SECTIONS */}
        <div className="mt-8 pt-6 border-t border-zinc-900">
          <p className="text-center text-[10px] font-sans font-bold text-zinc-550 uppercase tracking-widest mb-4">
            - Or proceed with -
          </p>

          <button
            type="button"
            id="google-signin-btn"
            disabled={loading}
            onClick={handleOAuthClick}
            className="w-full py-3 bg-[#0d0d12] hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-800 text-zinc-200 text-xs font-bold font-sans tracking-wide rounded-xl transition-all cursor-pointer flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.22-.67-.35-1.37-.35-2.09z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            {activeTab === "register" ? "Google Sign-Up" : "Google Sign-In"}
          </button>
        </div>
      </div>
    </div>
  );
}
