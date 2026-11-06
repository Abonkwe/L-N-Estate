import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Plus,
  Edit,
  AlertCircle,
  RefreshCw,
  Loader2,
  Home,
  User,
} from "lucide-react";
import { getHouseApi, type House } from "@/api/houses";
import { getUnitsApi, type Unit } from "@/api/units";
import { formatMoney } from "@/lib/format";
import { HouseFormDialog } from "@/components/houses/HouseFormDialog";
import { UnitFormDialog } from "@/components/houses/UnitFormDialog";

export const HouseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const houseId = id ? parseInt(id, 10) : NaN;

  const [isHouseDialogOpen, setIsHouseDialogOpen] = useState(false);
  const [isUnitDialogOpen, setIsUnitDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // Fetch house details
  const {
    data: house,
    isLoading: isHouseLoading,
    isError: isHouseError,
    error: houseError,
    refetch: refetchHouse,
  } = useQuery<House>({
    queryKey: ["houses", houseId],
    queryFn: () => getHouseApi(houseId),
    enabled: !isNaN(houseId),
  });

  // Fetch units for this house
  const {
    data: units = [],
    isLoading: isUnitsLoading,
    isError: isUnitsError,
    error: unitsError,
    refetch: refetchUnits,
  } = useQuery<Unit[]>({
    queryKey: ["units", { house_id: houseId }],
    queryFn: () => getUnitsApi({ house_id: houseId }),
    enabled: !isNaN(houseId),
  });

  if (isNaN(houseId)) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-overdue font-semibold">Invalid house ID</p>
        <Link
          to="/houses"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Houses</span>
        </Link>
      </div>
    );
  }

  const handleOpenAddUnit = () => {
    setEditingUnit(null);
    setIsUnitDialogOpen(true);
  };

  const handleOpenEditUnit = (unit: Unit) => {
    setEditingUnit(unit);
    setIsUnitDialogOpen(true);
  };

  const formatUnitType = (type: string) => {
    switch (type) {
      case "studio":
        return "Studio";
      case "apartment":
        return "Apartment";
      case "other":
        return "Other";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-12">
      {/* Breadcrumb / Back Link */}
      <div>
        <Link
          to="/houses"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-header-cap text-ink-2 hover:text-ink transition-colors focus:outline-none focus:ring-1 focus:ring-primary rounded-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Houses</span>
        </Link>
      </div>

      {/* House Error State */}
      {isHouseError && (
        <div
          role="alert"
          className="p-4 rounded-panel bg-[#FDF2F1] border border-overdue/30 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-overdue shrink-0" />
            <div className="text-sm text-overdue font-medium">
              {houseError instanceof Error ? houseError.message : "Failed to load house details"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetchHouse()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-overdue/40 text-overdue rounded-btn-sm hover:bg-overdue/5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* House Header Card */}
      {isHouseLoading ? (
        <div className="bg-surface border border-line rounded-panel p-6 shadow-sm flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-sm text-ink-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>Loading house details...</span>
          </div>
        </div>
      ) : house ? (
        <div className="bg-surface border border-line rounded-panel p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-6 h-6 text-primary shrink-0" />
                <h1 className="text-[28px] font-semibold text-ink leading-tight">
                  {house.name}
                </h1>
              </div>
              {house.address && (
                <p className="text-sm text-ink-2 font-normal pl-8">
                  {house.address}
                </p>
              )}
              {house.notes && (
                <p className="text-xs text-ink-2/80 italic pl-8 pt-0.5">
                  {house.notes}
                </p>
              )}
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsHouseDialogOpen(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium border border-line text-ink hover:bg-band rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <Edit className="w-3.5 h-3.5 text-ink-2" />
                <span>Edit house</span>
              </button>
              <button
                type="button"
                onClick={handleOpenAddUnit}
                className="inline-flex items-center gap-1.5 h-9 px-4 bg-primary hover:bg-primary-hover active:bg-[#174BB0] text-white text-xs font-semibold rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New unit</span>
              </button>
            </div>
          </div>

          {/* Occupancy Summary Strip */}
          <div className="pt-4 border-t border-row-line flex flex-wrap items-center gap-6 text-xs">
            <div>
              <span className="text-ink-2 uppercase tracking-header-cap font-semibold text-[11px] block">
                Total Units
              </span>
              <span className="text-lg font-mono font-semibold text-ink tabular-nums">
                {house.unit_count}
              </span>
            </div>
            <div className="border-l border-row-line pl-6">
              <span className="text-ink-2 uppercase tracking-header-cap font-semibold text-[11px] block">
                Occupied
              </span>
              <span className="text-lg font-mono font-semibold text-ink tabular-nums">
                {house.occupied_count} of {house.unit_count}
              </span>
            </div>
            <div className="border-l border-row-line pl-6">
              <span className="text-ink-2 uppercase tracking-header-cap font-semibold text-[11px] block">
                Vacant Units
              </span>
              <span className="text-lg font-mono font-semibold text-ink tabular-nums">
                {Math.max(0, house.unit_count - house.occupied_count)}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Units Error State */}
      {isUnitsError && (
        <div
          role="alert"
          className="p-4 rounded-panel bg-[#FDF2F1] border border-overdue/30 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-overdue shrink-0" />
            <div className="text-sm text-overdue font-medium">
              {unitsError instanceof Error ? unitsError.message : "Failed to load units"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => refetchUnits()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-overdue/40 text-overdue rounded-btn-sm hover:bg-overdue/5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Units Section Title */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-lg font-semibold text-ink">
          Units ({units.length})
        </h2>
        <button
          type="button"
          onClick={handleOpenAddUnit}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline focus:outline-none focus:ring-1 focus:ring-primary rounded-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add unit</span>
        </button>
      </div>

      {/* Units Table */}
      <div className="bg-surface border border-line rounded-panel overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-ink bg-band/30">
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Unit Label
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Type
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Description
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                  Listed Rent (FCFA)
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2">
                  Occupant
                </th>
                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-header-cap text-ink-2 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isUnitsLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-ink-2">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span>Loading units...</span>
                    </div>
                  </td>
                </tr>
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-ink-2 bg-band/10">
                    <div className="max-w-sm mx-auto space-y-3">
                      <Home className="w-8 h-8 text-ink-2/40 mx-auto" />
                      <div>
                        <p className="font-medium text-ink">
                          No units in this house yet. Add the first one.
                        </p>
                        <p className="text-xs text-ink-2 mt-1">
                          Create rentable apartments or studios to begin assigning leases.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenAddUnit}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-primary text-white rounded-btn-sm hover:bg-primary-hover transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add first unit</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                units.map((unit) => {
                  const isOccupied = unit.is_occupied || Boolean(unit.tenant_name);

                  return (
                    <tr
                      key={unit.id}
                      className="border-b border-row-line hover:bg-band/40 transition-colors"
                    >
                      {/* Label */}
                      <td className="px-5 py-3.5 text-[14.5px] font-medium text-ink whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Home className="w-4 h-4 text-ink-2 shrink-0" />
                          <span>{unit.label}</span>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-5 py-3.5 text-[14px] text-ink-2 whitespace-nowrap">
                        {formatUnitType(unit.unit_type)}
                      </td>

                      {/* Description */}
                      <td className="px-5 py-3.5 text-[14px] text-ink-2 max-w-[280px] truncate">
                        {unit.description || "—"}
                      </td>

                      {/* Listed Rent */}
                      <td className="px-5 py-3.5 text-[14.5px] font-mono text-ink tabular-nums text-right whitespace-nowrap">
                        {unit.listed_rent != null
                          ? formatMoney(unit.listed_rent, false)
                          : "—"}
                      </td>

                      {/* Occupant */}
                      <td className="px-5 py-3.5 text-[14px] whitespace-nowrap">
                        {isOccupied ? (
                          unit.lease_id ? (
                            <Link
                              to={`/leases/${unit.lease_id}`}
                              className="inline-flex items-center gap-1.5 font-medium text-ink hover:text-primary hover:underline transition-colors focus:outline-none focus:ring-1 focus:ring-primary rounded-sm"
                            >
                              <User className="w-3.5 h-3.5 text-ink-2" />
                              <span>{unit.tenant_name || "Active tenant"}</span>
                            </Link>
                          ) : (
                            <span className="font-medium text-ink">
                              {unit.tenant_name || "Occupied"}
                            </span>
                          )
                        ) : (
                          <div className="inline-flex items-center gap-3">
                            <div className="inline-flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-[2px] bg-ink-2/40 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="text-sm text-ink-2 font-medium">
                                Vacant
                              </span>
                            </div>
                            <Link
                              to={`/leases/new?unit_id=${unit.id}`}
                              className="inline-flex items-center justify-center h-6 px-2 text-[11px] font-semibold text-primary border border-primary/30 hover:bg-primary/5 rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                              title="Create lease for this vacant unit"
                            >
                              <span>New lease</span>
                            </Link>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenEditUnit(unit)}
                          className="inline-flex items-center justify-center gap-1 h-7 px-2.5 text-xs font-medium border border-line text-ink hover:bg-band rounded-btn-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <Edit className="w-3 h-3 text-ink-2" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog for Edit House */}
      {house && (
        <HouseFormDialog
          isOpen={isHouseDialogOpen}
          onClose={() => setIsHouseDialogOpen(false)}
          house={house}
          onSuccess={() => refetchHouse()}
        />
      )}

      {/* Dialog for Add / Edit Unit */}
      <UnitFormDialog
        isOpen={isUnitDialogOpen}
        onClose={() => setIsUnitDialogOpen(false)}
        houseId={houseId}
        houseName={house?.name}
        unit={editingUnit}
        onSuccess={() => {
          refetchUnits();
          refetchHouse();
        }}
      />
    </div>
  );
};
