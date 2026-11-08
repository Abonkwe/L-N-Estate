import React, { useState, useEffect } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Unit, UnitIn, UnitPatch, UnitType } from "@/api/units";
import { getUnitsApi, createUnitApi, updateUnitApi } from "@/api/units";
import { useDialogA11y } from "@/lib/useDialogA11y";

interface UnitFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  houseId: number;
  houseName?: string;
  unit?: Unit | null;
  onSuccess?: (savedUnit: Unit) => void;
}

export const UnitFormDialog: React.FC<UnitFormDialogProps> = ({
  isOpen,
  onClose,
  houseId,
  houseName,
  unit = null,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const isEditing = Boolean(unit);

  const { data: existingUnits = [] } = useQuery<Unit[]>({
    queryKey: ["units", { house_id: houseId }],
    queryFn: () => getUnitsApi({ house_id: houseId }),
  });

  const [label, setLabel] = useState("");
  const [unitType, setUnitType] = useState<UnitType>("apartment");
  const [listedRentStr, setListedRentStr] = useState("");
  const [description, setDescription] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (unit) {
        setLabel(unit.label || "");
        setUnitType(unit.unit_type || "apartment");
        setListedRentStr(unit.listed_rent != null ? String(unit.listed_rent) : "");
        setDescription(unit.description || "");
      } else {
        setLabel("");
        setUnitType("apartment");
        setListedRentStr("");
        setDescription("");
      }
      setErrorMessage(null);
    }
  }, [isOpen, unit]);

  // Accessible dialog focus trap and Escape handler
  const dialogRef = useDialogA11y<HTMLDivElement>({
    isOpen,
    onClose: () => {
      if (!isSubmitting) onClose();
    },
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setErrorMessage("Unit label is required.");
      return;
    }

    const hasDuplicate = existingUnits.some(
      (u) => (!unit || u.id !== unit.id) && u.label.trim().toLowerCase() === trimmedLabel.toLowerCase()
    );
    if (hasDuplicate) {
      setErrorMessage("This house already has a unit with that label");
      return;
    }

    let parsedListedRent: number | null = null;
    if (listedRentStr.trim()) {
      const num = parseInt(listedRentStr.trim().replace(/\s+/g, ""), 10);
      if (isNaN(num) || num <= 0) {
        setErrorMessage("Listed rent must be a positive whole integer if provided.");
        return;
      }
      parsedListedRent = num;
    }

    setIsSubmitting(true);
    try {
      let savedUnit: Unit;
      if (isEditing && unit) {
        const patchData: UnitPatch = {
          label: trimmedLabel,
          unit_type: unitType,
          listed_rent: parsedListedRent,
          description: description.trim() ? description.trim() : null,
        };
        savedUnit = await updateUnitApi(unit.id, patchData);
      } else {
        const inData: UnitIn = {
          house_id: houseId,
          label: trimmedLabel,
          unit_type: unitType,
          listed_rent: parsedListedRent,
          description: description.trim() ? description.trim() : null,
        };
        savedUnit = await createUnitApi(inData);
      }

      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: ["units", { house_id: houseId }] });
      await queryClient.invalidateQueries({ queryKey: ["units"] });
      await queryClient.invalidateQueries({ queryKey: ["houses"] });
      await queryClient.invalidateQueries({ queryKey: ["houses", houseId] });

      onSuccess?.(savedUnit);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Failed to save unit");
      }
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
      aria-labelledby="unit-dialog-title"
    >
      <div className="relative w-full max-w-md bg-surface border border-line rounded-panel shadow-xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between bg-band/30">
          <div>
            <h2 id="unit-dialog-title" className="text-lg font-semibold text-ink">
              {isEditing ? "Edit unit" : "New unit"}
            </h2>
            <p className="text-xs text-ink-2 mt-0.5">
              {houseName ? `${houseName} • ` : ""}
              {isEditing ? `Modify unit ${unit?.label}` : "Add a rentable unit"}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 bg-overdue/10 border border-overdue/30 rounded-btn-sm flex items-start gap-2.5 text-xs text-overdue font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Unit Label */}
          <div>
            <label
              htmlFor="unit-label-input"
              className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
            >
              Unit Label <span className="text-overdue">*</span>
            </label>
            <input
              id="unit-label-input"
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Unit 1, Flat 3B, Studio 102"
              className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {/* Unit Type */}
          <div>
            <label
              htmlFor="unit-type-select"
              className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
            >
              Type <span className="text-overdue">*</span>
            </label>
            <select
              id="unit-type-select"
              value={unitType}
              onChange={(e) => setUnitType(e.target.value as UnitType)}
              className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="apartment">Apartment</option>
              <option value="studio">Studio</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Listed Rent */}
          <div>
            <label
              htmlFor="unit-listed-rent-input"
              className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
            >
              Listed Rent (FCFA)
            </label>
            <div className="relative">
              <input
                id="unit-listed-rent-input"
                type="text"
                inputMode="numeric"
                value={listedRentStr}
                onChange={(e) => setListedRentStr(e.target.value)}
                placeholder="e.g. 100 000"
                className="w-full h-10 pl-3 pr-14 bg-surface border border-input-border rounded-input text-sm font-mono text-ink placeholder:text-ink-2/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary tabular-nums"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-2 pointer-events-none">
                FCFA
              </span>
            </div>
            <p className="text-xs text-ink-2 mt-1">
              Listed rent is optional and is only a default suggestion, not the real rent.
            </p>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="unit-desc-input"
              className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
            >
              Description
            </label>
            <textarea
              id="unit-desc-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Ground floor front side, 2 bedrooms, private veranda..."
              className="w-full p-2.5 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none"
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
              disabled={isSubmitting || !label.trim()}
              className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 px-4 py-2 text-xs font-semibold bg-primary hover:bg-primary-hover active:bg-primary-hover text-white rounded-btn-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 min-h-[44px] sm:min-h-[36px]"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isEditing ? "Save changes" : "Create unit"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
