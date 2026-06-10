import React, { useState } from "react";
import { DailyLog, Employee } from "../types";
import { Award, TrendingUp, Calendar, Users, Activity, Filter, RefreshCw, Trophy, Crown, Medal } from "lucide-react";
import { GOVERNMENT_HOLIDAYS_2026 } from "../utils/productivity";

interface MetricCardsProps {
  logs: DailyLog[];
  employees?: Employee[];
  simulatedToday?: string;
  onSimulatedTodayChange?: (val: string) => void;
}

export default function MetricCards({ logs, employees = [], simulatedToday, onSimulatedTodayChange }: MetricCardsProps) {
  // Filter States
  const [filterType, setFilterType] = useState<"all" | "individual" | "team" | "department">("all");
  const [selectedId, setSelectedId] = useState<string>("ALL");
  const [timeScope, setTimeScope] = useState<"all" | "daily" | "monthly" | "yearly">("all");

  // Top Performers highlight panel settings
  const [performersMode, setPerformersMode] = useState<"overall" | "team">("overall");
  const [performersSelectedTeam, setPerformersSelectedTeam] = useState<string>("");

  const getEmployeeTeam = (empId: string) => {
    const emp = employees.find((e) => e.id.toUpperCase() === empId.toUpperCase());
    return emp?.team || "Team Alpha";
  };

  const getEmployeeDept = (empId: string) => {
    const emp = employees.find((e) => e.id.toUpperCase() === empId.toUpperCase());
    return emp?.department || "Assembly";
  };

  // Convert a YYYY-MM-DD date string to human readable label based on time scope selected
  const getFormattedScopeLabel = (scope: "all" | "daily" | "monthly" | "yearly", dateStr?: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const year = parts[0];
    const monthNum = parseInt(parts[1], 10);
    const dayNum = parseInt(parts[2], 10);
    
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const monthName = monthNames[monthNum - 1] || parts[1];

    if (scope === "daily") {
      return `${monthName} ${dayNum}, ${year}`;
    }
    if (scope === "monthly") {
      return `${monthName} ${year}`;
    }
    if (scope === "yearly") {
      return `${year}`;
    }
    return "All Records";
  };

  // Extract unique elements for selectors
  const uniqueEmployees = Array.from(
    new Map(employees.map((e) => [e.id.toUpperCase(), e])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const uniqueTeams = Array.from(
    new Set(employees.map((e) => e.team || "Team Alpha"))
  ).sort();

  const uniqueDepartments = Array.from(
    new Set(employees.map((e) => e.department || "Assembly"))
  ).sort();

  // Reset target selection when type changes
  const handleFilterTypeChange = (type: "all" | "individual" | "team" | "department") => {
    setFilterType(type);
    setSelectedId("ALL");
  };

  // Filter logs based on time scope selection first
  const timeFilteredLogs = logs.filter((log) => {
    if (!simulatedToday) return true;
    if (timeScope === "all") return true;
    
    if (timeScope === "daily") {
      return log.date === simulatedToday;
    }
    
    if (timeScope === "monthly") {
      const logYearMonth = log.date.substring(0, 7); // "YYYY-MM"
      const refYearMonth = simulatedToday.substring(0, 7);
      return logYearMonth === refYearMonth;
    }
    
    if (timeScope === "yearly") {
      const logYear = log.date.substring(0, 4); // "YYYY"
      const refYear = simulatedToday.substring(0, 4);
      return logYear === refYear;
    }
    
    return true;
  });

  // Filter logs based on selection focus second
  const filteredLogs = timeFilteredLogs.filter((log) => {
    if (filterType === "all") return true;
    
    if (filterType === "individual") {
      if (selectedId === "ALL") return true;
      return log.id.toUpperCase() === selectedId.toUpperCase();
    }
    
    if (filterType === "team") {
      if (selectedId === "ALL") return true;
      const team = getEmployeeTeam(log.id);
      return team.toLowerCase() === selectedId.toLowerCase();
    }
    
    if (filterType === "department") {
      if (selectedId === "ALL") return true;
      const dept = getEmployeeDept(log.id);
      return dept.toLowerCase() === selectedId.toLowerCase();
    }
    
    return true;
  });

  // KPI Calculations on the filtered set
  const totalLogs = filteredLogs.length;
  const filteredStaffCount = new Set(filteredLogs.map((log) => log.id)).size;

  const totalFinalProd = filteredLogs.reduce((sum, log) => sum + (log.finalProd || 0), 0);

  // Exclude leave days, unworked holiday days, unworked off days, and days with 0 total productivity when calculating average productivity percentage
  const logsForProductivity = filteredLogs.filter((log) => {
    const isHolidayOff = GOVERNMENT_HOLIDAYS_2026.has(log.date) && (!log.inTime || !log.outTime);
    const isOffdayOff = log.isOffDay && (!log.inTime || !log.outTime);
    return !log.isLeave && !log.isWastewater && !isHolidayOff && !isOffdayOff && (log.finalProd || 0) > 0;
  });
  const avgProductivity =
    logsForProductivity.length > 0
      ? logsForProductivity.reduce((sum, log) => sum + (log.pctProd || 0), 0) / logsForProductivity.length
      : 0;

  // Average efficiency only for records where they actually worked (workMins > 0) or off day duty counting style, excluding holiday offs, unworked off days, and days with 0 total productivity
  const logsWithTime = filteredLogs.filter((log) => {
    const isHolidayOff = GOVERNMENT_HOLIDAYS_2026.has(log.date) && (!log.inTime || !log.outTime);
    const isOffdayOff = log.isOffDay && (!log.inTime || !log.outTime);
    return !log.isLeave && !log.isWastewater && !isHolidayOff && !isOffdayOff && (log.workMins > 0 || log.isOffDay) && (log.finalProd || 0) > 0;
  });
  const avgEfficiency =
    logsWithTime.length > 0
      ? logsWithTime.reduce((sum, log) => sum + (log.pctEff || 0), 0) / logsWithTime.length
      : 0;

  const totalExtraMins = filteredLogs.reduce((sum, log) => sum + (log.extra || 0), 0);
  const extraHours = Math.floor(totalExtraMins / 60);
  const extraMinsRemaining = totalExtraMins % 60;

  const totalOffDays = filteredLogs.filter((log) => log.isOffDay && (!log.inTime || !log.outTime)).length;
  const totalLeaveDays = filteredLogs.filter((log) => log.isLeave).length;

  const activePerformantTeam = performersSelectedTeam || uniqueTeams[0] || "RSL German";

  // Calculation of Top Performers for Week, Month, Year
  const getTopPerformerForPeriod = (periodLogs: DailyLog[], teamFilter?: string) => {
    const groups: { [key: string]: DailyLog[] } = {};
    for (const log of periodLogs) {
      if (!groups[log.id]) {
        groups[log.id] = [];
      }
      groups[log.id].push(log);
    }

    const performersList = [];
    for (const empId of Object.keys(groups)) {
      const empLogs = groups[empId];
      const empInfo = employees.find(e => e.id.toUpperCase() === empId.toUpperCase());
      const team = empInfo?.team || empLogs[0]?.shiftName || "Team Alpha";

      if (teamFilter && team.toLowerCase() !== teamFilter.toLowerCase()) {
        continue;
      }

      // Filter out non-work entries (leaves, unworked off-days, unworked holidays)
      const workingLogs = empLogs.filter((log) => {
        const isHolidayOff = GOVERNMENT_HOLIDAYS_2026.has(log.date) && (!log.inTime || !log.outTime);
        const isOffdayOff = log.isOffDay && (!log.inTime || !log.outTime);
        return !log.isLeave && !log.isWastewater && !isHolidayOff && !isOffdayOff;
      });

      if (workingLogs.length === 0) continue;

      const totalPct = workingLogs.reduce((sum, log) => sum + (log.pctProd || 0), 0);
      const avgPct = totalPct / workingLogs.length;
      const totalProd = workingLogs.reduce((sum, log) => sum + (log.finalProd || 0), 0);

      const name = empInfo?.name || workingLogs[0]?.name || empId;

      performersList.push({
        id: empId,
        name,
        team,
        avgPct,
        totalProd,
        daysCount: workingLogs.length
      });
    }

    if (performersList.length === 0) return null;

    // Sort by avg Pct descending, then by total productivity descending as tiebreaker
    performersList.sort((a, b) => {
      if (Math.abs(b.avgPct - a.avgPct) < 0.01) {
        return b.totalProd - a.totalProd;
      }
      return b.avgPct - a.avgPct;
    });

    return performersList[0];
  };

  const getWeekLogs = () => {
    if (!simulatedToday) return [];
    const refDate = new Date(simulatedToday);
    const day = refDate.getDay();
    const diffToMonday = refDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(refDate);
    monday.setDate(diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return logs.filter((log) => {
      const d = new Date(log.date);
      return d >= monday && d <= sunday;
    });
  };

  const getMonthLogs = () => {
    if (!simulatedToday) return [];
    const prefix = simulatedToday.substring(0, 7); // "YYYY-MM"
    return logs.filter((log) => log.date.startsWith(prefix));
  };

  const getYearLogs = () => {
    if (!simulatedToday) return [];
    const prefix = simulatedToday.substring(0, 4); // "YYYY"
    return logs.filter((log) => log.date.startsWith(prefix));
  };

  const targetTeamFilter = performersMode === "team" ? activePerformantTeam : undefined;

  const weekTop = getTopPerformerForPeriod(getWeekLogs(), targetTeamFilter);
  const monthTop = getTopPerformerForPeriod(getMonthLogs(), targetTeamFilter);
  const yearTop = getTopPerformerForPeriod(getYearLogs(), targetTeamFilter);

  return (
    <div className="space-y-4 mb-6">
      {/* Filtering Selector Panel */}
      <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-3xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Card Focus Mode selection */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 font-sans flex items-center gap-1 shrink-0">
              <Filter className="w-3 h-3 text-slate-500" /> Card Focus Mode:
            </span>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 flex-wrap">
              <button
                onClick={() => handleFilterTypeChange("all")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  filterType === "all" ? "bg-white text-slate-900 shadow-3xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                🏢 Entire Company
              </button>
              <button
                onClick={() => handleFilterTypeChange("individual")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  filterType === "individual" ? "bg-white text-slate-900 shadow-3xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                👤 Individual
              </button>
              <button
                onClick={() => handleFilterTypeChange("team")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  filterType === "team" ? "bg-white text-slate-900 shadow-3xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                👥 Team
              </button>
              <button
                onClick={() => handleFilterTypeChange("department")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  filterType === "department" ? "bg-white text-slate-900 shadow-3xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                🏭 Department
              </button>
            </div>
          </div>

          {/* Time Scope selector (Daily, Monthly, Yearly) */}
          <div className="flex flex-wrap items-center gap-2 border-l border-slate-200 pl-0 lg:pl-4">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 font-sans flex items-center gap-1 shrink-0">
              <Calendar className="w-3 h-3 text-slate-500" /> Time Scope:
            </span>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 flex-wrap">
              <button
                onClick={() => setTimeScope("all")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  timeScope === "all" ? "bg-white text-slate-900 shadow-3xs" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                🌐 All Time
              </button>
              <button
                onClick={() => setTimeScope("daily")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  timeScope === "daily" ? "bg-white text-slate-900 shadow-3xs" : "text-slate-500 hover:text-slate-900"
                }`}
                title={`Daily metrics for ${getFormattedScopeLabel("daily", simulatedToday)}`}
              >
                📅 Daily
              </button>
              <button
                onClick={() => setTimeScope("monthly")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  timeScope === "monthly" ? "bg-white text-slate-900 shadow-3xs" : "text-slate-500 hover:text-slate-900"
                }`}
                title={`Monthly metrics for ${getFormattedScopeLabel("monthly", simulatedToday)}`}
              >
                📅 Monthly
              </button>
              <button
                onClick={() => setTimeScope("yearly")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  timeScope === "yearly" ? "bg-white text-slate-900 shadow-3xs" : "text-slate-500 hover:text-slate-900"
                }`}
                title={`Yearly metrics for ${getFormattedScopeLabel("yearly", simulatedToday)}`}
              >
                📅 Yearly
              </button>
            </div>

            {/* Dynamic scope indicator badge with editable date/month/year picker */}
            {timeScope !== "all" && (
              <div className="flex flex-wrap items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-950 font-bold px-2 py-1 rounded-lg font-sans text-[11px] shadow-3xs">
                <span className="text-[9px] text-indigo-650 font-extrabold uppercase mr-0.5 select-none tracking-wider font-sans">
                  Target {timeScope === "daily" ? "Date" : timeScope === "monthly" ? "Month" : "Year"}: 
                </span>
                {timeScope === "daily" && (
                  <input
                    type="date"
                    value={simulatedToday}
                    onChange={(e) => {
                      if (e.target.value && onSimulatedTodayChange) {
                        onSimulatedTodayChange(e.target.value);
                      }
                    }}
                    className="bg-white border border-indigo-150 text-[10px] font-bold text-indigo-950 px-1.5 py-0.5 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-hidden w-24 cursor-pointer font-mono shadow-3xs"
                    title="Click to edit the reference date!"
                  />
                )}
                {timeScope === "monthly" && (
                  <input
                    type="month"
                    value={simulatedToday ? simulatedToday.substring(0, 7) : ""}
                    onChange={(e) => {
                      if (e.target.value && onSimulatedTodayChange) {
                        const day = simulatedToday ? simulatedToday.split("-")[2] || "01" : "01";
                        onSimulatedTodayChange(`${e.target.value}-${day}`);
                      }
                    }}
                    className="bg-white border border-indigo-150 text-[10px] font-bold text-indigo-950 px-1.5 py-0.5 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-hidden w-28 cursor-pointer font-mono shadow-3xs"
                    title="Click to edit the reference month!"
                  />
                )}
                {timeScope === "yearly" && (
                  <select
                    value={simulatedToday ? simulatedToday.substring(0, 4) : "2026"}
                    onChange={(e) => {
                      if (e.target.value && onSimulatedTodayChange) {
                        const parts = simulatedToday ? simulatedToday.split("-") : ["2026", "06", "08"];
                        const month = parts[1] || "01";
                        const day = parts[2] || "01";
                        onSimulatedTodayChange(`${e.target.value}-${month}-${day}`);
                      }
                    }}
                    className="bg-white border border-indigo-150 text-[10px] font-bold text-indigo-950 px-1.5 py-0.5 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-hidden w-20 cursor-pointer font-mono shadow-3xs"
                    title="Select the reference year!"
                  >
                    {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                )}
                <span className="text-[10px] text-indigo-800 bg-indigo-100 bg-opacity-65 px-1.5 py-0.5 rounded-md font-extrabold font-sans select-none pointer-events-none whitespace-nowrap">
                  {getFormattedScopeLabel(timeScope, simulatedToday)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Level Targets Selector */}
        {filterType !== "all" && (
          <div className="flex items-center gap-2 w-full md:w-auto flex-grow justify-end">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Target Focus:</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-1.5 focus:outline-hidden transition-all max-w-[240px] truncate cursor-pointer shadow-3xs"
            >
              <option value="ALL">-- Select All Focus --</option>
              {filterType === "individual" &&
                uniqueEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.id})
                  </option>
                ))}
              {filterType === "team" &&
                uniqueTeams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              {filterType === "department" &&
                uniqueDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept} Department
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Grid of 5 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Productivity Card */}
        <div id="card-total-productivity" className="bg-white border border-slate-150 p-4.5 rounded-2xl shadow-3xs hover:shadow-2xs transition-all duration-300 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
              Total Productivity
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mt-1 font-display tracking-tight leading-none">
              {Math.round(totalFinalProd)}
            </h3>
            <p className="text-[10px] text-indigo-600 font-medium mt-1 flex items-center gap-1">
              <Activity className="w-3 h-3 shrink-0 animate-pulse" />
              Combined Raw Output
            </p>
          </div>
        </div>

        {/* Avg % Productivity Card (UPDATED REQUIREMENT) */}
        <div id="card-avg-productivity" className="bg-white border border-slate-150 p-4.5 rounded-2xl shadow-3xs hover:shadow-2xs transition-all duration-300 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
              Avg. % Productivity
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mt-1 font-display tracking-tight leading-none">
              {avgProductivity.toFixed(1)}%
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">
              Excludes leave entries
            </p>
          </div>
        </div>

        {/* Average Efficiency Card */}
        <div id="card-avg-efficiency" className="bg-white border border-slate-150 p-4.5 rounded-2xl shadow-3xs hover:shadow-2xs transition-all duration-300 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
              Avg. % Efficiency
            </span>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-lg shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mt-1 font-display tracking-tight leading-none">
              {avgEfficiency.toFixed(1)}%
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">
              Adjusted by minutes worked
            </p>
          </div>
        </div>

        {/* Extra Time Worked Card */}
        <div id="card-total-extra-time" className="bg-white border border-slate-150 p-4.5 rounded-2xl shadow-3xs hover:shadow-2xs transition-all duration-300 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
              Total Extra Time
            </span>
            <div className="p-2 bg-amber-50 text-amber-500 rounded-lg shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mt-1 font-display tracking-tight leading-none">
              {extraHours}h {extraMinsRemaining}m
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">
              Minutes worked &gt; 540m
            </p>
          </div>
        </div>

        {/* Active Team Directory Stats */}
        <div id="card-active-staff" className="bg-white border border-slate-150 p-4.5 rounded-2xl shadow-3xs hover:shadow-2xs transition-all duration-300 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
              Focused Staff pool
            </span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mt-1 font-display tracking-tight leading-none">
              {filteredStaffCount} <span className="text-xs font-normal text-slate-500">Staff</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-1 font-sans font-medium">
              {totalOffDays} Off Days | {totalLeaveDays} Leaves
            </p>
          </div>
        </div>
      </div>

      {/* Top Performers Highlight Block per user request */}
      <div id="top-performers-highlight" className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 mt-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-200/60 pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-sans">
              Top Performers of the Period
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Mode Switcher */}
            <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setPerformersMode("overall")}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  performersMode === "overall"
                    ? "bg-white text-indigo-600 shadow-3xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Overall (Entire Company)
              </button>
              <button
                onClick={() => setPerformersMode("team")}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  performersMode === "team"
                    ? "bg-white text-indigo-600 shadow-3xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Team-Wise
              </button>
            </div>

            {/* Team Dropdown */}
            {performersMode === "team" && (
              <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
                <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Team:</span>
                <select
                  value={activePerformantTeam}
                  onChange={(e) => setPerformersSelectedTeam(e.target.value)}
                  className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-hidden focus:border-indigo-500 text-slate-700"
                >
                  {uniqueTeams.map((teamName) => (
                    <option key={teamName} value={teamName}>
                      {teamName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Weekly Performer */}
          <div className="bg-white border border-slate-150 p-3.5 rounded-xl shadow-3xs flex items-center justify-between gap-3 relative overflow-hidden group hover:border-amber-300 transition-all duration-300">
            <div className="space-y-1 relative z-10 w-full overflow-hidden">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                Top Performer of the Week
              </span>
              {weekTop ? (
                <>
                  <h4 className="text-sm font-bold text-slate-900 truncate pr-4 font-sans">{weekTop.name}</h4>
                  <p className="text-[10px] text-slate-500 font-medium font-sans truncate pr-4">{weekTop.team} ({weekTop.id})</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-100 font-sans">
                      ★ {weekTop.avgPct.toFixed(1)}% Avg
                    </span>
                    <span className="text-[9px] text-slate-400 font-sans">({weekTop.daysCount} active days)</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400 italic font-sans py-1">No logs in this week range</p>
              )}
            </div>
            {weekTop && (
              <div className="p-2 bg-amber-50 text-amber-500 rounded-xl shrink-0 border border-amber-100 shadow-3xs group-hover:bg-amber-100 group-hover:scale-105 transition-all duration-300">
                <Crown className="w-5 h-5 text-amber-500" />
              </div>
            )}
          </div>

          {/* Monthly Performer */}
          <div className="bg-white border border-slate-150 p-3.5 rounded-xl shadow-3xs flex items-center justify-between gap-3 relative overflow-hidden group hover:border-emerald-300 transition-all duration-300">
            <div className="space-y-1 relative z-10 w-full overflow-hidden">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                Top Performer of the Month
              </span>
              {monthTop ? (
                <>
                  <h4 className="text-sm font-bold text-slate-900 truncate pr-4 font-sans">{monthTop.name}</h4>
                  <p className="text-[10px] text-slate-500 font-medium font-sans truncate pr-4">{monthTop.team} ({monthTop.id})</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100 font-sans">
                      ★ {monthTop.avgPct.toFixed(1)}% Avg
                    </span>
                    <span className="text-[9px] text-slate-400 font-sans">({monthTop.daysCount} active days)</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400 italic font-sans py-1">No logs in this month range</p>
              )}
            </div>
            {monthTop && (
              <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl shrink-0 border border-emerald-100 shadow-3xs group-hover:bg-emerald-100 group-hover:scale-105 transition-all duration-300">
                <Trophy className="w-5 h-5 text-emerald-500" />
              </div>
            )}
          </div>

          {/* Yearly Performer */}
          <div className="bg-white border border-slate-150 p-3.5 rounded-xl shadow-3xs flex items-center justify-between gap-3 relative overflow-hidden group hover:border-indigo-300 transition-all duration-300">
            <div className="space-y-1 relative z-10 w-full overflow-hidden">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-sans">
                Top Performer of the Year
              </span>
              {yearTop ? (
                <>
                  <h4 className="text-sm font-bold text-slate-900 truncate pr-4 font-sans">{yearTop.name}</h4>
                  <p className="text-[10px] text-slate-500 font-medium font-sans truncate pr-4">{yearTop.team} ({yearTop.id})</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100 font-sans">
                      ★ {yearTop.avgPct.toFixed(1)}% Avg
                    </span>
                    <span className="text-[9px] text-slate-400 font-sans">({yearTop.daysCount} active days)</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-400 italic font-sans py-1">No logs in this year range</p>
              )}
            </div>
            {yearTop && (
              <div className="p-2 bg-indigo-50 text-indigo-500 rounded-xl shrink-0 border border-indigo-100 shadow-3xs group-hover:bg-indigo-100 group-hover:scale-105 transition-all duration-300">
                <Medal className="w-5 h-5 text-indigo-500" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
