import React, { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Plus,
  Ban,
  FileText,
  AlertCircle,
  RefreshCw,
  Loader2,
  FileCheck,
  Phone,
  Home,
} from "lucide-react";
import { getLeaseApi, getRentSheetApi } from "@/api/leases";
import { getPaymentsApi, openReceiptPdf, type PaymentOut } from "@/api/payments";
import { StatusMarker } from "@/components/shared/StatusMarker";
import { RecordPaymentDialog } from "@/components/payments/RecordPaymentDialog";
import { AddRentChangeDialog } from "@/components/leases/AddRentChangeDialog";
import { AddAdjustmentDialog } from "@/components/leases/AddAdjustmentDialog";
import { EndLeaseDialog } from "@/components/leases/EndLeaseDialog";
import { VoidPaymentDialog } from "@/components/leases/VoidPaymentDialog";
import { formatMoney, formatDate } from "@/lib/format";

export const LeaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const leaseId = id ? parseInt(id, 10) : NaN;
  const queryClient = useQueryClient();

  // Dialog visibility states
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isRentChangeDialogOpen, setIsRentChangeDialogOpen] = useState(false);
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);
  const [isEndLeaseDialogOpen, setIsEndLeaseDialogOpen] = useState(false);
  const [voidTargetPayment, setVoidTargetPayment] = useState<PaymentOut | null>(null);

  // Table filters
  const [showVoided, setShowVoided] = useState(false);

  // PDF loading & error state
  const [loadingPdfId, setLoadingPdfId] = useState<number | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  // Fetch Lease Details
  const {
    data: lease,
    isLoading: isLeaseLoading,
    isError: isLeaseError,
    error: leaseError,
    refetch: refetchLease,
  } = useQuery({
    queryKey: ["leases", leaseId],
    queryFn: () => getLeaseApi(leaseId),
    enabled: !isNaN(leaseId),
  });

  // Fetch Rent Sheet
  const {
    data: rentSheet = [],
    isLoading: isRentSheetLoading,
    isError: isRentSheetError,
    error: rentSheetError,
    refetch: refetchRentSheet,
  } = useQuery({
    queryKey: ["leases", leaseId, "rent-sheet"],
    queryFn: () => getRentSheetApi(leaseId),
    enabled: !isNaN(leaseId),
  });

  // Fetch Payments (with include_void=true)
  const {
    data: payments = [],
    isLoading: isPaymentsLoading,
    isError: isPaymentsError,
    error: paymentsError,
    refetch: refetchPayments,
  } = useQuery({
    queryKey: ["payments", { lease_id: leaseId }],
    queryFn: () => getPaymentsApi(leaseId, true),
    enabled: !isNaN(leaseId),
  });

  // Refetch all queries related to this lease and overview
  const handleRefetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ["leases", leaseId] });
    queryClient.invalidateQueries({ queryKey: ["leases", leaseId, "rent-sheet"] });
    queryClient.invalidateQueries({ queryKey: ["payments", { lease_id: leaseId }] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["leases", "active"] });
  };

  // Authenticated PDF viewer handler
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

  // Filter payments based on showVoided toggle
  const displayedPayments = useMemo(() => {
    if (showVoided) return payments;
    return payments.filter((p) => !p.is_void);
  }, [payments, showVoided]);

  // Method display name helper
  const getMethodLabel = (method: string) => {
    switch (method) {
      case "bank":
        return "Bank transfer";
      case "mobile_money":
        return "Mobile Money";
      default:
        return "Cash";
    }
  };

  // Deposit status label helper
  const getDepositStatusLabel = (status: string) => {
    switch (status) {
      case "held":
        return "Held";
      case "refunded":
        return "Refunded";
      case "partially_refunded":
        return "Partially refunded";
      case "forfeited":
        return "Forfeited";
      default:
        return status;
    }
  };

  // Invalid ID state
  if (isNaN(leaseId)) {
    return (
      <div className="max-w-[1200px] mx-auto py-12 text-center space-y-4">
        <h2 className="text-xl font-semibold text-ink">Invalid lease ID</h2>
        <p className="text-sm text-ink-2">Please select a valid lease from the overview.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-btn-sm text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Overview</span>
        </Link>
      </div>
    );
  }

  // Loading State
  if (isLeaseLoading) {
    return (
      <div className="space-y-6 max-w-[1200px] mx-auto animate-pulse">
        <div className="h-6 w-36 bg-line/40 rounded-sm" />
        <div className="h-28 bg-surface border border-line rounded-panel p-6 space-y-3">
          <div className="h-8 w-64 bg-line/30 rounded-sm" />
          <div className="h-4 w-48 bg-line/20 rounded-sm" />
        </div>
        <div className="h-48 bg-surface border border-line rounded-panel" />
        <div className="h-64 bg-surface border border-line rounded-panel" />
      </div>
    );
  }

  // Error State
  if (isLeaseError || !lease) {
    return (
      <div className="max-w-[1200px] mx-auto py-8 space-y-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Overview</span>
        </Link>
        <div
          role="alert"
          className="p-5 bg-overdue/10 border border-overdue/30 rounded-panel flex items-start justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-overdue shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-overdue">Failed to load lease</h3>
              <p className="text-xs text-ink-2 mt-1">
                {leaseError instanceof Error
                  ? leaseError.message
                  : "Lease not found or server error"}
              </p>
            </div>
          </div>
          <button
            onClick={() => refetchLease()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-overdue/40 text-overdue rounded-btn-sm hover:bg-overdue/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-overdue min-h-[36px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  const isActiveLease = lease.status === "active";

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto pb-12">
      {/* Back link */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2 hover:text-primary transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded p-1"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Overview</span>
        </Link>
      </div>

      {/* Global Receipt PDF Error Alert */}
      {receiptError && (
        <div
          role="alert"
          className="p-4 bg-overdue/10 border border-overdue/30 rounded-panel flex items-center justify-between gap-3 text-xs text-overdue font-medium"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{receiptError}</span>
          </div>
          <button
            onClick={() => setReceiptError(null)}
            className="text-overdue hover:underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* HEADER CARD */}
      <div className="bg-surface border border-line rounded-panel p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          {/* Tenant & Unit Info */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[28px] font-semibold text-ink leading-tight">
                {lease.tenant_name}
              </h1>
              <StatusMarker
                status={lease.payment_status}
                daysOverdue={lease.days_overdue}
                daysUntilExpiry={lease.days_until_expiry}
                graceDays={lease.grace_days}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-ink-2">
              <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                <Home className="w-4 h-4 text-ink-2" />
                {lease.house_name} &bull; Unit {lease.unit_label}
              </span>
              {lease.tenant_phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-ink-2" />
                  <span className="font-mono">{lease.tenant_phone}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs">
                <Calendar className="w-3.5 h-3.5 text-ink-2" />
                Lease: {formatDate(lease.start_date)} &ndash;{" "}
                {lease.end_date ? formatDate(lease.end_date) : "Ongoing"}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsPaymentDialogOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-9 px-4 text-xs font-semibold bg-primary hover:bg-primary-hover active:bg-primary-hover text-white rounded-btn transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 min-h-[44px] sm:min-h-[36px]"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Record payment</span>
            </button>

            <button
              type="button"
              onClick={() => setIsRentChangeDialogOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-9 px-3.5 text-xs font-semibold border border-line bg-surface text-ink hover:bg-band rounded-btn transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] sm:min-h-[36px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add rent change</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAdjustmentDialogOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-9 px-3.5 text-xs font-semibold border border-line bg-surface text-ink hover:bg-band rounded-btn transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] sm:min-h-[36px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add adjustment</span>
            </button>

            {/* End lease button: Only visible when active */}
            {isActiveLease && (
              <button
                type="button"
                onClick={() => setIsEndLeaseDialogOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-9 px-3.5 text-xs font-semibold border border-overdue/40 text-overdue bg-surface hover:bg-overdue/10 rounded-btn transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-overdue min-h-[44px] sm:min-h-[36px]"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>End lease</span>
              </button>
            )}
          </div>
        </div>

        {/* METRICS STRIP (C Console heavy top rule + hairline bottom rule) */}
        <div className="mt-6 pt-5 border-t-2 border-ink grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-row-line">
          {/* Paid Through */}
          <div className="pt-2 sm:pt-0 sm:px-3 first:pl-0">
            <span className="block text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
              Paid through
            </span>
            <span className="block text-xl font-mono font-medium text-ink mt-0.5 tabular-nums">
              {formatDate(lease.paid_through)}
            </span>
            <span className="block text-[11px] text-ink-2 mt-0.5">
              {lease.months_paid} month{lease.months_paid === 1 ? "" : "s"} paid
            </span>
          </div>

          {/* Monthly Total */}
          <div className="pt-2 sm:pt-0 sm:px-3">
            <span className="block text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
              Monthly total
            </span>
            <span className="block text-xl font-mono font-medium text-ink mt-0.5 tabular-nums">
              {formatMoney(lease.monthly_total, true)}
            </span>
            <span className="block text-[11px] text-ink-2 mt-0.5">
              Base: {formatMoney(lease.base_rent)} &bull; Utilities:{" "}
              {formatMoney((lease.water_fee ?? 0) + (lease.waste_fee ?? 0))}
            </span>
          </div>

          {/* Deposit */}
          <div className="pt-2 sm:pt-0 sm:px-3">
            <span className="block text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
              Deposit
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-mono font-medium text-ink tabular-nums">
                {formatMoney(lease.deposit_amount, true)}
              </span>
              <span className="text-xs font-semibold text-ink-2">
                ({getDepositStatusLabel(lease.deposit_status)})
              </span>
            </div>
            {lease.deposit_refunded > 0 && (
              <span className="block text-[11px] text-paid mt-0.5">
                Refunded: {formatMoney(lease.deposit_refunded, true)}
              </span>
            )}
          </div>

          {/* Next Month Charge / Position */}
          <div className="pt-2 sm:pt-0 sm:px-3 last:pr-0">
            <span className="block text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
              Next month charge
            </span>
            <span className="block text-xl font-mono font-medium text-ink mt-0.5 tabular-nums">
              {formatMoney(lease.next_month_charge, true)}
            </span>
            <span className="block text-[11px] text-ink-2 mt-0.5">
              {lease.credit_toward_next > 0
                ? `Credit: ${formatMoney(lease.credit_toward_next, true)}`
                : lease.shortfall_next > 0
                ? `Shortfall: ${formatMoney(lease.shortfall_next, true)}`
                : "Starts " + formatDate(lease.next_period_start)}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: RENT SHEET TABLE */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Rent sheet</h2>
            <p className="text-xs text-ink-2">
              Word &ldquo;Rents Monitoring Sheet&rdquo; ledger &bull; Rebuilt from payments
            </p>
          </div>
          <span className="text-xs font-mono text-ink-2">
            {rentSheet.length} {rentSheet.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {isRentSheetError && (
          <div
            role="alert"
            className="p-3 bg-overdue/10 border border-overdue/30 rounded-panel flex items-center justify-between text-xs text-overdue"
          >
            <span>
              {rentSheetError instanceof Error
                ? rentSheetError.message
                : "Failed to load rent sheet"}
            </span>
            <button
              onClick={() => refetchRentSheet()}
              className="font-semibold underline hover:text-overdue/80"
            >
              Retry
            </button>
          </div>
        )}

        <div className="bg-surface border border-line rounded-panel overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-ink bg-band/30">
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 w-16">
                    S/N
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                    Date
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                    Amount (FCFA)
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                    Period from
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                    Period to
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                    Comment
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                    Receipt
                  </th>
                </tr>
              </thead>
              <tbody>
                {isRentSheetLoading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-ink-2">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>Loading rent sheet...</span>
                      </div>
                    </td>
                  </tr>
                ) : rentSheet.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-8 text-center text-sm text-ink-2 bg-band/10"
                    >
                      No rent sheet entries recorded yet. Record a payment to populate the ledger.
                    </td>
                  </tr>
                ) : (
                  rentSheet.map((row) => {
                    // Match corresponding payment ID for opening PDF receipt
                    const paymentId =
                      payments.find((p) => p.receipt_id === row.receipt_id)?.id ??
                      row.receipt_id;
                    const isOpeningPdf = paymentId ? loadingPdfId === paymentId : false;

                    return (
                      <tr
                        key={row.sn}
                        className="border-b border-row-line hover:bg-band/40 transition-colors"
                      >
                        <td className="px-5 py-3 text-[14.5px] font-mono text-ink-2 tabular-nums">
                          {row.sn}
                        </td>
                        <td className="px-5 py-3 text-[14.5px] font-mono text-ink tabular-nums whitespace-nowrap">
                          {formatDate(row.paid_on)}
                        </td>
                        <td className="px-5 py-3 text-[14.5px] font-mono font-medium text-ink text-right tabular-nums whitespace-nowrap">
                          {formatMoney(row.amount)}
                        </td>
                        <td className="px-5 py-3 text-[14.5px] font-mono text-ink tabular-nums whitespace-nowrap">
                          {formatDate(row.period_from)}
                        </td>
                        <td className="px-5 py-3 text-[14.5px] font-mono text-ink tabular-nums whitespace-nowrap">
                          {formatDate(row.period_to)}
                        </td>
                        <td className="px-5 py-3 text-[14.5px] text-ink">
                          {row.comment || "—"}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          {paymentId ? (
                            <button
                              type="button"
                              onClick={() => handleOpenReceipt(paymentId)}
                              disabled={isOpeningPdf}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-line hover:border-primary text-primary hover:bg-primary/5 rounded-btn-sm transition-colors focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                              title="Open bilingual receipt PDF"
                            >
                              {isOpeningPdf ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileText className="w-3.5 h-3.5" />
                              )}
                              <span>
                                Receipt #{String(row.receipt_id ?? paymentId).padStart(5, "0")}
                              </span>
                            </button>
                          ) : (
                            <span className="text-ink-2/60 text-xs">—</span>
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
      </section>

      {/* SECTION 2: PAYMENTS TABLE */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-ink">Payments</h2>
            <p className="text-xs text-ink-2">
              All payment transactions with receipts and void status
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Show Voided Toggle */}
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-ink select-none">
              <input
                type="checkbox"
                checked={showVoided}
                onChange={(e) => setShowVoided(e.target.checked)}
                className="w-4 h-4 rounded text-primary border-input-border focus:ring-primary"
              />
              <span>Show voided payments</span>
            </label>

            <span className="text-xs font-mono text-ink-2">
              {displayedPayments.length} displayed
            </span>
          </div>
        </div>

        {isPaymentsError && (
          <div
            role="alert"
            className="p-3 bg-overdue/10 border border-overdue/30 rounded-panel flex items-center justify-between text-xs text-overdue"
          >
            <span>
              {paymentsError instanceof Error
                ? paymentsError.message
                : "Failed to load payments"}
            </span>
            <button
              onClick={() => refetchPayments()}
              className="font-semibold underline hover:text-overdue/80"
            >
              Retry
            </button>
          </div>
        )}

        <div className="bg-surface border border-line rounded-panel overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-ink bg-band/30">
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                    Date
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
                    Receipt
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                    Status
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {isPaymentsLoading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-ink-2">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>Loading payments...</span>
                      </div>
                    </td>
                  </tr>
                ) : displayedPayments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-8 text-center text-sm text-ink-2 bg-band/10"
                    >
                      {payments.length > 0 && !showVoided
                        ? "All recorded payments are voided. Enable 'Show voided payments' to view them."
                        : "No payments recorded yet for this lease."}
                    </td>
                  </tr>
                ) : (
                  displayedPayments.map((payment) => {
                    const isOpeningPdf = loadingPdfId === payment.id;
                    const isVoid = payment.is_void;

                    return (
                      <tr
                        key={payment.id}
                        className={`border-b border-row-line transition-colors ${
                          isVoid
                            ? "bg-overdue/5 text-ink-2/65"
                            : "hover:bg-band/40 text-ink"
                        }`}
                      >
                        {/* Date */}
                        <td
                          className={`px-5 py-3.5 text-[14.5px] font-mono tabular-nums whitespace-nowrap ${
                            isVoid ? "line-through" : ""
                          }`}
                        >
                          {formatDate(payment.paid_on)}
                        </td>

                        {/* Amount */}
                        <td
                          className={`px-5 py-3.5 text-[14.5px] font-mono font-medium text-right tabular-nums whitespace-nowrap ${
                            isVoid ? "line-through text-ink-2/65" : "text-ink"
                          }`}
                        >
                          {formatMoney(payment.amount)}
                        </td>

                        {/* Method */}
                        <td
                          className={`px-5 py-3.5 text-[14.5px] whitespace-nowrap ${
                            isVoid ? "line-through" : ""
                          }`}
                        >
                          {getMethodLabel(payment.method)}
                        </td>

                        {/* Reference */}
                        <td
                          className={`px-5 py-3.5 text-[14.5px] font-mono tabular-nums ${
                            isVoid ? "line-through" : ""
                          }`}
                        >
                          {payment.reference || "—"}
                        </td>

                        {/* Receipt */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {payment.receipt_id ? (
                            <button
                              type="button"
                              onClick={() => handleOpenReceipt(payment.id)}
                              disabled={isOpeningPdf}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-btn-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                                isVoid
                                  ? "border-line text-ink-2/70 hover:bg-band"
                                  : "border-line hover:border-primary text-primary hover:bg-primary/5"
                              }`}
                            >
                              {isOpeningPdf ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <FileCheck className="w-3.5 h-3.5" />
                              )}
                              <span>
                                Receipt #{String(payment.receipt_id).padStart(5, "0")}
                              </span>
                            </button>
                          ) : (
                            <span className="text-ink-2/60 text-xs">—</span>
                          )}
                        </td>

                        {/* Status & Void reason */}
                        <td className="px-5 py-3.5 text-xs">
                          {isVoid ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-overdue/10 text-overdue border border-overdue/20 uppercase tracking-wider">
                                Voided
                              </span>
                              {payment.void_reason && (
                                <p className="text-[12px] italic text-ink-2 mt-0.5 max-w-xs break-words">
                                  &ldquo;{payment.void_reason}&rdquo;
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-paid/10 text-paid border border-paid/20">
                              Completed
                            </span>
                          )}
                        </td>

                        {/* Action: Void */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          {!isVoid ? (
                            <button
                              type="button"
                              onClick={() => setVoidTargetPayment(payment)}
                              className="inline-flex items-center justify-center h-7 px-3 text-xs font-medium text-overdue hover:text-white border border-overdue/40 hover:bg-overdue rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-overdue"
                            >
                              Void
                            </button>
                          ) : (
                            <span className="text-xs text-ink-2/50 italic">Voided</span>
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
      </section>

      {/* SECTION 3: RENT HISTORY (TERMS) */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-ink">Rent history</h2>
            <p className="text-xs text-ink-2">
              Lease terms history &bull; Earlier paid months preserve their historical rent
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsRentChangeDialogOpen(true)}
            className="inline-flex items-center gap-1.5 self-start sm:self-auto text-xs font-semibold text-primary hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add rent change</span>
          </button>
        </div>

        <div className="bg-surface border border-line rounded-panel overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-ink bg-band/30">
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                    Effective from
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                    Base rent (FCFA)
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                    Water (FCFA)
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                    Waste (FCFA)
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                    Monthly total (FCFA)
                  </th>
                  <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                    Notice date
                  </th>
                </tr>
              </thead>
              <tbody>
                {lease.terms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-8 text-center text-sm text-ink-2 bg-band/10"
                    >
                      No rent terms recorded.
                    </td>
                  </tr>
                ) : (
                  lease.terms.map((term, index) => (
                    <tr
                      key={index}
                      className="border-b border-row-line hover:bg-band/40 transition-colors"
                    >
                      <td className="px-5 py-3 text-[14.5px] font-mono text-ink tabular-nums whitespace-nowrap">
                        {formatDate(term.effective_from)}
                      </td>
                      <td className="px-5 py-3 text-[14.5px] font-mono text-ink text-right tabular-nums whitespace-nowrap">
                        {formatMoney(term.base_rent)}
                      </td>
                      <td className="px-5 py-3 text-[14.5px] font-mono text-ink text-right tabular-nums whitespace-nowrap">
                        {formatMoney(term.water_fee)}
                      </td>
                      <td className="px-5 py-3 text-[14.5px] font-mono text-ink text-right tabular-nums whitespace-nowrap">
                        {formatMoney(term.waste_fee)}
                      </td>
                      <td className="px-5 py-3 text-[14.5px] font-mono font-medium text-ink text-right tabular-nums whitespace-nowrap">
                        {formatMoney(term.monthly_total)}
                      </td>
                      <td className="px-5 py-3 text-[14.5px] font-mono text-ink-2 tabular-nums whitespace-nowrap">
                        {formatDate(term.notice_given_on)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* DIALOGS */}
      {/* 1. Record Payment Dialog */}
      <RecordPaymentDialog
        isOpen={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        preselectedLease={lease}
        onSuccess={handleRefetchAll}
      />

      {/* 2. Add Rent Change Dialog */}
      <AddRentChangeDialog
        isOpen={isRentChangeDialogOpen}
        onClose={() => setIsRentChangeDialogOpen(false)}
        lease={lease}
        onSuccess={handleRefetchAll}
      />

      {/* 3. Add Adjustment Dialog */}
      <AddAdjustmentDialog
        isOpen={isAdjustmentDialogOpen}
        onClose={() => setIsAdjustmentDialogOpen(false)}
        lease={lease}
        onSuccess={handleRefetchAll}
      />

      {/* 4. End Lease Dialog */}
      <EndLeaseDialog
        isOpen={isEndLeaseDialogOpen}
        onClose={() => setIsEndLeaseDialogOpen(false)}
        lease={lease}
        onSuccess={handleRefetchAll}
      />

      {/* 5. Void Payment Dialog */}
      <VoidPaymentDialog
        isOpen={!!voidTargetPayment}
        onClose={() => setVoidTargetPayment(null)}
        payment={voidTargetPayment}
        onSuccess={handleRefetchAll}
      />
    </div>
  );
};

