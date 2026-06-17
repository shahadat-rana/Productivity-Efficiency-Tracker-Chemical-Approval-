import React, { useState } from "react";
import { DailyLog, Employee } from "../types";
import { Calendar, Filter, Download, Users, Layers, Award } from "lucide-react";
import { GOVERNMENT_HOLIDAYS_2026 } from "../utils/productivity";

interface SummariesViewProps {
  logs: DailyLog[];
  employees?: Employee[];
}

export interface AggregatedRow {
  key: string;
  period: string; // YYYY-MM-DD for daily, YYYY-MM for monthly, YYYY for yearly
  groupName: string; // ID, Team Name, or Dept Name
  displayName?: string; // Employee Name (for individual)
  team?: string;
  department?: string;
  totalDays: number;
  totalLeaves: number;
  totalOffDays: number;
  totalTypeA: number;
  totalTypeB: number;
  totalTypeC: number;
  totalFood: number;
  totalCombined: number;
  totalCnA: number;
  totalOnlyRsl: number;
  totalMins: number;
  totalExtra: number;
  totalActProd: number; // Rounded full number
  totalFinalProd: number; // Rounded full number (Total Productivity)
  totalTarget: number;
  avgPctProd: number;
  avgPctEff: number;
}

export default function SummariesView({ logs: rawLogs, employees = [] }: SummariesViewProps) {
  // Query Dimensions
  const [selectedFreq, setSelectedFreq] = useState<"daily" | "monthly" | "yearly">("monthly");
  const [selectedDim, setSelectedDim] = useState<"individual" | "team" | "department">("individual");
  
  // Quick Filters
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [dateFilterMode, setDateFilterMode] = useState<"dropdown" | "calendar">("calendar");

  const [monthFilter, setMonthFilter] = useState("ALL");
  const [monthFilterMode, setMonthFilterMode] = useState<"dropdown" | "calendar">("calendar");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [yearFilterMode, setYearFilterMode] = useState<"dropdown" | "calendar">("calendar");

  const getEmployeeTeam = (empId: string) => {
    const emp = employees.find((e) => e.id.toUpperCase() === empId.toUpperCase());
    return emp?.team || "Team Alpha";
  };

  const getEmployeeDept = (empId: string) => {
    const emp = employees.find((e) => e.id.toUpperCase() === empId.toUpperCase());
    return emp?.department || "Assembly";
  };

  const uniqueTeams = Array.from(new Set(employees.map((e) => e.team || "Team Alpha")));
  const uniqueDepts = Array.from(new Set(employees.map((e) => e.department || "Assembly")));
  const uniqueDates = Array.from(new Set(rawLogs.map((log) => log.date))).sort((a, b) => b.localeCompare(a));
  const uniqueMonths = Array.from(new Set(rawLogs.map((log) => log.date.substring(0, 7)))).sort((a, b) => b.localeCompare(a));
  const uniqueYears = Array.from(new Set(rawLogs.map((log) => log.date.substring(0, 4)))).sort((a, b) => b.localeCompare(a));

  // 1. Filter Raw Logs first by dropdown selectors
  const filteredLogs = rawLogs.filter((log) => {
    const team = getEmployeeTeam(log.id);
    const dept = getEmployeeDept(log.id);
    const matchTeam = teamFilter === "ALL" || team.toLowerCase() === teamFilter.toLowerCase();
    const matchDept = deptFilter === "ALL" || dept.toLowerCase() === deptFilter.toLowerCase();
    
    let matchDate = true;
    if (selectedFreq === "daily") {
      matchDate = dateFilter === "ALL" || log.date === dateFilter;
    } else if (selectedFreq === "monthly") {
      matchDate = monthFilter === "ALL" || log.date.substring(0, 7) === monthFilter;
    } else if (selectedFreq === "yearly") {
      matchDate = yearFilter === "ALL" || log.date.substring(0, 4) === yearFilter;
    }
    
    return matchTeam && matchDept && matchDate;
  });

  // 2. Perform Multi-dimensional aggregation
  const aggMap: { [key: string]: any } = {};

  filteredLogs.forEach((log) => {
    const team = getEmployeeTeam(log.id);
    const dept = getEmployeeDept(log.id);

    // Determine Period group
    let period = "";
    if (selectedFreq === "daily") {
      period = log.date;
    } else if (selectedFreq === "monthly") {
      period = log.date.substring(0, 7); // YYYY-MM
    } else {
      period = log.date.substring(0, 4); // YYYY
    }

    // Determine Dimension group
    let groupKey = "";
    let groupName = "";
    let displayName = "";

    if (selectedDim === "individual") {
      groupKey = log.id.toUpperCase();
      groupName = log.id;
      displayName = log.name;
    } else if (selectedDim === "team") {
      groupKey = team.toLowerCase();
      groupName = team;
    } else {
      groupKey = dept.toLowerCase();
      groupName = dept;
    }

    const rowKey = `${period}_${groupKey}`;

    if (!aggMap[rowKey]) {
      aggMap[rowKey] = {
        key: rowKey,
        period,
        groupName,
        displayName,
        team,
        department: dept,
        totalDays: 0,
        totalLeaves: 0,
        totalOffDays: 0,
        totalTypeA: 0,
        totalTypeB: 0,
        totalTypeC: 0,
        totalFood: 0,
        totalCombined: 0,
        totalCnA: 0,
        totalOnlyRsl: 0,
        totalMins: 0,
        totalExtra: 0,
        totalActProd: 0,
        totalFinalProd: 0,
        totalTarget: 0,
        _sumPctProd: 0,
        _prodDaysCount: 0,
        _sumPctEff: 0,
        _effDaysCount: 0,
      };
    }

    const row = aggMap[rowKey];
    row.totalDays += 1;
    row.totalLeaves += log.isLeave ? 1 : 0;
    row.totalOffDays += log.isOffDay ? 1 : 0;
    row.totalTypeA += log.typeA || 0;
    row.totalTypeB += log.typeB || 0;
    row.totalTypeC += log.typeC || 0;
    row.totalFood += log.foodSample || 0;
    row.totalCombined += log.combinedSample || 0;
    row.totalCnA += log.cnASample || 0;
    row.totalOnlyRsl += log.onlyRslSample || 0;
    row.totalMins += log.workMins || 0;
    row.totalExtra += log.extra || 0;
    row.totalActProd += log.actProd || 0;
    row.totalFinalProd += log.finalProd || 0;
    row.totalTarget += log.target || 0;
    
    const isHolidayOff = GOVERNMENT_HOLIDAYS_2026.has(log.date) && (!log.inTime || !log.outTime);
    const isOffdayOff = log.isOffDay && (!log.inTime || !log.outTime);
    
    if (!log.isLeave && !log.isWastewater && !isHolidayOff && !isOffdayOff && (log.finalProd || 0) > 0) {
      row._sumPctProd += log.pctProd || 0;
      row._prodDaysCount += 1;
    }
    if ((log.workMins > 0 || log.isOffDay) && !log.isLeave && !log.isWastewater && !isHolidayOff && !isOffdayOff && (log.finalProd || 0) > 0) {
      row._sumPctEff += log.pctEff || 0;
      row._effDaysCount += 1;
    }
  });

  // Convert map to custom final arrays
  const aggRows: AggregatedRow[] = Object.values(aggMap).map((row: any) => {
    return {
      key: row.key,
      period: row.period,
      groupName: row.groupName,
      displayName: row.displayName,
      team: row.team,
      department: row.department,
      totalDays: row.totalDays,
      totalLeaves: row.totalLeaves,
      totalOffDays: row.totalOffDays,
      totalTypeA: row.totalTypeA,
      totalTypeB: row.totalTypeB,
      totalTypeC: row.totalTypeC,
      totalFood: row.totalFood,
      totalCombined: row.totalCombined,
      totalCnA: row.totalCnA,
      totalOnlyRsl: row.totalOnlyRsl,
      totalMins: row.totalMins,
      totalExtra: row.totalExtra,
      totalActProd: row.totalActProd,
      totalFinalProd: row.totalFinalProd,
      totalTarget: row.totalTarget,
      avgPctProd: row._prodDaysCount > 0 ? row._sumPctProd / row._prodDaysCount : 0,
      avgPctEff: row._effDaysCount > 0 ? row._sumPctEff / row._effDaysCount : 0,
    } as AggregatedRow;
  });

  // Sort descending by period, then by group name
  aggRows.sort((a, b) => {
    const periodComp = b.period.localeCompare(a.period);
    if (periodComp !== 0) return periodComp;
    return a.groupName.localeCompare(b.groupName);
  });

  // Calculate Table-level summaries
  const totalDaysAll = aggRows.reduce((sum, r) => sum + r.totalDays, 0);
  const totalLeavesAll = aggRows.reduce((sum, r) => sum + r.totalLeaves, 0);
  const totalOffDaysAll = aggRows.reduce((sum, r) => sum + r.totalOffDays, 0);
  const totalTypeAAll = aggRows.reduce((sum, r) => sum + r.totalTypeA, 0);
  const totalTypeBAll = aggRows.reduce((sum, r) => sum + r.totalTypeB, 0);
  const totalTypeCAll = aggRows.reduce((sum, r) => sum + r.totalTypeC, 0);
  const totalFoodAll = aggRows.reduce((sum, r) => sum + r.totalFood, 0);
  const totalCombinedAll = aggRows.reduce((sum, r) => sum + r.totalCombined, 0);
  const totalCnAAll = aggRows.reduce((sum, r) => sum + r.totalCnA, 0);
  const totalOnlyRslAll = aggRows.reduce((sum, r) => sum + r.totalOnlyRsl, 0);
  const totalMinsAll = aggRows.reduce((sum, r) => sum + r.totalMins, 0);
  const totalExtraAll = aggRows.reduce((sum, r) => sum + r.totalExtra, 0);
  const totalActProdAll = aggRows.reduce((sum, r) => sum + r.totalActProd, 0);
  const totalFinalProdAll = aggRows.reduce((sum, r) => sum + r.totalFinalProd, 0);
  const totalTargetAll = aggRows.reduce((sum, r) => sum + r.totalTarget, 0);
  const avgPctProdAll = aggRows.length > 0 ? aggRows.reduce((sum, r) => sum + r.avgPctProd, 0) / aggRows.length : 0;
  const avgPctEffAll = aggRows.length > 0 ? aggRows.reduce((sum, r) => sum + r.avgPctEff, 0) / aggRows.length : 0;

  // Custom multi-dimensional CSV exporter
  const handleDownloadCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    const freqTitle = selectedFreq.toUpperCase();
    const dimTitle = selectedDim.toUpperCase();

    // Determine row headings depending on the selected dimension
    let headings = ["Period Group", selectedDim === "individual" ? "Employee ID" : `${selectedDim} Name`];
    if (selectedDim === "individual") {
      headings = ["Period Group", "Employee ID", "Employee Name", "Team", "Department"];
    }

    const fullHeaders = [
      ...headings,
      "Leaves Total",
      "Off Days Total",
      "Total Target",
      "Actual Productivity",
      "Total Productivity",
      "Avg % Productivity",
      "Avg % Efficiency",
      "Short Ack with final commit (A)",
      "Only Short Ack (B)",
      "Final commit without Short Ack (C)",
      "Food sample (D)",
      "Combined sample",
      "C&A Sample",
      "Only RSL sample",
      "Total Minutes",
      "Total Extra Time"
    ];

    csvContent += fullHeaders.join(",") + "\n";

    aggRows.forEach((row) => {
      let rowData = [row.period, row.groupName];
      if (selectedDim === "individual") {
        rowData = [row.period, row.groupName, row.displayName || "", row.team || "", row.department || ""];
      }

      rowData = [
        ...rowData,
        row.totalLeaves.toString(),
        row.totalOffDays.toString(),
        row.totalTarget.toString(),
        row.totalActProd.toFixed(0),
        row.totalFinalProd.toFixed(0),
        row.avgPctProd.toFixed(1) + "%",
        row.avgPctEff.toFixed(1) + "%",
        row.totalTypeA.toString(),
        row.totalTypeB.toString(),
        row.totalTypeC.toString(),
        row.totalFood.toString(),
        row.totalCombined.toString(),
        row.totalCnA.toString(),
        row.totalOnlyRsl.toFixed(0),
        row.totalMins.toString(),
        row.totalExtra.toString()
      ];

      csvContent += rowData.map(val => `"${val.replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Productivity_Analysis_${freqTitle}_${dimTitle}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      
      {/* Title block */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-900 font-display flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            Consolidated Sheets Analysis
          </h3>
          <p className="text-xs text-slate-500 font-sans mt-0.5">
            Dynamic pivot analytics computed on historical daily ledger records.
          </p>
        </div>

        {/* Dynamic Controls / Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/50">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 font-sans">
              Frequency:
            </span>
            <div className="flex gap-0.5">
              {(["daily", "monthly", "yearly"] as const).map((freq) => (
                <button
                  key={freq}
                  onClick={() => setSelectedFreq(freq)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg cursor-pointer transition-all ${
                    selectedFreq === freq
                      ? "bg-white text-slate-900 shadow-3xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/50">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 font-sans">
              Dimension:
            </span>
            <div className="flex gap-0.5">
              {(["individual", "team", "department"] as const).map((dim) => (
                <button
                  key={dim}
                  onClick={() => setSelectedDim(dim)}
                  className={`px-3 py-1 text-[11px] font-semibold rounded-lg cursor-pointer transition-all ${
                    selectedDim === dim
                      ? "bg-white text-slate-900 shadow-3xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {dim.charAt(0).toUpperCase() + dim.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden hover:border-slate-300 transition-all font-sans cursor-pointer shadow-3xs"
            >
              <option value="ALL">All Teams</option>
              {uniqueTeams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden hover:border-slate-300 transition-all font-sans cursor-pointer shadow-3xs"
            >
              <option value="ALL">All Depts</option>
              {uniqueDepts.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {selectedFreq === "daily" && (
              <div className="relative flex items-center gap-1 min-w-[140px] max-w-[205px]">
                {dateFilterMode === "dropdown" ? (
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="px-2.5 py-1.5 w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden hover:border-slate-300 transition-all font-sans cursor-pointer shadow-3xs h-[32px]"
                  >
                    <option value="ALL">All Days</option>
                    {uniqueDates.map((d) => {
                      let formatted = d;
                      try {
                        const parts = d.split("-");
                        if (parts.length === 3) {
                          const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                          formatted = dateObj.toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          });
                        }
                      } catch (e) {
                        // Fallback
                      }
                      return (
                        <option key={d} value={d}>
                          {formatted}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="relative w-full">
                    <input
                      type="date"
                      value={dateFilter === "ALL" ? "" : dateFilter}
                      onChange={(e) => setDateFilter(e.target.value || "ALL")}
                      className="px-2.5 py-1.5 w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden hover:border-slate-300 transition-all font-sans h-[32px]"
                    />
                    {dateFilter !== "ALL" && (
                      <button
                        type="button"
                        onClick={() => setDateFilter("ALL")}
                        className="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold hover:bg-slate-100 rounded-md p-0.5 text-[10px] w-4 h-4 flex items-center justify-center transition-all"
                        title="Clear Filter"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {/* Switcher button */}
                <button
                  type="button"
                  onClick={() => setDateFilterMode((m) => m === "dropdown" ? "calendar" : "dropdown")}
                  className="flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl w-8 h-[32px] shrink-0 transition-all cursor-pointer shadow-3xs"
                  title={dateFilterMode === "dropdown" ? "Switch to Calendar Picker" : "Switch to Dropdown List"}
                >
                  {dateFilterMode === "dropdown" ? (
                    <Calendar className="w-3.5 h-3.5" />
                  ) : (
                    <Filter className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}

            {selectedFreq === "monthly" && (
              <div className="relative flex items-center gap-1 min-w-[140px] max-w-[205px]">
                {monthFilterMode === "dropdown" ? (
                  <select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="px-2.5 py-1.5 w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden hover:border-slate-300 transition-all font-sans cursor-pointer shadow-3xs h-[32px]"
                  >
                    <option value="ALL">All Months</option>
                    {uniqueMonths.map((mo) => {
                      let formatted = mo;
                      try {
                        const parts = mo.split("-");
                        if (parts.length === 2) {
                          const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
                          formatted = dateObj.toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric"
                          });
                        }
                      } catch (e) {
                        // Fallback
                      }
                      return (
                        <option key={mo} value={mo}>
                          {formatted}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="relative w-full">
                    <input
                      type="month"
                      value={monthFilter === "ALL" ? "" : monthFilter}
                      onChange={(e) => setMonthFilter(e.target.value || "ALL")}
                      className="px-2.5 py-1.5 w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden hover:border-slate-300 transition-all font-sans h-[32px]"
                    />
                    {monthFilter !== "ALL" && (
                      <button
                        type="button"
                        onClick={() => setMonthFilter("ALL")}
                        className="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold hover:bg-slate-100 rounded-md p-0.5 text-[10px] w-4 h-4 flex items-center justify-center transition-all"
                        title="Clear Filter"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {/* Switcher button */}
                <button
                  type="button"
                  onClick={() => setMonthFilterMode((m) => m === "dropdown" ? "calendar" : "dropdown")}
                  className="flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl w-8 h-[32px] shrink-0 transition-all cursor-pointer shadow-3xs"
                  title={monthFilterMode === "dropdown" ? "Switch to Calendar Picker" : "Switch to Dropdown List"}
                >
                  {monthFilterMode === "dropdown" ? (
                    <Calendar className="w-3.5 h-3.5" />
                  ) : (
                    <Filter className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}

            {selectedFreq === "yearly" && (
              <div className="relative flex items-center gap-1 min-w-[140px] max-w-[205px]">
                {yearFilterMode === "dropdown" ? (
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="px-2.5 py-1.5 w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden hover:border-slate-300 transition-all font-sans cursor-pointer shadow-3xs h-[32px]"
                  >
                    <option value="ALL">All Years</option>
                    {uniqueYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="relative w-full">
                    <input
                      type="number"
                      min="2000"
                      max="2099"
                      placeholder="YYYY"
                      value={yearFilter === "ALL" ? "" : yearFilter}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.length <= 4) {
                          setYearFilter(val || "ALL");
                        }
                      }}
                      className="px-2.5 py-1.5 w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden hover:border-slate-300 transition-all font-sans h-[32px]"
                    />
                    {yearFilter !== "ALL" && (
                      <button
                        type="button"
                        onClick={() => setYearFilter("ALL")}
                        className="absolute right-7 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold hover:bg-slate-100 rounded-md p-0.5 text-[10px] w-4 h-4 flex items-center justify-center transition-all"
                        title="Clear Filter"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {/* Switcher button */}
                <button
                  type="button"
                  onClick={() => setYearFilterMode((m) => m === "dropdown" ? "calendar" : "dropdown")}
                  className="flex items-center justify-center border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-xl w-8 h-[32px] shrink-0 transition-all cursor-pointer shadow-3xs"
                  title={yearFilterMode === "dropdown" ? "Switch to Manual Input" : "Switch to Dropdown List"}
                >
                  {yearFilterMode === "dropdown" ? (
                    <Calendar className="w-3.5 h-3.5" />
                  ) : (
                    <Filter className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}

            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all cursor-pointer font-sans h-[32px]"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Aggregate Report Content Grid Table */}
      <div className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse font-mono">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="p-3">Period</th>
                <th className="p-3">
                  {selectedDim === "individual" ? "Employee ID" : `${selectedDim.charAt(0).toUpperCase() + selectedDim.slice(1)} Name`}
                </th>
                {selectedDim === "individual" && (
                  <>
                    <th className="p-3">Full Name</th>
                    <th className="p-3">Team</th>
                    <th className="p-3">Department</th>
                  </>
                )}
                <th className="p-3 text-center bg-teal-50/50 text-teal-900">Leaves</th>
                <th className="p-3 text-center bg-teal-50/50 text-teal-900">Off Days</th>
                <th className="p-3 text-center bg-indigo-100 text-indigo-950 font-extrabold text-[11px] leading-tight max-w-[90px] whitespace-normal">Actual<br />productivity</th>
                <th className="p-3 text-center bg-emerald-100 text-emerald-950 font-extrabold text-[11px] leading-tight max-w-[90px] whitespace-normal">Total<br />productivity</th>
                <th className="p-3 text-center font-bold text-slate-700 whitespace-nowrap">% Prod</th>
                <th className="p-3 text-center font-extrabold text-purple-950 bg-purple-100/75 whitespace-nowrap">% Eff</th>
                <th className="p-3 text-center" title="Short Acknowledgement with final commit font">Short Ack+Commit (A)</th>
                <th className="p-3 text-center" title="Only Short Acknowledgement">Only Short Ack (B)</th>
                <th className="p-3 text-center" title="Final commit without Short Acknowledgement">Commit w/o Ack (C)</th>
                <th className="p-3 text-center">Food (D)</th>
                <th className="p-3 text-center">Combined</th>
                <th className="p-3 text-center">C&A Sample</th>
                <th className="p-3 text-center bg-emerald-50 text-emerald-950 font-bold">Only RSL</th>
                <th className="p-3 text-center bg-sky-50 text-sky-950 font-bold">Minutes</th>
                <th className="p-3 text-center bg-amber-50 text-amber-950 font-bold">Extra Mins</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aggRows.length === 0 ? (
                <tr>
                  <td colSpan={23} className="p-8 text-center text-slate-400 font-sans">
                    No logs directory match for the active filters.
                  </td>
                </tr>
              ) : (
                aggRows.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50 transition-all font-mono">
                    <td className="p-3 font-semibold text-slate-900">{row.period}</td>
                    <td className="p-3 font-bold text-slate-700">{row.groupName}</td>
                    {selectedDim === "individual" && (
                      <>
                        <td className="p-3 font-sans text-slate-900 whitespace-nowrap">{row.displayName}</td>
                        <td className="p-3 font-sans text-slate-500 whitespace-nowrap">{row.team}</td>
                        <td className="p-3 font-sans text-slate-500 whitespace-nowrap">{row.department}</td>
                      </>
                    )}
                    <td className="p-3 text-center bg-teal-50/20 font-semibold text-teal-800">{row.totalLeaves}</td>
                    <td className="p-3 text-center bg-teal-50/20 font-semibold text-teal-800">{row.totalOffDays}</td>
                    <td className="p-3 text-center bg-indigo-50/30 text-indigo-950 font-bold">{row.totalActProd.toFixed(0)}</td>
                    <td className="p-3 text-center bg-emerald-50/30 text-emerald-950 font-extrabold">{row.totalFinalProd.toFixed(0)}</td>
                    <td className="p-3 text-center font-bold text-slate-700">{row.avgPctProd.toFixed(1)}%</td>
                    <td className="p-3 text-center font-extrabold text-emerald-600">{row.avgPctEff.toFixed(1)}%</td>
                    <td className="p-3 text-center text-slate-600">{row.totalTypeA}</td>
                    <td className="p-3 text-center text-slate-600">{row.totalTypeB}</td>
                    <td className="p-3 text-center text-slate-600">{row.totalTypeC}</td>
                    <td className="p-3 text-center text-slate-600">{row.totalFood}</td>
                    <td className="p-3 text-center text-slate-600">{row.totalCombined}</td>
                    <td className="p-3 text-center text-slate-600">{row.totalCnA}</td>
                    <td className="p-3 text-center bg-emerald-50/20 text-emerald-900 font-medium">{(row.totalOnlyRsl || 0).toFixed(0)}</td>
                    <td className="p-3 text-center bg-sky-50/20 text-sky-900 font-medium">{row.totalMins}m</td>
                    <td className="p-3 text-center bg-amber-50/20 text-amber-900 font-medium">{row.totalExtra}m</td>
                  </tr>
                ))
              )}
            </tbody>
            {aggRows.length > 0 && (
              <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-semibold text-slate-900 font-mono">
                <tr className="hover:bg-slate-200 transition-colors">
                  <td className="p-3 font-bold text-slate-900">Grand Total</td>
                  <td className="p-3 font-bold text-slate-700">-</td>
                  {selectedDim === "individual" && (
                    <>
                      <td className="p-3"></td>
                      <td className="p-3"></td>
                      <td className="p-3"></td>
                    </>
                  )}
                  <td className="p-3 text-center bg-teal-150/40 text-teal-900 font-bold">{totalLeavesAll}</td>
                  <td className="p-3 text-center bg-teal-150/40 text-teal-900 font-bold">{totalOffDaysAll}</td>
                  <td className="p-3 text-center bg-indigo-100/60 text-indigo-950 font-bold text-indigo-900">{totalActProdAll.toFixed(0)}</td>
                  <td className="p-3 text-center bg-emerald-100/60 text-emerald-950 font-extrabold">{totalFinalProdAll.toFixed(0)}</td>
                  <td className="p-3 text-center text-slate-900 font-bold">{avgPctProdAll.toFixed(1)}%</td>
                  <td className="p-3 text-center text-emerald-700 font-extrabold">{avgPctEffAll.toFixed(1)}%</td>
                  <td className="p-3 text-center text-slate-700">{totalTypeAAll}</td>
                  <td className="p-3 text-center text-slate-700">{totalTypeBAll}</td>
                  <td className="p-3 text-center text-slate-700">{totalTypeCAll}</td>
                  <td className="p-3 text-center text-slate-700">{totalFoodAll}</td>
                  <td className="p-3 text-center text-slate-700">{totalCombinedAll}</td>
                  <td className="p-3 text-center text-slate-700">{totalCnAAll}</td>
                  <td className="p-3 text-center bg-emerald-100/50 text-emerald-950 font-bold">{totalOnlyRslAll.toFixed(0)}</td>
                  <td className="p-3 text-center bg-sky-100/50 text-sky-900 font-bold">{totalMinsAll}</td>
                  <td className="p-3 text-center bg-amber-100/50 text-amber-900 font-bold">{totalExtraAll}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      
    </div>
  );
}
