import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/Login";
import { OverviewPage } from "./pages/Overview";
import { LeaseDetailPage } from "./pages/LeaseDetail";
import { TenantsPage } from "./pages/Tenants";
import { TenantDetailPage } from "./pages/TenantDetail";
import { NewLeasePage } from "./pages/NewLease";
import { HousesPage } from "./pages/Houses";
import { HouseDetailPage } from "./pages/HouseDetail";
import { PaymentsPage } from "./pages/Payments";
import { ExpensesPage } from "./pages/Expenses";
import { ReportsPage } from "./pages/Reports";
import { AppShell } from "./components/layout/AppShell";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";

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
    <ErrorBoundary>
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
                <Route index element={<OverviewPage />} />
                <Route path="leases/new" element={<NewLeasePage />} />
                <Route path="leases/:id" element={<LeaseDetailPage />} />
                <Route path="tenants" element={<TenantsPage />} />
                <Route path="tenants/new" element={<TenantDetailPage isNew={true} />} />
                <Route path="tenants/:id" element={<TenantDetailPage />} />
                <Route path="houses" element={<HousesPage />} />
                <Route path="houses/:id" element={<HouseDetailPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
