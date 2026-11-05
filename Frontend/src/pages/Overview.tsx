import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, RefreshCw } from "lucide-react";
import { getDashboardApi, type LeaseItem } from "@/api/dashboard";
import { SummaryStrip } from "@/components/shared/SummaryStrip";
import { StatusMarker } from "@/components/shared/StatusMarker";
import { formatMoney, formatDate, formatHeaderDate } from "@/lib/format";

export const OverviewPage: React.FC = () => {
  const [search, setSearch] = useState("");

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboardApi(30),
    staleTime: 1000 * 60,
  });

  const leases = useMemo(() => data?.leases || [], [data?.leases]);
  const counts = data?.counts;
  const vacantUnits = useMemo(() => data?.vacant_units || [], [data?.vacant_units]);

  // Sum of monthly_total over active leases returned
  const monthlyRentRoll = useMemo(() => {
    return leases.reduce((sum, l) => sum + (l.monthly_total || 0), 0);
  }, [leases]);

  // Client-side search filtering
  const filteredLeases = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leases;
    return leases.filter((l) => {
      const matchTenant = l.tenant_name.toLowerCase().includes(q);
      const matchHouse = l.house_name.toLowerCase().includes(q);
      const matchUnit = l.unit_label.toLowerCase().includes(q);
      return matchTenant || matchHouse || matchUnit;
    });
  }, [leases, search]);

  // Grouped active leases by urgency
  const needsAttention = useMemo(() => {
    return filteredLeases.filter(
      (l) => l.payment_status === "overdue" || l.payment_status === "grace"
    );
  }, [filteredLeases]);

  const comingUp = useMemo(() => {
    return filteredLeases.filter((l) => l.payment_status === "expiring_soon");
  }, [filteredLeases]);

  const upToDate = useMemo(() => {
    return filteredLeases.filter((l) => l.payment_status === "up_to_date");
  }, [filteredLeases]);

  const renderLeaseRow = (lease: LeaseItem) => {
    const isUrgent =
      lease.payment_status === "overdue" || lease.payment_status === "grace";
    const isExpiring = lease.payment_status === "expiring_soon";

    return (
      <tr
        key={lease.id}
        className="border-b border-row-line last:border-b-0 hover:bg-[#F8FAFC] transition-colors"
      >
        {/* Tenant */}
        <td className="px-5 py-3.5 text-[14.5px] font-medium text-ink">
          <Link
            to={`/leases/${lease.id}`}
            className="hover:text-primary transition-colors hover:underline focus:outline-none focus:ring-1 focus:ring-primary rounded-sm"
          >
            {lease.tenant_name}
          </Link>
        </td>

        {/* Unit */}
        <td className="px-5 py-3.5 text-[14.5px] text-ink whitespace-nowrap">
          {lease.house_name}, {lease.unit_label}
        </td>

        {/* Monthly Total (FCFA) - right-aligned mono */}
        <td className="px-5 py-3.5 text-[14.5px] font-mono text-ink text-right tabular-nums whitespace-nowrap">
          {formatMoney(lease.monthly_total)}
        </td>

        {/* Paid Through */}
        <td className="px-5 py-3.5 text-[14.5px] text-ink whitespace-nowrap">
          {formatDate(lease.paid_through)}
        </td>

        {/* Status */}
        <td className="px-5 py-3.5 whitespace-nowrap">
          <StatusMarker
            status={lease.payment_status}
            daysOverdue={lease.days_overdue}
            daysUntilExpiry={lease.days_until_expiry}
            graceDays={lease.grace_days}
          />
        </td>

        {/* Action Button */}
        <td className="px-5 py-3.5 text-right whitespace-nowrap">
          {isUrgent ? (
            <button
              type="button"
              className="inline-flex items-center justify-center h-8 px-4 text-xs font-medium bg-primary hover:bg-primary-hover active:bg-[#174BB0] text-white rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            >
              Record payment
            </button>
          ) : isExpiring ? (
            <button
              type="button"
              className="inline-flex items-center justify-center h-8 px-4 text-xs font-medium border border-primary text-primary hover:bg-primary/5 active:bg-primary/10 rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Record payment
            </button>
          ) : (
            <button
              type="button"
              className="inline-flex items-center justify-center h-8 px-4 text-xs font-medium border border-line text-primary hover:bg-primary/5 active:bg-primary/10 rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              View
            </button>
          )}
        </td>
      </tr>
    );
  };

  const renderGroupHeader = (title: string, count: number) => {
    return (
      <tr className="bg-band border-b border-row-line">
        <th
          colSpan={6}
          className="px-5 py-2 text-left text-[11px] font-semibold uppercase tracking-header-cap text-ink-2"
        >
          {title}, {count}
        </th>
      </tr>
    );
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-ink leading-tight">
            Overview
          </h1>
          <p className="text-sm text-ink-2 mt-0.5 font-normal">
            {formatHeaderDate()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenant or unit"
              className="w-full h-10 px-3.5 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-2 hover:text-ink"
              >
                Clear
              </button>
            )}
          </div>

          {/* Primary Record payment button */}
          <button
            type="button"
            className="h-10 px-4 bg-primary hover:bg-primary-hover active:bg-[#174BB0] text-white text-sm font-medium rounded-btn transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 flex items-center justify-center"
          >
            Record payment
          </button>
        </div>
      </div>

      {/* Error State Banner */}
      {isError && (
        <div
          role="alert"
          className="p-4 rounded-panel bg-[#FDF2F1] border border-overdue/30 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-overdue shrink-0" />
            <div className="text-sm text-overdue font-medium">
              {error instanceof Error ? error.message : "Failed to load dashboard data"}
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-overdue/40 text-overdue rounded-btn-sm hover:bg-overdue/5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-20 bg-line/30 rounded-sm" />
          <div className="h-80 bg-surface border border-line rounded-panel" />
        </div>
      ) : (
        <>
          {/* Summary Strip */}
          <SummaryStrip
            monthlyRentRoll={monthlyRentRoll}
            leaseCount={leases.length}
            overdueCount={counts?.overdue ?? 0}
            graceCount={counts?.grace ?? 0}
            expiringCount={counts?.expiring_soon ?? 0}
            upToDateCount={counts?.up_to_date ?? 0}
          />

          {/* Table Container */}
          <div className="bg-surface border border-line rounded-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                      Tenant
                    </th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                      Unit
                    </th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                      Monthly Total (FCFA)
                    </th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                      Paid Through
                    </th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                      Status
                    </th>
                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right w-[160px]">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-ink-2 text-sm">
                        {search
                          ? `No leases found matching "${search}".`
                          : "No active leases recorded yet."}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {/* 1. Needs attention */}
                      {needsAttention.length > 0 && (
                        <>
                          {renderGroupHeader("Needs attention", needsAttention.length)}
                          {needsAttention.map(renderLeaseRow)}
                        </>
                      )}

                      {/* 2. Coming up */}
                      {comingUp.length > 0 && (
                        <>
                          {renderGroupHeader("Coming up", comingUp.length)}
                          {comingUp.map(renderLeaseRow)}
                        </>
                      )}

                      {/* 3. Up to date */}
                      {upToDate.length > 0 && (
                        <>
                          {renderGroupHeader("Up to date", upToDate.length)}
                          {upToDate.map(renderLeaseRow)}
                        </>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vacant units row below table */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
            <span>
              {vacantUnits.length === 0 ? (
                "No vacant units"
              ) : (
                <>
                  <span className="text-ink font-medium">
                    {vacantUnits.length} vacant unit{vacantUnits.length === 1 ? "" : "s"}:
                  </span>{" "}
                  {vacantUnits.map((u) => `${u.house_name}, ${u.label}`).join("; ")}
                </>
              )}
            </span>
            <button
              type="button"
              className="inline-flex items-center px-3 py-1 text-xs font-medium border border-line text-primary hover:bg-primary/5 active:bg-primary/10 rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              New lease
            </button>
          </div>
        </>
      )}
    </div>
  );
};
