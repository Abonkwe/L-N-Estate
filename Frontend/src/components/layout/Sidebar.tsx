import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LogOut, X } from "lucide-react";
import { getHousesApi, type House } from "@/api/houses";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/cn";

interface SidebarProps {
  onNavigate?: () => void;
  isMobileDrawer?: boolean;
}

const MANAGE_NAV_ITEMS = [
  { label: "Overview", to: "/" },
  { label: "Tenants", to: "/tenants" },
  { label: "Payments", to: "/payments" },
  { label: "Expenses", to: "/expenses" },
  { label: "Reports", to: "/reports" },
];

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate, isMobileDrawer = false }) => {
  const { user, logout } = useAuth();
  const location = useLocation();

  const { data: houses = [], isLoading: housesLoading } = useQuery<House[]>({
    queryKey: ["houses"],
    queryFn: getHousesApi,
    staleTime: 1000 * 30, // 30s fresh time, invalidated on any house/unit update
  });

  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-text flex flex-col h-full select-none",
        isMobileDrawer ? "w-full max-w-[320px]" : "w-sidebar"
      )}
    >
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-sidebar-hover shrink-0">
        <div>
          <div className="text-white font-bold text-base tracking-tight leading-tight">
            L&amp;N Apartments
          </div>
          <div className="text-[11px] font-semibold tracking-header-cap text-sidebar-label uppercase mt-0.5">
            Rent management
          </div>
        </div>
        {isMobileDrawer && onNavigate && (
          <button
            onClick={onNavigate}
            aria-label="Close menu"
            className="p-2 text-sidebar-text hover:text-white rounded-md min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Manage Section */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-header-cap text-sidebar-label">
            Manage
          </div>
          <nav className="space-y-0.5">
            {MANAGE_NAV_ITEMS.map((item) => {
              const isActive =
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to);

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-btn-sm text-sm font-medium transition-colors min-h-[44px] md:min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isActive
                      ? "bg-sidebar-active text-white"
                      : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
                  )}
                >
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Houses Section */}
        <div>
          <div className="px-3 mb-2 flex items-center justify-between">
            <NavLink
              to="/houses"
              onClick={onNavigate}
              className={cn(
                "text-[11px] font-semibold uppercase tracking-header-cap transition-colors",
                location.pathname === "/houses"
                  ? "text-white font-bold underline underline-offset-4"
                  : "text-sidebar-label hover:text-white"
              )}
            >
              Houses
            </NavLink>
            <NavLink
              to="/houses"
              onClick={onNavigate}
              className="text-[10px] uppercase font-semibold text-sidebar-label hover:text-white tracking-wider transition-colors"
            >
              All
            </NavLink>
          </div>

          <div className="space-y-0.5">
            {housesLoading ? (
              <div className="px-3 py-2 text-xs text-sidebar-label italic">Loading houses...</div>
            ) : houses.length === 0 ? (
              <div className="px-3 py-2 text-xs text-sidebar-label">No houses recorded</div>
            ) : (
              houses.map((house) => (
                <NavLink
                  key={house.id}
                  to={`/houses/${house.id}`}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-btn-sm text-sm transition-colors min-h-[44px] md:min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    location.pathname === `/houses/${house.id}`
                      ? "bg-sidebar-active text-white font-medium"
                      : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
                  )}
                >
                  <span className="truncate pr-2">{house.name}</span>
                  <span className="font-mono text-xs text-sidebar-label figure tabular-nums shrink-0">
                    {house.occupied_count} of {house.unit_count}
                  </span>
                </NavLink>
              ))
            )}
          </div>
        </div>
      </div>

      {/* User / Logout Footer */}
      <div className="p-3 border-t border-sidebar-hover shrink-0">
        <div className="px-3 py-2 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <div className="text-xs font-semibold text-white truncate">
              {user?.full_name || "Staff"}
            </div>
            <div className="text-[11px] text-sidebar-label truncate">{user?.email}</div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            aria-label="Sign out"
            className="p-2 text-sidebar-label hover:text-white hover:bg-sidebar-hover rounded-btn-sm transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
