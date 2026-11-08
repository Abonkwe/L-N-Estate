import React, { useState, useEffect, useMemo } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import type { LeaseDetail } from "@/api/leases";
import { addRentTermApi } from "@/api/leases";
import { Money } from "@/components/shared/Money";
import { useDialogA11y } from "@/lib/useDialogA11y";

interface AddRentChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  lease: LeaseDetail;
  onSuccess: () => void;
}

export const AddRentChangeDialog: React.FC<AddRentChangeDialogProps> = ({
  isOpen,
  onClose,
  lease,
  onSuccess,
}) => {
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [baseRentStr, setBaseRentStr] = useState("");
  const [waterFeeStr, setWaterFeeStr] = useState("");
  const [wasteFeeStr, setWasteFeeStr] = useState("");
  const [noticeGivenOn, setNoticeGivenOn] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize form defaults when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Helper text says: "Set the effective date to the day the tenant's current paid period ends."
      // Default to paid_through or next_period_start if available
      setEffectiveFrom(lease.paid_through || lease.next_period_start || "");
      setBaseRentStr(String(lease.base_rent ?? ""));
      setWaterFeeStr(String(lease.water_fee ?? 0));
      setWasteFeeStr(String(lease.waste_fee ?? 0));
      setNoticeGivenOn("");
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

  // Derived preview total
  const calculatedTotal = useMemo(() => {
    const base = parseInt(baseRentStr, 10) || 0;
    const water = parseInt(waterFeeStr, 10) || 0;
    const waste = parseInt(wasteFeeStr, 10) || 0;
    return base + water + waste;
  }, [baseRentStr, waterFeeStr, wasteFeeStr]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const baseRent = parseInt(baseRentStr, 10);
    const waterFee = parseInt(waterFeeStr, 10);
    const wasteFee = parseInt(wasteFeeStr, 10);

    if (!effectiveFrom) {
      setErrorMessage("Effective date is required.");
      return;
    }

    if (isNaN(baseRent) || baseRent <= 0) {
      setErrorMessage("Base rent must be a positive integer.");
      return;
    }

    if (isNaN(waterFee) || waterFee < 0) {
      setErrorMessage("Water fee must be a non-negative integer.");
      return;
    }

    if (isNaN(wasteFee) || wasteFee < 0) {
      setErrorMessage("Waste fee must be a non-negative integer.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addRentTermApi(lease.id, {
        effective_from: effectiveFrom,
        base_rent: baseRent,
        water_fee: waterFee,
        waste_fee: wasteFee,
        notice_given_on: noticeGivenOn.trim() ? noticeGivenOn : null,
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to record rent change"
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
      aria-labelledby="rent-change-dialog-title"
    >
      <div className="relative w-full max-w-lg bg-surface border border-line rounded-panel shadow-xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between bg-band/30">
          <div>
            <h2
              id="rent-change-dialog-title"
              className="text-lg font-semibold text-ink"
            >
              Add rent change
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
          {/* Helper text required by brief */}
          <div className="p-3 bg-band/70 border border-line/60 rounded-btn-sm text-xs text-ink-2 leading-relaxed">
            <span className="font-semibold text-ink">Guideline:</span> Set the
            effective date to the day the tenant&apos;s current paid period ends.
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

          {/* Effective Date */}
          <div>
            <label
              htmlFor="effective-from-input"
              className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
            >
              Effective date <span className="text-overdue">*</span>
            </label>
            <input
              id="effective-from-input"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              required
              className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
            />
          </div>

          {/* Rent Breakdown Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="base-rent-input"
                className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
              >
                Base rent (FCFA) <span className="text-overdue">*</span>
              </label>
              <input
                id="base-rent-input"
                type="number"
                min="0"
                step="1"
                value={baseRentStr}
                onChange={(e) => setBaseRentStr(e.target.value)}
                required
                className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm font-mono text-ink text-right tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            <div>
              <label
                htmlFor="water-fee-input"
                className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
              >
                Water fee (FCFA)
              </label>
              <input
                id="water-fee-input"
                type="number"
                min="0"
                step="1"
                value={waterFeeStr}
                onChange={(e) => setWaterFeeStr(e.target.value)}
                className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm font-mono text-ink text-right tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>

            <div>
              <label
                htmlFor="waste-fee-input"
                className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
              >
                Waste fee (FCFA)
              </label>
              <input
                id="waste-fee-input"
                type="number"
                min="0"
                step="1"
                value={wasteFeeStr}
                onChange={(e) => setWasteFeeStr(e.target.value)}
                className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm font-mono text-ink text-right tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </div>

          {/* New Monthly Total Summary */}
          <div className="p-3 bg-band/40 border border-row-line rounded-btn-sm flex items-center justify-between">
            <span className="text-xs font-medium text-ink-2">
              New monthly total:
            </span>
            <span className="text-sm font-mono font-semibold text-ink tabular-nums">
              <Money amount={calculatedTotal} showUnit />
            </span>
          </div>

          {/* Notice Date */}
          <div>
            <label
              htmlFor="notice-given-input"
              className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
            >
              Notice date (optional)
            </label>
            <input
              id="notice-given-input"
              type="date"
              value={noticeGivenOn}
              onChange={(e) => setNoticeGivenOn(e.target.value)}
              className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
            />
            <p className="text-[11px] text-ink-2 mt-1">
              Date on which the rent change notice was issued to the tenant.
            </p>
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
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 px-4 py-2 text-xs font-medium bg-primary hover:bg-primary-hover active:bg-primary-hover text-white rounded-btn-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 min-h-[44px] sm:min-h-[36px]"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save rent change</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

