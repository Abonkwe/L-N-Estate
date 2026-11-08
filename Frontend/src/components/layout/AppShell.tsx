import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useDialogA11y } from "@/lib/useDialogA11y";

export const AppShell: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const drawerRef = useDialogA11y<HTMLDivElement>({
    isOpen: mobileMenuOpen,
    onClose: () => setMobileMenuOpen(false),
  });

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row antialiased overflow-x-hidden">
      {/* Mobile Top Header (visible on < 768px) */}
      <header className="md:hidden h-14 bg-sidebar px-4 flex items-center justify-between border-b border-sidebar-hover shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-base tracking-tight">AMS</span>
          <span className="text-[11px] font-semibold text-sidebar-label uppercase tracking-header-cap">
            &bull; Buea
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open navigation menu"
          className="p-2 text-sidebar-text hover:text-white rounded-btn-sm min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Desktop Sidebar (visible on >= 768px) */}
      <div className="hidden md:flex md:w-sidebar md:shrink-0 h-screen sticky top-0 z-10 border-r border-sidebar-hover shadow-sm">
        <Sidebar />
      </div>

      {/* Mobile Drawer (visible when open on < 768px) */}
      {mobileMenuOpen && (
        <div
          ref={drawerRef}
          className="fixed inset-0 z-50 md:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative flex-1 flex flex-col max-w-[280px] w-full bg-sidebar shadow-xl z-10 animate-in slide-in-from-left duration-200">
            <Sidebar onNavigate={() => setMobileMenuOpen(false)} isMobileDrawer />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 w-full max-w-full overflow-y-auto overflow-x-hidden px-4 md:px-10 py-6 md:py-[30px]">
        <Outlet />
      </main>
    </div>
  );
};

