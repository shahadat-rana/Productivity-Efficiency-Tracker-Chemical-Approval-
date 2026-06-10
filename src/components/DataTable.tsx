import React, { useState } from "react";
import { DailyLog, Employee } from "../types";
import {
  isRecordLocked,
  computeLogCalculations,
  GOVERNMENT_HOLIDAYS_2026,
} from "../utils/productivity";
import {
  Search,
  Lock,
  Unlock,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Download,
  Users,
  Calendar,
  Filter,
  BookOpen,
} from "lucide-react";

interface DataTableProps {
  logs: DailyLog[];
  simulatedToday: string;
  isOwnerMode: boolean;
  onDeleteLog: (uid: string) => void;
  onUpdateLog: (log: DailyLog) => void;
  employees?: Employee[];
  selectedUids: string[];
  setSelectedUids: (uids: string[]) => void;
}

export default function DataTable({
  logs,
  simulatedToday,
  isOwnerMode,
  onDeleteLog,
  onUpdateLog,
  employees = [],
  selectedUids,
  setSelectedUids,
}: DataTableProps) {
  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [idFilter, setIdFilter] = useState("ALL");
  const [selectedDateFilters, setSelectedDateFilters] = useState<string[]>([]);
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [dateFilterMode, setDateFilterMode] = useState<"dropdown" | "calendar">(
    "calendar",
  );
  const [sheetViewMode, setSheetViewMode] = useState<"daily" | "monthly" | "yearly">("daily");
  const [showDatePickerDropdown, setShowDatePickerDropdown] = useState(false);

  const getEmployeeTeam = (empId: string) => {
    const emp = employees.find(
      (e) => e.id.toUpperCase() === empId.toUpperCase(),
    );
    return emp?.team || "Team Alpha";
  };

  const formatDateLabel = (d: string) => {
    try {
      const parts = d.split("-");
      if (parts.length === 3) {
        const dateObj = new Date(
          parseInt(parts[0]),
          parseInt(parts[1]) - 1,
          parseInt(parts[2]),
        );
        return dateObj.toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    } catch (e) {
      // Fallback
    }
    return d;
  };

  // Editing state
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DailyLog>>({});

  // Sorting
  const [sortField, setSortField] = useState<keyof DailyLog>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const handleSort = (field: keyof DailyLog) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const handleEditClick = (log: DailyLog) => {
    setEditingUid(log.uid);
    setEditForm({ ...log });
  };

  const handleSaveClick = () => {
    if (!editingUid || !editForm) return;

    // Calculate updated fields using helper
    const updated = computeLogCalculations({
      uid: editForm.uid!,
      date: editForm.date!,
      id: editForm.id!.toUpperCase(),
      name: editForm.name!,
      inTime: editForm.isLeave ? "" : editForm.inTime || "",
      outTime: editForm.isLeave ? "" : editForm.outTime || "",
      isOffDay: !!editForm.isOffDay,
      isLeave: !!editForm.isLeave,
      isWastewater: !!editForm.isWastewater,
      typeA: editForm.isLeave ? 0 : Number(editForm.typeA || 0),
      typeB: editForm.isLeave ? 0 : Number(editForm.typeB || 0),
      typeC: editForm.isLeave ? 0 : Number(editForm.typeC || 0),
      foodSample: editForm.isLeave ? 0 : Number(editForm.foodSample || 0),
      combinedSample: editForm.isLeave
        ? 0
        : Number(editForm.combinedSample || 0),
    });

    onUpdateLog(updated);
    setEditingUid(null);
  };

  const uniqueIds = Array.from(new Set(logs.map((log) => log.id)));
  const uniqueDates = Array.from(new Set(logs.map((log) => log.date))).sort(
    (a, b) => b.localeCompare(a),
  );

  // Filter logs bases on date and search filters
  const filteredLogs = logs
    .filter((log) => {
      const matchSearch =
        log.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchId = idFilter === "ALL" || log.id === idFilter;
      const matchDate = selectedDateFilters.length === 0 || selectedDateFilters.includes(log.date);
      const logTeam = getEmployeeTeam(log.id);
      const matchTeam =
        teamFilter === "ALL" ||
        logTeam.toLowerCase() === teamFilter.toLowerCase();
      return matchSearch && matchId && matchDate && matchTeam;
    })
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

  // Calculate aggregated records if in monthly or yearly mode
  const aggregatedLogs = React.useMemo(() => {
    if (sheetViewMode === "daily") {
      return filteredLogs;
    }

    const groups: { [key: string]: typeof filteredLogs } = {};
    filteredLogs.forEach((log) => {
      let period = log.date;
      if (sheetViewMode === "monthly") {
        period = log.date.substring(0, 7); // YYYY-MM
      } else if (sheetViewMode === "yearly") {
        period = log.date.substring(0, 4); // YYYY
      }
      const groupKey = `${period}_${log.id}`;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(log);
    });

    return Object.keys(groups).map((key) => {
      const gLogs = groups[key];
      const first = gLogs[0];
      let periodName = first.date;
      if (sheetViewMode === "monthly") {
        const parts = first.date.split("-");
        if (parts.length >= 2) {
          const year = parseInt(parts[0]);
          const monthIdx = parseInt(parts[1]) - 1;
          const dObj = new Date(year, monthIdx, 1);
          periodName = dObj.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        }
      } else if (sheetViewMode === "yearly") {
        periodName = first.date.substring(0, 4);
      }

      const workedDaysCount = gLogs.filter((l) => !l.isLeave && !l.isOffDay).length;
      const offDaysCount = gLogs.filter((l) => l.isOffDay).length;
      const leaveDaysCount = gLogs.filter((l) => l.isLeave).length;
      const wastewaterDaysCount = gLogs.filter((l) => l.isWastewater).length;

      const totalTypeA = gLogs.reduce((sum, l) => sum + (l.typeA || 0), 0);
      const totalTypeB = gLogs.reduce((sum, l) => sum + (l.typeB || 0), 0);
      const totalTypeC = gLogs.reduce((sum, l) => sum + (l.typeC || 0), 0);
      const totalFoodSample = gLogs.reduce((sum, l) => sum + (l.foodSample || 0), 0);
      const totalCombinedSample = gLogs.reduce((sum, l) => sum + (l.combinedSample || 0), 0);
      const totalOnlyRslSample = gLogs.reduce((sum, l) => sum + (l.onlyRslSample || 0), 0);
      const totalWorkMins = gLogs.reduce((sum, l) => sum + (l.workMins || 0), 0);
      const totalExtra = gLogs.reduce((sum, l) => sum + (l.extra || 0), 0);
      
      const totalActProd = gLogs.reduce((sum, l) => sum + (l.actProd || 0), 0);
      const totalFinalProd = gLogs.reduce((sum, l) => sum + (l.finalProd || 0), 0);
      const totalTarget = gLogs.reduce((sum, l) => sum + (l.target || 0), 0);

      const pctProdLogs = gLogs.filter((l) => !l.isLeave && !l.isWastewater && l.target > 0);
      const avgPctProd = pctProdLogs.length > 0 
        ? pctProdLogs.reduce((sum, l) => sum + (l.pctProd || 0), 0) / pctProdLogs.length
        : 0;
      
      const pctEffLogs = gLogs.filter((l) => !l.isLeave && !l.isWastewater && l.workMins > 0);
      const avgPctEff = pctEffLogs.length > 0
        ? pctEffLogs.reduce((sum, l) => sum + (l.pctEff || 0), 0) / pctEffLogs.length
        : 0;

      return {
        uid: `agg_${key}`,
        date: periodName,
        id: first.id,
        name: first.name,
        inTime: "",
        outTime: "",
        isOffDay: offDaysCount > 0,
        isLeave: leaveDaysCount > 0,
        isWastewater: wastewaterDaysCount > 0,
        typeA: totalTypeA,
        typeB: totalTypeB,
        typeC: totalTypeC,
        foodSample: totalFoodSample,
        combinedSample: totalCombinedSample,
        onlyRslSample: totalOnlyRslSample,
        workMins: totalWorkMins,
        extra: totalExtra,
        actProd: totalActProd,
        finalProd: totalFinalProd,
        target: totalTarget,
        pctProd: avgPctProd,
        pctEff: avgPctEff,
        workedCount: gLogs.length,
        workedDaysCount,
        offDaysCount,
        leaveDaysCount,
        wastewaterDaysCount,
        isAggregated: true,
      };
    });
  }, [filteredLogs, sheetViewMode]);

  // Combined logs list for the grid display based on mode
  const displayLogs = React.useMemo(() => {
    if (sheetViewMode === "daily") {
      return filteredLogs;
    }
    
    return [...aggregatedLogs].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredLogs, aggregatedLogs, sheetViewMode, sortField, sortOrder]);

  const totalRecords = filteredLogs.length;
  const totalOffDays = filteredLogs.filter((l) => l.isOffDay).length;
  const totalLeaves = filteredLogs.filter((l) => l.isLeave).length;
  const totalTypeA = filteredLogs.reduce((sum, l) => sum + (l.typeA || 0), 0);
  const totalTypeB = filteredLogs.reduce((sum, l) => sum + (l.typeB || 0), 0);
  const totalTypeC = filteredLogs.reduce((sum, l) => sum + (l.typeC || 0), 0);
  const totalFood = filteredLogs.reduce(
    (sum, l) => sum + (l.foodSample || 0),
    0,
  );
  const totalCombined = filteredLogs.reduce(
    (sum, l) => sum + (l.combinedSample || 0),
    0,
  );
  const totalOnlyRsl = filteredLogs.reduce(
    (sum, l) => sum + (l.onlyRslSample || 0),
    0,
  );
  const totalMins = filteredLogs.reduce((sum, l) => sum + (l.workMins || 0), 0);
  const totalExtra = filteredLogs.reduce((sum, l) => sum + (l.extra || 0), 0);
  const totalActProd = filteredLogs.reduce(
    (sum, l) => sum + (l.actProd || 0),
    0,
  );
  const totalFinalProd = filteredLogs.reduce(
    (sum, l) => sum + (l.finalProd || 0),
    0,
  );
  const totalTarget = filteredLogs.reduce((sum, l) => sum + (l.target || 0), 0);

  // Calculate averages excluding leave days, unworked holiday days, unworked off days, and days with 0 total productivity so they don't drag down active averages
  const prodLogs = filteredLogs.filter((l) => {
    const isHolidayOff =
      GOVERNMENT_HOLIDAYS_2026.has(l.date) && (!l.inTime || !l.outTime);
    const isOffdayOff = l.isOffDay && (!l.inTime || !l.outTime);
    return (
      !l.isLeave && !isHolidayOff && !isOffdayOff && (l.finalProd || 0) > 0
    );
  });
  const avgPctProd =
    prodLogs.length > 0
      ? prodLogs.reduce((sum, l) => sum + l.pctProd, 0) / prodLogs.length
      : 0;

  const effLogs = filteredLogs.filter((l) => {
    const isHolidayOff =
      GOVERNMENT_HOLIDAYS_2026.has(l.date) && (!l.inTime || !l.outTime);
    const isOffdayOff = l.isOffDay && (!l.inTime || !l.outTime);
    return (
      (l.workMins > 0 || l.isOffDay) &&
      !l.isLeave &&
      !isHolidayOff &&
      !isOffdayOff &&
      (l.finalProd || 0) > 0
    );
  });
  const avgPctEff =
    effLogs.length > 0
      ? effLogs.reduce((sum, l) => sum + l.pctEff, 0) / effLogs.length
      : 0;

  const handleDownloadCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";

    // Headers with descriptive full names original to specification definitions placed strategically
    const headers = [
      "Date",
      "ID",
      "Name",
      "In Time",
      "Out Time",
      "Off Day",
      "Leave",
      "Target",
      "Actual productivity",
      "Total productivity",
      "% Productivity",
      "% Efficiency",
      "Short Acknowledgement with final commit",
      "Only Short Acknowledgement",
      "Final commit without Short Acknowledgement",
      "Food sample",
      "Combined sample",
      "Only RSL sample",
      "Working Minutes",
      "Extra Time (mins)",
    ];

    csvContent += headers.map((h) => `"${h}"`).join(",") + "\n";

    filteredLogs.forEach((log) => {
      const row = [
        log.date,
        log.id,
        log.name,
        log.inTime || "",
        log.outTime || "",
        log.isOffDay ? "Yes" : "No",
        log.isLeave ? "Yes" : "No",
        log.target,
        log.actProd.toFixed(0),
        log.finalProd.toFixed(0),
        `${log.pctProd.toFixed(1)}%`,
        `${log.pctEff.toFixed(1)}%`,
        log.typeA,
        log.typeB,
        log.typeC,
        log.foodSample,
        log.combinedSample || 0,
        log.onlyRslSample || 0,
        log.workMins,
        log.extra,
      ];
      csvContent +=
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",") +
        "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    // Explicit dynamic filtered naming
    link.setAttribute(
      "download",
      `Productivity_Backup_Filtered_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      {/* Table Header / Action Toolbar */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-bold text-slate-900 font-display flex items-center gap-1.5 text-lg">
              {sheetViewMode === "daily" && "Daily Input Sheet"}
              {sheetViewMode === "monthly" && "Monthly Input Sheet Summary"}
              {sheetViewMode === "yearly" && "Yearly Input Sheet Summary"}
              <span className="text-xs font-normal text-slate-500 font-sans">
                ({filteredLogs.length} matching daily logs)
              </span>
            </h3>

            {/* View Mode Toggle: daily, Monthly & Yearly */}
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 select-none">
              <button
                type="button"
                onClick={() => setSheetViewMode("daily")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  sheetViewMode === "daily"
                    ? "bg-white text-indigo-700 shadow-3xs border border-indigo-150/40"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Daily View
              </button>
              <button
                type="button"
                onClick={() => setSheetViewMode("monthly")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  sheetViewMode === "monthly"
                    ? "bg-white text-indigo-700 shadow-3xs border border-indigo-150/40"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Monthly Summary
              </button>
              <button
                type="button"
                onClick={() => setSheetViewMode("yearly")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  sheetViewMode === "yearly"
                    ? "bg-white text-indigo-700 shadow-3xs border border-indigo-150/40"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                Yearly Summary
              </button>
            </div>
          </div>

          {/* Shift Guide in exactly one line */}
          <div className="flex items-center gap-1.5 mt-2.5 select-none overflow-x-auto whitespace-nowrap scrollbar-none py-0.5 max-w-full">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-1 font-sans shrink-0">Shifts Guide:</span>
            <span className="text-[10px] bg-sky-50 text-sky-800 border border-sky-200/50 rounded-lg px-2 py-0.5 font-sans font-semibold shrink-0">Morning Shift (7:00-4:00)</span>
            <span className="text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200/50 rounded-lg px-2 py-0.5 font-sans font-semibold shrink-0">General Shift (8:30-5:30)</span>
            <span className="text-[10px] bg-purple-50 text-purple-800 border border-purple-200/50 rounded-lg px-2 py-0.5 font-sans font-semibold shrink-0">Special Shift (10:00-7:00)</span>
            <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200/50 rounded-lg px-2 py-0.5 font-sans font-semibold shrink-0">Afternoon Shift (12:00-9:00)</span>
            <span className="text-[10px] bg-slate-100 text-slate-800 border border-slate-200 rounded-lg px-2 py-0.5 font-sans font-semibold shrink-0">Night Shift (10:00-6:00)</span>
          </div>
        </div>

        {/* Filters & Action Utilities */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 flex-grow sm:flex-initial">
            {/* Text Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 w-full text-xs border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden bg-white transition-all shadow-3xs"
              />
            </div>

            {/* Team Selector */}
            {isOwnerMode ? (
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="px-3 py-1.5 w-full text-xs border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden bg-white transition-all font-semibold text-slate-700 cursor-pointer shadow-3xs"
              >
                <option value="ALL">All Teams</option>
                {Array.from(
                  new Set(employees.map((emp) => emp.team || "Team Alpha")),
                ).map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-3 py-1.5 w-full text-xs font-semibold text-slate-500 border border-slate-100 bg-slate-50 rounded-xl flex items-center shadow-3xs truncate select-none">
                Workspace: {employees[0]?.team || "My Team"}
              </div>
            )}

            {/* ID selector */}
            <select
              value={idFilter}
              onChange={(e) => setIdFilter(e.target.value)}
              className="px-3 py-1.5 w-full text-xs border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden bg-white transition-all cursor-pointer shadow-3xs"
            >
              <option value="ALL">All Employee IDs</option>
              {uniqueIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>

            {/* Multiselect Date Selector with Popover */}
            <div className="relative w-full flex items-center gap-1">
              {dateFilterMode === "dropdown" ? (
                <div className="relative w-full">
                  <button
                    type="button"
                    onClick={() => setShowDatePickerDropdown(!showDatePickerDropdown)}
                    className="px-3 py-1.5 w-full text-xs border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden bg-white text-left transition-all font-semibold text-slate-700 font-sans cursor-pointer h-[32px] flex items-center justify-between shadow-3xs"
                  >
                    <span className="truncate">
                      {selectedDateFilters.length === 0
                        ? "All Days"
                        : `${selectedDateFilters.length} Days Set`}
                    </span>
                    <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>

                  {showDatePickerDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowDatePickerDropdown(false)}
                      />
                      <div className="absolute right-0 left-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-20 p-2 space-y-1 w-52">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-1 px-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setSelectedDateFilters([])}
                            className="text-rose-600 hover:text-rose-700 font-bold"
                          >
                            Clear All
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedDateFilters([...uniqueDates])}
                            className="text-indigo-600 hover:text-indigo-700 font-bold"
                          >
                            Select All
                          </button>
                        </div>
                        <div className="space-y-0.5">
                          {uniqueDates.map((d) => {
                            const isChecked = selectedDateFilters.includes(d);
                            return (
                              <label
                                key={d}
                                className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-slate-50 cursor-pointer text-[11px] select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedDateFilters(selectedDateFilters.filter((x) => x !== d));
                                    } else {
                                      setSelectedDateFilters([...selectedDateFilters, d]);
                                    }
                                  }}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                />
                                <span className="font-semibold text-slate-700 truncate">{formatDateLabel(d)}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="relative w-full">
                  <input
                    type="date"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && !selectedDateFilters.includes(val)) {
                        setSelectedDateFilters([...selectedDateFilters, val]);
                      }
                    }}
                    className="px-3 py-1.5 w-full text-xs border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden bg-white transition-all font-semibold font-sans text-slate-700 h-[32px] cursor-pointer shadow-3xs"
                    placeholder="Add Date"
                  />
                  {selectedDateFilters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedDateFilters([])}
                      className="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold hover:bg-slate-100 rounded-md p-0.5 text-[10px] w-4 h-4 flex items-center justify-center transition-all"
                      title="Clear Filter"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {/* Toggle between Dropdown list and native calendar input */}
              <button
                type="button"
                onClick={() =>
                  setDateFilterMode((m) =>
                    m === "dropdown" ? "calendar" : "dropdown",
                  )
                }
                className="flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl w-8 h-[32px] shrink-0 transition-all cursor-pointer shadow-3xs"
                title={
                  dateFilterMode === "dropdown"
                    ? "Add Dates via Calendar Picker"
                    : "Toggle Dropdown Checker Tracker"
                }
              >
                {dateFilterMode === "dropdown" ? (
                  <Calendar className="w-3.5 h-3.5" />
                ) : (
                  <Filter className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* New Filtered backup Download as CSV Button */}
          <button
            onClick={handleDownloadCSV}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 hover:border-indigo-200 rounded-xl transition-all cursor-pointer font-sans shrink-0 h-[30px] shadow-3xs"
            title="Download current filtered view as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Selected Dates Badges Tray */}
      {selectedDateFilters.length > 0 && (
        <div className="px-5 pb-3 pt-2 bg-slate-50/40 flex flex-wrap items-center gap-1.5 border-b border-slate-100">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 font-sans mr-1">
            Active Multi-Date Filters ({selectedDateFilters.length}):
          </span>
          {selectedDateFilters.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg px-2.5 py-0.5 text-[10px] font-sans font-bold shadow-3xs animate-fade-in"
            >
              {formatDateLabel(d)}
              <button
                type="button"
                onClick={() => setSelectedDateFilters(selectedDateFilters.filter((x) => x !== d))}
                className="text-indigo-400 hover:text-rose-600 font-extrabold ml-1 cursor-pointer"
                title="Remove date filter"
              >
                ✕
              </button>
            </span>
          ))}
          <button
            onClick={() => setSelectedDateFilters([])}
            className="text-[10px] text-rose-600 hover:text-rose-700 font-bold hover:underline ml-1 font-sans cursor-pointer"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Spreadsheet grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold font-mono tracking-wider tabular-nums">
              {isOwnerMode && (
                <th className="p-3 text-center w-10">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                    checked={
                      filteredLogs.length > 0 &&
                      filteredLogs.every((log) =>
                        selectedUids.includes(log.uid),
                      )
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        const allVisible = filteredLogs.map((l) => l.uid);
                        setSelectedUids(
                          Array.from(new Set([...selectedUids, ...allVisible])),
                        );
                      } else {
                        setSelectedUids(
                          selectedUids.filter(
                            (uid) => !filteredLogs.some((l) => l.uid === uid),
                          ),
                        );
                      }
                    }}
                  />
                </th>
              )}
              <th
                className="p-3 select-none cursor-pointer hover:bg-slate-200"
                onClick={() => handleSort("date")}
              >
                Date{" "}
                {sortField === "date" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th
                className="p-3 select-none cursor-pointer hover:bg-slate-200"
                onClick={() => handleSort("id")}
              >
                ID {sortField === "id" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th
                className="p-3 select-none cursor-pointer hover:bg-slate-200"
                onClick={() => handleSort("name")}
              >
                Name{" "}
                {sortField === "name" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th className="p-3 text-center">In</th>
              <th className="p-3 text-center">Out</th>
              <th className="p-3 text-center">Off</th>
              <th className="p-3 text-center">Leave</th>
              <th className="p-3 text-center text-teal-800 font-semibold font-mono">
                Wastewater
              </th>
              <th className="p-3 text-center bg-indigo-100 text-indigo-950 font-extrabold text-[11px] leading-tight max-w-[90px] whitespace-normal">
                Actual<br />productivity
              </th>
              <th className="p-3 text-center bg-emerald-100 text-emerald-950 font-extrabold text-[11px] leading-tight max-w-[90px] whitespace-normal">
                Total<br />productivity
              </th>
              <th className="p-3 text-center bg-emerald-150 text-emerald-950 font-extrabold whitespace-nowrap">
                % Prod
              </th>
              <th className="p-3 text-center bg-purple-150 text-purple-950 font-extrabold whitespace-nowrap">
                % Eff
              </th>
              <th className="p-3 text-center text-[10px] leading-tight font-extrabold max-w-[120px] whitespace-normal break-words">
                Short Acknowledgement with final commit
              </th>
              <th className="p-3 text-center text-[10px] leading-tight font-extrabold max-w-[120px] whitespace-normal break-words">
                Only Short Acknowledgement
              </th>
              <th className="p-3 text-center text-[10px] leading-tight font-extrabold max-w-[120px] whitespace-normal break-words">
                Final commit without Short Acknowledgement
              </th>
              <th className="p-3 text-center text-[10px] leading-tight font-extrabold max-w-[120px] whitespace-normal break-words">
                Food sample
              </th>
              <th className="p-3 text-center text-[10px] leading-tight font-extrabold max-w-[120px] whitespace-normal break-words">
                Combined sample
              </th>
              <th className="p-3 text-center text-[10px] leading-tight font-extrabold max-w-[120px] whitespace-normal break-words bg-emerald-50 text-emerald-950 font-bold">
                Only RSL sample
              </th>
              <th className="p-3 text-center bg-sky-50 text-sky-900 font-bold">
                Mins
              </th>
              <th className="p-3 text-center bg-amber-50 text-amber-900 font-bold">
                Extra
              </th>
              <th className="p-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {displayLogs.length === 0 ? (
              <tr>
                <td
                  colSpan={isOwnerMode ? 21 : 20}
                  className="text-center py-8 text-slate-400 font-sans"
                >
                  No matching production journal entries found. Check your
                  filters or add a new record.
                </td>
              </tr>
            ) : (
              displayLogs.map((log) => {
                const isAggregated = (log as any).isAggregated;
                const isLocked = isAggregated || isRecordLocked(
                  log.date,
                  simulatedToday,
                  isOwnerMode,
                );
                const isEditing = editingUid === log.uid;

                // Real-time calculations while editing to keep columns synced
                const editCalcs = isEditing
                  ? computeLogCalculations({
                      uid: editForm.uid || log.uid,
                      date: editForm.date || log.date,
                      id: editForm.id || log.id,
                      name: editForm.name || log.name,
                      inTime: editForm.isLeave ? "" : editForm.inTime || "",
                      outTime: editForm.isLeave ? "" : editForm.outTime || "",
                      isOffDay: !!editForm.isOffDay,
                      isLeave: !!editForm.isLeave,
                      typeA: editForm.isLeave ? 0 : Number(editForm.typeA || 0),
                      typeB: editForm.isLeave ? 0 : Number(editForm.typeB || 0),
                      typeC: editForm.isLeave ? 0 : Number(editForm.typeC || 0),
                      foodSample: editForm.isLeave
                        ? 0
                        : Number(editForm.foodSample || 0),
                      combinedSample: editForm.isLeave
                        ? 0
                        : Number(editForm.combinedSample || 0),
                    })
                  : null;

                const displayLog = isEditing && editCalcs ? editCalcs : log;

                return (
                  <tr
                    key={log.uid}
                    className={`hover:bg-slate-50/50 transition-colors ${
                      isEditing ? "bg-indigo-50/20" : isAggregated ? "bg-slate-50/30 font-medium" : isLocked ? "bg-slate-50/30 text-slate-500" : "bg-white"
                    }`}
                  >
                    {isOwnerMode && (
                      <td className="p-3 text-center">
                        {isAggregated ? (
                          <span className="text-[10px] text-slate-400 font-sans font-bold" title="Read-only Period Aggregate">-</span>
                        ) : (
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4 shadow-3xs"
                            checked={selectedUids.includes(log.uid)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUids([...selectedUids, log.uid]);
                              } else {
                                setSelectedUids(
                                  selectedUids.filter((uid) => uid !== log.uid),
                                );
                              }
                            }}
                          />
                        )}
                      </td>
                    )}
                    {/* Date */}
                    <td className="p-3 font-semibold whitespace-nowrap">
                      {isEditing ? (
                        <input
                          type="date"
                          value={editForm.date || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, date: e.target.value })
                          }
                          className="border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-500 font-mono"
                        />
                      ) : (
                        <span className="flex items-center gap-1.5 flex-wrap">
                          {isAggregated ? (
                            <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                          ) : isLocked ? (
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5 text-indigo-500" />
                          )}
                          <span>{log.date}</span>
                          {!isAggregated && GOVERNMENT_HOLIDAYS_2026.has(log.date) && (
                            <span className="bg-orange-100 text-orange-850 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight select-none border border-orange-200">
                              Holiday
                            </span>
                          )}
                        </span>
                      )}
                    </td>

                    {/* Employee ID */}
                    <td className="p-3 font-bold text-slate-700">{log.id}</td>

                    {/* Employee Name */}
                    <td className="p-3 font-sans font-medium text-slate-900 text-ellipsis max-w-[120px] overflow-hidden whitespace-nowrap">
                      {log.name}
                    </td>

                    {/* In Time */}
                    <td className="p-3 text-center">
                      {isEditing && !editForm.isLeave ? (
                        <div className="flex flex-col items-center gap-1">
                          <input
                            type="time"
                            value={editForm.inTime || ""}
                            onChange={(e) =>
                              setEditForm({ ...editForm, inTime: e.target.value })
                            }
                            className="border border-slate-300 rounded p-0.5 text-[10px] w-14 font-mono text-slate-800"
                          />
                        </div>
                      ) : isAggregated ? (
                        <span className="bg-slate-100/80 px-2 py-0.5 rounded-md text-[10px] font-sans font-semibold text-slate-600 border border-slate-205/60">
                          {(log as any).workedDaysCount} workdays
                        </span>
                      ) : log.isLeave ? (
                        <span className="text-slate-400">-</span>
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <span className="font-mono text-xs text-slate-900">{log.inTime || <span className="text-slate-400">-</span>}</span>
                          {log.inTime && log.shiftName && (
                            <span className={`text-[9px] font-sans font-semibold px-1 py-0.5 mt-1 rounded border leading-none block select-none whitespace-nowrap scale-95 md:scale-100 ${
                              log.shiftName === "Morning" ? "bg-sky-50 text-sky-700 border-sky-105" :
                              log.shiftName === "General" ? "bg-indigo-50 text-indigo-700 border-indigo-105" :
                              log.shiftName === "Special" ? "bg-purple-50 text-purple-700 border-purple-105" :
                              log.shiftName === "Afternoon" ? "bg-amber-50 text-amber-700 border-amber-105" :
                              "bg-slate-100 text-slate-700 border-slate-200"
                            }`}>
                              {log.shiftName}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Out Time */}
                    <td className="p-3 text-center">
                      {isEditing && !editForm.isLeave ? (
                        <input
                          type="time"
                          value={editForm.outTime || ""}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              outTime: e.target.value,
                            })
                          }
                          className="border border-slate-300 rounded p-0.5 text-[10px] w-14 font-mono text-slate-800"
                        />
                      ) : isAggregated ? (
                        <span className="text-slate-400 font-mono text-[11px] font-bold">
                          {(log as any).workedCount} total records
                        </span>
                      ) : log.isLeave ? (
                        <span className="text-slate-400">-</span>
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <span className="font-mono text-xs text-slate-900">{log.outTime || <span className="text-slate-400">-</span>}</span>
                          {log.inTime && log.shiftName && (
                            <span className="text-[9px] font-sans text-slate-400 tracking-tight mt-1 leading-none block select-none">
                              Target: {
                                log.shiftName === "Morning" ? "16:00" :
                                log.shiftName === "General" ? "17:30" :
                                log.shiftName === "Special" ? "19:00" :
                                log.shiftName === "Afternoon" ? "21:00" :
                                "07:00"
                              }
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Off day */}
                    <td className="p-3 text-center">
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={!!editForm.isOffDay}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              isOffDay: e.target.checked,
                              ...(e.target.checked ? { isLeave: false } : {}),
                            })
                          }
                          className="rounded"
                        />
                      ) : isAggregated ? (
                        <span className="font-sans text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 rounded px-1.5 py-0.5 select-none shrink-0 inline-block">
                          {(log as any).offDaysCount} Off
                        </span>
                      ) : log.isOffDay ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] uppercase font-bold font-sans">
                          Yes
                        </span>
                      ) : (
                        <span className="text-slate-300">No</span>
                      )}
                    </td>

                    {/* Leave */}
                    <td className="p-3 text-center">
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={!!editForm.isLeave}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              isLeave: e.target.checked,
                              ...(e.target.checked
                                ? { isOffDay: false, isWastewater: false }
                                : {}),
                            })
                          }
                          className="rounded"
                        />
                      ) : isAggregated ? (
                        <span className="font-sans text-[10px] font-extrabold bg-purple-50 text-purple-800 border border-purple-200 rounded px-1.5 py-0.5 select-none shrink-0 inline-block">
                          {(log as any).leaveDaysCount} Leave
                        </span>
                      ) : log.isLeave ? (
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] uppercase font-bold font-sans">
                          Yes
                        </span>
                      ) : (
                        <span className="text-slate-300">No</span>
                      )}
                    </td>

                    {/* Wastewater */}
                    <td className="p-3 text-center">
                      {isEditing ? (
                        <input
                          type="checkbox"
                          checked={!!editForm.isWastewater}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              isWastewater: e.target.checked,
                              ...(e.target.checked ? { isLeave: false } : {}),
                            })
                          }
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        />
                      ) : isAggregated ? (
                        <span className="font-sans text-[10px] font-extrabold bg-teal-50/80 text-teal-800 border border-teal-200 rounded px-1.5 py-0.5 select-none shrink-0 inline-block">
                          {(log as any).wastewaterDaysCount} WW
                        </span>
                      ) : log.isWastewater ? (
                        <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-850 text-[10px] uppercase font-bold font-sans border border-teal-200">
                          Yes
                        </span>
                      ) : (
                        <span className="text-slate-300">No</span>
                      )}
                    </td>

                    {/* Computed Act Prod */}
                    <td className="p-3 text-center bg-indigo-50 text-indigo-900 tabular-nums font-medium font-mono">
                      {displayLog.actProd.toFixed(0)}
                    </td>

                    {/* Computed Final Prod */}
                    <td className="p-3 text-center bg-emerald-50 text-emerald-950 font-bold tabular-nums font-mono">
                      {displayLog.finalProd.toFixed(0)}
                    </td>

                    {/* Computed % Productivity */}
                    <td className="p-3 text-center bg-emerald-100/40 text-emerald-900 font-bold tabular-nums font-mono">
                      {displayLog.pctProd.toFixed(1)}%
                    </td>

                    {/* Computed % Efficiency */}
                    <td className="p-3 text-center bg-purple-100/40 text-purple-900 font-bold tabular-nums font-mono">
                      {displayLog.pctEff.toFixed(1)}%
                    </td>

                    {/* Type A */}
                    <td className="p-3 text-center font-bold">
                      {isEditing && !editForm.isLeave ? (
                        <input
                          type="number"
                          value={editForm.typeA || 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              typeA: parseInt(e.target.value) || 0,
                            })
                          }
                          className="border border-slate-300 rounded p-0.5 text-[10px] w-10 text-center font-mono text-slate-800"
                        />
                      ) : log.isLeave ? (
                        "0"
                      ) : (
                        log.typeA
                      )}
                    </td>

                    {/* Type B */}
                    <td className="p-3 text-center">
                      {isEditing && !editForm.isLeave ? (
                        <input
                          type="number"
                          value={editForm.typeB || 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              typeB: parseInt(e.target.value) || 0,
                            })
                          }
                          className="border border-slate-300 rounded p-0.5 text-[10px] w-10 text-center font-mono text-slate-800"
                        />
                      ) : log.isLeave ? (
                        "0"
                      ) : (
                        log.typeB
                      )}
                    </td>

                    {/* Type C */}
                    <td className="p-3 text-center">
                      {isEditing && !editForm.isLeave ? (
                        <input
                          type="number"
                          value={editForm.typeC || 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              typeC: parseInt(e.target.value) || 0,
                            })
                          }
                          className="border border-slate-300 rounded p-0.5 text-[10px] w-10 text-center font-mono text-slate-800"
                        />
                      ) : log.isLeave ? (
                        "0"
                      ) : (
                        log.typeC
                      )}
                    </td>

                    {/* Food D */}
                    <td className="p-3 text-center">
                      {isEditing && !editForm.isLeave ? (
                        <input
                          type="number"
                          value={editForm.foodSample || 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              foodSample: parseInt(e.target.value) || 0,
                            })
                          }
                          className="border border-slate-300 rounded p-0.5 text-[10px] w-10 text-center font-mono text-slate-805"
                        />
                      ) : log.isLeave ? (
                        "0"
                      ) : (
                        log.foodSample
                      )}
                    </td>

                    {/* Combined sample */}
                    <td className="p-3 text-center">
                      {isEditing && !editForm.isLeave ? (
                        <input
                          type="number"
                          value={editForm.combinedSample || 0}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              combinedSample: parseInt(e.target.value) || 0,
                            })
                          }
                          className="border border-slate-300 rounded p-0.5 text-[10px] w-10 text-center font-mono text-slate-805"
                        />
                      ) : log.isLeave ? (
                        "0"
                      ) : (
                        log.combinedSample || 0
                      )}
                    </td>

                    {/* Only RSL sample */}
                    <td className="p-3 text-center bg-emerald-50 text-emerald-950 font-bold">
                      {displayLog.isLeave
                        ? "0"
                        : (displayLog.onlyRslSample || 0).toFixed(0)}
                    </td>

                    {/* Computed Mins */}
                    <td className="p-3 text-center bg-sky-50 text-sky-900 font-bold tabular-nums">
                      {displayLog.workMins}m
                    </td>

                    {/* Computed Extra */}
                    <td className="p-3 text-center bg-amber-50 text-amber-900 font-bold tabular-nums">
                      {displayLog.extra}m
                    </td>

                    {/* Edit Actions */}
                    <td className="p-3 text-center whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={handleSaveClick}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] px-2 py-0.5 rounded cursor-pointer font-sans"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingUid(null)}
                            className="bg-slate-400 hover:bg-slate-500 text-white text-[10px] px-2 py-0.5 rounded cursor-pointer font-sans"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : isAggregated ? (
                        <span className="text-[10px] font-sans font-bold text-slate-500 uppercase bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 select-none" title="Rollup summary. Read-only.">Rollup</span>
                      ) : (
                        <div className="flex gap-1.5 justify-center">
                          <button
                            onClick={() => handleEditClick(log)}
                            disabled={isLocked}
                            className={`p-1.5 rounded-lg border cursor-pointer hover:bg-slate-100 border-slate-200 transition-colors ${
                              isLocked
                                ? "opacity-30 cursor-not-allowed hover:bg-transparent text-slate-400"
                                : "text-indigo-600"
                            }`}
                            title={
                              isLocked
                                ? "Row locked. Activates ownership toggle above to bypass."
                                : "Edit Row"
                            }
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteLog(log.uid)}
                            disabled={isLocked}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isLocked
                                ? "opacity-25 cursor-not-allowed hover:bg-transparent text-slate-350 border-slate-100"
                                : "text-rose-600 hover:bg-rose-50 border-slate-200 hover:border-rose-200 cursor-pointer"
                            }`}
                            title={
                              isLocked
                                ? "Row locked. Activates ownership toggle above to bypass."
                                : log.uid.startsWith("virtual_")
                                ? "Delete Virtual Log (Owner Only)"
                                : "Delete Row"
                            }
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {filteredLogs.length > 0 && (
            <tfoot className="bg-slate-100/90 border-t-2 border-slate-300 font-semibold text-slate-900 sticky bottom-0 backdrop-blur-xs font-mono">
              <tr className="hover:bg-slate-200 transition-colors">
                {isOwnerMode && <td className="p-3"></td>}
                <td className="p-3 font-bold text-slate-900 text-left">
                  Team Total / Avg
                </td>
                <td className="p-3 font-bold text-slate-700">
                  {totalRecords} recs
                </td>
                <td className="p-3"></td>
                <td className="p-3"></td>
                <td className="p-3"></td>
                <td className="p-3 text-center text-teal-800 font-bold bg-teal-50/50">
                  {totalOffDays}
                </td>
                <td className="p-3 text-center text-teal-800 font-bold bg-teal-50/50">
                  {totalLeaves}
                </td>
                {/* Actual Productivity */}
                <td className="p-3 text-center bg-indigo-100/60 text-indigo-900 font-semibold">
                  {totalActProd.toFixed(0)}
                </td>
                {/* Total Productivity */}
                <td className="p-3 text-center bg-emerald-100/60 text-emerald-950 font-extrabold">
                  {totalFinalProd.toFixed(0)}
                </td>
                {/* % Prod */}
                <td className="p-3 text-center bg-emerald-100/60 text-emerald-900 font-bold">
                  {avgPctProd.toFixed(1)}%
                </td>
                {/* % Eff */}
                <td className="p-3 text-center bg-purple-100/60 text-purple-900 font-bold">
                  {avgPctEff.toFixed(1)}%
                </td>
                <td className="p-3 text-center">{totalTypeA}</td>
                <td className="p-3 text-center">{totalTypeB}</td>
                <td className="p-3 text-center">{totalTypeC}</td>
                <td className="p-3 text-center">{totalFood}</td>
                <td className="p-3 text-center">{totalCombined}</td>
                <td className="p-3 text-center bg-emerald-100/60 text-emerald-950 font-bold">
                  {totalOnlyRsl.toFixed(0)}
                </td>
                <td className="p-3 text-center bg-sky-100/60 text-sky-900 font-bold">
                  {totalMins}
                </td>
                <td className="p-3 text-center bg-amber-100/60 text-amber-900 font-bold">
                  {totalExtra}
                </td>
                <td className="p-3"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
