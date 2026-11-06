import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Plus,
  AlertCircle,
  RefreshCw,
  Loader2,
  Edit,
  ArrowRight,
} from "lucide-react";
import { getHousesApi, type House } from "@/api/houses";
import { HouseFormDialog } from "@/components/houses/HouseFormDialog";

export const HousesPage: React.FC = () => {
  const [isHouseDialogOpen, setIsHouseDialogOpen] = useState(false);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);

  const {
    data: houses = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<House[]>({
    queryKey: ["houses"],
    queryFn: getHousesApi,
  });

  const handleOpenAddHouse = () => {
    setEditingHouse(null);
    setIsHouseDialogOpen(true);
  };

  const handleOpenEditHouse = (house: House, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingHouse(house);
    setIsHouseDialogOpen(true);
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-ink leading-tight">
            Houses
          </h1>
          <p className="text-sm text-ink-2 mt-0.5 font-normal">
            {houses.length} propert{houses.length === 1 ? "y" : "ies"} &bull; Building and unit occupancy management
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenAddHouse}
            className="inline-flex items-center gap-1.5 h-10 px-4 bg-primary hover:bg-primary-hover active:bg-[#174BB0] text-white text-sm font-medium rounded-btn transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <Plus className="w-4 h-4" />
            <span>New house</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          className="p-4 rounded-panel bg-[#FDF2F1] border border-overdue/30 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-overdue shrink-0" />
            <div className="text-sm text-overdue font-medium">
              {error instanceof Error ? error.message : "Failed to load houses"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-overdue/40 text-overdue rounded-btn-sm hover:bg-overdue/5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Houses Table */}
      <div className="bg-surface border border-line rounded-panel overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="border-b border-ink bg-band/30">
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  House Name
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Address
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                  Units
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                  Occupied
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-ink-2">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span>Loading houses...</span>
                    </div>
                  </td>
                </tr>
              ) : houses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-ink-2 bg-band/10">
                    <div className="max-w-sm mx-auto space-y-3">
                      <Building2 className="w-8 h-8 text-ink-2/40 mx-auto" />
                      <div>
                        <p className="font-medium text-ink">
                          No houses yet. Add the first one.
                        </p>
                        <p className="text-xs text-ink-2 mt-1">
                          Register your first building property to start tracking units and leases.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenAddHouse}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-primary text-white rounded-btn-sm hover:bg-primary-hover transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add first house</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                houses.map((house) => (
                  <tr
                    key={house.id}
                    className="border-b border-row-line hover:bg-band/40 transition-colors"
                  >
                    {/* Name */}
                    <td className="px-5 py-3.5 text-[14.5px] font-medium text-ink">
                      <Link
                        to={`/houses/${house.id}`}
                        className="hover:text-primary transition-colors hover:underline inline-flex items-center gap-2 focus:outline-none focus:ring-1 focus:ring-primary rounded-sm"
                      >
                        <Building2 className="w-4 h-4 text-ink-2 shrink-0" />
                        <span>{house.name}</span>
                      </Link>
                    </td>

                    {/* Address */}
                    <td className="px-5 py-3.5 text-[14px] text-ink-2">
                      {house.address || "—"}
                    </td>

                    {/* Units Count */}
                    <td className="px-5 py-3.5 text-[14.5px] font-mono text-ink tabular-nums text-right">
                      {house.unit_count}
                    </td>

                    {/* Occupied Count ("2 of 3") */}
                    <td className="px-5 py-3.5 text-[14.5px] font-mono text-ink tabular-nums text-right">
                      {house.occupied_count} of {house.unit_count}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditHouse(house, e)}
                          className="inline-flex items-center justify-center gap-1 h-7 px-2.5 text-xs font-medium border border-line text-ink hover:bg-band rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <Edit className="w-3 h-3 text-ink-2" />
                          <span>Edit</span>
                        </button>
                        <Link
                          to={`/houses/${house.id}`}
                          className="inline-flex items-center justify-center gap-1 h-7 px-2.5 text-xs font-medium text-primary hover:bg-primary/5 rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                          title={`View units in ${house.name}`}
                        >
                          <span>Units</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* House Add/Edit Dialog */}
      <HouseFormDialog
        isOpen={isHouseDialogOpen}
        onClose={() => setIsHouseDialogOpen(false)}
        house={editingHouse}
      />
    </div>
  );
};

