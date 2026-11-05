import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/Login";
import { AppShell } from "./components/layout/AppShell";
import { PlaceholderPage } from "./pages/PlaceholderPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-xs uppercase font-semibold tracking-header-cap text-ink-2">
            Loading AMS...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route
                index
                element={
                  <PlaceholderPage
                    title="Overview"
                    subtitle="App shell active. Overview screen will be built in Step 2."
                  />
                }
              />
              <Route path="tenants" element={<PlaceholderPage title="Tenants" />} />
              <Route path="payments" element={<PlaceholderPage title="Payments" />} />
              <Route path="expenses" element={<PlaceholderPage title="Expenses" />} />
              <Route path="reports" element={<PlaceholderPage title="Reports" />} />
              <Route path="houses" element={<PlaceholderPage title="Houses & Units" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;

