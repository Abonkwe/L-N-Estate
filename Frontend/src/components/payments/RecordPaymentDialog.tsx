import React, { useState, useEffect, useRef, useMemo } from "react";
import { z } from "zod";
import { X, CheckCircle2, Printer, Loader2, ArrowRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getActiveLeasesApi, type LeaseItem } from "@/api/leases";
import {
  previewPaymentApi,
  createPaymentApi,
  getReceiptPdfBlob,
  type PaymentPreview,
  type PaymentMethod,
  type PaymentOut,
} from "@/api/payments";
import { formatMoney, formatDate } from "@/lib/format";

interface RecordPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedLease?: LeaseItem | null;
  onSuccess?: () => void;
}

const paymentSchema = z.object({
  amount: z
    .number()
    .int("Amount must be a whole integer")
    .positive("Amount must be greater than 0"),
  paid_on: z.string().min(1, "Payment date is required"),
  method: z.enum(["cash", "bank", "mobile_money"] as const),
  reference: z.string().optional(),
  note: z.string().optional(),
});

export const RecordPaymentDialog: React.FC<RecordPaymentDialogProps> = ({
  isOpen,
  onClose,
  preselectedLease,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  // Active leases for picker (if no preselected lease)
  const { data: activeLeases = [] } = useQuery({
    queryKey: ["leases", "active"],
    queryFn: getActiveLeasesApi,
    enabled: isOpen && !preselectedLease,
  });

  // Selected lease
  const [selectedLeaseId, setSelectedLeaseId] = useState<number | null>(
    preselectedLease?.id ?? null
  );
  const [leaseSearch, setLeaseSearch] = useState("");

  // Form fields
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [paidOn, setPaidOn] = useState<string>(todayStr);
  const [amountStr, setAmountStr] = useState<string>("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // UI state
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdPayment, setCreatedPayment] = useState<PaymentOut | null>(null);
  const [receiptBlobUrl, setReceiptBlobUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  // Live preview state
  const [preview, setPreview] = useState<PaymentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewReqIdRef = useRef(0);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Reset or initialize when opened
  useEffect(() => {
    if (isOpen) {
      const initialLease = preselectedLease ?? null;
      setSelectedLeaseId(initialLease?.id ?? null);
      setPaidOn(new Date().toISOString().slice(0, 10));
      setAmountStr(initialLease ? String(initialLease.next_month_charge) : "");
      setMethod("cash");
      setReference("");
      setNote("");
      setFormError(null);
      setPreview(null);
      setPreviewError(null);
      setCreatedPayment(null);
      setReceiptBlobUrl(null);
      setLeaseSearch("");

      // Focus after mount
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, preselectedLease]);

  // Clean up blob URL on unmount or reset
  useEffect(() => {
    return () => {
      if (receiptBlobUrl) {
        URL.revokeObjectURL(receiptBlobUrl);
      }
    };
  }, [receiptBlobUrl]);

  // Current active lease object
  const currentLease = useMemo(() => {
    if (preselectedLease && preselectedLease.id === selectedLeaseId) {
      return preselectedLease;
    }
    return activeLeases.find((l) => l.id === selectedLeaseId) ?? null;
  }, [preselectedLease, activeLeases, selectedLeaseId]);

  // Handle ESC key to close
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

  // Debounced Live Preview Effect
  useEffect(() => {
    if (!isOpen || !selectedLeaseId) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    const numAmount = parseInt(amountStr, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    const currentReqId = ++previewReqIdRef.current;
    setPreviewLoading(true);
    setPreviewError(null);

    const timer = setTimeout(async () => {
      try {
        const previewData = await previewPaymentApi({
          lease_id: selectedLeaseId,
          paid_on: paidOn,
          amount: numAmount,
          method,
          reference: reference.trim() || null,
          note: note.trim() || null,
        });

        // Only update if this request is still the newest one
        if (currentReqId === previewReqIdRef.current) {
          setPreview(previewData);
          setPreviewError(null);
        }
      } catch (err: unknown) {
        if (currentReqId === previewReqIdRef.current) {
          setPreview(null);
          setPreviewError(
            err instanceof Error ? err.message : "Error calculating payment preview"
          );
        }
      } finally {
        if (currentReqId === previewReqIdRef.current) {
          setPreviewLoading(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isOpen, selectedLeaseId, amountStr, paidOn, method, reference, note]);

  // Quick-fill chips handler
  const handleQuickFill = (multiplier: number) => {
    if (!currentLease) return;
    const val = currentLease.next_month_charge * multiplier;
    setAmountStr(String(val));
    setFormError(null);
    amountInputRef.current?.focus();
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeaseId) {
      setFormError("Please select an active lease.");
      return;
    }

    const numAmount = parseInt(amountStr, 10);
    const parsed = paymentSchema.safeParse({
      amount: numAmount,
      paid_on: paidOn,
      method,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || "Invalid payment details");
      return;
    }

    if ((method === "bank" || method === "mobile_money") && !reference.trim()) {
      setFormError(`Reference is required for ${method === "bank" ? "Bank transfer" : "Mobile Money"}`);
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      const payment = await createPaymentApi({
        lease_id: selectedLeaseId,
        paid_on: paidOn,
        amount: numAmount,
        method,
        reference: reference.trim() || null,
        note: note.trim() || null,
      });

      setCreatedPayment(payment);

      // Invalidate dashboard and lease caches immediately
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["leases"] });

      // Pre-fetch receipt PDF blob immediately
      setIsLoadingPdf(true);
      try {
        const blob = await getReceiptPdfBlob(payment.id);
        const url = URL.createObjectURL(blob);
        setReceiptBlobUrl(url);
      } catch (err) {
        console.error("Failed to pre-fetch receipt PDF blob:", err);
      } finally {
        setIsLoadingPdf(false);
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!receiptBlobUrl) return;
    window.open(receiptBlobUrl, "_blank");
  };

  const handleDone = () => {
    onClose();
    if (onSuccess) {
      onSuccess();
    }
  };

  if (!isOpen) return null;

  // Filtered active leases for picker
  const filteredActiveLeases = activeLeases.filter((l) => {
    const q = leaseSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      l.tenant_name.toLowerCase().includes(q) ||
      l.house_name.toLowerCase().includes(q) ||
      l.unit_label.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-payment-title"
    >
      <div className="bg-surface border border-line rounded-panel w-full max-w-[500px] shadow-lg flex flex-col max-h-[88vh] overflow-hidden">
        {/* Dialog Header */}
        <div className="px-5 py-3 border-b border-line flex items-center justify-between bg-surface shrink-0">
          <div>
            <h2 id="record-payment-title" className="text-base font-semibold text-ink">
              {createdPayment ? "Payment Recorded" : "Record Payment"}
            </h2>
            <div className="text-[11px] text-ink-2">
              {createdPayment
                ? `Receipt #${createdPayment.receipt_id || createdPayment.id}`
                : "Record rent collection and update tenant coverage"}
            </div>
          </div>
          {!isSubmitting && (
            <button
              onClick={createdPayment ? handleDone : onClose}
              aria-label="Close dialog"
              className="p-1 text-ink-2 hover:text-ink hover:bg-band rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Success View */}
        {createdPayment ? (
          <div className="p-5 space-y-4 overflow-y-auto">
            <div className="p-3.5 bg-[#F2F7F4] border border-[#2F6B4A]/30 rounded-panel flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-paid shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-paid">
                  Payment successfully recorded
                </div>
                <div className="text-xs text-ink mt-0.5">
                  Receipt #{createdPayment.receipt_id || createdPayment.id} has been issued for{" "}
                  <span className="font-semibold">{createdPayment.tenant_name}</span> (
                  {createdPayment.house_name}, {createdPayment.unit_label}).
                </div>
                <div className="text-xs font-mono tabular-nums text-ink mt-1.5">
                  Amount: <span className="font-semibold">{formatMoney(createdPayment.amount)} FCFA</span> &bull; Paid on{" "}
                  {formatDate(createdPayment.paid_on)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handlePrintReceipt}
                disabled={!receiptBlobUrl || isLoadingPdf}
                className="h-9 px-3.5 bg-surface border border-line text-primary hover:bg-primary/5 active:bg-primary/10 font-medium text-xs rounded-btn transition-colors focus:outline-none focus:ring-2 focus:ring-primary flex items-center gap-1.5 disabled:opacity-50"
              >
                {isLoadingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                <span>Print receipt</span>
              </button>

              <button
                type="button"
                onClick={handleDone}
                className="h-9 px-4 bg-primary hover:bg-primary-hover active:bg-[#174BB0] text-white font-medium text-xs rounded-btn transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Payment Entry Form */
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0" noValidate>
            <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
              {/* Error Banner */}
              {formError && (
                <div
                  role="alert"
                  className="p-2.5 px-3 text-xs font-medium rounded-btn-sm border border-overdue/30 bg-[#FDF2F1] text-overdue"
                >
                  {formError}
                </div>
              )}

              {/* Lease Selector (when opened from header) or Locked Lease Card (when opened from row) */}
              {preselectedLease ? (
                <div className="p-2.5 px-3 bg-band/70 border border-line rounded-panel flex items-center justify-between">
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-header-cap text-ink-2 shrink-0">
                      Lease:
                    </span>
                    <span className="font-semibold text-ink text-sm truncate">
                      {preselectedLease.tenant_name}
                    </span>
                    <span className="text-xs text-ink-2 truncate">
                      ({preselectedLease.house_name}, {preselectedLease.unit_label})
                    </span>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="font-mono text-xs font-semibold text-ink tabular-nums">
                      {formatMoney(preselectedLease.monthly_total)} FCFA
                    </span>
                    <span className="text-[10px] text-ink-2 ml-1">/mo</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="lease-picker"
                    className="block text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                  >
                    Active Lease *
                  </label>
                  <div className="space-y-1.5">
                    <input
                      id="lease-picker"
                      type="text"
                      value={leaseSearch}
                      onChange={(e) => setLeaseSearch(e.target.value)}
                      placeholder="Search tenant or unit to select lease..."
                      className="w-full h-9 px-3 bg-surface border border-input-border rounded-input text-xs text-ink placeholder:text-ink-2/50 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <div className="max-h-28 overflow-y-auto border border-line rounded-input bg-surface divide-y divide-row-line">
                      {filteredActiveLeases.length === 0 ? (
                        <div className="px-3 py-1.5 text-xs text-ink-2 italic">
                          No matching active leases
                        </div>
                      ) : (
                        filteredActiveLeases.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => {
                              setSelectedLeaseId(l.id);
                              setAmountStr(String(l.next_month_charge));
                              setLeaseSearch(`${l.tenant_name} (${l.house_name}, ${l.unit_label})`);
                              setFormError(null);
                            }}
                            className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-band transition-colors ${
                              selectedLeaseId === l.id ? "bg-primary/10 font-semibold" : ""
                            }`}
                          >
                            <div className="truncate">
                              <span className="text-ink">{l.tenant_name}</span>
                              <span className="text-ink-2 ml-1">
                                &bull; {l.house_name}, {l.unit_label}
                              </span>
                            </div>
                            <span className="font-mono text-ink tabular-nums shrink-0 ml-2">
                              {formatMoney(l.next_month_charge)} FCFA
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Date Paid & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="paid-on-date"
                    className="block text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                  >
                    Date Paid *
                  </label>
                  <input
                    id="paid-on-date"
                    type="date"
                    required
                    value={paidOn}
                    onChange={(e) => setPaidOn(e.target.value)}
                    className="w-full h-9 px-3 bg-surface border border-input-border rounded-input text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label
                    htmlFor="payment-amount"
                    className="block text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                  >
                    Amount (FCFA) *
                  </label>
                  <input
                    ref={amountInputRef}
                    id="payment-amount"
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={amountStr}
                    onChange={(e) => {
                      setAmountStr(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="e.g. 113000"
                    className="w-full h-9 px-3 bg-surface border border-input-border rounded-input text-xs font-mono text-ink tabular-nums placeholder:text-ink-2/50 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {/* Quick-Fill Chips nested directly with amount */}
                  {currentLease && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[10px] font-semibold text-ink-2 uppercase tracking-header-cap">
                        Quick:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuickFill(1)}
                        className="px-2 py-0.5 text-[10px] font-mono border border-input-border rounded-btn-sm text-ink hover:bg-band hover:border-primary transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
                        title={`1 month: ${formatMoney(currentLease.next_month_charge)} FCFA`}
                      >
                        1 mo ({formatMoney(currentLease.next_month_charge)})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickFill(3)}
                        className="px-2 py-0.5 text-[10px] font-mono border border-input-border rounded-btn-sm text-ink hover:bg-band hover:border-primary transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
                        title={`3 months: ${formatMoney(currentLease.next_month_charge * 3)} FCFA`}
                      >
                        3 mos
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickFill(6)}
                        className="px-2 py-0.5 text-[10px] font-mono border border-input-border rounded-btn-sm text-ink hover:bg-band hover:border-primary transition-colors focus:outline-none focus:ring-1 focus:ring-primary"
                        title={`6 months: ${formatMoney(currentLease.next_month_charge * 6)} FCFA`}
                      >
                        6 mos
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Method & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="payment-method"
                    className="block text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                  >
                    Payment Method *
                  </label>
                  <select
                    id="payment-method"
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="w-full h-9 px-3 bg-surface border border-input-border rounded-input text-xs text-ink focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="mobile_money">Mobile Money</option>
                  </select>
                </div>

                {method === "bank" || method === "mobile_money" ? (
                  <div>
                    <label
                      htmlFor="payment-reference"
                      className="block text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                    >
                      Reference *
                    </label>
                    <input
                      id="payment-reference"
                      type="text"
                      required
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder={method === "bank" ? "Txn / Cheque #" : "MTN / Orange Txn ID"}
                      className="w-full h-9 px-3 bg-surface border border-input-border rounded-input text-xs text-ink placeholder:text-ink-2/50 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="payment-note-inline"
                      className="block text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                    >
                      Note (optional)
                    </label>
                    <input
                      id="payment-note-inline"
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional memo"
                      className="w-full h-9 px-3 bg-surface border border-input-border rounded-input text-xs text-ink placeholder:text-ink-2/50 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              {/* Note (only shown when method is bank or mobile_money and reference is occupying the second column) */}
              {(method === "bank" || method === "mobile_money") && (
                <div>
                  <label
                    htmlFor="payment-note"
                    className="block text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
                  >
                    Note (optional)
                  </label>
                  <input
                    id="payment-note"
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional memo"
                    className="w-full h-9 px-3 bg-surface border border-input-border rounded-input text-xs text-ink placeholder:text-ink-2/50 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              {/* Live Preview Panel (Section 6.3) */}
              <div className="p-3 bg-band/50 border border-line rounded-panel space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-header-cap text-ink-2">
                    Live Preview
                  </span>
                  {previewLoading && (
                    <span className="text-[11px] text-ink-2 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Calculating...</span>
                    </span>
                  )}
                </div>

                {previewError ? (
                  <div className="text-xs text-overdue font-medium">{previewError}</div>
                ) : preview ? (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-ink">
                      <span className="text-ink-2">Period Covered:</span>
                      <span className="font-medium">
                        {preview.covers_from && preview.covers_to ? (
                          <>
                            {formatDate(preview.covers_from)} &rarr; {formatDate(preview.covers_to)}
                            <span className="ml-1 text-ink-2">({preview.months_covered} mo)</span>
                          </>
                        ) : (
                          "Partial payment"
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-ink">
                      <span className="text-ink-2">New Paid-Through:</span>
                      <span className="font-semibold text-ink">
                        {formatDate(preview.paid_through_after)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-ink">
                      <span className="text-ink-2">Balance Remaining (Reste):</span>
                      <span className="font-mono font-semibold tabular-nums text-ink">
                        {formatMoney(preview.balance_remaining)} FCFA
                      </span>
                    </div>

                    <div className="pt-1 border-t border-row-line text-ink-2 italic text-[11px]">
                      &ldquo;{preview.purpose}&rdquo;
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-ink-2 italic">
                    Enter an amount above to preview coverage calculation.
                  </div>
                )}
              </div>
            </div>

            {/* Dialog Footer Actions */}
            <div className="px-5 py-3 border-t border-line bg-band/20 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-9 px-3.5 text-xs font-semibold uppercase tracking-header-cap text-ink-2 hover:text-ink rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !selectedLeaseId || !amountStr || previewLoading}
                className="h-9 px-4 bg-primary hover:bg-primary-hover active:bg-[#174BB0] text-white font-medium text-xs rounded-btn transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm payment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
