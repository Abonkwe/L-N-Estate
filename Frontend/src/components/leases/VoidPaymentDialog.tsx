import React, { useState, useEffect } from "react";
import { X, Loader2, AlertCircle, AlertTriangle } from "lucide-react";
import type { PaymentOut } from "@/api/payments";
import { voidPaymentApi } from "@/api/payments";
import { formatMoney, formatDate } from "@/lib/format";

interface VoidPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentOut | null;
  onSuccess: () => void;
}

export const VoidPaymentDialog: React.FC<VoidPaymentDialogProps> = ({
  isOpen,
  onClose,
  payment,
  onSuccess,
}) => {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !payment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3) {
      setErrorMessage("Reason must be at least 3 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      await voidPaymentApi(payment.id, {
        reason: trimmedReason,
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to void payment"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="void-dialog-title"
    >
      <div className="relative w-full max-w-md bg-surface border border-line rounded-panel shadow-xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between bg-band/30">
          <div>
            <h2 id="void-dialog-title" className="text-lg font-semibold text-ink">
              Void payment
            </h2>
            <p className="text-xs text-ink-2 mt-0.5">
              Payment #{payment.id} &bull; {payment.tenant_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 text-ink-2 hover:text-ink rounded-btn-sm hover:bg-band focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Explicit Rule Warning required by brief */}
          <div className="p-3.5 bg-[#FDF2F1] border border-overdue/30 rounded-panel flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-overdue shrink-0 mt-0.5" />
            <div className="text-xs text-ink space-y-1">
              <p className="font-bold text-overdue">Important:</p>
              <p className="leading-relaxed text-ink-2">
                This payment <strong className="text-ink">stays on record</strong> and
                cannot be deleted. It will be marked as void and will no longer count
                toward the tenant&apos;s rent.{" "}
                <span className="font-semibold text-overdue">This action cannot be undone.</span>
              </p>
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="p-3 bg-[#FDF2F1] border border-overdue/30 rounded-btn-sm flex items-start gap-2.5 text-xs text-overdue font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Payment Summary */}
          <div className="p-3 bg-band/40 border border-row-line rounded-btn-sm space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-ink-2">Amount:</span>
              <span className="font-mono font-bold text-ink">
                {formatMoney(payment.amount, true)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-2">Paid date:</span>
              <span className="font-mono text-ink">{formatDate(payment.paid_on)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-2">Payment method:</span>
              <span className="text-ink">{getMethodLabel(payment.method)}</span>
            </div>
            {payment.reference && (
              <div className="flex justify-between">
                <span className="text-ink-2">Reference:</span>
                <span className="font-mono text-ink">{payment.reference}</span>
              </div>
            )}
          </div>

          {/* Void Reason Input */}
          <div>
            <label
              htmlFor="void-reason-input"
              className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
            >
              Reason for voiding <span className="text-overdue">* (minimum 3 characters)</span>
            </label>
            <textarea
              id="void-reason-input"
              rows={3}
              placeholder="e.g. Entered twice by mistake, wrong tenant selected..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={3}
              className="w-full p-2.5 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/60 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-line flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium border border-line text-ink hover:bg-band rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || reason.trim().length < 3}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-overdue hover:bg-overdue/90 active:bg-[#851E17] text-white rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-overdue disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Void payment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

