import React, { useState, useEffect, useMemo } from "react";
import { X, Loader2, AlertCircle, Plus, Minus } from "lucide-react";
import type { LeaseDetail } from "@/api/leases";
import { createAdjustmentApi } from "@/api/payments";
import { Money } from "@/components/shared/Money";
import { useDialogA11y } from "@/lib/useDialogA11y";

interface AddAdjustmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lease: LeaseDetail;
  onSuccess: () => void;
}

export const AddAdjustmentDialog: React.FC<AddAdjustmentDialogProps> = ({
  isOpen,
  onClose,
  lease,
  onSuccess,
}) => {
  // Sign: "credit" (positive, tenant credit) or "charge" (negative, extra charge to tenant)
  const [adjustmentType, setAdjustmentType] = useState<"credit" | "charge">("credit");
  const [amountStr, setAmountStr] = useState("");
  const [reason, setReason] = useState("");
  const [adjustedOn, setAdjustedOn] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize defaults
  useEffect(() => {
    if (isOpen) {
      setAdjustmentType("credit");
      setAmountStr("");
      setReason("");
      setAdjustedOn(new Date().toISOString().slice(0, 10));
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Accessible dialog focus trap and Escape handler
  const dialogRef = useDialogA11y<HTMLDivElement>({
    isOpen,
    onClose: () => {
      if (!isSubmitting) onClose();
    },
  });

  const signedAmount = useMemo(() => {
    const raw = parseInt(amountStr, 10);
    if (isNaN(raw) || raw <= 0) return 0;
    return adjustmentType === "credit" ? raw : -raw;
  }, [amountStr, adjustmentType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const raw = parseInt(amountStr, 10);
    if (isNaN(raw) || raw <= 0) {
      setErrorMessage("Amount must be a positive whole integer.");
      return;
    }

    if (reason.trim().length < 3) {
      setErrorMessage("Reason must be at least 3 characters.");
      return;
    }

    if (!adjustedOn) {
      setErrorMessage("Adjustment date is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const finalAmount = adjustmentType === "credit" ? raw : -raw;
      await createAdjustmentApi({
        lease_id: lease.id,
        amount: finalAmount,
        reason: reason.trim(),
        adjusted_on: adjustedOn,
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to record adjustment"
      );
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
      aria-labelledby="adjustment-dialog-title"
    >
      <div className="relative w-full max-w-lg bg-surface border border-line rounded-panel shadow-xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between bg-band/30">
          <div>
            <h2
              id="adjustment-dialog-title"
              className="text-lg font-semibold text-ink"
            >
              Add financial adjustment
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Sign Explanation Banner */}
          <div className="p-3.5 bg-band/60 border border-line rounded-btn-sm space-y-1.5 text-xs">
            <p className="font-semibold text-ink">Understanding adjustment signs:</p>
            <ul className="space-y-1 text-ink-2 list-disc list-inside">
              <li>
                <strong className="text-paid">Positive (+) Credit to tenant:</strong>{" "}
                Discount, waiver, goodwill concession, or opening credit balance.
              </li>
              <li>
                <strong className="text-overdue">Negative (&minus;) Extra charge:</strong>{" "}
                Damages, utility penalty, or in-lieu deductions added to tenant balance.
              </li>
            </ul>
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

          {/* Type selector (Credit vs Charge) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1.5">
              Adjustment Type <span className="text-overdue">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustmentType("credit")}
                className={`flex items-center justify-center gap-2 h-11 px-3 rounded-btn-sm text-xs font-semibold border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] ${
                  adjustmentType === "credit"
                    ? "bg-paid/10 border-paid text-paid shadow-sm ring-1 ring-paid/20"
                    : "bg-surface border-line text-ink-2 hover:bg-band"
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Credit to tenant (+)</span>
              </button>

              <button
                type="button"
                onClick={() => setAdjustmentType("charge")}
                className={`flex items-center justify-center gap-2 h-11 px-3 rounded-btn-sm text-xs font-semibold border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] ${
                  adjustmentType === "charge"
                    ? "bg-overdue/10 border-overdue text-overdue shadow-sm ring-1 ring-overdue/20"
                    : "bg-surface border-line text-ink-2 hover:bg-band"
                }`}
              >
                <Minus className="w-4 h-4" />
                <span>Extra charge (&minus;)</span>
              </button>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label
              htmlFor="adj-amount-input"
              className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
            >
              Amount (FCFA) <span className="text-overdue">*</span>
            </label>
            <div className="relative">
              <span
                className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono font-bold ${
                  adjustmentType === "credit" ? "text-paid" : "text-overdue"
                }`}
              >
                {adjustmentType === "credit" ? "+" : "−"}
              </span>
              <input
                id="adj-amount-input"
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 10000"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                required
                className="w-full h-10 pl-8 pr-3 bg-surface border border-input-border rounded-input text-sm font-mono text-ink tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            {signedAmount !== 0 && (
              <p className="text-[11px] text-ink-2 mt-1">
                Net ledger change:{" "}
                <span className="font-mono font-semibold text-ink">
                  {adjustmentType === "credit" ? "+" : "−"}
                  <Money amount={Math.abs(signedAmount)} showUnit />
                </span>
              </p>
            )}
          </div>

          {/* Reason input */}
          <div>
            <label
              htmlFor="adj-reason-input"
              className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
            >
              Reason <span className="text-overdue">* (minimum 3 characters)</span>
            </label>
            <input
              id="adj-reason-input"
              type="text"
              placeholder="e.g. Goodwill credit for delayed tap repair"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={3}
              className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {/* Date input */}
          <div>
            <label
              htmlFor="adj-date-input"
              className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
            >
              Adjustment date <span className="text-overdue">*</span>
            </label>
            <input
              id="adj-date-input"
              type="date"
              value={adjustedOn}
              onChange={(e) => setAdjustedOn(e.target.value)}
              required
              className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-line flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 sm:h-9 px-4 py-2 text-xs font-medium border border-line text-ink hover:bg-band rounded-btn-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] sm:min-h-[36px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || reason.trim().length < 3 || !amountStr}
              className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 px-4 py-2 text-xs font-medium bg-primary hover:bg-primary-hover active:bg-primary-hover text-white rounded-btn-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 min-h-[44px] sm:min-h-[36px]"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Apply adjustment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

