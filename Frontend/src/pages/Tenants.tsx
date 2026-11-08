import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Plus,
  User,
  Phone,
  Home,
  AlertCircle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { getTenantsApi, type Tenant } from "@/api/tenants";
import { getActiveLeasesApi, type LeaseItem } from "@/api/leases";
import { StatusMarker } from "@/components/shared/StatusMarker";

export const TenantsPage: React.FC = () => {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Fetch tenants with debounced search
  const {
    data: tenants = [],
    isLoading: isTenantsLoading,
    isError: isTenantsError,
    error: tenantsError,
    refetch: refetchTenants,
  } = useQuery<Tenant[]>({
    queryKey: ["tenants", { q: debouncedQuery }],
    queryFn: () => getTenantsApi(debouncedQuery),
  });

  // Fetch active leases to map current unit/house
  const { data: activeLeases = [] } = useQuery<LeaseItem[]>({
    queryKey: ["leases", "active"],
    queryFn: getActiveLeasesApi,
  });

  // Map tenant_id -> active LeaseItem
  const tenantActiveLeaseMap = useMemo(() => {
    const map = new Map<number, LeaseItem>();
    for (const lease of activeLeases) {
      if (!map.has(lease.tenant_id)) {
        map.set(lease.tenant_id, lease);
      }
    }
    return map;
  }, [activeLeases]);

  const getIdDocLabel = (tenant: Tenant) => {
    if (!tenant.id_doc_type && !tenant.id_doc_number) return "—";
    const typeLabel =
      tenant.id_doc_type === "nic"
        ? "CNI"
        : tenant.id_doc_type === "residence_permit"
        ? "Residence permit"
        : tenant.id_doc_type === "passport"
        ? "Passport"
        : "";
    return `${typeLabel ? typeLabel + ": " : ""}${tenant.id_doc_number || ""}`;
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-ink leading-tight">
            Tenants
          </h1>
          <p className="text-sm text-ink-2 mt-0.5 font-normal">
            {tenants.length} registered tenant{tenants.length === 1 ? "" : "s"} &bull; Contract records and ID documentation
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {/* Search box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-ink-2 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Search tenants by name or phone"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name or phone..."
              className="w-full h-11 sm:h-10 pl-9 pr-3 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchInput("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-xs text-ink-2 hover:text-ink min-w-[36px] min-h-[36px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                Clear
              </button>
            )}
          </div>

          {/* New Tenant Button */}
          <Link
            to="/tenants/new"
            className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-10 px-4 bg-primary hover:bg-primary-hover active:bg-primary-hover text-white text-sm font-medium rounded-btn transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[44px] sm:min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>New tenant</span>
          </Link>
        </div>
      </div>

      {/* Error state */}
      {isTenantsError && (
        <div
          role="alert"
          className="p-4 rounded-panel bg-overdue/10 border border-overdue/30 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-overdue shrink-0" />
            <div className="text-sm text-overdue font-medium">
              {tenantsError instanceof Error
                ? tenantsError.message
                : "Failed to load tenants"}
            </div>
          </div>
          <button
            onClick={() => refetchTenants()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-overdue/40 text-overdue rounded-btn-sm hover:bg-overdue/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-overdue min-h-[36px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Tenants Table */}
      <div className="bg-surface border border-line rounded-panel overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-ink bg-band/30">
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Tenant Name
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Phone
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Current Unit / House
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  ID Document
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isTenantsLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-ink-2">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span>Loading tenants...</span>
                    </div>
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-ink-2 bg-band/10">
                    <div className="max-w-sm mx-auto space-y-3">
                      <User className="w-8 h-8 text-ink-2/40 mx-auto" />
                      <div>
                        <p className="font-medium text-ink">
                          {debouncedQuery
                            ? `No tenants found matching "${debouncedQuery}"`
                            : "No tenants recorded yet"}
                        </p>
                        <p className="text-xs text-ink-2 mt-1">
                          {debouncedQuery
                            ? "Try checking the phone number or name spelling."
                            : "Add the first tenant to get started."}
                        </p>
                      </div>
                      <Link
                        to="/tenants/new"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-primary text-white rounded-btn-sm hover:bg-primary-hover"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add first tenant</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => {
                  const activeLease = tenantActiveLeaseMap.get(tenant.id);

                  return (
                    <tr
                      key={tenant.id}
                      className="border-b border-row-line hover:bg-band/40 transition-colors"
                    >
                      {/* Name */}
                      <td className="px-5 py-3.5 text-[14.5px] font-medium text-ink">
                        <Link
                          to={`/tenants/${tenant.id}`}
                          className="hover:text-primary transition-colors hover:underline focus:outline-none focus:ring-1 focus:ring-primary rounded-sm"
                        >
                          {tenant.title ? `${tenant.title} ` : ""}
                          {tenant.full_name}
                        </Link>
                      </td>

                      {/* Phone */}
                      <td className="px-5 py-3.5 text-[14.5px] font-mono text-ink tabular-nums whitespace-nowrap">
                        {tenant.phone ? (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-ink-2 shrink-0" />
                            <span>{tenant.phone}</span>
                            {tenant.whatsapp_number && (
                              <span
                                className="text-[10px] px-1 py-0.5 bg-paid/10 text-paid rounded font-sans font-medium"
                                title={`WhatsApp: ${tenant.whatsapp_number}`}
                              >
                                WA
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-ink-2/60">—</span>
                        )}
                      </td>

                      {/* Current Unit */}
                      <td className="px-5 py-3.5 text-[14.5px] whitespace-nowrap">
                        {activeLease ? (
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/leases/${activeLease.id}`}
                              className="font-medium text-ink hover:text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <Home className="w-3.5 h-3.5 text-ink-2" />
                              <span>
                                {activeLease.house_name}, {activeLease.unit_label}
                              </span>
                            </Link>
                            <StatusMarker
                              status={activeLease.payment_status}
                              daysOverdue={activeLease.days_overdue}
                              daysUntilExpiry={activeLease.days_until_expiry}
                              graceDays={activeLease.grace_days}
                              className="scale-90 origin-left"
                            />
                          </div>
                        ) : (
                          <span className="text-ink-2/60 text-xs italic">
                            No active lease
                          </span>
                        )}
                      </td>

                      {/* ID Document */}
                      <td className="px-5 py-3.5 text-[13px] font-mono text-ink-2">
                        {getIdDocLabel(tenant)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            to={`/tenants/${tenant.id}`}
                            className="inline-flex items-center justify-center h-7 px-3 text-xs font-medium border border-line text-ink hover:bg-band rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            Details
                          </Link>
                          <Link
                            to={`/leases/new?tenant_id=${tenant.id}`}
                            className="inline-flex items-center justify-center h-7 px-2.5 text-xs font-medium text-primary hover:bg-primary/5 rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                            title="Create new lease for this tenant"
                          >
                            <span>New lease</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
