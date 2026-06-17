import React, { useState, useEffect } from "react";
import { DailyLog, Employee, EmailNotification, SmtpConfig } from "./types";
import { generateSeedLogs, SEED_EMPLOYEES } from "./utils/seedData";
import { computeLogCalculations, getEnrichedLogs } from "./utils/productivity";
import { safeStorage } from "./utils/safeStorage";
import MetricCards from "./components/MetricCards";
import InputForm from "./components/InputForm";
import DataTable from "./components/DataTable";
import DashboardView from "./components/DashboardView";
import SummariesView from "./components/SummariesView";
import GoogleSheetsIntegration from "./components/GoogleSheetsIntegration";
import StaffDirectory from "./components/StaffDirectory";
import {
  FileSpreadsheet,
  TrendingUp,
  Award,
  BookOpen,
  Calendar,
  Lock,
  Unlock,
  ShieldAlert,
  Info,
  Layers,
  Plus,
  Users,
  Trash,
  X,
  Mail,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from "lucide-react";

export default function App() {
  // Load initial logs from localStorage or generate seed data
  const [logs, setLogs] = useState<DailyLog[]>(() => {
    const saved = safeStorage.getItem("productivity_logs_v2");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((log: any) => log.id && !log.id.toString().toUpperCase().startsWith("EMP"));
          return filtered.map((log: any) => computeLogCalculations(log));
        }
      } catch (e) {
        console.error("Error loading logs from localStorage", e);
      }
    }
    return generateSeedLogs();
  });

  // Persist logs changes to localStorage
  useEffect(() => {
    safeStorage.setItem("productivity_logs_v2", JSON.stringify(logs));
  }, [logs]);

  // Sync browser window/tab title dynamically
  useEffect(() => {
    document.title = "Productivity & Efficiency Tracker (Chemical Approval)";
  }, []);

  // System States
  const [activeTab, setActiveTab] = useState<"journal" | "dashboard" | "summaries" | "sync" | "directory">("journal");
  
  const [isDateManuallyChanged, setIsDateManuallyChanged] = useState<boolean>(() => {
    return safeStorage.getItem("productivity_is_date_manually_changed") === "true";
  });

  const [simulatedToday, setSimulatedToday] = useState<string>(() => {
    const saved = safeStorage.getItem("productivity_simulated_today_v3");
    if (saved && safeStorage.getItem("productivity_is_date_manually_changed") === "true") {
      return saved;
    }
    const local = new Date();
    const year = local.getFullYear();
    const month = String(local.getMonth() + 1).padStart(2, "0");
    const day = String(local.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  const handleSimulatedTodayChange = (newDate: string) => {
    setSimulatedToday(newDate);
    setIsDateManuallyChanged(true);
    safeStorage.setItem("productivity_is_date_manually_changed", "true");
    safeStorage.setItem("productivity_simulated_today_v3", newDate);
  };

  const resetSimulatedToday = () => {
    const local = new Date();
    const year = local.getFullYear();
    const month = String(local.getMonth() + 1).padStart(2, "0");
    const day = String(local.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;
    setSimulatedToday(todayStr);
    setIsDateManuallyChanged(false);
    safeStorage.removeItem("productivity_is_date_manually_changed");
    safeStorage.removeItem("productivity_simulated_today_v3");
  };

  // Track calendar transitions and keep simulatedToday dynamically in sync
  useEffect(() => {
    const getLocalDateString = () => {
      const local = new Date();
      const year = local.getFullYear();
      const month = String(local.getMonth() + 1).padStart(2, "0");
      const day = String(local.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const interval = setInterval(() => {
      const currentCalendarDate = getLocalDateString();
      if (!isDateManuallyChanged) {
        setSimulatedToday((prev) => {
          if (prev !== currentCalendarDate) {
            return currentCalendarDate;
          }
          return prev;
        });
      }
    }, 15000); // Check every 15 seconds to be highly responsive

    return () => clearInterval(interval);
  }, [isDateManuallyChanged]);

  const [isOwnerMode, setIsOwnerMode] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);

  // Employee/Worker active selection profile state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(() => {
    return safeStorage.getItem("productivity_selected_employee_id_v3") || null;
  });

  useEffect(() => {
    if (selectedEmployeeId) {
      safeStorage.setItem("productivity_selected_employee_id_v3", selectedEmployeeId);
    } else {
      safeStorage.removeItem("productivity_selected_employee_id_v3");
    }
  }, [selectedEmployeeId]);

  // Dynamic selected row IDs for selected deletion
  const [selectedUids, setSelectedUids] = useState<string[]>([]);

  // Clear selection whenever we toggle Owner mode
  useEffect(() => {
    setSelectedUids([]);
  }, [isOwnerMode]);

  // Admin Password Override & Storage States
  const [adminPassword, setAdminPassword] = useState<string>(() => {
    return safeStorage.getItem("admin_password_v2") || "admin123";
  });

  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [checkInId, setCheckInId] = useState<string>("");

  // Employee Login & Registration States
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);

  // Employee Password Recovery States
  const [showRecoveryModal, setShowRecoveryModal] = useState<boolean>(false);
  const [recoveryEmail, setRecoveryEmail] = useState<string>("");
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);

  // Registration form inputs
  const [regId, setRegId] = useState<string>("");
  const [regName, setRegName] = useState<string>("");
  const [regEmail, setRegEmail] = useState<string>("");
  const [regPassword, setRegPassword] = useState<string>("");
  const [regTeam, setRegTeam] = useState<string>("RSL German");
  const [regTeamCustom, setRegTeamCustom] = useState<string>("");
  const [regDept, setRegDept] = useState<string>("Chemical Approval");

  // Change Password States within Owner Mode
  const [showChangePasswordModal, setShowChangePasswordModal] = useState<boolean>(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>("");
  const [newPasswordInput, setNewPasswordInput] = useState<string>("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>("");
  const [passwordUpdateError, setPasswordUpdateError] = useState<string | null>(null);
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState<boolean>(false);

  // Persist Password Changes
  useEffect(() => {
    safeStorage.setItem("admin_password_v2", adminPassword);
  }, [adminPassword]);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccessMessage(null);

    if (authMode === "login") {
      const cleanEmail = loginEmail.trim().toLowerCase();
      const cleanPass = loginPassword;

      if (!cleanEmail || !cleanPass) {
        setAuthError("Please fill out all fields.");
        return;
      }

      const match = employees.find((emp) => {
        if (emp.password !== cleanPass) return false;

        const empMail = (emp.email || "").toLowerCase();
        const empId = (emp.id || "").toLowerCase();

        // 1. Exact Email match
        if (empMail === cleanEmail) return true;

        // 2. ID Code match (e.g. typing D9655)
        if (empId === cleanEmail) return true;

        // 3. Normalized email username comparison (handles abul.basher vs basher)
        const cleanEmailPrefix = cleanEmail.split("@")[0].replace(/[^a-z0-9]/g, "");
        const empEmailPrefix = empMail.split("@")[0].replace(/[^a-z0-9]/g, "");

        if (cleanEmailPrefix && empEmailPrefix) {
          if (cleanEmailPrefix === empEmailPrefix) return true;
          if (cleanEmailPrefix.includes(empEmailPrefix) || empEmailPrefix.includes(cleanEmailPrefix)) return true;
        }

        // 4. Name-based match fallback
        const strippedName = (emp.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanEmailPrefix && strippedName && (cleanEmailPrefix.includes(strippedName) || strippedName.includes(cleanEmailPrefix))) {
          return true;
        }

        return false;
      });

      if (match) {
        setSelectedEmployeeId(match.id);
        setAuthSuccessMessage(`Welcome back, ${match.name}!`);
        setLoginEmail("");
        setLoginPassword("");
      } else {
        setAuthError("Invalid email or password combination. Hint: default seed password is 'welcome123'.");
      }
    } else {
      const cleanId = regId.trim().toUpperCase();
      const cleanName = regName.trim();
      const cleanEmail = regEmail.trim().toLowerCase();
      const cleanPass = regPassword;
      let finalTeam = regTeam;
      if (regTeam === "CUSTOM") {
        finalTeam = regTeamCustom.trim();
      }
      const cleanDept = regDept.trim() || "Chemical Approval";

      if (!cleanId || !cleanName || !cleanEmail || !cleanPass || !finalTeam) {
        setAuthError("Please fill out all required fields.");
        return;
      }

      if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
        setAuthError("Please enter a valid email address.");
        return;
      }

      if (employees.some((emp) => emp.id.toUpperCase() === cleanId)) {
        setAuthError(`Employee with ID ${cleanId} is already registered.`);
        return;
      }
      if (employees.some((emp) => emp.email?.toLowerCase() === cleanEmail)) {
        setAuthError(`Employee with Email ${cleanEmail} is already registered.`);
        return;
      }

      const newEmp: Employee = {
        id: cleanId,
        name: cleanName,
        email: cleanEmail,
        password: cleanPass,
        team: finalTeam,
        department: cleanDept,
      };

      setEmployees((prev) => [...prev, newEmp]);
      setSelectedEmployeeId(cleanId);
      setAuthSuccessMessage(`Successfully registered! Welcome, ${cleanName}!`);
      
      setRegId("");
      setRegName("");
      setRegEmail("");
      setRegPassword("");
      setRegTeam("RSL German");
      setRegTeamCustom("");
    }
  };

  const handlePasswordRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoverySuccess(null);

    const cleanEmail = recoveryEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setRecoveryError("Please enter your registered email address.");
      return;
    }

    const match = employees.find(
      (emp) => emp.email?.toLowerCase() === cleanEmail || emp.id.toLowerCase() === cleanEmail
    );

    if (match) {
      // Create simulated recovery mail notification in the virtual alerts dispatch system
      const newNotification: EmailNotification = {
        id: `mail_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toLocaleTimeString() + " " + new Date().toLocaleDateString(),
        employeeId: match.id,
        employeeName: match.name,
        teamName: match.team || "Team Alpha",
        pctProd: 100,
        pctEff: 100,
        subject: `[SECURITY] Password Recovery request for ${match.name}`,
        body: `Dear ${match.name},\n\nYou requested a password recovery for your employee portal account.\n\nYour account credentials:\n- Employee ID: ${match.id}\n- Registered Email: ${match.email || "N/A"}\n- Your Secure Password: ${match.password || "N/A"}\n\nPlease retain this information securely.\n\nSincerely,\nWorkspace Security Compliance`,
        supervisorName: match.name,
        supervisorEmail: match.email || "user@workspace.com",
        deliveryStatus: "Sent",
      };
      setMailNotifications((prev) => [newNotification, ...prev]);

      setRecoverySuccess(
        `Verification successful! Your registered password is: "${match.password}". A simulated backup confirmation notice has also been dispatched to the alert system logs.`
      );
      setRecoveryEmail("");
    } else {
      setRecoveryError("No registered employee was found matching that Email or Employee ID.");
    }
  };

  const handleToggleOwnerMode = () => {
    if (isOwnerMode) {
      setIsOwnerMode(false);
    } else {
      setPasswordInput("");
      setPasswordError(null);
      setShowPasswordModal(true);
    }
  };

  const handleVerifyPassword = () => {
    if (passwordInput.trim() === adminPassword.trim()) {
      setIsOwnerMode(true);
      setShowPasswordModal(false);
      setPasswordError(null);
    } else {
      setPasswordError("Incorrect password. Please try again.");
    }
  };

  const handleUpdatePassword = () => {
    // If not in owner mode, we need to verify current password before changing it
    if (!isOwnerMode) {
      if (currentPasswordInput.trim() !== adminPassword.trim()) {
        setPasswordUpdateError("Incorrect current password.");
        return;
      }
    }
    const cleanNewPass = newPasswordInput.trim();
    if (cleanNewPass.length < 4) {
      setPasswordUpdateError("Password must be at least 4 characters long.");
      return;
    }
    if (cleanNewPass !== confirmPasswordInput.trim()) {
      setPasswordUpdateError("Passwords do not match.");
      return;
    }

    setAdminPassword(cleanNewPass);
    setPasswordUpdateError(null);
    setPasswordUpdateSuccess(true);
    
    // Auto close after showing success for a second
    setTimeout(() => {
      setShowChangePasswordModal(false);
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      setCurrentPasswordInput("");
      setPasswordUpdateSuccess(false);
    }, 1500);
  };

  // Dynamic state / confirmation handlers (safe inside iframe)
  const [activeDeleteUid, setActiveDeleteUid] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState<string | null>(null);

  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeletePassword, setBulkDeletePassword] = useState("");
  const [bulkDeletePasswordError, setBulkDeletePasswordError] = useState<string | null>(null);

  const [showWipeAllModal, setShowWipeAllModal] = useState(false);
  const [wipeAllPassword, setWipeAllPassword] = useState("");
  const [wipeAllPasswordError, setWipeAllPasswordError] = useState<string | null>(null);

  // Load/Save dynamic employees list
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = safeStorage.getItem("productivity_employees_v2");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((emp: any) => emp.id && !emp.id.toString().toUpperCase().startsWith("EMP"));
          const hasOldSeed = parsed.some((emp: any) => emp.id && emp.id.toString().toUpperCase().startsWith("EMP"));
          if (hasOldSeed) {
            safeStorage.removeItem("productivity_logs_v2");
            return SEED_EMPLOYEES;
          }
          // Populate default login credentials for seed / existing profiles if not set
          return filtered.map((emp: any) => {
            const seedMatch = SEED_EMPLOYEES.find(se => se.id.toUpperCase() === emp.id.toUpperCase());
            const hasEmail = !!emp.email;
            const hasPassword = !!emp.password;
            const sanitizedName = emp.name?.toLowerCase().replace(/[^a-z0-9]/g, "") || emp.id.toLowerCase();
            return {
              ...emp,
              email: seedMatch ? seedMatch.email : (hasEmail ? emp.email : `${sanitizedName}@workspace.com`),
              password: seedMatch ? seedMatch.password : (hasPassword ? emp.password : "welcome123")
            };
          });
        }
      } catch (e) {
        console.error("Error loading employees from localStorage", e);
      }
    }
    return SEED_EMPLOYEES;
  });

  useEffect(() => {
    safeStorage.setItem("productivity_employees_v2", JSON.stringify(employees));
  }, [employees]);

  // Supervisors and Mail States
  const [supervisors, setSupervisors] = useState<Record<string, { name: string; email: string }>>(() => {
    const saved = safeStorage.getItem("productivity_supervisors_v2");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading supervisors", e);
      }
    }
    return {
      "Team Alpha": { name: "John Miller", email: "john.miller@productivity-portal.com" },
      "Team Beta": { name: "Sarah Connor", email: "sarah.connor@productivity-portal.com" },
      "RSL German": { name: "Heinrich Müller", email: "heinrich.mueller@productivity-portal.com" },
    };
  });

  useEffect(() => {
    safeStorage.setItem("productivity_supervisors_v2", JSON.stringify(supervisors));
  }, [supervisors]);

  const [mailNotifications, setMailNotifications] = useState<EmailNotification[]>(() => {
    const saved = safeStorage.getItem("productivity_mail_notifications_v3");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading mail notifications", e);
      }
    }
    return [];
  });

  useEffect(() => {
    safeStorage.setItem("productivity_mail_notifications_v3", JSON.stringify(mailNotifications));
  }, [mailNotifications]);

  const [acknowledgedLogUids, setAcknowledgedLogUids] = useState<string[]>(() => {
    const saved = safeStorage.getItem("productivity_acknowledged_log_uids_v3");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error loading acknowledgedLogUids", e);
      }
    }
    return [];
  });

  useEffect(() => {
    safeStorage.setItem("productivity_acknowledged_log_uids_v3", JSON.stringify(acknowledgedLogUids));
  }, [acknowledgedLogUids]);

  const [autoDispatchEnabled, setAutoDispatchEnabled] = useState<boolean>(() => {
    const saved = safeStorage.getItem("productivity_auto_dispatch_enabled_v3");
    return saved === null ? true : saved === "true";
  });

  useEffect(() => {
    safeStorage.setItem("productivity_auto_dispatch_enabled_v3", autoDispatchEnabled ? "true" : "false");
  }, [autoDispatchEnabled]);

  const [mailToast, setMailToast] = useState<{
    id: string;
    message: string;
    recipient: string;
    details: string;
  } | null>(null);

  const handleUpdateSupervisor = (teamName: string, name: string, email: string) => {
    setSupervisors((prev) => ({
      ...prev,
      [teamName]: { name, email },
    }));
  };

  const handleClearMailNotifications = () => {
    // Collect all current exceptions from existing logs to prevent scanner from auto-resending them
    const currentExceptionUids = logs
      .filter((log) => {
        const target = log.target ?? 11;
        if (target === 0 || log.isLeave || log.isWastewater) return false;
        return log.pctProd < 100 || log.pctEff < 100;
      })
      .map((log) => log.uid);

    setAcknowledgedLogUids((prev) => Array.from(new Set([...prev, ...currentExceptionUids])));
    setMailNotifications([]);
  };

  const handleDeleteMailNotification = (id: string, logUid?: string) => {
    if (logUid) {
      setAcknowledgedLogUids((prev) => Array.from(new Set([...prev, logUid])));
    }
    setMailNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const triggerMailNotification = (log: DailyLog) => {
    // Under performance checks: below 100% target threshold
    const target = log.target ?? 11;
    if (target === 0 || log.isLeave || log.isWastewater) return;

    const isUnderProd = log.pctProd < 100;
    const isUnderEff = log.pctEff < 100;

    if (!isUnderProd && !isUnderEff) return;

    // Immediately acknowledge to prevent duplicate triggers
    setAcknowledgedLogUids((prev) => Array.from(new Set([...prev, log.uid])));

    // Find employee info to determine team assignment
    const emp = employees.find((e) => e.id.toLowerCase() === log.id.toLowerCase());
    const teamName = emp?.team || "Team Alpha";
    const supervisor = supervisors[teamName] || {
      name: `${teamName} Master Supervisor`,
      email: `${teamName.toLowerCase().replace(/[^a-z0-9]/g, "") || "admin"}.supervisor@productivity-portal.com`
    };

    const metricsString = [
      isUnderProd ? `Productivity index is ${log.pctProd.toFixed(1)}% (Target: 100%)` : null,
      isUnderEff ? `Efficiency index is ${log.pctEff.toFixed(1)}% (Target: 100%)` : null,
    ].filter(Boolean).join(" and ");

    const subject = `[KPI ALERT] Employee Performance Sub-100%: ${log.name} (${log.id})`;
    
    const body = `Dear ${supervisor.name},\n\nThis is an automated notification from the Chemical Assembly Support Tracker.\n\nAn employee assigned to your team (${teamName}) has recorded daily performance metrics below the mandatory 100% target threshold.\n\nSummary of KPI Exception:\n- Date: ${log.date}\n- Employee Name: ${log.name}\n- Employee ID: ${log.id}\n- Current Productivity: ${log.pctProd.toFixed(1)}% (Target: 100%)\n- Current Efficiency: ${log.pctEff.toFixed(1)}% (Target: 100%)\n- Alert Condition: ${metricsString}\n\nThis discrepancy has been recorded in the central database. Please evaluate this block and carry out internal team adjustment or log correction where appropriate.\n\nRemediation Actions:\n1. Open the dashboard to investigate\n2. Align with operators on task allocation\n3. Mark as resolved once reviewed.\n\nSincerely,\nCompliance Tracker`;

    const newNotification: EmailNotification = {
      id: `mail_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toLocaleTimeString() + " " + new Date().toLocaleDateString(),
      employeeId: log.id,
      employeeName: log.name,
      teamName,
      pctProd: log.pctProd,
      pctEff: log.pctEff,
      subject,
      body,
      supervisorName: supervisor.name,
      supervisorEmail: supervisor.email,
      deliveryStatus: autoDispatchEnabled ? "Queued (Background agent)" : "Draft (Ready to Send)",
      logUid: log.uid,
    };

    setMailNotifications((prev) => [newNotification, ...prev]);

    if (!autoDispatchEnabled) {
      setMailToast({
        id: newNotification.id,
        message: `📝 Alert Drafted for ${supervisor.name}!`,
        recipient: supervisor.email,
        details: "Under 100% targets recorded. Press Send to transmit.",
      });

      setTimeout(() => {
        setMailToast((prev) => (prev?.id === newNotification.id ? null : prev));
      }, 6500);
      return;
    }
    
    setMailToast({
      id: newNotification.id,
      message: `Supervisor ${supervisor.name} notified for ${log.name}'s KPI drop.`,
      recipient: supervisor.email,
      details: "Connecting to SMTP Relay...",
    });

    // Retrieve live client-configured SMTP Config from safeStorage
    let currentSmtpConfig: SmtpConfig | undefined = undefined;
    const savedSmtpStr = safeStorage.getItem("productivity_smtp_config_v2");
    if (savedSmtpStr) {
      try {
        currentSmtpConfig = JSON.parse(savedSmtpStr);
      } catch (e) {
        console.error("Failed to parse local SMTP settings:", e);
      }
    }

    // Retrieve live client-configured Resend Config from safeStorage
    let currentResendConfig: { apiKey: string; fromEmail: string } | undefined = undefined;
    const savedResendStr = safeStorage.getItem("productivity_resend_config_v3");
    if (savedResendStr) {
      try {
        currentResendConfig = JSON.parse(savedResendStr);
      } catch (e) {
        console.error("Failed to parse local Resend settings:", e);
      }
    }

    // Make the backend call to automatically send the mail in the background with no client interaction required!
    fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: newNotification.id,
        to: supervisor.email,
        toName: supervisor.name,
        subject,
        body,
        smtpConfig: currentSmtpConfig,
        resendConfig: currentResendConfig,
      }),
    })
      .then((res) => {
        // Return JSON parse regardless of status to handle structured failures
        return res.json().then((data) => ({ ok: res.ok, data }));
      })
      .then(({ ok, data }) => {
        if (ok && data.success && data.logEntry) {
          setMailNotifications((prev) =>
            prev.map((n) =>
              n.id === newNotification.id
                ? {
                    ...n,
                    deliveryStatus: data.logEntry.status || "Delivered",
                    smtpLog: data.logEntry.smtpLog,
                  }
                : n
            )
          );
          setMailToast({
            id: newNotification.id,
            message: `✉️ Auto-Dispatched to ${supervisor.name}!`,
            recipient: supervisor.email,
            details: data.message || "100% Automated Background Relay Success ✔",
          });
        } else {
          // Handled structured failure
          const mtaLog = data?.logEntry?.smtpLog || [
            `[Error] transmission failed: ${data?.error || "Unknown relay error"}`
          ];
          setMailNotifications((prev) =>
            prev.map((n) =>
              n.id === newNotification.id
                ? {
                    ...n,
                    deliveryStatus: currentResendConfig?.apiKey ? "Failed (Resend API error)" : "Failed (Check Transport Log)",
                    smtpLog: mtaLog,
                  }
                : n
            )
          );
          setMailToast({
            id: newNotification.id,
            message: `❌ Real SMTP Relay Refused to dispatch`,
            recipient: supervisor.email,
            details: data?.error || "Relay connection issue. Check transport logs.",
          });
        }
      })
      .catch((err) => {
        console.error("Failed clear auto-send delivery:", err);
        setMailNotifications((prev) =>
          prev.map((n) =>
            n.id === newNotification.id
              ? {
                  ...n,
                  deliveryStatus: "Offline Sim-Mode Delivery",
                }
              : n
          )
        );
        setMailToast({
          id: newNotification.id,
          message: `✉️ Delivery Simulated/Queued for ${supervisor.name}`,
          recipient: supervisor.email,
          details: "Saved locally (Offline mode)",
        });
      });

    // Automatically fade out after 6 seconds
    setTimeout(() => {
      setMailToast((prev) => (prev?.id === newNotification.id ? null : prev));
    }, 6500);
  };

  const handleSendMailNotification = (notifId: string) => {
    const notif = mailNotifications.find((n) => n.id === notifId);
    if (!notif) return;

    // Set temporary sending status
    setMailNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, deliveryStatus: "Sending..." } : n))
    );

    setMailToast({
      id: notifId,
      message: `Sending alert to ${notif.supervisorName}...`,
      recipient: notif.supervisorEmail,
      details: "Connecting to Mail Service...",
    });

    // Retrieve configurations
    let currentSmtpConfig: SmtpConfig | undefined = undefined;
    const savedSmtpStr = safeStorage.getItem("productivity_smtp_config_v2");
    if (savedSmtpStr) {
      try {
        currentSmtpConfig = JSON.parse(savedSmtpStr);
      } catch (e) {}
    }

    let currentResendConfig: { apiKey: string; fromEmail: string } | undefined = undefined;
    const savedResendStr = safeStorage.getItem("productivity_resend_config_v3");
    if (savedResendStr) {
      try {
        currentResendConfig = JSON.parse(savedResendStr);
      } catch (e) {}
    }

    fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: notifId,
        to: notif.supervisorEmail,
        toName: notif.supervisorName,
        subject: notif.subject,
        body: notif.body,
        smtpConfig: currentSmtpConfig,
        resendConfig: currentResendConfig,
      }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok && data.success && data.logEntry) {
          setMailNotifications((prev) =>
            prev.map((n) =>
              n.id === notifId
                ? {
                    ...n,
                    deliveryStatus: data.logEntry.status || "Delivered",
                    smtpLog: data.logEntry.smtpLog,
                  }
                : n
            )
          );
          setMailToast({
            id: notifId,
            message: `✉️ Dispatched to ${notif.supervisorName}!`,
            recipient: notif.supervisorEmail,
            details: data.message || "100% Automated Background Relay Success ✔",
          });
        } else {
          const mtaLog = data?.logEntry?.smtpLog || [
            `[Error] transmission failed: ${data?.error || "Unknown relay error"}`
          ];
          setMailNotifications((prev) =>
            prev.map((n) =>
              n.id === notifId
                ? {
                    ...n,
                    deliveryStatus: currentResendConfig?.apiKey ? "Failed (Resend API error)" : "Failed (Check Transport Log)",
                    smtpLog: mtaLog,
                  }
                : n
            )
          );
          setMailToast({
            id: notifId,
            message: `❌ Delivery Refused`,
            recipient: notif.supervisorEmail,
            details: data?.error || "Connection/Authorization issue. Check logs.",
          });
        }
      })
      .catch((err) => {
        console.error("Direct dispatch error:", err);
        setMailNotifications((prev) =>
          prev.map((n) =>
            n.id === notifId
              ? {
                  ...n,
                  deliveryStatus: "Offline Sim-Mode Delivery",
                }
              : n
          )
        );
        setMailToast({
          id: notifId,
          message: `✉️ Simulated Delivery to ${notif.supervisorName}`,
          recipient: notif.supervisorEmail,
          details: "Saved locally (Offline simulator active)",
        });
      });

    setTimeout(() => {
      setMailToast((prev) => (prev?.id === notifId ? null : prev));
    }, 6500);
  };

  // Background scanner effect to auto-dispatch notifications for any existing or new log exception
  useEffect(() => {
    if (logs.length === 0) return;

    // Find any outstanding exceptions that haven't been notified yet
    const pendingExceptions = logs.filter((log) => {
      const target = log.target ?? 11;
      if (target === 0 || log.isLeave || log.isWastewater) return false;

      const isUnderProd = log.pctProd < 100;
      const isUnderEff = log.pctEff < 100;

      if (!isUnderProd && !isUnderEff) return false;

      // Verify if a notification has already been triggered or acknowledged
      const hasNotify = acknowledgedLogUids.includes(log.uid);

      return !hasNotify;
    });

    if (pendingExceptions.length > 0) {
      // Dispatch the first outstanding exception
      const nextLog = pendingExceptions[pendingExceptions.length - 1]; // oldest first
      triggerMailNotification(nextLog);
    }
  }, [logs, supervisors, employees, acknowledgedLogUids]);

  // Track deleted virtual logs to allow them to be deleted dynamically
  const [deletedVirtualUids, setDeletedVirtualUids] = useState<string[]>(() => {
    const saved = safeStorage.getItem("productivity_deleted_virtual_uids_v2");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.error("Error loading deletedVirtualUids from localStorage", e);
      }
    }
    return [];
  });

  useEffect(() => {
    safeStorage.setItem("productivity_deleted_virtual_uids_v2", JSON.stringify(deletedVirtualUids));
  }, [deletedVirtualUids]);

  // Memoize enriched logs which includes virtual leave days of unentered dates for staff
  const enrichedLogs = React.useMemo(() => {
    const enriched = getEnrichedLogs(logs, employees, simulatedToday);
    return enriched.filter((log) => !deletedVirtualUids.includes(log.uid));
  }, [logs, employees, simulatedToday, deletedVirtualUids]);

  const loggedInEmployee = React.useMemo(() => {
    if (!selectedEmployeeId) return null;
    return employees.find((e) => e.id.toUpperCase() === selectedEmployeeId.toUpperCase()) || null;
  }, [selectedEmployeeId, employees]);

  const loggedInTeam = loggedInEmployee?.team || null;

  // Restructure visibility lists so that employees only see their own team's data, while admins see all accumulated data
  const visibleLogs = React.useMemo(() => {
    if (isOwnerMode) {
      return enrichedLogs;
    }
    if (!loggedInTeam) {
      return [];
    }
    return enrichedLogs.filter((log) => {
      const emp = employees.find((e) => e.id.toUpperCase() === log.id.toUpperCase());
      const teamOfLog = emp?.team || "Team Alpha";
      return teamOfLog.toLowerCase() === loggedInTeam.toLowerCase();
    });
  }, [enrichedLogs, isOwnerMode, loggedInTeam, employees]);

  const visibleEmployees = React.useMemo(() => {
    if (isOwnerMode) {
      return employees;
    }
    if (!loggedInTeam) {
      return [];
    }
    return employees.filter((emp) => emp.team?.toLowerCase() === loggedInTeam.toLowerCase());
  }, [employees, isOwnerMode, loggedInTeam]);

  const visibleMailNotifications = React.useMemo(() => {
    if (isOwnerMode) {
      return mailNotifications;
    }
    if (!loggedInTeam) {
      return [];
    }
    return mailNotifications.filter((notif) => {
      return notif.teamName?.toLowerCase() === loggedInTeam.toLowerCase();
    });
  }, [mailNotifications, isOwnerMode, loggedInTeam]);

  // Dynamic deletion timers removed to prefer explicit password confirmations
  // Core Mutation Actions
  const handleAddLog = (newLog: DailyLog) => {
    // Add to state and alert
    setLogs((prev) => [newLog, ...prev]);
    triggerMailNotification(newLog);
  };

  const handleUpdateLog = (updatedLog: DailyLog) => {
    // Convert edited virtual leave logs into a real physical DB entry
    let finalLog = updatedLog;
    if (updatedLog.uid.startsWith("virtual_")) {
      const realLog = {
        ...updatedLog,
        uid: `log_${Date.now()}` // assign new timestamp unique identifier
      };
      setLogs((prev) => [realLog, ...prev]);
      finalLog = realLog;
    } else {
      setLogs((prev) => prev.map((log) => (log.uid === updatedLog.uid ? updatedLog : log)));
    }
    // Untrack the updated log to allow notification recalculation
    setAcknowledgedLogUids((prev) => prev.filter((uid) => uid !== finalLog.uid));
    triggerMailNotification(finalLog);
  };

  const handleDeleteLog = (uid: string) => {
    if (isOwnerMode) {
      if (uid.startsWith("virtual_")) {
        setDeletedVirtualUids((prev) => [...prev, uid]);
      } else {
        setLogs((prev) => prev.filter((log) => log.uid !== uid));
      }
      setSelectedUids((prev) => prev.filter((u) => u !== uid));
    } else {
      setActiveDeleteUid(uid);
      setDeletePassword("");
      setDeletePasswordError(null);
    }
  };

  const handleConfirmDeleteIndividual = () => {
    if (deletePassword.trim() === adminPassword.trim()) {
      if (activeDeleteUid) {
        if (activeDeleteUid.startsWith("virtual_")) {
          setDeletedVirtualUids((prev) => [...prev, activeDeleteUid]);
        } else {
          setLogs((prev) => prev.filter((log) => log.uid !== activeDeleteUid));
        }
        setSelectedUids((prev) => prev.filter((u) => u !== activeDeleteUid));
      }
      setActiveDeleteUid(null);
      setDeletePassword("");
      setDeletePasswordError(null);
    } else {
      setDeletePasswordError("Incorrect Admin Password.");
    }
  };

  const handleDeleteLogsClick = () => {
    if (selectedUids.length === 0) return;
    if (isOwnerMode) {
      // Directly delete when already authenticated as owner!
      const virtuals = selectedUids.filter((uid) => uid.startsWith("virtual_"));
      const physicals = selectedUids.filter((uid) => !uid.startsWith("virtual_"));
      if (virtuals.length > 0) {
        setDeletedVirtualUids((prev) => [...prev, ...virtuals]);
      }
      if (physicals.length > 0) {
        setLogs((prev) => prev.filter((log) => !physicals.includes(log.uid)));
      }
      setSelectedUids([]);
    } else {
      setBulkDeletePassword("");
      setBulkDeletePasswordError(null);
      setShowBulkDeleteModal(true);
    }
  };

  const handleConfirmBulkDelete = () => {
    if (bulkDeletePassword.trim() === adminPassword.trim()) {
      const virtuals = selectedUids.filter((uid) => uid.startsWith("virtual_"));
      const physicals = selectedUids.filter((uid) => !uid.startsWith("virtual_"));
      if (virtuals.length > 0) {
        setDeletedVirtualUids((prev) => [...prev, ...virtuals]);
      }
      if (physicals.length > 0) {
        setLogs((prev) => prev.filter((log) => !physicals.includes(log.uid)));
      }
      setSelectedUids([]);
      setShowBulkDeleteModal(false);
      setBulkDeletePassword("");
      setBulkDeletePasswordError(null);
    } else {
      setBulkDeletePasswordError("Incorrect Admin Password.");
    }
  };

  const handleDeleteAllClick = () => {
    setWipeAllPassword("");
    setWipeAllPasswordError(null);
    setShowWipeAllModal(true);
  };

  const handleConfirmWipeAll = () => {
    if (wipeAllPassword.trim() === adminPassword.trim()) {
      setLogs([]);
      setEmployees([]);
      setDeletedVirtualUids([]);
      setSelectedUids([]);
      setShowWipeAllModal(false);
      setWipeAllPassword("");
      setWipeAllPasswordError(null);
    } else {
      setWipeAllPasswordError("Incorrect Admin Password.");
    }
  };

  const handleRestoreDatabase = (restoredLogs: DailyLog[], restoredEmployees: Employee[]) => {
    setLogs(restoredLogs);
    setEmployees(restoredEmployees);
    setDeletedVirtualUids([]);
  };

  const handleAddEmployee = (id: string, name: string, team?: string, department?: string): boolean => {
    const cleanId = id.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanTeam = team?.trim() || "Team Alpha";
    const cleanDept = department?.trim() || "Assembly";
    if (employees.some((emp) => emp.id === cleanId)) {
      return false; // already exists
    }
    const sanitizedName = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "") || cleanId.toLowerCase();
    const generatedEmail = `${sanitizedName}@workspace.com`;
    setEmployees((prev) => [...prev, { 
      id: cleanId, 
      name: cleanName, 
      team: cleanTeam, 
      department: cleanDept,
      email: generatedEmail,
      password: "welcome123"
    }]);
    return true;
  };

  const handleRemoveEmployee = (id: string) => {
    setEmployees((prev) => prev.filter((emp) => emp.id !== id));
  };

  const handleUpdateEmployee = (updatedEmployee: Employee) => {
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === updatedEmployee.id ? updatedEmployee : emp))
    );
    // Cascade employee name update to any of their daily logs
    setLogs((prev) =>
      prev.map((log) => {
        if (log.id.toUpperCase() === updatedEmployee.id.toUpperCase()) {
          return { ...log, name: updatedEmployee.name };
        }
        return log;
      })
    );
  };

  const handleRenameTeam = (oldTeamName: string, newTeamName: string) => {
    const cleanOld = oldTeamName.trim();
    const cleanNew = newTeamName.trim();
    if (!cleanNew || cleanOld.toLowerCase() === cleanNew.toLowerCase()) {
      return;
    }
    setEmployees((prev) =>
      prev.map((emp) => {
        const empTeam = emp.team || "Team Alpha";
        if (empTeam.toLowerCase() === cleanOld.toLowerCase()) {
          return { ...emp, team: cleanNew };
        }
        return emp;
      })
    );
  };

  const handleRenameDepartment = (oldDeptName: string, newDeptName: string) => {
    const cleanOld = oldDeptName.trim();
    const cleanNew = newDeptName.trim();
    if (!cleanNew || cleanOld.toLowerCase() === cleanNew.toLowerCase()) {
      return;
    }
    setEmployees((prev) =>
      prev.map((emp) => {
        const empDept = emp.department || "Assembly";
        if (empDept.toLowerCase() === cleanOld.toLowerCase()) {
          return { ...emp, department: cleanNew };
        }
        return emp;
      })
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      
      {/* Dynamic Header banner */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo / Title Block */}
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center shadow-3xs shrink-0 select-none">
              <FileSpreadsheet className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold font-display text-slate-950 tracking-tight flex flex-wrap items-center gap-2">
                Productivity & Efficiency Tracker (Chemical Approval)
              </h1>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Calculates productivity, working durations, and attendance efficiency quotas.
              </p>
            </div>
          </div>

          {/* Simulation Controllers (The heart of explaining locking mechanism) */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-100 p-2 rounded-2xl border border-slate-200">
            {/* Active Workspace / Identity Badge */}
            {selectedEmployeeId && (
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-950 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-3xs">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                  👤 <span className="font-bold text-indigo-900">{loggedInEmployee?.name || selectedEmployeeId}</span> ({loggedInTeam || "No Team"})
                </span>
                <button
                  onClick={() => {
                    setSelectedEmployeeId(null);
                    setCheckInId("");
                  }}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline bg-transparent border-0 cursor-pointer pl-1"
                  title="Switch profile to view another team or authenticate as administrator"
                >
                  Switch Profile
                </button>
              </div>
            )}

            {/* Owner rights trigger */}
            <button
              onClick={handleToggleOwnerMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                isOwnerMode
                  ? "bg-indigo-600 text-white shadow-xs animate-pulse"
                  : "bg-white text-slate-700 hover:text-slate-900 shadow-3xs"
              }`}
              title="Spreadsheet Owner can edit locked past rows, mimicking sheet protection schemas."
            >
              {isOwnerMode ? (
                <>
                  <Unlock className="w-3.5 h-3.5 text-indigo-200 animate-bounce" />
                  Admin Mode: Approved Organization Access
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  Worker Mode (Auto-Locking)
                </>
              )}
            </button>

            {/* Quick access Change Password */}
            <button
              onClick={() => {
                setNewPasswordInput("");
                setConfirmPasswordInput("");
                setCurrentPasswordInput("");
                setPasswordUpdateError(null);
                setPasswordUpdateSuccess(false);
                setShowChangePasswordModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all bg-white hover:bg-slate-50 text-slate-700 hover:text-indigo-650 border border-slate-200 hover:border-slate-300 shadow-3xs"
              title="Configure/Change tracker password of Administrator"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Change Password
            </button>

            {/* Simulated target date selector */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white px-2.5 py-1 rounded-xl shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <label className="font-semibold text-slate-500 font-sans uppercase tracking-[0.05em] text-[10px]">
                System Today:
              </label>
              <input
                type="date"
                value={simulatedToday}
                onChange={(e) => handleSimulatedTodayChange(e.target.value)}
                className="font-mono text-xs border-0 bg-transparent text-slate-950 focus:ring-0 p-0 font-bold focus:outline-hidden"
                title="Change system's calendar date to test midnight-protection locks on historical data!"
              />
              {isDateManuallyChanged && (
                <button
                  type="button"
                  onClick={resetSimulatedToday}
                  className="ml-1 px-1.5 py-0.5 text-[9px] bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold rounded-md border border-amber-200 transition-colors cursor-pointer"
                  title="Reset to today's real date and resume automated calendar sync"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Owner-Only Security & Database Operations Panel */}
        {isOwnerMode && (
          <div className="bg-rose-50/50 p-4 border border-rose-100 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs font-sans text-rose-950 leading-relaxed shadow-3xs animate-in slide-in-from-top-2 duration-200">
            <div className="flex gap-2.5 items-start">
              <ShieldAlert className="w-5 h-5 text-rose-600 mt-0.5 shrink-0 animate-bounce" />
              <div>
                <span className="font-bold block text-rose-950">Active Owner Authorization Controls:</span>
                Your cryptographic bypass token grants high-privilege direct database clearance rights. Use checkboxes in the table below to select records for deletion.
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 self-end lg:self-center">
              {/* Change Owner Password */}
              <button
                onClick={() => {
                  setNewPasswordInput("");
                  setConfirmPasswordInput("");
                  setPasswordUpdateError(null);
                  setPasswordUpdateSuccess(false);
                  setShowChangePasswordModal(true);
                }}
                className="text-xs font-medium px-4 py-2 text-slate-700 hover:text-indigo-600 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 shadow-3xs transition-all cursor-pointer font-sans rounded-xl flex items-center justify-center gap-1.5"
                title="Change the Admin/Owner password"
              >
                <Lock className="w-3.5 h-3.5" />
                Change Password
              </button>

              {/* Delete Logs (Clear Daily Worksheet) */}
              <button
                disabled={selectedUids.length === 0}
                onClick={handleDeleteLogsClick}
                className={`text-xs font-medium px-4 py-2 transition-all font-sans whitespace-nowrap border rounded-xl flex items-center justify-center gap-1.5 duration-200 ${
                  selectedUids.length === 0
                    ? "opacity-50 cursor-not-allowed bg-slate-100/50 text-slate-400 border-slate-200"
                    : "text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 border-rose-200 hover:border-rose-300 shadow-3xs cursor-pointer"
                }`}
                title={selectedUids.length === 0 ? "Check logs below first to delete them" : "Delete selected items"}
              >
                <Trash className="w-3.5 h-3.5" />
                Delete Selected Data ({selectedUids.length})
              </button>

              {/* Delete All Data Point */}
              <button
                onClick={handleDeleteAllClick}
                className="text-xs font-medium px-4 py-2 text-rose-800 hover:text-rose-900 bg-rose-100/50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 shadow-3xs transition-all cursor-pointer font-sans whitespace-nowrap rounded-xl flex items-center justify-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Delete All Data
              </button>
            </div>
          </div>
        )}

        {/* If employee hasn't checked in yet and not in Admin Mode, show beautiful Check-In panel */}
        {!isOwnerMode && !selectedEmployeeId ? (
          <div className="max-w-md mx-auto my-12 bg-white rounded-3xl border border-slate-200 p-8 shadow-md space-y-6 animate-in fade-in duration-200">
            <div className="flex justify-center">
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-3xs shrink-0 select-none">
                <Users className="w-8 h-8 text-indigo-600 animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-1.5 text-center">
              <h2 className="text-xl font-bold font-display text-slate-950 tracking-tight text-center">Workspace Authentication</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed font-sans text-center">
                Access your team metrics and submit daily support worksheets securely.
              </p>
            </div>

            {/* Auth Mode Tabs */}
            <div className="flex border-b border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError(null);
                  setAuthSuccessMessage(null);
                }}
                className={`flex-1 pb-2.5 text-xs font-bold uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer ${
                  authMode === "login"
                    ? "border-indigo-600 text-indigo-600 font-extrabold"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("register");
                  setAuthError(null);
                  setAuthSuccessMessage(null);
                }}
                className={`flex-1 pb-2.5 text-xs font-bold uppercase tracking-wider text-center border-b-2 transition-all cursor-pointer ${
                  authMode === "register"
                    ? "border-indigo-600 text-indigo-600 font-extrabold"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Register Employee
              </button>
            </div>

            {/* Inline Notifications */}
            {authError && (
              <div className="bg-rose-50 border border-rose-100 text-rose-900 text-xs py-2.5 px-3.5 rounded-xl font-sans flex items-start gap-1.5 animate-in slide-in-from-top-1 duration-205">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {authSuccessMessage && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-950 text-xs py-2.5 px-3.5 rounded-xl font-sans flex items-start gap-1.5 animate-in slide-in-from-top-1 duration-205">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{authSuccessMessage}</span>
              </div>
            )}

            {/* Submit Form */}
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === "login" ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-sans">
                      Mail ID (Email Address)
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. shahadat@workspace.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-sans">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryEmail("");
                          setRecoverySuccess(null);
                          setRecoveryError(null);
                          setShowRecoveryModal(true);
                        }}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline transition-all cursor-pointer font-sans"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="Enter password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all text-slate-800"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-left">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-sans">
                        Employee Code/ID
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. D9123"
                        value={regId}
                        onChange={(e) => setRegId(e.target.value)}
                        className="w-full text-xs font-medium border border-slate-200 rounded-xl px-2.5 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-sans">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. John Doe"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full text-xs font-medium border border-slate-200 rounded-xl px-2.5 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-sans">
                      Mail ID (Email Address)
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. john.doe@workspace.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-sans">
                        Password
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Set password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full text-xs font-medium border border-slate-200 rounded-xl px-2.5 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-sans">
                        Department
                      </label>
                      <input
                        type="text"
                        placeholder="Chemical Approval"
                        value={regDept}
                        onChange={(e) => setRegDept(e.target.value)}
                        className="w-full text-xs font-medium border border-slate-200 rounded-xl px-2.5 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Team Assignment Selection */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-sans">
                      Assign Team Workspace
                    </label>
                    <select
                      value={regTeam}
                      onChange={(e) => setRegTeam(e.target.value)}
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all cursor-pointer text-slate-700"
                    >
                      {Array.from(new Set(employees.map(e => e.team || "Team Alpha"))).map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                      <option value="CUSTOM">-- Create Custom Team... --</option>
                    </select>
                  </div>

                  {regTeam === "CUSTOM" && (
                    <div className="space-y-1 animate-in slide-in-from-top-1 duration-150">
                      <label className="block text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest font-sans">
                        New Custom Team Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Team Gamma"
                        value={regTeamCustom}
                        onChange={(e) => setRegTeamCustom(e.target.value)}
                        className="w-full text-xs font-medium border border-indigo-200 rounded-xl px-3 py-2 bg-indigo-50/20 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all text-slate-800"
                      />
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white hover:shadow-xs rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
              >
                {authMode === "login" ? "Enter Team Workspace" : "Register and Sign In"}
              </button>
            </form>

            {/* Quick credentials details drawer */}
            <details className="text-left bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] text-slate-500 font-mono">
              <summary className="font-bold text-slate-700 cursor-pointer hover:text-indigo-600 select-none">
                💡 View Demo Credentials (Team Isolation)
              </summary>
              <div className="mt-2 space-y-2 bg-white p-2 rounded-lg border border-slate-100">
                <p className="text-[10px] leading-relaxed">Use these seeded worker accounts to test role-assigned team visibility constraints:</p>
                <ul className="list-disc pl-4 space-y-1 mt-1 text-slate-600 text-[10px]">
                  <li><strong>Email:</strong> <span className="text-indigo-600">shahadat@workspace.com</span> | <kbd className="bg-slate-150 px-1 rounded">welcome123</kbd> <span className="text-slate-400">[RSL German]</span></li>
                  <li><strong>Email:</strong> <span className="text-indigo-600">mahfuzul@workspace.com</span> | <kbd className="bg-slate-150 px-1 rounded">welcome123</kbd> <span className="text-slate-400">[RSL German]</span></li>
                  <li><strong>Email:</strong> <span className="text-indigo-600">basher@workspace.com</span> | <kbd className="bg-slate-150 px-1 rounded">welcome123</kbd> <span className="text-slate-400">[RSL German]</span></li>
                </ul>
                <p className="mt-1 text-[10px] text-slate-400 leading-normal font-sans">Or register a brand-new employee in any other team (like <span className="italic">"Team Alpha"</span>) to verify real-time team isolation.</p>
              </div>
            </details>

            {/* Admin toggle */}
            <div className="border-t border-slate-100 pt-4 flex flex-col items-center gap-2 text-center">
              <p className="text-[10px] text-slate-400 font-medium font-sans">
                Are you an Organization Administrator?
              </p>
              <button
                type="button"
                onClick={handleToggleOwnerMode}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1.5 cursor-pointer font-sans mx-auto"
              >
                <Lock className="w-3.5 h-3.5" />
                Unlock Administrator Master Access
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Global Highlight Metrics */}
            <MetricCards logs={visibleLogs} employees={visibleEmployees} simulatedToday={simulatedToday} onSimulatedTodayChange={handleSimulatedTodayChange} />

            {/* Menu Tabs Navigation */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-px">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab("journal")}
                  className={`pb-3 text-sm font-semibold tracking-wide relative cursor-pointer transition-all flex items-center gap-2 ${
                    activeTab === "journal"
                      ? "text-indigo-600 font-bold border-b-2 border-indigo-600"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Daily Logs
                </button>
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`pb-3 text-sm font-semibold tracking-wide relative cursor-pointer transition-all flex items-center gap-2 ${
                    activeTab === "dashboard"
                      ? "text-indigo-600 font-bold border-b-2 border-indigo-600"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Analytics Dashboard
                </button>
                <button
                  onClick={() => setActiveTab("summaries")}
                  className={`pb-3 text-sm font-semibold tracking-wide relative cursor-pointer transition-all flex items-center gap-2 ${
                    activeTab === "summaries"
                      ? "text-indigo-600 font-bold border-b-2 border-indigo-600"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  Spreadsheet Summaries
                </button>
                {isOwnerMode && (
                  <button
                    onClick={() => setActiveTab("sync")}
                    className={`pb-3 text-sm font-semibold tracking-wide relative cursor-pointer transition-all flex items-center gap-2 ${
                      activeTab === "sync"
                        ? "text-indigo-600 font-bold border-b-2 border-indigo-600"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    <Award className="w-4 h-4" />
                    Backup & Sheets Sync
                  </button>
                )}
                <button
                  onClick={() => setActiveTab("directory")}
                  className={`pb-3 text-sm font-semibold tracking-wide relative cursor-pointer transition-all flex items-center gap-2 ${
                    activeTab === "directory"
                      ? "text-indigo-600 font-bold border-b-2 border-indigo-600"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Staff Directory
                </button>
              </div>

              {activeTab === "journal" && !isFormOpen && (
                <button
                  onClick={() => setIsFormOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs py-1.5 px-3.5 rounded-xl cursor-pointer shadow-sm transition-all flex items-center gap-1.5 font-sans"
                >
                  <Plus className="w-4 h-4" />
                  Add Entry
                </button>
              )}
            </div>

            {/* Tab views content */}
            <div>
              {activeTab === "journal" && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {isFormOpen && (
                    <InputForm
                      onAddLog={handleAddLog}
                      onClose={() => setIsFormOpen(false)}
                      existingLogs={logs}
                      employees={visibleEmployees}
                    />
                  )}
                  <DataTable
                    logs={visibleLogs}
                    simulatedToday={simulatedToday}
                    isOwnerMode={isOwnerMode}
                    onDeleteLog={handleDeleteLog}
                    onUpdateLog={handleUpdateLog}
                    employees={visibleEmployees}
                    selectedUids={selectedUids}
                    setSelectedUids={setSelectedUids}
                  />
                </div>
              )}

              {activeTab === "dashboard" && (
                <div className="animate-in fade-in duration-200">
                  <DashboardView
                    logs={visibleLogs}
                    employees={visibleEmployees}
                    supervisors={supervisors}
                    mailNotifications={visibleMailNotifications}
                    onClearMailNotifications={handleClearMailNotifications}
                    onDeleteMailNotification={handleDeleteMailNotification}
                    onSendMailNotification={handleSendMailNotification}
                    autoDispatchEnabled={autoDispatchEnabled}
                    onToggleAutoDispatch={() => setAutoDispatchEnabled(!autoDispatchEnabled)}
                  />
                </div>
              )}

              {activeTab === "summaries" && (
                <div className="animate-in fade-in duration-200">
                  <SummariesView logs={visibleLogs} employees={visibleEmployees} />
                </div>
              )}

              {activeTab === "sync" && isOwnerMode && (
                <div className="animate-in fade-in duration-200">
                  <GoogleSheetsIntegration
                    logs={visibleLogs}
                    employees={visibleEmployees}
                    adminPassword={adminPassword}
                    onRestoreDatabase={handleRestoreDatabase}
                  />
                </div>
              )}

              {activeTab === "directory" && (
                <div className="animate-in fade-in duration-200">
                  <StaffDirectory
                    employees={visibleEmployees}
                    logs={visibleLogs}
                    adminPassword={adminPassword}
                    isOwnerMode={isOwnerMode}
                    onAddEmployee={handleAddEmployee}
                    onRemoveEmployee={handleRemoveEmployee}
                    onUpdateEmployee={handleUpdateEmployee}
                    onRenameTeam={handleRenameTeam}
                    onRenameDepartment={handleRenameDepartment}
                    supervisors={supervisors}
                    onUpdateSupervisor={handleUpdateSupervisor}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Individual Row Deletion Confirmation Modal */}
        {activeDeleteUid && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex gap-3 items-start">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm font-sans">Delete Intake Record</h3>
                  <p className="text-xs text-slate-500 font-sans mt-1">
                    No data can be deleted without an admin password. Please enter the password below to authorize.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
                  Admin Password
                </label>
                <input
                  type="password"
                  placeholder="Enter Admin Password"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value);
                    setDeletePasswordError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleConfirmDeleteIndividual();
                    }
                  }}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-rose-500 focus:outline-hidden transition-all font-mono"
                  autoFocus
                />
                {deletePasswordError && (
                  <p className="text-[10px] text-rose-600 font-bold font-sans animate-pulse">
                    ⚠️ {deletePasswordError}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 mt-1 font-mono">
                  Hint: password is <span className="font-bold text-slate-700">{adminPassword}</span>
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => {
                    setActiveDeleteUid(null);
                    setDeletePassword("");
                    setDeletePasswordError(null);
                  }}
                  className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDeleteIndividual}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-xl cursor-pointer transition-all shadow-3xs"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Selected Rows Deletion Modal */}
        {showBulkDeleteModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex gap-3 items-start">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <ShieldAlert className="w-5 h-5 text-rose-600 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm font-sans">Delete Selected Data</h3>
                  <p className="text-xs text-slate-500 font-sans mt-1">
                    You have selected <span className="font-extrabold text-slate-800">{selectedUids.length}</span> records for absolute deletion. Enter password to authorize.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
                  Admin Password
                </label>
                <input
                  type="password"
                  placeholder="Enter Admin Password"
                  value={bulkDeletePassword}
                  onChange={(e) => {
                    setBulkDeletePassword(e.target.value);
                    setBulkDeletePasswordError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleConfirmBulkDelete();
                    }
                  }}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-rose-500 focus:outline-hidden transition-all font-mono"
                  autoFocus
                />
                {bulkDeletePasswordError && (
                  <p className="text-[10px] text-rose-600 font-bold font-sans animate-pulse">
                    ⚠️ {bulkDeletePasswordError}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 mt-1 font-mono">
                  Hint: password is <span className="font-bold text-slate-700">{adminPassword}</span>
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => {
                    setShowBulkDeleteModal(false);
                    setBulkDeletePassword("");
                    setBulkDeletePasswordError(null);
                  }}
                  className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBulkDelete}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-semibold rounded-xl cursor-pointer transition-all shadow-3xs"
                >
                  Bulk Delete Records
                </button>
              </div>
            </div>
          </div>
        )}

        {/* System Wipe All Data Modal */}
        {showWipeAllModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex gap-3 items-start">
                <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
                  <ShieldAlert className="w-5 h-5 text-rose-700 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm font-sans">Absolute Factory Recovery</h3>
                  <p className="text-xs text-rose-700 font-sans mt-1 leading-normal font-semibold">
                    Warning! This wipes all employee roster directory records and worksheet logs. Enter admin password to wipe.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
                  Admin Password
                </label>
                <input
                  type="password"
                  placeholder="Enter Admin Password"
                  value={wipeAllPassword}
                  onChange={(e) => {
                    setWipeAllPassword(e.target.value);
                    setWipeAllPasswordError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleConfirmWipeAll();
                    }
                  }}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-100 border-rose-200 focus:bg-white focus:border-rose-500 focus:outline-hidden transition-all font-mono"
                  autoFocus
                />
                {wipeAllPasswordError && (
                  <p className="text-[10px] text-rose-600 font-bold font-sans animate-pulse">
                    ⚠️ {wipeAllPasswordError}
                  </p>
                )}
                <p className="text-[10px] text-slate-400 mt-1 font-mono">
                  Hint: password is <span className="font-bold text-slate-700">{adminPassword}</span>
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => {
                    setShowWipeAllModal(false);
                    setWipeAllPassword("");
                    setWipeAllPasswordError(null);
                  }}
                  className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmWipeAll}
                  className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded-xl cursor-pointer transition-all shadow-3xs font-sans"
                >
                  Execute Total Wipeout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Admin Password Entry Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex gap-3 items-start">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Lock className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm font-sans">Elevated Owner Override</h3>
                  <p className="text-xs text-slate-500 font-sans mt-1">
                    Enter the admin password to toggle Owner privileges and bypass sheet protections.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-sans">
                    Admin Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter owner password"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleVerifyPassword();
                      }
                    }}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
                    autoFocus
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    Hint: password is <span className="font-bold text-slate-700">{adminPassword}</span>
                  </p>
                  {passwordError && (
                    <p className="text-[10px] text-rose-600 font-bold mt-1.5 font-sans">
                      ⚠️ {passwordError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifyPassword}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors shadow-3xs"
                >
                  Unlock Owner Rights
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Password Recovery Modal */}
        {showRecoveryModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-xl space-y-4 animate-in zoom-in-95 duration-150 text-left">
              <div className="flex gap-3 items-start">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <KeyRound className="w-5 h-5 text-indigo-600 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm font-sans">Password Recovery</h3>
                  <p className="text-xs text-slate-500 font-sans mt-1">
                    Enter your registered Mail ID or Employee ID to look up your portal credentials.
                  </p>
                </div>
              </div>

              <form onSubmit={handlePasswordRecovery} className="space-y-3 pt-1">
                {recoveryError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-900 text-xs py-2 px-3 rounded-lg font-sans">
                    ⚠️ {recoveryError}
                  </div>
                )}
                {recoverySuccess && (
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-950 text-xs py-2.5 px-3 rounded-xl font-sans leading-relaxed select-all">
                    ✔ {recoverySuccess}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-sans">
                    Mail ID or Employee Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. shahadat@workspace.com or D9771"
                    value={recoveryEmail}
                    onChange={(e) => {
                      setRecoveryEmail(e.target.value);
                      setRecoveryError(null);
                      setRecoverySuccess(null);
                    }}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all text-slate-800 font-sans"
                    autoFocus
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRecoveryModal(false);
                      setRecoveryError(null);
                      setRecoverySuccess(null);
                    }}
                    className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-all shadow-3xs font-sans"
                  >
                    Recover Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Change Owner Password Modal */}
        {showChangePasswordModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex gap-3 items-start">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Lock className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm font-sans">Update Owner Password</h3>
                  <p className="text-xs text-slate-500 font-sans mt-1">
                    Set a secure custom password to lock and protect spreadsheet operations.
                  </p>
                </div>
              </div>

              {passwordUpdateSuccess ? (
                <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-100 flex items-center gap-2 text-xs font-sans animate-bounce duration-200 animate-in fade-in">
                  <span className="text-lg">✓</span>
                  <div>
                    <p className="font-bold">Password Updated Successfully!</p>
                    <p className="text-[10px] text-emerald-600">The new password is now active and stored.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {!isOwnerMode && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-sans">
                        Current Password
                      </label>
                      <input
                        type="password"
                        placeholder="Enter current password"
                        value={currentPasswordInput}
                        onChange={(e) => {
                          setCurrentPasswordInput(e.target.value);
                          setPasswordUpdateError(null);
                        }}
                        className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all font-mono"
                        autoFocus
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-sans">
                      New Password
                    </label>
                    <input
                      type="text"
                      placeholder="Enter new custom password"
                      value={newPasswordInput}
                      onChange={(e) => {
                        setNewPasswordInput(e.target.value);
                        setPasswordUpdateError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleUpdatePassword();
                        }
                      }}
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
                      autoFocus={isOwnerMode}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 font-sans">
                      Confirm Password
                    </label>
                    <input
                      type="text"
                      placeholder="Confirm new custom password"
                      value={confirmPasswordInput}
                      onChange={(e) => {
                        setConfirmPasswordInput(e.target.value);
                        setPasswordUpdateError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleUpdatePassword();
                        }
                      }}
                      className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
                    />
                  </div>

                  {passwordUpdateError && (
                    <p className="text-[10px] text-rose-600 font-bold mt-1.5 font-sans">
                      ⚠️ {passwordUpdateError}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <button
                  disabled={passwordUpdateSuccess}
                  onClick={() => setShowChangePasswordModal(false)}
                  className="px-3.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  disabled={passwordUpdateSuccess}
                  onClick={handleUpdatePassword}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors shadow-3xs disabled:opacity-40"
                >
                  Update Password
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Mail Dispatch Notification Toast */}
        {mailToast && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white rounded-2xl shadow-2xl p-4 border border-indigo-500/30 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="p-2 bg-indigo-600/30 rounded-xl text-indigo-400 shrink-0">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
            </div>
            <div className="flex-1 min-w-0 font-sans">
              <h4 className="text-xs font-black text-indigo-300 uppercase tracking-widest">
                Email Dispatch Sim
              </h4>
              <p className="text-xs font-extrabold text-white mt-1 leading-snug">
                {mailToast.message}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                Routed to: {mailToast.recipient}
              </p>
              <div className="mt-2 text-[9px] text-indigo-200/80 font-semibold bg-white/5 py-1 px-2 rounded-lg inline-block font-mono">
                {mailToast.details}
              </div>
            </div>
            <button
              onClick={() => setMailToast(null)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

      </main>

      {/* Humble aesthetic footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-500 py-6 text-xs text-center font-sans mt-auto">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="text-slate-400 font-medium font-sans">
            Productivity & Efficiency Ledger
          </p>
          <p className="text-indigo-400 font-semibold font-sans text-[11px] mt-1 text-slate-400/80">
            Created by <span className="text-indigo-400 font-bold select-all">Shahadat Hossain Khanduker</span>
          </p>
          <p className="text-slate-600 text-[10px]">
            © {new Date().getFullYear()} Workspace Productivity Portal
          </p>
        </div>
      </footer>

    </div>
  );
}
