import React, { useState, useEffect } from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { House, HouseIn, HousePatch } from "@/api/houses";
import { getHousesApi, createHouseApi, updateHouseApi } from "@/api/houses";
import { useDialogA11y } from "@/lib/useDialogA11y";

interface HouseFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  house?: House | null;
  onSuccess?: (savedHouse: House) => void;
}

export const HouseFormDialog: React.FC<HouseFormDialogProps> = ({
  isOpen,
  onClose,
  house = null,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const isEditing = Boolean(house);

  const { data: existingHouses = [] } = useQuery<House[]>({
    queryKey: ["houses"],
    queryFn: getHousesApi,
  });

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (house) {
        setName(house.name || "");
        setAddress(house.address || "");
        setNotes(house.notes || "");
      } else {
        setName("");
        setAddress("");
        setNotes("");
      }
      setErrorMessage(null);
    }
  }, [isOpen, house]);

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

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage("House name is required.");
      return;
    }

    const hasDuplicate = existingHouses.some(
      (h) => (!house || h.id !== house.id) && h.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (hasDuplicate) {
      setErrorMessage("A house with this name already exists");
      return;
    }

    setIsSubmitting(true);
    try {
      let savedHouse: House;
      if (isEditing && house) {
        const patchData: HousePatch = {
          name: trimmedName,
          address: address.trim() ? address.trim() : null,
          notes: notes.trim() ? notes.trim() : null,
        };
        savedHouse = await updateHouseApi(house.id, patchData);
      } else {
        const inData: HouseIn = {
          name: trimmedName,
          address: address.trim() ? address.trim() : null,
          notes: notes.trim() ? notes.trim() : null,
        };
        savedHouse = await createHouseApi(inData);
      }

      // Invalidate queries so that sidebar, lists and details update immediately
      await queryClient.invalidateQueries({ queryKey: ["houses"] });
      if (isEditing && house) {
        await queryClient.invalidateQueries({ queryKey: ["houses", house.id] });
      }

      onSuccess?.(savedHouse);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Failed to save house");
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
      aria-labelledby="house-dialog-title"
    >
      <div className="relative w-full max-w-md bg-surface border border-line rounded-panel shadow-xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between bg-band/30">
          <div>
            <h2 id="house-dialog-title" className="text-lg font-semibold text-ink">
              {isEditing ? "Edit house" : "New house"}
            </h2>
            <p className="text-xs text-ink-2 mt-0.5">
              {isEditing ? `Update details for ${house?.name}` : "Register a new building property"}
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
          {errorMessage && (
            <div
              role="alert"
              className="p-3 bg-overdue/10 border border-overdue/30 rounded-btn-sm flex items-start gap-2.5 text-xs text-overdue font-medium"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* House Name */}
          <div>
            <label
              htmlFor="house-name-input"
              className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
            >
              House Name <span className="text-overdue">*</span>
            </label>
            <input
              id="house-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hilltop Villa or Clerks Quarters Block A"
              className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {/* Address */}
          <div>
            <label
              htmlFor="house-address-input"
              className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
            >
              Address
            </label>
            <input
              id="house-address-input"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Molyko, Buea (Opposite University Gate)"
              className="w-full h-10 px-3 bg-surface border border-input-border rounded-input text-sm text-ink placeholder:text-ink-2/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="house-notes-input"
              className="block text-xs font-semibold uppercase tracking-header-cap text-ink-2 mb-1"
            >
              Notes
            </label>
            <textarea
              id="house-notes-input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Caretaker contacts, water pump operating hours..."
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
              disabled={isSubmitting || !name.trim()}
              className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 px-4 py-2 text-xs font-semibold bg-primary hover:bg-primary-hover active:bg-primary-hover text-white rounded-btn-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 min-h-[44px] sm:min-h-[36px]"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isEditing ? "Save changes" : "Create house"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
