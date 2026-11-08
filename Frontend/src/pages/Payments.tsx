import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Loader2,
  AlertCircle,
  RefreshCw,
  Search,
  Plus,
  Info,
  Ban,
} from "lucide-react";
import { getPaymentsApi, openReceiptPdf, type PaymentOut } from "@/api/payments";
import { getLeasesApi, type LeaseItem } from "@/api/leases";
import { RecordPaymentDialog } from "@/components/payments/RecordPaymentDialog";
import { VoidPaymentDialog } from "@/components/leases/VoidPaymentDialog";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

export const PaymentsPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters state
  const [selectedLeaseId, setSelectedLeaseId] = useState<number | "all">("all");
  const [tenantFilter, setTenantFilter] = useState<string>("");
  const [includeVoid, setIncludeVoid] = useState<boolean>(true);

  // Dialogs & action state
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState<boolean>(false);
  const [voidTargetPayment, setVoidTargetPayment] = useState<PaymentOut | null>(null);
  const [loadingPdfId, setLoadingPdfId] = useState<number | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  // Fetch leases for lease picker
  const { data: leases = [] } = useQuery<LeaseItem[]>({
    queryKey: ["leases", "all"],
    queryFn: () => getLeasesApi(),
  });

  // Fetch payments
  const leaseIdParam = selectedLeaseId === "all" ? null : selectedLeaseId;
  const {
    data: payments = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<PaymentOut[]>({
    queryKey: ["payments", { lease_id: leaseIdParam, include_void: includeVoid }],
    queryFn: () => getPaymentsApi(leaseIdParam, includeVoid, 200),
  });

  // Client-side tenant-name text filter applied to returned rows
  const filteredPayments = useMemo(() => {
    const q = tenantFilter.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p) => p.tenant_name.toLowerCase().includes(q));
  }, [payments, tenantFilter]);

  const isLimitReached = payments.length >= 200;

  // Receipt PDF open handler
  const handleOpenReceipt = async (paymentId: number) => {
    try {
      setLoadingPdfId(paymentId);
      setReceiptError(null);
      await openReceiptPdf(paymentId);
    } catch (err: unknown) {
      setReceiptError(
        err instanceof Error ? err.message : "Failed to load receipt PDF"
      );
    } finally {
      setLoadingPdfId(null);
    }
  };

  const handleRefetch = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["leases"] });
  };

  const formatMethodLabel = (method: string) => {
    switch (method) {
      case "cash":
        return "Cash";
      case "bank":
        return "Bank";
      case "mobile_money":
        return "Mobile Money";
      default:
        return method;
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-ink leading-tight">
            Payments
          </h1>
          <p className="text-sm text-ink-2 mt-0.5 font-normal">
            Rent collection history, receipts, and payment status
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsRecordDialogOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-10 px-4 bg-primary hover:bg-primary-hover active:bg-primary-hover text-white text-sm font-medium rounded-btn transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[44px] sm:min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>Record payment</span>
          </button>
        </div>
      </div>

      {/* Limit Notice (when 200 rows returned) */}
      {isLimitReached && (
        <div className="p-3.5 rounded-panel bg-band/60 border border-line flex items-center gap-3 text-xs text-ink-2">
          <Info className="w-4 h-4 text-primary shrink-0" />
          <span>
            <strong>Limit reached:</strong> Showing the 200 most recent payments. Select a specific lease above to inspect earlier history.
          </span>
        </div>
      )}

      {/* Receipt Fetch Error Alert */}
      {receiptError && (
        <div
          role="alert"
          className="p-3.5 rounded-panel bg-overdue/10 border border-overdue/30 flex items-center justify-between gap-3 text-xs text-overdue"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{receiptError}</span>
          </div>
          <button
            type="button"
            onClick={() => setReceiptError(null)}
            className="font-medium underline hover:text-overdue/80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Query Error State */}
      {isError && (
        <div
          role="alert"
          className="p-4 rounded-panel bg-overdue/10 border border-overdue/30 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-overdue shrink-0" />
            <div className="text-sm text-overdue font-medium">
              {error instanceof Error ? error.message : "Failed to load payments"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-overdue/40 text-overdue rounded-btn-sm hover:bg-overdue/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-overdue min-h-[36px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-surface border border-line rounded-panel p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-1">
          {/* Tenant Name Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-ink-2/60 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by tenant name..."
              value={tenantFilter}
              onChange={(e) => setTenantFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-input-border rounded-input text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          {/* Lease Picker */}
          <div className="min-w-[240px]">
            <select
              value={selectedLeaseId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedLeaseId(val === "all" ? "all" : parseInt(val, 10));
              }}
              className="w-full px-3 py-2 text-sm bg-surface border border-input-border rounded-input text-ink focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="all">All leases</option>
              {leases.map((lease) => (
                <option key={lease.id} value={lease.id}>
                  {lease.tenant_name} &bull; {lease.house_name} ({lease.unit_label})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Include Voided Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-center pl-1">
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              id="includeVoid"
              checked={includeVoid}
              onChange={(e) => setIncludeVoid(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-line peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-line after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
            <span className="ml-2 text-sm font-medium text-ink">
              Include voided
            </span>
          </label>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-surface border border-line rounded-panel overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="border-b border-ink bg-band/30">
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Date
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Tenant
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Unit
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                  Amount (FCFA)
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Method
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Reference
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Status
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-center">
                  Receipt
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-row-line">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      <span className="text-xs text-ink-2 uppercase tracking-header-cap font-semibold">
                        Loading payments...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <div className="text-base font-semibold text-ink">
                        No payments found
                      </div>
                      <p className="text-sm text-ink-2">
                        {tenantFilter || selectedLeaseId !== "all"
                          ? "No payments match the active filter criteria. Try clearing filters."
                          : "No payments recorded yet. Click 'Record payment' to add the first one."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => {
                  const isVoid = payment.is_void;

                  return (
                    <tr
                      key={payment.id}
                      className={cn(
                        "hover:bg-band/20 transition-colors",
                        isVoid && "bg-band/10"
                      )}
                    >
                      {/* Date */}
                      <td className="px-5 py-3.5 text-sm text-ink whitespace-nowrap">
                        <span className={cn(isVoid && "line-through text-ink-2/60")}>
                          {formatDate(payment.paid_on)}
                        </span>
                      </td>

                      {/* Tenant */}
                      <td className="px-5 py-3.5 text-sm font-medium whitespace-nowrap">
                        <Link
                          to={`/leases/${payment.lease_id}`}
                          className={cn(
                            "hover:underline",
                            isVoid
                              ? "line-through text-ink-2/60 hover:text-ink"
                              : "text-primary hover:text-primary-hover"
                          )}
                        >
                          {payment.tenant_name}
                        </Link>
                      </td>

                      {/* Unit */}
                      <td className="px-5 py-3.5 text-sm text-ink whitespace-nowrap">
                        <div className={cn(isVoid && "line-through text-ink-2/60")}>
                          <span className="font-medium text-ink">
                            {payment.unit_label}
                          </span>
                          <span className="text-xs text-ink-2 ml-1.5 font-normal">
                            ({payment.house_name})
                          </span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-3.5 text-sm font-mono tabular-nums text-right font-medium whitespace-nowrap">
                        <span className={cn(isVoid && "line-through text-ink-2/60")}>
                          {formatMoney(payment.amount)}
                        </span>
                      </td>

                      {/* Method */}
                      <td className="px-5 py-3.5 text-sm text-ink-2 whitespace-nowrap">
                        <span className={cn(isVoid && "line-through text-ink-2/60")}>
                          {formatMethodLabel(payment.method)}
                        </span>
                      </td>

                      {/* Reference */}
                      <td className="px-5 py-3.5 text-xs text-ink-2 max-w-[140px] truncate">
                        <span className={cn(isVoid && "line-through text-ink-2/60")}>
                          {payment.reference || "—"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5 text-xs">
                        {isVoid ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-overdue/10 text-overdue border border-overdue/20 uppercase tracking-wider">
                              Voided
                            </span>
                            {payment.void_reason && (
                              <p className="text-[12px] italic text-overdue/90 mt-0.5 max-w-xs break-words">
                                &ldquo;{payment.void_reason}&rdquo;
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-sm bg-paid shrink-0" />
                            <span className="text-xs font-medium text-paid">
                              Paid
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Receipt */}
                      <td className="px-5 py-3.5 text-xs text-center whitespace-nowrap">
                        {payment.receipt_id ? (
                          <button
                            type="button"
                            onClick={() => handleOpenReceipt(payment.id)}
                            disabled={loadingPdfId === payment.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary hover:text-primary-hover bg-band/40 hover:bg-band border border-line rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                            title="Open authenticated receipt PDF"
                          >
                            {loadingPdfId === payment.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FileText className="w-3.5 h-3.5" />
                            )}
                            <span>
                              #{String(payment.receipt_id).padStart(5, "0")}
                            </span>
                          </button>
                        ) : (
                          <span className="text-ink-2/60 text-xs">—</span>
                        )}
                      </td>

                      {/* Actions (Void) */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {!isVoid ? (
                          <button
                            type="button"
                            onClick={() => setVoidTargetPayment(payment)}
                            className="inline-flex items-center justify-center gap-1 h-7 px-2.5 text-xs font-medium text-overdue hover:text-white border border-overdue/40 hover:bg-overdue rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-overdue"
                            title="Void this payment with a reason"
                          >
                            <Ban className="w-3 h-3" />
                            <span>Void</span>
                          </button>
                        ) : (
                          <span className="text-xs text-ink-2/40 italic">Voided</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        isOpen={isRecordDialogOpen}
        onClose={() => setIsRecordDialogOpen(false)}
        preselectedLease={null}
        onSuccess={handleRefetch}
      />

      {/* Void Payment Dialog */}
      <VoidPaymentDialog
        isOpen={!!voidTargetPayment}
        onClose={() => setVoidTargetPayment(null)}
        payment={voidTargetPayment}
        onSuccess={handleRefetch}
      />
    </div>
  );
};

