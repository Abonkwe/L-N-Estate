import React, { useState, useEffect } from "react";
import { X, Loader2, AlertCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import type { LeaseDetail } from "@/api/leases";
import { endLeaseApi } from "@/api/leases";
import { formatMoney, formatDate } from "@/lib/format";
import { Money } from "@/components/shared/Money";
import { useDialogA11y } from "@/lib/useDialogA11y";

interface EndLeaseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lease: LeaseDetail;
  onSuccess: () => void;
}

export const EndLeaseDialog: React.FC<EndLeaseDialogProps> = ({
  isOpen,
  onClose,
  lease,
  onSuccess,
}) => {
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [status, setStatus] = useState<"ended" | "terminated">("ended");
  const [endedOn, setEndedOn] = useState("");
  const [depositRefundedStr, setDepositRefundedStr] = useState("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize defaults
  useEffect(() => {
    if (isOpen) {
      setStep("form");
      setStatus("ended");
      setEndedOn(new Date().toISOString().slice(0, 10));
      // Default deposit refund to the deposit amount or 0
      setDepositRefundedStr(String(lease.deposit_amount ?? 0));
      setNotes("");
      setErrorMessage(null);
    }
  }, [isOpen, lease]);

  // Accessible dialog focus trap and Escape handler
  const dialogRef = useDialogA11y<HTMLDivElement>({
    isOpen,
    onClose: () => {
      if (!isSubmitting) onClose();
    },
  });

  if (!isOpen) return null;

  const handleNextToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const refund = parseInt(depositRefundedStr, 10);
    if (isNaN(refund) || refund < 0) {
      setErrorMessage("Deposit refunded must be a valid non-negative number.");
      return;
    }

    if (refund > lease.deposit_amount) {
      setErrorMessage(
        `Refund cannot exceed the deposit amount of ${formatMoney(lease.deposit_amount, true)}.`
      );
      return;
    }

    if (!endedOn) {
      setErrorMessage("End date is required.");
      return;
    }

    setStep("confirm");
  };

  const handleConfirmEnd = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    const refund = parseInt(depositRefundedStr, 10) || 0;

    try {
      await endLeaseApi(lease.id, {
        status,
        ended_on: endedOn,
        deposit_refunded: refund,
        notes: notes.trim() ? notes.trim() : null,
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to end lease"
      );
      // Stay on confirm or return to form
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-lease-dialog-title"
    >
      <div className="relative w-full max-w-lg bg-surface border border-line rounded-panel shadow-xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between bg-band/30">
          <div>
            <h2
              id="end-lease-dialog-title"
              className="text-lg font-semibold text-ink"
            >
              {step === "form" ? "End lease" : "Confirm ending lease"}
            </h2>
            <p className="text-xs text-ink-2 mt-0.5">
              {lease.tenant_name} &bull; {lease.house_name}, {lease.unit_label}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-ink-2 hover:text-ink rounded-btn-sm hover:bg-band focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Step */}
        {step === "form" && (
          <form onSubmit={handleNextToConfirm} className="p-6 space-y-4">
            {errorMessage && (
              <div
                role="alert"
                className="p-3 bg-overdue/10 border border-overdue/30 rounded-btn-sm flex items-start gap-2.5 text-xs text-overdue font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            {/* Status selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1.5">
                Lease resolution <span className="text-overdue">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStatus("ended")}
                  className={`flex flex-col text-left p-3 rounded-btn-sm border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] ${
                    status === "ended"
                      ? "bg-band/80 border-primary ring-1 ring-primary/30"
                      : "bg-surface border-line hover:bg-band/40"
                  }`}
                >
                  <span className="text-xs font-bold text-ink">Ended</span>
                  <span className="text-[11px] text-ink-2 mt-0.5">
                    Regular completion or agreed departure
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus("terminated")}
                  className={`flex flex-col text-left p-3 rounded-btn-sm border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] ${
                    status === "terminated"
                      ? "bg-overdue/10 border-overdue ring-1 ring-overdue/30"
                      : "bg-surface border-line hover:bg-band/40"
                  }`}
                >
                  <span className="text-xs font-bold text-overdue">Terminated</span>
                  <span className="text-[11px] text-ink-2 mt-0.5">
                    Early termination, breach, or eviction
                  </span>
                </button>
              </div>
            </div>

            {/* End Date */}
            <div>
              <label
                htmlFor="ended-on-input"
                className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
              >
                End date <span className="text-overdue">*</span>
              </label>
              <input
                id="ended-on-input"
                type="date"
                value={endedOn}
                onChange={(e) => setEndedOn(e.target.value)}
                required
                className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
              />
            </div>

            {/* Deposit refund */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="deposit-refunded-input"
                  className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2"
                >
                  Deposit refunded (FCFA) <span className="text-overdue">*</span>
                </label>
                <span className="text-[11px] font-mono text-ink-2">
                  Held: <Money amount={lease.deposit_amount} showUnit />
                </span>
              </div>
              <input
                id="deposit-refunded-input"
                type="number"
                min="0"
                max={lease.deposit_amount}
                step="1"
                value={depositRefundedStr}
                onChange={(e) => setDepositRefundedStr(e.target.value)}
                required
                className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm font-mono text-ink text-right tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              <p className="text-[11px] text-ink-2 mt-1">
                Enter 0 for full forfeiture, up to <Money amount={lease.deposit_amount} showUnit /> for full return.
              </p>
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="end-lease-notes"
                className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
              >
                Inspection / Handover notes (optional)
              </label>
              <textarea
                id="end-lease-notes"
                rows={3}
                placeholder="Details of checkout inspection, keys returned, deductions, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none"
              />
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-line flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-10 sm:h-9 px-4 py-2 text-xs font-medium border border-line text-ink hover:bg-band rounded-btn-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] sm:min-h-[36px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-10 sm:h-9 px-4 py-2 text-xs font-medium bg-overdue hover:bg-overdue/90 text-white rounded-btn-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-overdue min-h-[44px] sm:min-h-[36px]"
              >
                Review termination &rarr;
              </button>
            </div>
          </form>
        )}

        {/* Confirmation Step */}
        {step === "confirm" && (
          <div className="p-6 space-y-5">
            {/* Warning Callout */}
            <div className="p-4 bg-overdue/10 border border-overdue/30 rounded-panel flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-overdue shrink-0 mt-0.5" />
              <div className="text-xs text-ink space-y-1">
                <p className="font-bold text-overdue text-sm">
                  Confirm ending this lease
                </p>
                <p className="leading-relaxed">
                  This action marks the lease as{" "}
                  <strong>{status}</strong>, immediately frees unit{" "}
                  <strong>{lease.unit_label}</strong> as vacant, and finalizes
                  the deposit. This cannot be undone.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="p-3 bg-overdue/10 border border-overdue/30 rounded-btn-sm flex items-start gap-2.5 text-xs text-overdue font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">{errorMessage}</div>
              </div>
            )}

            {/* Summary Details */}
            <div className="bg-band/40 border border-row-line rounded-btn-sm p-4 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-row-line">
                <span className="text-ink-2">Tenant:</span>
                <span className="font-semibold text-ink">{lease.tenant_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-row-line">
                <span className="text-ink-2">Unit released:</span>
                <span className="font-semibold text-ink">
                  {lease.house_name}, {lease.unit_label}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-row-line">
                <span className="text-ink-2">End date:</span>
                <span className="font-mono font-semibold text-ink">
                  {formatDate(endedOn)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-row-line">
                <span className="text-ink-2">Status to set:</span>
                <span className="font-bold uppercase tracking-wider text-overdue">
                  {status}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-row-line">
                <span className="text-ink-2">Deposit held:</span>
                <span className="font-mono text-ink">
                  <Money amount={lease.deposit_amount} showUnit />
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-2">Deposit refunded to tenant:</span>
                <span className="font-mono font-bold text-ink">
                  <Money amount={parseInt(depositRefundedStr, 10) || 0} showUnit />
                </span>
              </div>
              {notes.trim() && (
                <div className="pt-2 text-ink-2 border-t border-row-line">
                  <span className="block font-medium mb-0.5">Notes:</span>
                  <p className="italic text-ink">{notes}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-line flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep("form")}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 h-10 sm:h-9 px-3 py-2 text-xs font-medium border border-line text-ink hover:bg-band rounded-btn-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] sm:min-h-[36px]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to edit</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmEnd}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 px-5 py-2 text-xs font-semibold bg-overdue hover:bg-overdue/90 text-white rounded-btn-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-overdue disabled:opacity-50 min-h-[44px] sm:min-h-[36px]"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm and end lease</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

