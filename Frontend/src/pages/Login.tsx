import React, { useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export const LoginPage: React.FC = () => {
  const { isAuthenticated, login, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => {
    try {
      const msg = sessionStorage.getItem("ams_login_message");
      if (msg) {
        sessionStorage.removeItem("ams_login_message");
        return msg;
      }
    } catch {
      // ignore
    }
    const stateMsg = (location.state as { message?: string } | null)?.message;
    return stateMsg || null;
  });
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && !authLoading) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-[400px] bg-surface border border-line rounded-input p-8 shadow-sm">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="text-2xl font-bold tracking-tight text-ink">AMS</div>
          <div className="text-xs uppercase tracking-header-cap font-semibold text-ink-2 mt-1">
            L&amp;N Estate &bull; Buea
          </div>
          <p className="text-sm text-ink-2 mt-3">Sign in to manage apartments and rent</p>
        </div>

        {/* Error notification */}
        {error && (
          <div
            role="alert"
            className="mb-6 p-3 text-sm rounded-btn-sm border border-overdue/30 bg-overdue/10 text-overdue font-medium"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1.5"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. abonkwe@gmail.com"
              disabled={submitting}
              className="w-full h-11 px-3.5 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors disabled:opacity-50"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={submitting}
              className="w-full h-11 px-3.5 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 bg-primary hover:bg-primary-hover active:bg-primary-hover text-white font-medium text-sm rounded-btn transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

