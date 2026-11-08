import React, { useState, useEffect } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createExpenseApi,
  updateExpenseApi,
  type ExpenseOut,
  type ExpenseIn,
  type ExpensePatch,
  type ExpenseCategory,
} from "@/api/expenses";
import { getHousesApi, type House } from "@/api/houses";
import { getUnitsApi, type Unit } from "@/api/units";
import { Money } from "@/components/shared/Money";
import { useDialogA11y } from "@/lib/useDialogA11y";

interface ExpenseFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  expense?: ExpenseOut | null;
  onSuccess: () => void;
}

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: "repairs", label: "Repairs" },
  { value: "installation", label: "Installation" },
  { value: "maintenance", label: "Maintenance" },
  { value: "water_bill", label: "Water Bill" },
  { value: "tax", label: "Tax" },
  { value: "cleaning", label: "Cleaning"},
  { value: "waste_removal", label: "Waste Removal"},
  { value: "other", label: "Other" },
];

export const ExpenseFormDialog: React.FC<ExpenseFormDialogProps> = ({
  isOpen,
  onClose,
  expense = null,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const isEditing = Boolean(expense);

  // Houses query
  const { data: houses = [] } = useQuery<House[]>({
    queryKey: ["houses"],
    queryFn: getHousesApi,
    enabled: isOpen,
  });

  // Form states
  const [houseId, setHouseId] = useState<number | "">("");
  const [unitId, setUnitId] = useState<number | null>(null);
  const [category, setCategory] = useState<ExpenseCategory>("repairs");
  const [amountStr, setAmountStr] = useState<string>("");
  const [incurredOn, setIncurredOn] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState<string>("");
  const [paidTo, setPaidTo] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Units for selected house
  const { data: houseUnits = [], isLoading: isUnitsLoading } = useQuery<Unit[]>({
    queryKey: ["units", { house_id: houseId }],
    queryFn: () => getUnitsApi({ house_id: typeof houseId === "number" ? houseId : undefined }),
    enabled: isOpen && typeof houseId === "number",
  });

  // Populate form on open or expense change
  useEffect(() => {
    if (isOpen) {
      if (expense) {
        setHouseId(expense.house_id);
        setUnitId(expense.unit_id ?? null);
        setCategory(expense.category);
        setAmountStr(String(expense.amount));
        setIncurredOn(expense.incurred_on);
        setDescription(expense.description || "");
        setPaidTo(expense.paid_to || "");
      } else {
        // New expense defaults
        setHouseId(houses.length > 0 ? houses[0].id : "");
        setUnitId(null);
        setCategory("repairs");
        setAmountStr("");
        setIncurredOn(new Date().toISOString().slice(0, 10));
        setDescription("");
        setPaidTo("");
      }
      setErrorMessage(null);
    }
  }, [isOpen, expense, houses]);

  // Accessible dialog focus trap and Escape handler
  const dialogRef = useDialogA11y<HTMLDivElement>({
    isOpen,
    onClose: () => {
      if (!isSubmitting) onClose();
    },
  });

  if (!isOpen) return null;

  const handleHouseChange = (newHouseId: number | "") => {
    setHouseId(newHouseId);
    setUnitId(null); // Reset unit when house changes
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (typeof houseId !== "number" || houseId <= 0) {
      setErrorMessage("Please select a house.");
      return;
    }

    const parsedAmount = parseInt(amountStr, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Amount must be a whole positive number in FCFA.");
      return;
    }

    if (!incurredOn) {
      setErrorMessage("Date is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && expense) {
        const patchData: ExpensePatch = {
          house_id: houseId,
          unit_id: unitId,
          category,
          amount: parsedAmount,
          incurred_on: incurredOn,
          description: description.trim() ? description.trim() : null,
          paid_to: paidTo.trim() ? paidTo.trim() : null,
        };
        await updateExpenseApi(expense.id, patchData);
      } else {
        const inData: ExpenseIn = {
          house_id: houseId,
          unit_id: unitId,
          category,
          amount: parsedAmount,
          incurred_on: incurredOn,
          description: description.trim() ? description.trim() : null,
          paid_to: paidTo.trim() ? paidTo.trim() : null,
        };
        await createExpenseApi(inData);
      }

      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save expense"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-dialog-title"
    >
      <div className="bg-surface border border-line rounded-panel shadow-lg w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Dialog Header */}
        <div className="px-6 py-4 border-b border-row-line flex items-center justify-between">
          <div>
            <h2 id="expense-dialog-title" className="text-lg font-semibold text-ink">
              {isEditing ? "Edit expense" : "Add expense"}
            </h2>
            <p className="text-xs text-ink-2 mt-0.5">
              {isEditing
                ? "Update expense details. Expenses cannot be deleted."
                : "Record an operational expense for a house or unit."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="p-2 text-ink-2 hover:text-ink rounded-btn-sm min-w-[44px] min-h-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dialog Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {errorMessage && (
              <div
                role="alert"
                className="p-3 bg-overdue/10 border border-overdue/30 rounded-input text-overdue text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* House & Unit Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="expense-house"
                  className="block text-xs font-semibold text-ink-2 uppercase tracking-header-cap mb-1.5"
                >
                  House <span className="text-overdue">*</span>
                </label>
                <select
                  id="expense-house"
                  value={houseId}
                  onChange={(e) =>
                    handleHouseChange(
                      e.target.value ? parseInt(e.target.value, 10) : ""
                    )
                  }
                  required
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 text-sm bg-surface border border-input-border rounded-input text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="" disabled>
                    Select house...
                  </option>
                  {houses.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="expense-unit"
                  className="block text-xs font-semibold text-ink-2 uppercase tracking-header-cap mb-1.5"
                >
                  Unit <span className="text-ink-2/60 normal-case font-normal">(Optional)</span>
                </label>
                <select
                  id="expense-unit"
                  value={unitId ?? ""}
                  onChange={(e) =>
                    setUnitId(
                      e.target.value ? parseInt(e.target.value, 10) : null
                    )
                  }
                  disabled={isSubmitting || typeof houseId !== "number"}
                  className="w-full px-3 py-2 text-sm bg-surface border border-input-border rounded-input text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:bg-band/50 disabled:text-ink-2/60"
                >
                  <option value="">Entire house (no unit)</option>
                  {houseUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label} ({u.unit_type})
                    </option>
                  ))}
                </select>
                {isUnitsLoading && typeof houseId === "number" && (
                  <p className="text-[11px] text-ink-2 mt-1">Loading units...</p>
                )}
              </div>
            </div>

            {/* Category & Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="expense-category"
                  className="block text-xs font-semibold text-ink-2 uppercase tracking-header-cap mb-1.5"
                >
                  Category <span className="text-overdue">*</span>
                </label>
                <select
                  id="expense-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  required
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 text-sm bg-surface border border-input-border rounded-input text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="expense-amount"
                  className="block text-xs font-semibold text-ink-2 uppercase tracking-header-cap mb-1.5"
                >
                  Amount (FCFA) <span className="text-overdue">*</span>
                </label>
                <div className="relative">
                  <input
                    id="expense-amount"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 25000"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-surface border border-input-border rounded-input text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                </div>
                {amountStr && !isNaN(parseInt(amountStr, 10)) && (
                  <p className="text-xs font-mono text-ink-2 mt-1">
                    <Money amount={parseInt(amountStr, 10)} showUnit />
                  </p>
                )}
              </div>
            </div>

            {/* Date & Paid To */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="expense-date"
                  className="block text-xs font-semibold text-ink-2 uppercase tracking-header-cap mb-1.5"
                >
                  Date incurred <span className="text-overdue">*</span>
                </label>
                <input
                  id="expense-date"
                  type="date"
                  value={incurredOn}
                  onChange={(e) => setIncurredOn(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 text-sm bg-surface border border-input-border rounded-input text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary font-mono"
                />
              </div>

              <div>
                <label
                  htmlFor="expense-paid-to"
                  className="block text-xs font-semibold text-ink-2 uppercase tracking-header-cap mb-1.5"
                >
                  Paid to <span className="text-ink-2/60 normal-case font-normal">(Optional)</span>
                </label>
                <input
                  id="expense-paid-to"
                  type="text"
                  placeholder="e.g. Musa Plumber, ENEO"
                  value={paidTo}
                  onChange={(e) => setPaidTo(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 text-sm bg-surface border border-input-border rounded-input text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="expense-desc"
                className="block text-xs font-semibold text-ink-2 uppercase tracking-header-cap mb-1.5"
              >
                Description <span className="text-ink-2/60 normal-case font-normal">(Optional)</span>
              </label>
              <textarea
                id="expense-desc"
                rows={2}
                placeholder="Details of the work or reason for expense..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 text-sm bg-surface border border-input-border rounded-input text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none"
              />
            </div>
          </div>

          {/* Dialog Footer */}
          <div className="px-6 py-4 bg-band/30 border-t border-row-line flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 sm:h-9 px-4 py-2 text-sm font-medium text-ink-2 hover:text-ink rounded-btn focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 min-h-[44px] sm:min-h-[36px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 h-10 sm:h-9 px-4 py-2 bg-primary hover:bg-primary-hover active:bg-primary-hover text-white text-sm font-medium rounded-btn transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 min-h-[44px] sm:min-h-[36px]"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isEditing ? "Save changes" : "Record expense"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

