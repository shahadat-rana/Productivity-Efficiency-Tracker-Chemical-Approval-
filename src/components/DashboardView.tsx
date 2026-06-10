import React, { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { 
  TrendingUp, 
  BarChart2, 
  PieChart as PieIcon, 
  Calendar, 
  Users, 
  Layers, 
  Sparkles,
  SlidersHorizontal,
  ChevronRight,
  Info,
  AlertTriangle,
  AlertCircle,
  TrendingDown,
  Search,
  Bell,
  CheckCircle,
  Eye,
  X,
  Mail,
  Terminal,
  Activity,
  Settings,
  Lock,
  Send,
  Check,
  Loader2
} from "lucide-react";

import { DailyLog, Employee, EmailNotification } from "../types";

interface DashboardViewProps {
  logs: DailyLog[];
  employees?: Employee[];
  supervisors?: Record<string, { name: string; email: string }>;
  mailNotifications?: EmailNotification[];
  onClearMailNotifications?: () => void;
  onDeleteMailNotification?: (id: string, logUid?: string) => void;
  onSendMailNotification?: (id: string) => void;
  autoDispatchEnabled?: boolean;
  onToggleAutoDispatch?: () => void;
}

import { GOVERNMENT_HOLIDAYS_2026 } from "../utils/productivity";

export default function DashboardView({
  logs,
  employees = [],
  supervisors = {},
  mailNotifications = [],
  onClearMailNotifications,
  onDeleteMailNotification,
  onSendMailNotification,
  autoDispatchEnabled = false,
  onToggleAutoDispatch
}: DashboardViewProps) {
  // Analytical Dimensions
  const [selectedFreq, setSelectedFreq] = useState<"daily" | "monthly" | "yearly">("daily");
  const [selectedDim, setSelectedDim] = useState<"individual" | "team" | "department">("individual");
  const [chartType, setChartType] = useState<"line" | "bar">("line");

  // Alert Center States
  const [alertsFilter, setAlertsFilter] = useState<"all" | "critical" | "team" | "individual">("all");
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  // Specific filters depending on selectedDim
  const [targetEmp, setTargetEmp] = useState<string>("ALL");
  const [targetTeam, setTargetTeam] = useState<string>("Team Alpha");
  const [targetDept, setTargetDept] = useState<string>("Assembly");

  // Metric selector for multi-member comparison
  const [selectedMetric, setSelectedMetric] = useState<"finalProd" | "actProd" | "onlyRslSample">("finalProd");

  const [expandedSmtpIds, setExpandedSmtpIds] = useState<string[]>([]);
  const toggleSmtpLog = (id: string) => {
    setExpandedSmtpIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Dedicated SMTP Server Relaying State for Background Emails
  const [smtpConfig, setSmtpConfig] = useState(() => {
    const saved = localStorage.getItem("productivity_smtp_config_v2");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      host: "",
      port: 587,
      secure: false,
      user: "",
      pass: "",
      fromName: "Compliance Alerts",
      fromEmail: "alerts@productivity-portal.com"
    };
  });
  const [showSmtpSettings, setShowSmtpSettings] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [smtpMessage, setSmtpMessage] = useState<string | null>(null);
  const [showSmtpPass, setShowSmtpPass] = useState(false);

  // Dedicated Resend REST API Configuration State
  const [resendConfig, setResendConfig] = useState(() => {
    const saved = localStorage.getItem("productivity_resend_config_v3");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      apiKey: "",
      fromEmail: "onboarding@resend.dev"
    };
  });
  const [showResendPass, setShowResendPass] = useState(false);
  const [activeChannelTab, setActiveChannelTab] = useState<"smtp" | "resend">(() => {
    const savedSmtp = localStorage.getItem("productivity_smtp_config_v2");
    const savedResend = localStorage.getItem("productivity_resend_config_v3");
    if (savedResend && !savedSmtp) {
      try {
        const parsed = JSON.parse(savedResend);
        if (parsed.apiKey) return "resend";
      } catch (e) {}
    }
    return "smtp";
  });

  const saveSmtpConfig = (newConfig: any) => {
    setSavingSmtp(true);
    setSmtpConfig(newConfig);
    localStorage.setItem("productivity_smtp_config_v2", JSON.stringify(newConfig));
    setTimeout(() => {
      setSavingSmtp(false);
      setSmtpMessage("✔ Server-side SMTP credentials synchronized successfully!");
      setTimeout(() => setSmtpMessage(null), 3000);
    }, 600);
  };

  const saveResendConfig = (newConfig: any) => {
    setSavingSmtp(true);
    setResendConfig(newConfig);
    localStorage.setItem("productivity_resend_config_v3", JSON.stringify(newConfig));
    setTimeout(() => {
      setSavingSmtp(false);
      setSmtpMessage("✔ Server-side Resend API Configuration synchronized successfully!");
      setTimeout(() => setSmtpMessage(null), 3000);
    }, 600);
  };

  // Helpers to get Employee information
  const getEmployeeTeam = (empId: string) => {
    const emp = employees.find((e) => e.id.toUpperCase() === empId.toUpperCase());
    return emp?.team || "Team Alpha";
  };

  const getEmployeeDept = (empId: string) => {
    const emp = employees.find((e) => e.id.toUpperCase() === empId.toUpperCase());
    return emp?.department || "Assembly";
  };

  const getEmployeeName = (empId: string) => {
    const emp = employees.find((e) => e.id.toUpperCase() === empId.toUpperCase());
    return emp?.name || empId;
  };

  // Get dynamic collections built across both active registry & logs indices
  const uniqueTeams = Array.from(new Set([
    ...employees.map((e) => e.team || "Team Alpha"),
    ...logs.map((l) => getEmployeeTeam(l.id))
  ])).filter(Boolean).sort();

  const uniqueDepts = Array.from(new Set([
    ...employees.map((e) => e.department || "Assembly"),
    ...logs.map((l) => getEmployeeDept(l.id))
  ])).filter(Boolean).sort();

  const uniqueEmps = Array.from(new Set([
    ...employees.map((e) => e.id),
    ...logs.map((l) => l.id)
  ])).filter(Boolean).sort();

  // ----------------------------------------------------
  // Compute Underperformance Alerts (< 100%)
  // ----------------------------------------------------
  const alertsList = React.useMemo(() => {
    const list: Array<{
      id: string;
      rawId: string;
      type: "individual" | "team";
      name: string;
      team?: string;
      dept?: string;
      avgProd: number;
      avgEff: number;
      isProdBelow: boolean;
      isEffBelow: boolean;
      severity: "critical" | "warning";
    }> = [];

    // Calculate for Teams
    uniqueTeams.forEach((teamName) => {
      const teamLogs = logs.filter((l) => getEmployeeTeam(l.id).toLowerCase() === teamName.toLowerCase());
      const nonLeaveLogs = teamLogs.filter((l) => {
        const isHolidayOff = GOVERNMENT_HOLIDAYS_2026.has(l.date) && (!l.inTime || !l.outTime);
        const isOffdayOff = l.isOffDay && (!l.inTime || !l.outTime);
        return !l.isLeave && !l.isWastewater && !isHolidayOff && !isOffdayOff;
      });
      if (nonLeaveLogs.length === 0) return;

      const prodLogs = nonLeaveLogs.filter(l => (l.finalProd || 0) > 0);
      const avgProd = prodLogs.length > 0 ? prodLogs.reduce((acc, l) => acc + (l.pctProd || 0), 0) / prodLogs.length : 0;

      const timeLogs = nonLeaveLogs.filter((l) => (l.workMins > 0 || l.isOffDay) && (l.finalProd || 0) > 0);
      const avgEff = timeLogs.length > 0 ? timeLogs.reduce((acc, l) => acc + (l.pctEff || 0), 0) / timeLogs.length : 0;

      if (avgProd < 100 || avgEff < 100) {
        list.push({
          id: `team-${teamName}`,
          rawId: teamName,
          type: "team",
          name: `${teamName}`,
          team: teamName,
          avgProd,
          avgEff,
          isProdBelow: avgProd < 100,
          isEffBelow: avgEff < 100,
          severity: (avgProd < 100 && avgEff < 100) ? "critical" : "warning",
        });
      }
    });

    // Calculate for Individuals
    uniqueEmps.forEach((empId) => {
      const empLogs = logs.filter((l) => l.id.toUpperCase() === empId.toUpperCase());
      const nonLeaveLogs = empLogs.filter((l) => {
        const isHolidayOff = GOVERNMENT_HOLIDAYS_2026.has(l.date) && (!l.inTime || !l.outTime);
        const isOffdayOff = l.isOffDay && (!l.inTime || !l.outTime);
        return !l.isLeave && !l.isWastewater && !isHolidayOff && !isOffdayOff;
      });
      if (nonLeaveLogs.length === 0) return;

      const prodLogs = nonLeaveLogs.filter(l => (l.finalProd || 0) > 0);
      const avgProd = prodLogs.length > 0 ? prodLogs.reduce((acc, l) => acc + (l.pctProd || 0), 0) / prodLogs.length : 0;

      const timeLogs = nonLeaveLogs.filter((l) => (l.workMins > 0 || l.isOffDay) && (l.finalProd || 0) > 0);
      const avgEff = timeLogs.length > 0 ? timeLogs.reduce((acc, l) => acc + (l.pctEff || 0), 0) / timeLogs.length : 0;

      if (avgProd < 100 || avgEff < 100) {
        list.push({
          id: `emp-${empId}`,
          rawId: empId,
          type: "individual",
          name: getEmployeeName(empId),
          team: getEmployeeTeam(empId),
          dept: getEmployeeDept(empId),
          avgProd,
          avgEff,
          isProdBelow: avgProd < 100,
          isEffBelow: avgEff < 100,
          severity: (avgProd < 100 && avgEff < 100) ? "critical" : "warning",
        });
      }
    });

    // Sort: critical first, then lowest overall score
    return list.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === "critical" ? -1 : 1;
      }
      return Math.min(a.avgProd, a.avgEff) - Math.min(b.avgProd, b.avgEff);
    });
  }, [logs, employees, uniqueTeams, uniqueEmps]);

  const activeAlerts = React.useMemo(() => {
    return alertsList.filter((a) => {
      if (dismissedAlerts.includes(a.id)) return false;
      if (alertsFilter === "critical") return a.severity === "critical";
      if (alertsFilter === "team") return a.type === "team";
      if (alertsFilter === "individual") return a.type === "individual";
      return true;
    });
  }, [alertsList, dismissedAlerts, alertsFilter]);

  const totalCount = React.useMemo(() => alertsList.filter((a) => !dismissedAlerts.includes(a.id)).length, [alertsList, dismissedAlerts]);
  const criticalCount = React.useMemo(() => alertsList.filter((a) => !dismissedAlerts.includes(a.id) && a.severity === "critical").length, [alertsList, dismissedAlerts]);
  const teamCount = React.useMemo(() => alertsList.filter((a) => !dismissedAlerts.includes(a.id) && a.type === "team").length, [alertsList, dismissedAlerts]);
  const individualCount = React.useMemo(() => alertsList.filter((a) => !dismissedAlerts.includes(a.id) && a.type === "individual").length, [alertsList, dismissedAlerts]);

  const handleAlertFocus = (alertItem: typeof alertsList[0]) => {
    if (alertItem.type === "team") {
      setSelectedDim("team");
      setTargetTeam(alertItem.rawId);
    } else {
      setSelectedDim("individual");
      setTargetEmp(alertItem.rawId);
    }
    const element = document.getElementById("supervisor-pivot-section");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  // ----------------------------------------------------
  // Aggregate Multi-Dimensional Dataset for Recharts
  // ----------------------------------------------------
  const periodMap: { [period: string]: { [key: string]: any } } = {};

  logs.forEach((log) => {
    // 1. Establish period grouping string
    let period = log.date;
    if (selectedFreq === "monthly") {
      period = log.date.substring(0, 7); // YYYY-MM
    } else if (selectedFreq === "yearly") {
      period = log.date.substring(0, 4); // YYYY
    }

    if (!periodMap[period]) {
      periodMap[period] = { period };
    }

    const empId = log.id;
    const team = getEmployeeTeam(empId);
    const dept = getEmployeeDept(empId);

    // Get metric value
    let val = 0;
    if (selectedMetric === "finalProd") val = log.finalProd;
    else if (selectedMetric === "actProd") val = log.actProd;
    else if (selectedMetric === "onlyRslSample") val = log.onlyRslSample;

    // Convert values to rounded numbers
    const finalVal = Math.round(val);

    // Apply specific logic based on selected dimension
    if (selectedDim === "individual") {
      if (targetEmp === "ALL") {
        // Multi-member compare: plot every employee as a distinct line
        // Accumulate in case they have multiple keys in the same month/year period
        periodMap[period][empId] = (periodMap[period][empId] || 0) + finalVal;
      } else if (empId.toUpperCase() === targetEmp.toUpperCase()) {
        // Single employee selected: we show all three metrics!
        periodMap[period]["Total Productivity"] = (periodMap[period]["Total Productivity"] || 0) + Math.round(log.finalProd);
        periodMap[period]["Actual Productivity"] = (periodMap[period]["Actual Productivity"] || 0) + Math.round(log.actProd);
        periodMap[period]["Only RSL"] = (periodMap[period]["Only RSL"] || 0) + Math.round(log.onlyRslSample);
      }
    } else if (selectedDim === "team") {
      if (targetTeam === "ALL") {
        // Compare all teams totals
        periodMap[period][team] = (periodMap[period][team] || 0) + finalVal;
      } else if (team.toLowerCase() === targetTeam.toLowerCase()) {
        // Specific team selected: plot all members belonging to this team side-by-side!
        periodMap[period][empId] = (periodMap[period][empId] || 0) + finalVal;
      }
    } else if (selectedDim === "department") {
      if (targetDept === "ALL") {
        // Compare all department totals
        periodMap[period][dept] = (periodMap[period][dept] || 0) + finalVal;
      } else if (dept.toLowerCase() === targetDept.toLowerCase()) {
        // Specific department selected: plot all members belonging to this department side-by-side!
        periodMap[period][empId] = (periodMap[period][empId] || 0) + finalVal;
      }
    }
  });

  // Sort periods chronologically
  const chartData = Object.values(periodMap).sort((a, b) => a.period.localeCompare(b.period));

  // Determine series keys to draw
  let seriesKeys: string[] = [];
  let isSingleEntity = false;

  if (selectedDim === "individual") {
    if (targetEmp === "ALL") {
      // Plot all employee lines
      seriesKeys = Array.from(new Set(logs.map((l) => l.id)));
    } else {
      // Plot the three productivities for that specific user
      seriesKeys = ["Total Productivity", "Actual Productivity", "Only RSL"];
      isSingleEntity = true;
    }
  } else if (selectedDim === "team") {
    if (targetTeam === "ALL") {
      // Plot each unique team as a series line
      seriesKeys = uniqueTeams;
    } else {
      // Plot each team member inside selected team as a series line
      seriesKeys = Array.from(new Set(
        logs
          .filter((l) => getEmployeeTeam(l.id).toLowerCase() === targetTeam.toLowerCase())
          .map((l) => l.id)
      ));
    }
  } else if (selectedDim === "department") {
    if (targetDept === "ALL") {
      // Plot department lines
      seriesKeys = uniqueDepts;
    } else {
      // Plot each department member inside selected department as a series line
      seriesKeys = Array.from(new Set(
        logs
          .filter((l) => getEmployeeDept(l.id).toLowerCase() === targetDept.toLowerCase())
          .map((l) => l.id)
      ));
    }
  }

  // Helper map to display friendly series names in the legend
  const employeeNameLookup = employees.reduce((acc, emp) => {
    acc[emp.id.toUpperCase()] = emp.name;
    return acc;
  }, {} as { [id: string]: string });

  const getSeriesDisplayName = (key: string) => {
    if (key === "Total Productivity" || key === "Actual Productivity" || key === "Only RSL") {
      return key;
    }
    const upperKey = key.toUpperCase();
    if (employeeNameLookup[upperKey]) {
      return `${employeeNameLookup[upperKey]} (${key})`;
    }
    const matchedLog = logs.find((l) => l.id.toUpperCase() === upperKey);
    if (matchedLog) {
      return `${matchedLog.name} (${key})`;
    }
    return key;
  };

  // Modern Indigo-Teal focus theme palette
  const PALETTE_COLORS = [
    "#6366f1", // primary indigo
    "#14b8a6", // teal
    "#f59e0b", // amber
    "#ec4899", // pink
    "#10b981", // emerald
    "#8b5cf6", // purple
    "#06b6d4", // sky
    "#e11d48", // rose
    "#f97316", // orange
    "#3b82f6", // clear blue
    "#22c55e", // heavy green
    "#4f46e5"  // violet
  ];

  const getSeriesColor = (key: string, index: number) => {
    if (key === "Total Productivity") return "#6366f1"; // Indigo
    if (key === "Actual Productivity") return "#8b5cf6"; // Purple
    if (key === "Only RSL") return "#0d9488"; // Teal
    return PALETTE_COLORS[index % PALETTE_COLORS.length];
  };

  // ----------------------------------------------------
  // Interactive Synchronized Dashboard Widgets
  // Filter active logs to zoom in remaining metric widgets with active scopes
  // ----------------------------------------------------
  const filteredLogsForWidgets = logs.filter((log) => {
    const empId = log.id;
    const team = getEmployeeTeam(empId);
    const dept = getEmployeeDept(empId);

    if (selectedDim === "team" && targetTeam !== "ALL") {
      return team.toLowerCase() === targetTeam.toLowerCase();
    }
    if (selectedDim === "department" && targetDept !== "ALL") {
      return dept.toLowerCase() === targetDept.toLowerCase();
    }
    if (selectedDim === "individual" && targetEmp !== "ALL") {
      return empId.toUpperCase() === targetEmp.toUpperCase();
    }
    return true;
  });

  // Calculate Efficiency leaderboard within active dynamic scope
  const empMap: { [id: string]: { id: string; name: string; totalEff: number; count: number } } = {};
  filteredLogsForWidgets.forEach((log) => {
    if (log.workMins > 0 && (log.finalProd || 0) > 0) {
      if (!empMap[log.id]) {
        empMap[log.id] = {
          id: log.id,
          name: log.name,
          totalEff: 0,
          count: 0,
        };
      }
      empMap[log.id].totalEff += log.pctEff;
      empMap[log.id].count += 1;
    }
  });

  const rankingData = Object.values(empMap)
    .map((item) => ({
      id: item.id,
      name: item.name,
      efficiency: item.count > 0 ? Number((item.totalEff / item.count).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.efficiency - a.efficiency);

  // Attendance summary / hour allocation within active dynamic scope
  let totalNormalMinutes = 0;
  let totalExtraMinutes = 0;
  let totalOffDayMinutes = 0;

  filteredLogsForWidgets.forEach((log) => {
    if (log.isOffDay) {
      totalOffDayMinutes += 300;
    } else if (!log.isLeave) {
      const normal = Math.min(540, log.workMins);
      totalNormalMinutes += normal;
      totalExtraMinutes += log.extra;
    }
  });

  const pieData = [
    { name: "Normal Hours Completed", value: Math.round(totalNormalMinutes / 60), color: "#6366f1" },
    { name: "Overtime/Extra Hours", value: Math.round(totalExtraMinutes / 60), color: "#f59e0b" },
    { name: "Off-Day Duty Credits", value: Math.round(totalOffDayMinutes / 60), color: "#14b8a6" },
  ].filter(item => item.value > 0);

  // Dynamic titles and helpers for scope
  const getActiveScopeLabel = () => {
    if (selectedDim === "individual") {
      return targetEmp === "ALL" ? "All Individual Staff" : `Employee: ${getEmployeeName(targetEmp)}`;
    } else if (selectedDim === "team") {
      return targetTeam === "ALL" ? "All Work Teams" : `Team: ${targetTeam}`;
    } else {
      return targetDept === "ALL" ? "All Departments" : `Department: ${targetDept}`;
    }
  };

  const getMetricFriendlyName = () => {
    if (selectedMetric === "finalProd") return "Total Productivity";
    if (selectedMetric === "actProd") return "Actual Productivity";
    return "Only RSL sample";
  };

  return (
    <div className="space-y-6">

      {totalCount > 0 && (
        <div className="bg-rose-50/90 border border-rose-200 text-rose-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-top duration-300 font-sans shadow-3xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl shrink-0 animate-pulse">
              <AlertCircle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="font-extrabold text-sm text-slate-900">⚠️ KPI Exception Triggered ({totalCount} Underperforming Entity{totalCount > 1 ? "s" : ""})</p>
              <p className="text-[11px] text-rose-700 font-medium mt-0.5">
                Supervisor Warning: Productivity and/or Efficiency index falls below <span className="font-extrabold">100%</span> target threshold. Please review the detailed notifications inside the Alerts Center below.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const el = document.getElementById("supervisor-pivot-section");
              if (el) {
                el.scrollIntoView({ behavior: "smooth" });
              }
            }}
            className="text-xs font-bold bg-rose-100 hover:bg-rose-200 text-rose-950 px-3 py-1.5 rounded-xl border border-rose-300 shadow-3xs transition-all cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-center"
          >
            Review Exceptions &rarr;
          </button>
        </div>
      )}
      
      {/* Upper Welcome and Overview Control Center */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 px-2.5 rounded-full text-[10px] font-extrabold text-indigo-700 bg-indigo-50 tracking-wider uppercase font-sans animate-pulse">
              Interactive Dashboard
            </span>
          </div>
          <h2 className="text-2xl font-black font-display text-slate-900 mt-2 tracking-tight">
            Comprehensive Productivity Ledger Charts
          </h2>
          <p className="text-xs text-slate-500 font-sans mt-0.5">
            Compare performance, visualize trends, and export structured ledger reports. Only RSL is calculated as (Total Productivity - Combined).
          </p>
        </div>

        {/* Global Stats Counter */}
        <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-150 shrink-0 font-sans">
          <div>
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Scope</span>
            <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5 mt-0.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              {getActiveScopeLabel()}
            </span>
          </div>
          <div className="w-px bg-slate-200"></div>
          <div>
            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Logs Analyzed</span>
            <span className="font-extrabold text-xs text-indigo-600 mt-0.5 block">{filteredLogsForWidgets.length} entries</span>
          </div>
        </div>
      </div>

      {/* Alert Notification System for Productivity & Efficiency < 100% */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 px-2.5 rounded-full text-[10px] font-extrabold text-rose-700 bg-rose-50 tracking-wider uppercase font-sans flex items-center gap-1.5 shadow-3xs">
                <Bell className="w-3 h-3 text-rose-500 animate-bounce" /> Supervisor Alerts Center
              </span>
            </div>
            <h3 className="text-lg font-black font-display text-slate-900 mt-2 tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" /> Performance Exceptions & Risks &lt; 100%
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Identifies active individuals or teams operating under the baseline 100% index for Productivity or Efficiency.
            </p>
          </div>

          {/* Inline Tab Filters */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-150 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setAlertsFilter("all")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-all ${
                alertsFilter === "all" ? "bg-white text-slate-900 shadow-3xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Alerts ({totalCount})
            </button>
            <button
              onClick={() => setAlertsFilter("critical")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-all ${
                alertsFilter === "critical"
                  ? "bg-rose-600 text-white shadow-3xs"
                  : "text-rose-600 hover:text-rose-900"
              }`}
            >
              🔥 Critical ({criticalCount})
            </button>
            <button
              onClick={() => setAlertsFilter("team")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-all ${
                alertsFilter === "team" ? "bg-white text-slate-900 shadow-3xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Teams ({teamCount})
            </button>
            <button
              onClick={() => setAlertsFilter("individual")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-all ${
                alertsFilter === "individual" ? "bg-white text-slate-900 shadow-3xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Staff ({individualCount})
            </button>
          </div>
        </div>

        {/* List of active alerts */}
        {activeAlerts.length === 0 ? (
          <div className="bg-emerald-50/55 border border-emerald-150 p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl shrink-0">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h5 className="font-bold text-slate-900 text-sm">Perfect Score Checked!</h5>
                <p className="text-xs text-slate-600 mt-0.5">
                  {totalCount === 0 
                    ? "Excellent performance across the board. No individuals or teams are operating under 100% metrics in this dataset!" 
                    : "Filtered exceptions are currently clear. Perfect metrics are on target."
                  }
                </p>
              </div>
            </div>
            {dismissedAlerts.length > 0 && (
              <button
                onClick={() => setDismissedAlerts([])}
                className="text-xs font-bold text-indigo-650 hover:text-indigo-800 bg-white border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-xl cursor-pointer shadow-3xs transition-all shrink-0"
              >
                Reset {dismissedAlerts.length} Dismissed Alerts
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 flex-wrap">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`bg-white border text-slate-800 p-4 rounded-2xl transition-all duration-300 flex flex-col justify-between hover:shadow-2xs relative group shadow-3xs ${
                  alert.severity === "critical"
                    ? "border-rose-250 hover:border-rose-350"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {/* Dismiss button */}
                <button
                  onClick={() => setDismissedAlerts((prev) => [...prev, alert.id])}
                  className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 cursor-pointer"
                  title="Dismiss alert for this session"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                <div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <span
                      className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider ${
                        alert.type === "team"
                          ? "bg-slate-100 text-slate-700 border border-slate-200/60"
                          : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                      }`}
                    >
                      {alert.type}
                    </span>
                    {alert.severity === "critical" ? (
                      <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-100 animate-pulse">
                        Critically Below Target
                      </span>
                    ) : (
                      <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-150">
                        Sub-optimal
                      </span>
                    )}
                  </div>

                  <h4 className="font-extrabold text-sm text-slate-900 truncate pr-5 font-sans">
                    {alert.name}
                  </h4>
                  
                  {alert.type === "individual" && alert.team ? (
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                      Team: <span className="font-semibold text-slate-600">{alert.team}</span> {alert.dept && <>| Dept: <span className="font-semibold text-slate-600">{alert.dept}</span></>}
                    </p>
                  ) : alert.type === "team" ? (
                    <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                      Aggregated team average metrics
                    </p>
                  ) : null}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    {/* Productivity column */}
                    <div>
                      <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Productivity</span>
                      <span
                        className={`font-mono text-xs font-extrabold flex items-center gap-0.5 mt-0.5 ${
                          alert.isProdBelow ? "text-rose-600 animate-pulse" : "text-emerald-600"
                        }`}
                      >
                        {alert.isProdBelow ? (
                          <TrendingDown className="w-3 h-3 text-rose-500 shrink-0" />
                        ) : (
                          <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                        )}
                        {alert.avgProd.toFixed(1)}%
                      </span>
                    </div>

                    {/* Efficiency column */}
                    <div>
                      <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Efficiency</span>
                      <span
                        className={`font-mono text-xs font-extrabold flex items-center gap-0.5 mt-0.5 ${
                          alert.isEffBelow ? "text-rose-600 animate-pulse" : "text-emerald-600"
                        }`}
                      >
                        {alert.isEffBelow ? (
                          <TrendingDown className="w-3 h-3 text-rose-500 shrink-0" />
                        ) : (
                          <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                        )}
                        {alert.avgEff.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* CTA Focus action */}
                  <button
                    onClick={() => handleAlertFocus(alert)}
                    className="p-1 px-2.5 rounded-xl text-[10px] bg-slate-50 hover:bg-indigo-600 border border-slate-200 text-slate-600 hover:text-white font-bold transition-all flex items-center gap-1 cursor-pointer shadow-3xs shrink-0"
                    title="Focus dashboard charts on this item"
                  >
                    <Eye className="w-3 h-3 shrink-0" /> Investigate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Automated Supervisor Mail Dispatch Hub */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-3xs space-y-5 animate-in fade-in duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-100/50">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="p-1 px-2.5 rounded-full text-[9px] font-extrabold text-indigo-700 bg-indigo-50 tracking-wider uppercase font-sans flex items-center gap-1.5 w-fit shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span> Real-time Dispatch Channel
              </span>
              <span className="p-1 px-2 rounded-full text-[9px] font-bold text-slate-500 bg-slate-100 tracking-wider uppercase font-sans">
                {mailNotifications.length} triggered
              </span>
            </div>
            <h3 className="text-base font-black font-sans text-slate-900 mt-2 tracking-tight flex items-center gap-2">
              <Mail className="w-4.5 h-4.5 text-indigo-600 shrink-0" /> Automated Supervisor Mail Dispatch Hub
            </h3>
            <p className="text-[11px] text-slate-500 font-sans mt-0.5">
              Drafts and registers KPI compliance email messages for team supervisors when sub-100% productivity operations occur.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 max-w-fit sm:self-center">
            {onToggleAutoDispatch && (
              <label 
                className="flex items-center gap-2 bg-indigo-50/50 border border-indigo-100 rounded-xl px-3 py-1.5 cursor-pointer hover:bg-indigo-100/55 select-none text-[10px] font-bold text-indigo-700 transition-colors shadow-3xs" 
                title="When checked, email alerts are immediately dispatched to supervisors on discovery. Otherwise, they are created as drafts for manual review and sending."
              >
                <input
                  type="checkbox"
                  checked={autoDispatchEnabled}
                  onChange={onToggleAutoDispatch}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span>Auto-Send Instantly</span>
              </label>
            )}

            <button
              onClick={() => setShowSmtpSettings(!showSmtpSettings)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold border rounded-xl transition-all cursor-pointer shadow-3xs ${
                showSmtpSettings 
                  ? "bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700"
                  : "bg-white hover:bg-slate-50 text-indigo-600 hover:text-indigo-700 border-slate-200"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              {showSmtpSettings ? "Hide SMTP Settings" : "Configure SMTP Relay"}
            </button>

            {mailNotifications.length > 0 && onClearMailNotifications && (
              <button
                onClick={onClearMailNotifications}
                className="px-3 py-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100/80 hover:text-rose-700 border border-rose-100 hover:border-rose-200 rounded-xl transition-all cursor-pointer shadow-3xs"
              >
                Clear Log History
              </button>
            )}
          </div>
        </div>

        {/* Dynamic SMTP Relaying Setup */}
        {showSmtpSettings && (
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-200 text-left">
            
            {/* Delivery Channel Tab Selector */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-wrap gap-2">
              <div className="flex items-center gap-1 bg-slate-205 bg-slate-200/60 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveChannelTab("smtp")}
                  className={`px-3 py-1.2 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeChannelTab === "smtp"
                      ? "bg-white text-indigo-700 shadow-3xs"
                      : "text-slate-650 hover:text-slate-800"
                  }`}
                >
                  SMTP Outgoing Relay
                </button>
                <button
                  type="button"
                  onClick={() => setActiveChannelTab("resend")}
                  className={`px-3 py-1.2 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    activeChannelTab === "resend"
                      ? "bg-white text-indigo-700 shadow-3xs"
                      : "text-slate-655 hover:text-slate-800"
                  }`}
                >
                  Resend REST API
                </button>
              </div>

              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                activeChannelTab === "resend"
                  ? (resendConfig.apiKey ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100")
                  : (smtpConfig.host ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100")
              }`}>
                {activeChannelTab === "resend"
                  ? (resendConfig.apiKey ? "● Resend API Active" : "○ Simulation mode")
                  : (smtpConfig.host ? "● SMTP Relay Active" : "○ Simulation mode")}
              </span>
            </div>

            {activeChannelTab === "smtp" ? (
              <>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-indigo-600" /> Background SMTP Mail Server Credentials
                  </h4>
                </div>

                <p className="text-[11.5px] leading-relaxed text-slate-600 font-sans">
                  To send <strong>automatic background emails</strong> directly to target inboxes without assigning any client-side software on this computer (bypassing mailto: completely), provide your organization's SMTP outgoing credentials below.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-1">
                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">SMTP Host / Server Address</label>
                    <input
                      type="text"
                      placeholder="e.g. smtp.gmail.com or smtp.sendgrid.net"
                      value={smtpConfig.host}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Port Number</label>
                    <input
                      type="number"
                      placeholder="587"
                      value={smtpConfig.port || ""}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, port: Number(e.target.value) })}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="md:col-span-2 flex items-end pb-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={smtpConfig.secure}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">SSL Port 465</span>
                    </label>
                  </div>

                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">SMTP Username / E-Mail</label>
                    <input
                      type="text"
                      placeholder="e.g. alerts@company.com"
                      value={smtpConfig.user}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                      <span>SMTP App Password</span>
                      <button
                        type="button"
                        onClick={() => setShowSmtpPass(!showSmtpPass)}
                        className="text-[9px] text-indigo-605 hover:underline font-semibold cursor-pointer"
                      >
                        {showSmtpPass ? "Hide" : "Show"} password
                      </button>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type={showSmtpPass ? "text" : "password"}
                        placeholder="••••••••••••••••"
                        value={smtpConfig.pass}
                        onChange={(e) => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                        className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 pl-8 font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sender return From Name</label>
                    <input
                      type="text"
                      placeholder="Compliance Alerts"
                      value={smtpConfig.fromName}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, fromName: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-sans text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="md:col-span-4 space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sender Outbound E-Mail Address</label>
                    <input
                      type="email"
                      placeholder="alerts@productivity-portal.com"
                      value={smtpConfig.fromEmail}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, fromEmail: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-650 text-indigo-600 animate-pulse" /> Resend.com E-Mail API Gateway
                  </h4>
                </div>

                <div className="text-[11.5px] leading-relaxed text-slate-600 font-sans space-y-2">
                  <p>
                    Integrate the modern <strong>Resend API</strong> for fast, reliable, and secure compliance email delivery with zero server handshake lag.
                  </p>
                  <p className="bg-amber-50 text-amber-900 border border-amber-200/60 rounded-xl p-3.5 text-[11px] leading-normal font-sans">
                    <strong>⚠️ Resend Credentials Instructions:</strong> Replace the key placeholder with your actual Resend API key starting with <code>re_...</code>. If you are using a free sandbox account on Resend, you can only send test emails to your registered verification address (e.g. <code>shahadatapplications@gmail.com</code>).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 pt-1">
                  <div className="md:col-span-6 space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                      <span>Resend API Key (re_xxxxxxxxx)</span>
                      <button
                        type="button"
                        onClick={() => setShowResendPass(!showResendPass)}
                        className="text-[9px] text-indigo-600 hover:underline font-semibold cursor-pointer"
                      >
                        {showResendPass ? "Hide" : "Show"} key
                      </button>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type={showResendPass ? "text" : "password"}
                        placeholder="e.g. re_xxxxxxxxx"
                        value={resendConfig.apiKey}
                        onChange={(e) => setResendConfig({ ...resendConfig, apiKey: e.target.value })}
                        className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 pl-8 font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-6 space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sender From Domain / Address</label>
                    <input
                      type="text"
                      placeholder="e.g. onboarding@resend.dev or verified@yourdomain.com"
                      value={resendConfig.fromEmail}
                      onChange={(e) => setResendConfig({ ...resendConfig, fromEmail: e.target.value })}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </>
            )}

            {smtpMessage && (
              <div className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-150 p-2.5 rounded-lg animate-in fade-in duration-150">
                {smtpMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-1.5">
              <button
                type="button"
                onClick={() => {
                  if (activeChannelTab === "resend") {
                    setResendConfig({
                      apiKey: "",
                      fromEmail: "onboarding@resend.dev"
                    });
                    localStorage.removeItem("productivity_resend_config_v3");
                    setSmtpMessage("✔ Resend API Keys removed. Simulation sandbox mode restored.");
                  } else {
                    setSmtpConfig({
                      host: "",
                      port: 587,
                      secure: false,
                      user: "",
                      pass: "",
                      fromName: "Compliance Alerts",
                      fromEmail: "alerts@productivity-portal.com"
                    });
                    localStorage.removeItem("productivity_smtp_config_v2");
                    setSmtpMessage("✔ SMTP configuration cleared. Simulation sandbox mode restored.");
                  }
                  setTimeout(() => setSmtpMessage(null), 3000);
                }}
                className="px-3.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
              >
                Reset to Sandbox Simulator
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeChannelTab === "resend") {
                    saveResendConfig(resendConfig);
                  } else {
                    saveSmtpConfig(smtpConfig);
                  }
                }}
                disabled={savingSmtp}
                className="px-4 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-3xs"
              >
                {savingSmtp ? "Syncing..." : (activeChannelTab === "resend" ? "Apply & Save Resend API" : "Apply & Save SMTP Config")}
              </button>
            </div>
          </div>
        )}

        {mailNotifications.length === 0 ? (
          <div className="text-center py-10 bg-slate-50/60 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center">
            <div className="p-3 bg-indigo-50 text-indigo-500 rounded-2xl mb-3 shadow-3xs">
              <Mail className="w-5 h-5 text-indigo-500" />
            </div>
            <span className="text-xs font-extrabold text-slate-700">No Email Alerts Dispatched Yet</span>
            <p className="text-[10px] text-slate-400 max-w-sm mt-1 leading-normal font-sans px-4">
              When an employee profile drops below 100% Productivity or Efficiency targets inside a recorded shift, an email draft will instantly populate here, addressed to their assigned supervisor.
            </p>
          </div>
        ) : (
          <div className="max-h-[380px] overflow-y-auto space-y-4 pr-1 divide-y divide-slate-100">
            {mailNotifications.map((notif, idx) => (
              <div key={notif.id} className={`pt-4 first:pt-0 animate-in fade-in slide-in-from-top-1 duration-150`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[9px] font-semibold text-slate-500 font-mono bg-slate-150 px-2 py-0.5 rounded-md">
                        {notif.timestamp}
                      </span>
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {notif.teamName}
                      </span>
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-100 flex items-center gap-1">
                        <TrendingDown className="w-2.5 h-2.5" /> KPI Exception
                      </span>
                      <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border flex items-center gap-1 ${
                        notif.deliveryStatus === "Sending..."
                          ? "bg-indigo-50 text-indigo-700 border-indigo-150 animate-pulse"
                          : notif.deliveryStatus?.startsWith("Draft")
                            ? "bg-amber-50 text-amber-700 border-amber-150"
                            : notif.deliveryStatus?.startsWith("Failed")
                              ? "bg-rose-50 text-rose-700 border-rose-150"
                              : "bg-emerald-50 text-emerald-700 border-emerald-100"
                      }`}>
                        {notif.deliveryStatus === "Sending..." ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-spin shrink-0"></span>
                        ) : notif.deliveryStatus?.startsWith("Draft") ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                        ) : notif.deliveryStatus?.startsWith("Failed") ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-505 bg-emerald-500 animate-pulse shrink-0"></span>
                        )}
                        {notif.deliveryStatus || "Delivered"}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-xs text-slate-800 font-sans mt-1.5">
                      Subject: <span className="font-normal font-mono text-slate-600">{notif.subject}</span>
                    </h4>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {onSendMailNotification && (
                      <button
                        onClick={() => onSendMailNotification(notif.id)}
                        disabled={notif.deliveryStatus === "Sending..."}
                        className={`flex items-center gap-1.5 py-1.5 px-2.8 px-3 rounded-xl text-[10px] font-bold border transition-all cursor-pointer shadow-3xs ${
                          notif.deliveryStatus === "Sending..."
                            ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                            : notif.deliveryStatus?.startsWith("Draft")
                              ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700 hover:shadow-2xs"
                              : "bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 border-indigo-150"
                        }`}
                        title={notif.deliveryStatus?.startsWith("Draft") ? "Transmit this email draft to supervisor's inbox now" : "Send/Resend this email to supervisor's inbox"}
                      >
                        {notif.deliveryStatus === "Sending..." ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-3 h-3 text-current" />
                            {notif.deliveryStatus?.startsWith("Draft") ? "Send Email" : "Resend Email"}
                          </>
                        )}
                      </button>
                    )}

                    {/* Toggle SMTP Session Logs */}
                    <button
                      onClick={() => toggleSmtpLog(notif.id)}
                      className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                        expandedSmtpIds.includes(notif.id)
                          ? "bg-slate-800 text-white border-slate-900"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      {expandedSmtpIds.includes(notif.id) ? "Hide Log" : "View Transport Log"}
                    </button>

                    <a
                      href={`mailto:${notif.supervisorEmail}?subject=${encodeURIComponent(notif.subject)}&body=${encodeURIComponent(notif.body)}`}
                      className="flex items-center gap-1 ml-auto sm:ml-0 text-[10px] font-bold text-slate-500 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 py-1.5 px-2.5 rounded-xl transition-colors cursor-pointer"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in your local mail client"
                    >
                      <Mail className="w-3 h-3 text-slate-400" /> Mailto backup
                    </a>

                    {onDeleteMailNotification && (
                      <button
                        onClick={() => onDeleteMailNotification(notif.id, notif.logUid)}
                        className="flex items-center gap-1 ml-auto sm:ml-0 text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-100 hover:border-rose-200 py-1.5 px-2.5 rounded-xl transition-colors cursor-pointer"
                        title="Dismiss and delete this alert"
                      >
                        <X className="w-3.5 h-3.5 text-rose-500" /> Dismiss Draft
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-Panel: SMTP Transport Log */}
                {expandedSmtpIds.includes(notif.id) && notif.smtpLog && (
                  <div className="mt-3 bg-slate-950 text-slate-200 font-mono text-[9px] p-3 rounded-xl border border-slate-850 animate-in slide-in-from-top-1 duration-150 shadow-inner max-h-48 overflow-y-auto">
                    <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-1.5 mb-2 flex justify-between select-none">
                      <span>SMTP Transaction log (MTA Daemon v2.4)</span>
                      <span className="text-emerald-400 flex items-center gap-1 font-sans">
                        <Activity className="w-2.5 h-2.5 animate-pulse" /> RELAY_OK
                      </span>
                    </div>
                    <div className="space-y-1 font-mono text-emerald-400">
                      {notif.smtpLog.map((line, lIdx) => (
                        <div key={lIdx} className="whitespace-pre-wrap leading-relaxed">
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 bg-slate-50/50 border border-slate-200 rounded-xl p-3.5 font-mono text-[10.5px] leading-relaxed text-slate-600 whitespace-pre-wrap select-all relative group/mail">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5 mb-2.5 flex justify-between select-none">
                    <span>E-Mail Envelope Details</span>
                    <span className="text-indigo-600 font-sans text-[8px] opacity-0 group-hover/mail:opacity-100 transition-opacity">
                      Click body below to highlight and copy
                    </span>
                  </div>
                  <strong className="text-slate-700 font-semibold select-none">To: </strong> {notif.supervisorName} &lt;<span className="text-indigo-600 font-bold underline decoration-indigo-200">{notif.supervisorEmail}</span>&gt;{"\n"}
                  <strong className="text-slate-700 font-semibold select-none">From: </strong> Automated Alerts &lt;notifications@productivity-portal.com&gt;{"\n"}
                  {"\n"}
                  {notif.body}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Primary Analytics bento container */}
      <div id="supervisor-pivot-section" className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Dynamic Axis Filter control block */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs space-y-5 lg:col-span-1">
          <div className="flex items-center gap-1.5 pb-3 border-b border-slate-100">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-900 font-sans">Pivot Axis Controls</h3>
          </div>

          {/* Time Frequency Controls */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" /> Time Frequency
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
              {(["daily", "monthly", "yearly"] as const).map((freq) => (
                <button
                  key={freq}
                  onClick={() => setSelectedFreq(freq)}
                  className={`py-1.5 text-center text-[11px] font-bold rounded-lg cursor-pointer transition-all ${
                    selectedFreq === freq
                      ? "bg-white text-slate-900 shadow-3xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Analysis Dimension Controls */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Layers className="w-3 h-3 text-slate-400" /> Analysis Dimension
            </label>
            <div className="flex flex-col gap-1 bg-slate-50 p-1 rounded-xl border border-slate-150">
              {(["individual", "team", "department"] as const).map((dim) => (
                <button
                  key={dim}
                  onClick={() => {
                    setSelectedDim(dim);
                    // Reset metric defaults in case
                  }}
                  className={`px-3 py-2 text-left text-[11px] font-bold rounded-lg cursor-pointer transition-all flex items-center justify-between ${
                    selectedDim === dim
                      ? "bg-indigo-600 text-white shadow-3xs font-extrabold"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className="capitalize">{dim}</span>
                  <ChevronRight className={`w-3.5 h-3.5 opacity-70 ${selectedDim === dim ? "text-white" : "text-slate-400"}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Target Selector Dropdown depending on dimension */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Users className="w-3 h-3 text-slate-400" /> Selected Target Focus
            </label>
            
            {selectedDim === "individual" && (
              <select
                value={targetEmp}
                onChange={(e) => setTargetEmp(e.target.value)}
                className="w-full text-xs font-semibold text-slate-750 bg-white border border-slate-200 rounded-xl px-2.5 py-2 hover:border-slate-300 focus:border-indigo-500 focus:outline-hidden transition-all shadow-3xs cursor-pointer"
              >
                <option value="ALL">Comparison: Compare All Staff</option>
                {uniqueEmps.map((empId) => (
                  <option key={empId} value={empId}>
                    {getEmployeeName(empId)} ({empId})
                  </option>
                ))}
              </select>
            )}

            {selectedDim === "team" && (
              <select
                value={targetTeam}
                onChange={(e) => setTargetTeam(e.target.value)}
                className="w-full text-xs font-semibold text-slate-750 bg-white border border-slate-200 rounded-xl px-2.5 py-2 hover:border-slate-300 focus:border-indigo-500 focus:outline-hidden transition-all shadow-3xs cursor-pointer"
              >
                <option value="ALL">Comparison: Compare All Teams</option>
                {uniqueTeams.map((team) => (
                  <option key={team} value={team}>
                    {team} Comparison
                  </option>
                ))}
              </select>
            )}

            {selectedDim === "department" && (
              <select
                value={targetDept}
                onChange={(e) => setTargetDept(e.target.value)}
                className="w-full text-xs font-semibold text-slate-750 bg-white border border-slate-200 rounded-xl px-2.5 py-2 hover:border-slate-300 focus:border-indigo-500 focus:outline-hidden transition-all shadow-3xs cursor-pointer"
              >
                <option value="ALL">Comparison: Compare All Departments</option>
                {uniqueDepts.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept} Department
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Metric Selector (Only shown if looking at multiple items (comparing them) on a single scale) */}
          {!isSingleEntity && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                Selected Y-Axis Metric
              </label>
              <div className="flex flex-col gap-1.5 font-sans">
                {[
                  { id: "finalProd", label: "Total Productivity", desc: "finalProd (Actual + Food)" },
                  { id: "actProd", label: "Actual Productivity", desc: "actProd (A + B/5 + 0.8C)" },
                  { id: "onlyRslSample", label: "Only RSL Sample", desc: "Productivity minus Combined" },
                ].map((metric) => (
                  <button
                    key={metric.id}
                    onClick={() => setSelectedMetric(metric.id as any)}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all relative flex flex-col justify-between ${
                      selectedMetric === metric.id
                        ? "bg-indigo-50/50 border-indigo-200 text-slate-900"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${selectedMetric === metric.id ? "bg-indigo-600 animate-pulse" : "bg-slate-300"}`}></span>
                      <span className="font-bold text-slate-800">{metric.label}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 pl-4 mt-0.5 font-mono">{metric.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Graph Type selector */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Chart Display:</span>
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/50">
              <button
                onClick={() => setChartType("line")}
                className={`px-2 py-1 text-[10px] font-bold rounded-md cursor-pointer transition-all ${
                  chartType === "line" ? "bg-white text-indigo-700 shadow-3xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Line Trend
              </button>
              <button
                onClick={() => setChartType("bar")}
                className={`px-2 py-1 text-[10px] font-bold rounded-md cursor-pointer transition-all ${
                  chartType === "bar" ? "bg-white text-indigo-700 shadow-3xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Bar Columns
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Secondary Time-Series Chart Pane */}
        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-xs lg:col-span-3 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 mb-2.5 pl-1">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base font-display flex items-center gap-1.5">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  Time Ledger Productivity Analysis
                </h3>
                <p className="text-xs text-slate-500 font-sans mt-0.5">
                  {isSingleEntity 
                    ? `Displaying multi-metrics trend line for: ${getEmployeeName(targetEmp)} (${targetEmp})`
                    : `Comparing ${getMetricFriendlyName()} across active groups over ${selectedFreq} interval`
                  }
                </p>
              </div>

              {/* Extra context pill for dynamic calculation details */}
              <div className="p-2 py-1 bg-emerald-50 text-emerald-800 font-medium text-[9px] font-sans border border-emerald-200/40 rounded-xl flex items-center gap-1 leading-none self-start">
                <Info className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>Only RSL = Productivity - Combined</span>
              </div>
            </div>
          </div>

          {/* Actual Chart Container */}
          <div className="h-88 w-full min-w-0 min-h-0 mt-4 text-[11px] font-mono">
            {chartData.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 font-sans bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-8 text-center space-y-2">
                <Calendar className="w-8 h-8 text-slate-350 shrink-0 animate-bounce" />
                <h5 className="font-bold text-slate-700 text-sm">No ledger results computed</h5>
                <p className="text-xs max-w-sm text-slate-400">There are no daily records populated or active employee allocations that matches the current pivot axis criteria.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                {chartType === "line" ? (
                  <LineChart data={chartData} margin={{ top: 10, right: 25, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="period" 
                      stroke="#94a3b8" 
                      tickLine={false} 
                      axisLine={false}
                      tickMargin={8} 
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      tickLine={false}
                      axisLine={false}
                      tickMargin={6}
                      domain={[0, "auto"]}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "#0f172a", borderRadius: "16px", border: "none", color: "#f8fafc", fontFamily: "sans-serif" }}
                      formatter={(value, name) => [value, getSeriesDisplayName(name as string)]}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={40} 
                      iconType="circle" 
                      iconSize={8}
                      formatter={(value) => <span className="text-xs font-semibold font-sans text-slate-700">{getSeriesDisplayName(value)}</span>}
                    />
                    {seriesKeys.map((key, index) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={getSeriesColor(key, index)}
                        strokeWidth={isSingleEntity && key === "Total Productivity" ? 3.5 : 2.5}
                        activeDot={{ r: 6 }}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 10, right: 25, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="period" 
                      stroke="#94a3b8" 
                      tickLine={false} 
                      axisLine={false}
                      tickMargin={8} 
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      tickLine={false}
                      axisLine={false}
                      tickMargin={6}
                      domain={[0, "auto"]}
                    />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: "#0f172a", borderRadius: "16px", border: "none", color: "#f8fafc", fontFamily: "sans-serif" }}
                      formatter={(value, name) => [value, getSeriesDisplayName(name as string)]}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={40} 
                      iconType="rect" 
                      iconSize={10}
                      formatter={(value) => <span className="text-xs font-semibold font-sans text-slate-700">{getSeriesDisplayName(value)}</span>}
                    />
                    {seriesKeys.map((key, index) => (
                      <Bar
                        key={key}
                        dataKey={key}
                        fill={getSeriesColor(key, index)}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={60}
                      />
                    ))}
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Secondary Synced Analytics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Dynamic Attendance Index for Active Scope */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-slate-900 font-display flex items-center gap-1.5 mb-1">
              <PieIcon className="w-4 h-4 text-emerald-500" />
              Hours Allocation Index
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              Aggregated normal vs overtime working hours for {getActiveScopeLabel()}
            </p>
          </div>

          <div className="h-56 w-full min-w-0 min-h-0 text-xs my-3 pl-1">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 font-sans border border-dashed border-slate-150 rounded-2xl">
                No active times recorded
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "10px", border: "none", color: "#fff", fontFamily: "sans-serif" }}
                    formatter={(value) => [`${value} hours`]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie Legends */}
          <div className="space-y-1.5 font-sans pt-2 border-t border-slate-50">
            {pieData.length === 0 ? (
              <p className="text-[10px] text-center text-slate-400">Add working times to populate allocation ratios</p>
            ) : (
              pieData.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                    <span className="text-slate-600">{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-900 font-mono">{item.value} hrs</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dynamic Efficiency Leaderboard for Active Scope */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs lg:col-span-2 flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-slate-900 font-display flex items-center gap-1.5 mb-1">
              <BarChart2 className="w-4 h-4 text-indigo-500" />
              Efficiency Leaderboard (% Score Ranking)
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              Average individual efficiency ratios ranked descending within {getActiveScopeLabel()}
            </p>
          </div>

          <div className="h-64 w-full min-w-0 min-h-0 text-xs mt-4">
            {rankingData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 font-sans border border-dashed border-slate-150 rounded-2xl">
                No active logs computed
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart
                  data={rankingData}
                  layout="horizontal"
                  margin={{ top: 10, right: 30, left: -25, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="id" stroke="#94a3b8" tickFormatter={(val) => val} />
                  <YAxis stroke="#94a3b8" unit="%" tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#0f172a", borderRadius: "12px", border: "none", color: "#fff", fontFamily: "sans-serif" }}
                    formatter={(value, name, props) => [`${value}%`, `${props.payload.name}`]}
                  />
                  <Bar dataKey="efficiency" radius={[4, 4, 0, 0]} maxBarSize={45}>
                    {rankingData.map((entry, index) => {
                      let color = "#ef4444"; // red
                      if (entry.efficiency >= 100) color = "#10b981"; // emerald
                      else if (entry.efficiency >= 80) color = "#6366f1"; // indigo
                      else if (entry.efficiency >= 50) color = "#f43f5e"; // rose/pinkish red
                      else color = "#f97316"; // orange
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Quick Info Disclaimer block */}
          <div className="pt-2 border-t border-slate-50 flex items-center gap-2 text-[10px] text-slate-500 font-sans">
            <span className="inline-block px-1.5 py-0.5 roundedbg-slate-150 font-bold border border-slate-250 text-indigo-700">Formula</span>
            <p className="truncate">Efficiency = Total Final Productivity / (Total Work Minutes / (540 / 11)) * 100%</p>
          </div>
        </div>

      </div>

    </div>
  );
}
