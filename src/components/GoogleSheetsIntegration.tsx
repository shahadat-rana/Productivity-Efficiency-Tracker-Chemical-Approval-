import React, { useState, useEffect } from "react";
import { Database, Copy, Check, Info, FileSpreadsheet, Download, RefreshCw, Terminal, Play, Upload, FolderOpen, ShieldCheck, History, Settings } from "lucide-react";
import { DailyLog, Employee } from "../types";
import { safeStorage } from "../utils/safeStorage";

// Simple IndexedDB wrapper for persisting FileSystemDirectoryHandle to remember path choice
const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("BackupPathwayDB", 1);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains("handles")) {
        db.createObjectStore("handles");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveDirectoryHandle = async (key: string, handle: FileSystemDirectoryHandle) => {
  try {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("handles", "readwrite");
      const store = tx.objectStore("handles");
      const request = store.put(handle, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to save directory handle", err);
  }
};

const loadDirectoryHandle = async (key: string): Promise<FileSystemDirectoryHandle | null> => {
  try {
    const db = await getDB();
    return new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction("handles", "readonly");
      const store = tx.objectStore("handles");
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to load directory handle", err);
    return null;
  }
};

const clearDirectoryHandle = async (key: string) => {
  try {
    const db = await getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("handles", "readwrite");
      const store = tx.objectStore("handles");
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to delete directory handle", err);
  }
};

interface GoogleSheetsIntegrationProps {
  logs: DailyLog[];
  employees: Employee[];
  adminPassword: string;
  onRestoreDatabase: (logs: DailyLog[], employees: Employee[]) => void;
}

interface ColDefinition {
  label: string;
  getValue: (log: DailyLog) => any;
  isNumeric: boolean;
  isPercentage: boolean;
}

const colMap: { [key: string]: ColDefinition } = {
  A: { label: "Date", getValue: (log) => log.date, isNumeric: false, isPercentage: false },
  B: { label: "ID", getValue: (log) => log.id, isNumeric: false, isPercentage: false },
  C: { label: "Name", getValue: (log) => log.name, isNumeric: false, isPercentage: false },
  D: { label: "In Time", getValue: (log) => log.inTime, isNumeric: false, isPercentage: false },
  E: { label: "Out Time", getValue: (log) => log.outTime, isNumeric: false, isPercentage: false },
  F: { label: "Off Day", getValue: (log) => log.isOffDay ? "Yes" : "No", isNumeric: false, isPercentage: false },
  G: { label: "Leave", getValue: (log) => log.isLeave ? "Yes" : "No", isNumeric: false, isPercentage: false },
  H: { label: "Short Acknowledgment with final commit", getValue: (log) => log.typeA, isNumeric: true, isPercentage: false },
  I: { label: "Only Short Acknowledgment", getValue: (log) => log.typeB, isNumeric: true, isPercentage: false },
  J: { label: "Final commit without Short Acknowledgment", getValue: (log) => log.typeC, isNumeric: true, isPercentage: false },
  K: { label: "Food sample", getValue: (log) => log.foodSample, isNumeric: true, isPercentage: false },
  L: { label: "Work Mins", getValue: (log) => log.workMins, isNumeric: true, isPercentage: false },
  M: { label: "Extra", getValue: (log) => log.extra, isNumeric: true, isPercentage: false },
  N: { label: "Act. Prod", getValue: (log) => log.actProd, isNumeric: true, isPercentage: false },
  O: { label: "Final Prod", getValue: (log) => log.finalProd, isNumeric: true, isPercentage: false },
  P: { label: "Target", getValue: (log) => log.target, isNumeric: true, isPercentage: false },
  Q: { label: "% Prod", getValue: (log) => log.pctProd, isNumeric: true, isPercentage: true },
  R: { label: "% Eff", getValue: (log) => log.pctEff, isNumeric: true, isPercentage: true },
  S: { label: "Combined sample", getValue: (log) => log.combinedSample || 0, isNumeric: true, isPercentage: false },
  T: { label: "Only RSL sample", getValue: (log) => log.onlyRslSample || 0, isNumeric: true, isPercentage: false },
  U: { label: "Leave (Days)", getValue: (log) => log.isLeave ? 1 : 0, isNumeric: true, isPercentage: false },
  V: { label: "Off day duty", getValue: (log) => log.isOffDay ? 1 : 0, isNumeric: true, isPercentage: false },
  W: { label: "Wastewater Sampling", getValue: (log) => log.isWastewater ? "Yes" : "No", isNumeric: false, isPercentage: false },
  X: { label: "C&A Sample", getValue: (log) => log.cnASample || 0, isNumeric: true, isPercentage: false },
};

interface RunQueryResult {
  headers: string[];
  rows: string[][];
  error?: string;
}

const runQuerySimulator = (queryStr: string, logs: DailyLog[]): RunQueryResult => {
  try {
    let cleanQuery = queryStr.trim();
    
    // Extract inner query string if it is surrounded by =QUERY(range, "query", [headers])
    const sheetQueryPattern = /^=QUERY\s*\(\s*['"]?Daily\s*Input['"]?!\s*[A-Z]+:[A-Z]+,\s*"([^"]+)"\s*(,\s*\d+)?\s*\)$/i;
    const matchSheet = cleanQuery.match(sheetQueryPattern);
    
    let sqlString = cleanQuery;
    if (matchSheet) {
      sqlString = matchSheet[1];
    } else {
      const genericMatch = cleanQuery.match(/^=QUERY\s*\(\s*[^,]+,\s*"([^"]+)"\s*\)$/i);
      if (genericMatch) {
        sqlString = genericMatch[1];
      }
    }
    
    let upperSql = sqlString.toUpperCase();
    
    // Parse main keywords positions
    const selectIdx = upperSql.indexOf("SELECT");
    const whereIdx = upperSql.indexOf("WHERE");
    const groupIdx = upperSql.indexOf("GROUP BY");
    const labelIdx = upperSql.indexOf("LABEL");
    
    if (selectIdx === -1) {
      return {
        headers: [],
        rows: [],
        error: "Missing mandatory 'SELECT' clause in query string."
      };
    }
    
    // Extract substrings for each clause
    const clausePositions = [
      { name: "SELECT", start: selectIdx, end: -1 },
      { name: "WHERE", start: whereIdx, end: -1 },
      { name: "GROUP BY", start: groupIdx, end: -1 },
      { name: "LABEL", start: labelIdx, end: -1 },
    ].filter(c => c.start !== -1).sort((a, b) => a.start - b.start);
    
    for (let i = 0; i < clausePositions.length; i++) {
      const current = clausePositions[i];
      const nextStart = i + 1 < clausePositions.length ? clausePositions[i + 1].start : sqlString.length;
      current.end = nextStart;
    }
    
    // Helper to get raw clause body
    const getClauseBody = (name: string): string => {
      const item = clausePositions.find(c => c.name === name);
      if (!item) return "";
      let slice = sqlString.substring(item.start + item.name.length, item.end).trim();
      return slice;
    };
    
    const selectBody = getClauseBody("SELECT");
    const whereBody = getClauseBody("WHERE");
    const groupBody = getClauseBody("GROUP BY");
    const labelBody = getClauseBody("LABEL");
    
    // Parse Select Items e.g. "B, C, SUM(O), AVG(Q)"
    const selectItems = selectBody.split(",").map(s => s.trim());
    if (selectItems.length === 0 || selectItems[0] === "") {
      return {
        headers: [],
        rows: [],
        error: "No output columns specified in SELECT block."
      };
    }
    
    // Parse labels map e.g. "SUM(O) 'Total Prod', AVG(Q) 'Avg % Prod'"
    const labelsMap: { [key: string]: string } = {};
    if (labelBody) {
      const labelRegex = /([A-Za-z0-9_()]+)\s+['"]([^'"]+)['"]/gi;
      let labelMatch;
      while ((labelMatch = labelRegex.exec(labelBody)) !== null) {
        labelsMap[labelMatch[1].toUpperCase()] = labelMatch[2];
      }
    }
    
    // Parse Group By columns
    const groupCols = groupBody ? groupBody.split(",").map(s => s.trim().toUpperCase()) : [];
    
    // Filter dataset
    let filteredLogs = [...logs];
    if (whereBody) {
      const upperWhere = whereBody.toUpperCase();
      
      // Handle "A IS NOT NULL"
      if (upperWhere.includes("A IS NOT NULL")) {
        filteredLogs = filteredLogs.filter(l => l.date && l.date !== "");
      }
      
      // Handle "G = 'NO'" or "G = 'No'" (Leave column)
      if (upperWhere.includes("G =") || upperWhere.includes("G=")) {
        if (upperWhere.includes("'NO'") || upperWhere.includes('"NO"')) {
          filteredLogs = filteredLogs.filter(l => !l.isLeave);
        } else if (upperWhere.includes("'YES'") || upperWhere.includes('"YES"')) {
          filteredLogs = filteredLogs.filter(l => l.isLeave);
        }
      }
      
      // Handle "F = 'NO'" or "F = 'No'" (Off day column)
      if (upperWhere.includes("F =") || upperWhere.includes("F=")) {
        if (upperWhere.includes("'NO'") || upperWhere.includes('"NO"')) {
          filteredLogs = filteredLogs.filter(l => !l.isOffDay);
        } else if (upperWhere.includes("'YES'") || upperWhere.includes('"YES"')) {
          filteredLogs = filteredLogs.filter(l => l.isOffDay);
        }
      }
    }
    
    // Grouping
    const groupedData: { [key: string]: DailyLog[] } = {};
    filteredLogs.forEach(log => {
      // If there are no group columns, aggregate everything into a single group, or keep rows separate
      const key = groupCols.length === 0 ? ("ROW_" + log.uid) : groupCols.map(col => String(colMap[col]?.getValue(log) ?? "")).join("||");
      if (!groupedData[key]) {
        groupedData[key] = [];
      }
      groupedData[key].push(log);
    });
    
    // Calculate results
    const resultRows: any[][] = [];
    
    Object.keys(groupedData).forEach(gKey => {
      const records = groupedData[gKey];
      const row: any[] = [];
      
      selectItems.forEach(item => {
        const cleanItem = item.trim();
        const upperItem = cleanItem.toUpperCase();
        
        const isSum = upperItem.startsWith("SUM(");
        const isAvg = upperItem.startsWith("AVG(");
        const isMin = upperItem.startsWith("MIN(");
        const isMax = upperItem.startsWith("MAX(");
        const isCount = upperItem.startsWith("COUNT(");
        
        if (isSum || isAvg || isMin || isMax || isCount) {
          const innerMatch = upperItem.match(/^[A-Z]+\(([A-Z]+)\)$/);
          const colLetter = innerMatch ? innerMatch[1] : "";
          const targetCol = colMap[colLetter];
          
          if (isCount) {
            row.push(records.length);
          } else if (!targetCol) {
            row.push(0);
          } else {
            const values = records.map(r => Number(targetCol.getValue(r) ?? 0)).filter(v => !isNaN(v));
            if (isSum) {
              row.push(values.reduce((acc, curr) => acc + curr, 0));
            } else if (isAvg) {
              const sum = values.reduce((acc, curr) => acc + curr, 0);
              row.push(values.length > 0 ? sum / values.length : 0);
            } else if (isMin) {
              row.push(values.length > 0 ? Math.min(...values) : 0);
            } else if (isMax) {
              row.push(values.length > 0 ? Math.max(...values) : 0);
            }
          }
        } else {
          const targetCol = colMap[upperItem];
          if (targetCol && records.length > 0) {
            row.push(targetCol.getValue(records[0]));
          } else {
            row.push("");
          }
        }
      });
      
      resultRows.push(row);
    });
    
    // Formats numbers cleanly
    const formattedRows = resultRows.map(row => {
      return row.map((val, idx) => {
        const origItem = selectItems[idx].toUpperCase();
        let isPerc = false;
        let isNum = false;
        
        if (origItem.includes("(Q)") || origItem.includes("(R)") || origItem === "Q" || origItem === "R") {
          isPerc = true;
          isNum = true;
        } else if (origItem.includes("SUM(") || origItem.includes("AVG(") || origItem.includes("MIN(") || origItem.includes("MAX(")) {
          isNum = true;
        } else {
          const innerMatch = origItem.match(/^[A-Z]+\(([A-Z]+)\)$/) || [null, origItem];
          const colLetter = innerMatch[1];
          const colDef = colMap[colLetter];
          if (colDef) {
            isPerc = colDef.isPercentage;
            isNum = colDef.isNumeric;
          }
        }
        
        if (typeof val === "number" && isNum) {
          if (isPerc) {
            return `${val.toFixed(1)}%`;
          } else {
            return Number.isInteger(val) ? String(val) : val.toFixed(2);
          }
        }
        return String(val);
      });
    });
    
    // Determine headers
    const headers = selectItems.map(item => {
      const key = item.toUpperCase();
      if (labelsMap[key]) {
        return labelsMap[key];
      }
      
      const isSum = key.startsWith("SUM(");
      const isAvg = key.startsWith("AVG(");
      const isCount = key.startsWith("COUNT(");
      
      const innerMatch = key.match(/^[A-Z]+\(([A-Z]+)\)$/);
      const colLetter = innerMatch ? innerMatch[1] : key;
      const colDef = colMap[colLetter];
      
      if (isSum) return `Total ${colDef?.label ?? colLetter}`;
      if (isAvg) return `Avg ${colDef?.label ?? colLetter}`;
      if (isCount) return `Row Count`;
      
      return colDef?.label ?? item;
    });
    
    return {
      headers,
      rows: formattedRows
    };
    
  } catch (error: any) {
    return {
      headers: [],
      rows: [],
      error: `Spreadsheet Syntax/Execution Error: ${error?.message || "Invalid QUERY structure."}`
    };
  }
};

export default function GoogleSheetsIntegration({
  logs,
  employees,
  adminPassword,
  onRestoreDatabase,
}: GoogleSheetsIntegrationProps) {
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedFormula, setCopiedFormula] = useState<string | null>(null);

  // Auto-backup Pathway States
  const [directoryHandle, setDirectoryHandle] = useState<any | null>(null);
  const [directoryName, setDirectoryName] = useState<string>("");
  const [autoBackupEnabled, setAutoBackupEnabled] = useState<boolean>(() => {
    return safeStorage.getItem("productivity_auto_backup_enabled") === "true";
  });
  const [backupFileName, setBackupFileName] = useState<string>(() => {
    return safeStorage.getItem("productivity_auto_backup_filename") || "assembly_tracker_realtime.csv";
  });
  const [backupFormat, setBackupFormat] = useState<"overwrite" | "rolling">(() => {
    return (safeStorage.getItem("productivity_auto_backup_format") as "overwrite" | "rolling") || "overwrite";
  });
  const [fallbackDownloadEnabled, setFallbackDownloadEnabled] = useState<boolean>(() => {
    return safeStorage.getItem("productivity_auto_backup_fallback") === "true";
  });
  const [backupLogs, setBackupLogs] = useState<string[]>([]);
  const [isIframe, setIsIframe] = useState<boolean>(false);
  const [showIframeWarning, setShowIframeWarning] = useState<boolean>(false);

  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch (e) {
      setIsIframe(true);
    }
  }, []);

  // Backup / Restore States
  const [restoreFileContent, setRestoreFileContent] = useState<any | null>(null);
  const [restorePass, setRestorePass] = useState("");
  const [restorePassError, setRestorePassError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<boolean>(false);
  const [restoreInfo, setRestoreInfo] = useState<{ logsCount: number; employeesCount: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && (Array.isArray(parsed.logs) || Array.isArray(parsed.employees))) {
          const logsCount = Array.isArray(parsed.logs) ? parsed.logs.length : 0;
          const employeesCount = Array.isArray(parsed.employees) ? parsed.employees.length : 0;
          setRestoreFileContent(parsed);
          setRestoreInfo({ logsCount, employeesCount });
          setRestorePass("");
          setRestorePassError(null);
          setRestoreSuccess(false);
        } else {
          alert("Invalid backup file structure. Must contain 'logs' and 'employees' lists.");
        }
      } catch (err) {
        alert("Fail to parse imported file. Please upload a valid assembly tracker JSON backup.");
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = () => {
    if (!restoreFileContent) return;
    if (restorePass !== adminPassword) {
      setRestorePassError("Incorrect Admin Password. Authorized restore aborted.");
      return;
    }

    onRestoreDatabase(restoreFileContent.logs || [], restoreFileContent.employees || []);
    setRestoreSuccess(true);
    setRestoreFileContent(null);
    setRestoreInfo(null);
    setRestorePass("");
    setRestorePassError(null);

    setTimeout(() => {
      setRestoreSuccess(false);
    }, 4000);
  };

  const handleExportJSON = () => {
    const backupObj = {
      version: "1.2-DeviceSnapshot",
      timestamp: new Date().toISOString(),
      logs: logs,
      employees: employees,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    
    const dateStr = new Date().toISOString().slice(0, 10);
    dlAnchorElem.setAttribute("download", `assembly_tracker_device_backup_${dateStr}.json`);
    dlAnchorElem.click();
  };

  // Load persistent directory handle on startup
  useEffect(() => {
    const loadSavedHandle = async () => {
      try {
        const savedHandle = await loadDirectoryHandle("active_backup_pathway");
        if (savedHandle) {
          setDirectoryHandle(savedHandle);
          setDirectoryName(savedHandle.name);
          setBackupLogs(prev => [`[System] Loaded persistent pathway handle: "${savedHandle.name}"`, ...prev]);
        }
      } catch (err) {
        console.error("IndexedDB load handle failed", err);
      }
    };
    loadSavedHandle();
  }, []);

  // Helper: check directory read/write permissions
  const checkDirectoryPermission = async (handle: any): Promise<boolean> => {
    try {
      const options = { mode: "readwrite" as const };
      if ((await handle.queryPermission(options)) === "granted") {
        return true;
      }
      if ((await handle.requestPermission(options)) === "granted") {
        return true;
      }
    } catch (e) {
      console.error("Permission check failed", e);
    }
    return false;
  };

  // Helper: standard client download trigger (fallback)
  const triggerFileDownload = (content: string, fileName: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper: Compile current logs to clean CSV text format matching requested schema
  const generateCsvText = (dataset: DailyLog[]): string => {
    let csv = "Date,ID,Name,In,Out,Off Day,Leave,Wastewater Sampling,Short Acknowledgement with final commit,Only Short Acknowledgement,Final commit without Short Acknowledgement,Food sample,Combined sample,C&A Sample,Only RSL sample,Leave (Days),Off day duty,Work Mins,Extra,Act. Prod,Final Prod,Target,% Prod,% Eff\n";
    dataset.forEach((log) => {
      const isOff = log.isOffDay ? "Yes" : "No";
      const isL = log.isLeave ? "Yes" : "No";
      const isW = log.isWastewater ? "Yes" : "No";
      csv += `"${log.date || ""}","${log.id || ""}","${log.name || ""}","${log.inTime || ""}","${log.outTime || ""}","${isOff}","${isL}","${isW}",${log.typeA || 0},${log.typeB || 0},${log.typeC || 0},${log.foodSample || 0},${log.combinedSample || 0},${log.cnASample || 0},${log.onlyRslSample || 0},${log.isLeave ? 1 : 0},${log.isOffDay ? 1 : 0},${log.workMins || 0},${log.extra || 0},${(log.actProd || 0).toFixed(0)},${(log.finalProd || 0).toFixed(0)},${log.target || 11},${(log.pctProd || 0).toFixed(1)}%,${(log.pctEff || 0).toFixed(1)}%\n`;
    });
    return csv;
  };

  // Watcher useEffect that triggers folder write upon logs or directory changes
  useEffect(() => {
    if (!autoBackupEnabled) return;

    const performBackup = async () => {
      const csvContent = generateCsvText(logs);
      const now = new Date();
      const timeString = now.toLocaleTimeString();
      let activeFileName = backupFileName;

      if (backupFormat === "rolling") {
        const dateStr = now.toISOString().slice(0, 10);
        const timeClean = now.toTimeString().slice(0, 8).replace(/:/g, "-");
        activeFileName = backupFileName.replace(".csv", "") + `_${dateStr}_${timeClean}.csv`;
      }

      if (directoryHandle) {
        try {
          const hasPermission = await checkDirectoryPermission(directoryHandle);
          if (!hasPermission) {
            setBackupLogs(prev => [`[${timeString}] ❌ Permission Denied write folder pathway`, ...prev].slice(0, 10));
            return;
          }

          const fileHandle = await directoryHandle.getFileHandle(activeFileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(csvContent);
          await writable.close();

          setBackupLogs(prev => [`[${timeString}] 🟢 Auto-Saved: "${activeFileName}" to folder`, ...prev].slice(0, 10));
        } catch (err: any) {
          console.error("Folder auto-backup write error", err);
          const errMsg = err?.message || "Write restriction in iframe";
          setBackupLogs(prev => [`[${timeString}] ❌ Failed: ${errMsg.substring(0, 45)}`, ...prev].slice(0, 10));

          if (fallbackDownloadEnabled) {
            triggerFileDownload(csvContent, activeFileName);
            setBackupLogs(prev => [`[${timeString}] 🔄 Fallback alert: Triggered auto browser CSV download`, ...prev].slice(0, 10));
          }
        }
      } else {
        if (fallbackDownloadEnabled) {
          triggerFileDownload(csvContent, activeFileName);
          setBackupLogs(prev => [`[${timeString}] 🟢 Saved via Fallback download: "${activeFileName}"`, ...prev].slice(0, 10));
        }
      }
    };

    const timer = setTimeout(() => {
      performBackup();
    }, 1500); // 1.5s debounce to cluster database transactions gracefully
    return () => clearTimeout(timer);
  }, [logs, directoryHandle, autoBackupEnabled, backupFileName, backupFormat, fallbackDownloadEnabled]);

  // Method: triggers directory picker UI
  const handleSelectPathway = async () => {
    // Proactively prevent showDirectoryPicker exception in browser iframe sandbox
    if (isIframe) {
      const timeStr = new Date().toLocaleTimeString();
      setBackupLogs(prev => [`[${timeStr}] ⚠️ Directory select paused: Browser inside frame restricted.`, ...prev].slice(0, 10));
      setShowIframeWarning(true);
      return;
    }

    try {
      if (!('showDirectoryPicker' in window)) {
        const timeStr = new Date().toLocaleTimeString();
        setBackupLogs(prev => [`[${timeStr}] ⚠️ Directory Access is not natively supported in this browser.`, ...prev].slice(0, 10));
        alert("The Directory Access pathway is restricted or not natively available in this browser. " + 
              "We have automatically enabled the Fallback background CSV download for you so your work logs stay perfectly safe!");
        setFallbackDownloadEnabled(true);
        safeStorage.setItem("productivity_auto_backup_fallback", "true");
        return;
      }

      // Try invoking showDirectoryPicker
      let handle;
      try {
        handle = await (window as any).showDirectoryPicker();
      } catch (innerErr) {
        handle = await (window as any).showDirectoryPicker({
          mode: "readwrite"
        });
      }

      setDirectoryHandle(handle);
      setDirectoryName(handle.name);
      await saveDirectoryHandle("active_backup_pathway", handle);

      const timeStr = new Date().toLocaleTimeString();
      setBackupLogs(prev => [`[${timeStr}] 🔓 Local pathway authorized: "${handle.name}"`, ...prev].slice(0, 10));
    } catch (err: any) {
      console.error("Directory selection aborted or locked", err);
      const timeStr = new Date().toLocaleTimeString();
      const isSecurityOrPermissionError = 
        err.name === 'SecurityError' || 
        err.name === 'NotAllowedError' || 
        err.message?.includes('Cross origin') || 
        err.message?.includes('sub frame') || 
        err.message?.includes('frame');
      
      if (isSecurityOrPermissionError) {
        setBackupLogs(prev => [`[${timeStr}] ❌ Security Blocked: Cannot delegate access inside an iframe.`, ...prev].slice(0, 10));
        setShowIframeWarning(true);
      } else if (err.name === 'AbortError') {
        setBackupLogs(prev => [`[${timeStr}] ⚠️ Pathway selection cancelled by user.`, ...prev].slice(0, 10));
      } else {
        setBackupLogs(prev => [`[${timeStr}] ❌ Selection Error: ${err.message || 'Access blocked'}`, ...prev].slice(0, 10));
        alert("Unauthorized local destination path or action. You can turn on 'Automatic Fallback Download' " + 
              "to automatically receive CSV updates seamlessly!");
      }
    }
  };

  // Method: disconnect pathway choice
  const handleClearPathway = async () => {
    setDirectoryHandle(null);
    setDirectoryName("");
    await clearDirectoryHandle("active_backup_pathway");
    const timeStr = new Date().toLocaleTimeString();
    setBackupLogs(prev => [`[${timeStr}] 🔒 Pathway connection severed.`, ...prev].slice(0, 10));
  };

  // Simulated Spreadsheet Formula query state
  const defaultQuery = `=QUERY('Daily Input'!A:V, "SELECT B, C, SUM(O), AVG(Q), AVG(R) WHERE A IS NOT NULL GROUP BY B, C LABEL SUM(O) 'Total Prod', AVG(Q) 'Avg % Prod'")`;
  const [queryInput, setQueryInput] = useState(defaultQuery);
  const [simulatedResult, setSimulatedResult] = useState<RunQueryResult>({ headers: [], rows: [] });
  const [copiedQuery, setCopiedQuery] = useState(false);

  // Execute query whenever the input query or background logs dataset matches change
  useEffect(() => {
    const res = runQuerySimulator(queryInput, logs);
    setSimulatedResult(res);
  }, [queryInput, logs]);

  const scriptCode = `function lockPastDates() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Daily Input");
  var range = sheet.getDataRange();
  var values = range.getValues();
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  for (var i = 1; i < values.length; i++) {
    var rowDate = new Date(values[i][0]); // Column A: Date
    rowDate.setHours(0, 0, 0, 0);

    if (rowDate < today) {
      var rowNumber = i + 1;
      var protection = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).protect();
      protection.setDescription('Locked for Date: ' + values[i][0]);
      
      // Remove all editors except the owner
      var me = Session.getEffectiveUser();
      protection.addEditor(me);
      protection.removeEditors(protection.getEditors());
      if (protection.canDomainEdit()) {
        protection.setDomainEdit(false);
      }
    }
  }
}

// Ensure you associate lockPastDates() with a daily Time-Driven trigger in your project configuration (Extensions > Apps Script)
`;

  const formulas = [
    {
      col: "L (Work Mins)",
      name: "Working Minutes",
      formula: '=IF(F2="Yes", 300, (E2-D2)*1440)',
      desc: "If off-day, credits 300 minutes, otherwise parses the duration between out time and in time in minutes.",
    },
    {
      col: "M (Extra)",
      name: "Extra Time",
      formula: "=MAX(0, L2-540)",
      desc: "Calculates additional minutes worked overtime past the standard 540-minute (9 hr) shift limit.",
    },
    {
      col: "N (Act. Prod)",
      name: "Actual Productivity",
      formula: "=H2 + (I2/5) + (J2*0.8)",
      desc: "Converts raw outputs to standard units (Short Acknowledgment with final commit is 1:1, Only Short Acknowledgment is 5:1, Final commit without Short Acknowledgment undergoes a 20% penalty).",
    },
    {
      col: "O (Final Prod)",
      name: "Final Productivity",
      formula: "=N2 + K2",
      desc: "Aggregates calculated productivity with raw bonus food sample logs.",
    },
    {
      col: "P (Target)",
      name: "Static Target",
      formula: "=11",
      desc: "The standard expected daily completed units.",
    },
    {
      col: "Q (% Prod)",
      name: "% Productivity",
      formula: "=O2/P2",
      desc: "Progress level toward the daily targeted completed quotas.",
    },
    {
      col: "R (% Eff)",
      name: "% Efficiency",
      formula: "=O2 / (L2 / (540/11))",
      desc: "Speed quality metric representing completed output adjusted by the ratio of minutes worked.",
    },
  ];

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyFormula = (col: string, formulaStr: string) => {
    navigator.clipboard.writeText(formulaStr);
    setCopiedFormula(col);
    setTimeout(() => setCopiedFormula(null), 2000);
  };

  const handleCopyQuery = () => {
    navigator.clipboard.writeText(queryInput);
    setCopiedQuery(true);
    setTimeout(() => setCopiedQuery(false), 2000);
  };

  const handleExportCSV = () => {
    const csvContent = generateCsvText(logs);
    triggerFileDownload(csvContent, "Spreadsheet_Productivity_Input.csv");
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Overview Card */}
      <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-400">
            <Database className="w-5 h-5" />
            <h3 className="font-bold text-slate-100 font-display">
              Google Sheets + Apps Script Sync Hub
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-sans max-w-2xl">
            This web application provides a secure offline interface matching the exact mathematical specifications of your production tracking spreadsheets. Learn how to configure your active live sheet with midnight-triggered row locking.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold py-3 px-5 rounded-xl uppercase tracking-wider transition-colors cursor-pointer font-sans shadow-md"
        >
          <Download className="w-4 h-4" />
          Export All Records to CSV
        </button>
      </div>

      {/* Integrated Live Auto-Backup Pathway & Destination Manager */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="bg-slate-50 border-b border-indigo-100/40 p-5 p-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-800 text-[10px] uppercase font-mono tracking-wider font-extrabold px-2 py-0.5 rounded-md">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                Live Background Pathway Daemon Active
              </span>
              <h3 className="text-base font-bold text-slate-900 font-display">
                Real-Time Local Pathway & Auto CSV Backups
              </h3>
              <p className="text-xs text-slate-500 leading-normal max-w-3xl">
                Define a physical destination directory pathway on your computer. Keep this tracker open, and all actions (adds, modifications, deletes) will be written instantly as a clean CSV file in that folder automatically.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-slate-500 font-sans">
                Real-time Autosave:
              </span>
              <button
                onClick={() => {
                  const val = !autoBackupEnabled;
                  setAutoBackupEnabled(val);
                  safeStorage.setItem("productivity_auto_backup_enabled", String(val));
                  const time = new Date().toLocaleTimeString();
                  setBackupLogs(prev => [`[${time}] ${val ? "🟢 Automated background pathway daemon enabled" : "🔴 Autosave pausing"}`, ...prev]);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  autoBackupEnabled ? "bg-indigo-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoBackupEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Pathway Authorization & Setup Controls */}
          <div className="lg:col-span-7 space-y-4 font-sans">
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">
                Destination Pathway Folder
              </label>
              
              {directoryName ? (
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-4 animate-in slide-in-from-top-1">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800">Authorized Pathway Workspace</p>
                      <p className="text-[11px] text-emerald-800 font-mono font-semibold select-all break-all bg-emerald-100/40 px-1.5 py-0.5 rounded border border-emerald-100 mt-1">
                        Device Destination Directory: /{directoryName}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleClearPathway}
                    className="text-[10px] font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    Disconnect Path
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 bg-slate-100 text-slate-400 rounded-lg">
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">No Destination Pathway Set</p>
                      <p className="text-[10px] text-slate-400">Directly link this app to a desktop directory (e.g. Backups folder) to initiate background saves.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSelectPathway}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl transition-all shadow-3xs cursor-pointer tracking-wide"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Choose Local Folder
                  </button>
                </div>
              )}
            </div>

            {isIframe && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-150">
                <div className="flex items-start gap-2.5">
                  <span className="text-amber-600 font-bold shrink-0 mt-0.5">⚠️</span>
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold text-amber-800">Sandbox Preview Restrictions Active</p>
                    <p className="text-[10px] text-amber-700 leading-normal">
                      Security rules block raw local file workspace write operations inside iframes. Click below to launch in full screen where Choose Folder works beautifully!
                    </p>
                  </div>
                </div>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto shrink-0 text-center inline-flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black px-3 py-2 rounded-lg transition-colors shadow-3xs cursor-pointer"
                >
                  Open App in Full Wide Tab
                </a>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Filename modifier */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Backup Filename Schema
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={backupFileName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBackupFileName(val);
                      safeStorage.setItem("productivity_auto_backup_filename", val);
                    }}
                    placeholder="assembly_tracker_realtime.csv"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-medium focus:outline-hidden focus:border-indigo-400 focus:bg-white"
                  />
                  <span className="absolute right-3.5 top-2.5 text-[10px] font-mono font-bold text-slate-400">.csv</span>
                </div>
              </div>

              {/* Rolling frequency selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Write Structure Pathway
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-slate-50 border border-slate-200 p-1 rounded-xl">
                  <button
                    onClick={() => {
                      setBackupFormat("overwrite");
                      safeStorage.setItem("productivity_auto_backup_format", "overwrite");
                    }}
                    className={`text-[10px] font-bold py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                      backupFormat === "overwrite"
                        ? "bg-slate-900 border border-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Overwrite (Single File)
                  </button>
                  <button
                    onClick={() => {
                      setBackupFormat("rolling");
                      safeStorage.setItem("productivity_auto_backup_format", "rolling");
                    }}
                    className={`text-[10px] font-bold py-1.5 px-2 rounded-lg transition-all cursor-pointer ${
                      backupFormat === "rolling"
                        ? "bg-slate-900 border border-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Rolling Snapshot List
                  </button>
                </div>
              </div>
            </div>

            {/* Sandbox Fallback setting */}
            <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="block text-xs font-bold text-slate-800">Sandboxed Browser Auto-Download Fallback</span>
                <span className="block text-[10px] text-slate-400">
                  If folder access is limited inside the system's sandboxed preview frame, turn this on to automatically save as a local browser download.
                </span>
              </div>
              <button
                onClick={() => {
                  const val = !fallbackDownloadEnabled;
                  setFallbackDownloadEnabled(val);
                  safeStorage.setItem("productivity_auto_backup_fallback", String(val));
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                  fallbackDownloadEnabled ? "bg-amber-500" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    fallbackDownloadEnabled ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Sync Tracing Console Log */}
          <div className="lg:col-span-5 bg-slate-950 text-slate-300 rounded-xl p-4 flex flex-col justify-between border border-slate-800 shadow-3xs max-h-[220px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500 flex items-center gap-2 font-extrabold">
                <History className="w-3.5 h-3.5 text-indigo-400" />
                Backup Daemon Logs
              </span>
              <button 
                onClick={() => setBackupLogs([])} 
                className="text-[9px] font-bold font-mono text-slate-500 hover:text-slate-300 transition-colors"
              >
                Clear Console
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto font-mono text-[10px] leading-relaxed space-y-1.5 py-2 mt-1 pr-1 custom-scrollbar">
              {backupLogs.length === 0 ? (
                <span className="text-slate-600 block italic">Daemon idle. Make database modifications to log backup triggers...</span>
              ) : (
                backupLogs.map((log, index) => (
                  <div key={index} className="flex justify-between hover:bg-slate-900 px-1 py-0.5 rounded text-slate-300 select-text">
                    <span>{log}</span>
                  </div>
                ))
              )}
            </div>

            <div className="text-[9px] text-slate-500 border-t border-slate-900 pt-2 flex justify-between">
              <span>Status: {autoBackupEnabled ? "Active Synchronizer" : "Suspended"}</span>
              <span>Local Path: {directoryName ? `/${directoryName}` : "N/A"}</span>
            </div>
          </div>

        </div>

        {/* Database Snapshots Section */}
        <div className="border-t border-slate-200 bg-slate-50/55 p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Continuous Storage Details */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs font-display">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>Standard App Storage & Snapshot export</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal font-sans">
                Every record remains 100% locally resident inside this platform. You can export the current snapshot configuration block in raw JSON format anytime for long-term vaulting.
              </p>

              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100 space-y-1.5 text-[10px] text-slate-600 font-sans">
                <div className="flex justify-between">
                  <span>Registered Workers Count:</span>
                  <span className="font-semibold text-slate-800">{employees.length} Slots</span>
                </div>
                <div className="flex justify-between">
                  <span>Logged Shifts History:</span>
                  <span className="font-semibold text-slate-800">{logs.length} Sheets</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleExportJSON}
              className="mt-3 w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold py-2 px-3 rounded-lg cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Database Backup Snapshot (.JSON)
            </button>
          </div>

          {/* Database restores details */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-3xs flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-xs font-display">
                <Upload className="w-4 h-4 text-rose-600" />
                <span>Upload Snapshot over current Database</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-normal font-sans">
                Restore employees and total worksheets completely by inputting a backup JSON.
              </p>

              {restoreSuccess && (
                <div className="p-2 bg-emerald-50 border border-emerald-100 rounded text-emerald-800 text-[10px] font-bold animate-pulse">
                  🎉 Snapshot database successfully restored!
                </div>
              )}

              {!restoreFileContent ? (
                <div className="border border-dashed border-slate-200 hover:border-indigo-300 rounded-lg p-3 text-center cursor-pointer hover:bg-indigo-50/10 transition-all relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Database className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                  <span className="block text-[10px] font-bold text-slate-600">Select Backup Snapshot (.json)</span>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-200 space-y-2 animate-in slide-in-from-top-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-slate-700">File Selected:</span>
                    <button 
                      onClick={() => { setRestoreFileContent(null); setRestoreInfo(null); }}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      Clear
                    </button>
                  </div>
                  
                  <div className="text-[10px] text-slate-600 flex justify-between">
                    <span>Logs to Import: <strong className="text-slate-800">{restoreInfo?.logsCount}</strong></span>
                    <span>Staff count: <strong className="text-slate-800">{restoreInfo?.employeesCount}</strong></span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="Enter Admin Password to execute"
                      value={restorePass}
                      onChange={(e) => {
                        setRestorePass(e.target.value);
                        setRestorePassError(null);
                      }}
                      className="flex-1 bg-white border border-slate-200 rounded px-2 py-0.5 text-[10px] focus:outline-hidden"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleExecuteRestore();
                      }}
                    />
                    <button
                      onClick={handleExecuteRestore}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-2 py-1 rounded text-[9px] cursor-pointer"
                    >
                      Restore
                    </button>
                  </div>
                  {restorePassError && (
                    <p className="text-[9px] text-rose-600 font-bold">⚠️ {restorePassError}</p>
                  )}
                </div>
              )}
            </div>

            <p className="text-[9px] text-slate-400 italic leading-snug mt-2 font-sans">
              *Importing raw configs will overwrite all active rows and employees. Ensure snapshot configuration aligns before compiling.
            </p>
          </div>
        </div>
      </div>

      {/* Simulated Spreadsheet Formula Action Box */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm">
              <Terminal className="w-4 h-4" />
              <span>Simulated Spreadsheet Formula Action</span>
            </div>
            <p className="text-xs text-slate-500 max-w-3xl">
              Dynamically simulate your standard Google Sheets <code className="font-mono bg-slate-50 px-1 py-0.5 border border-slate-100 rounded text-emerald-800 text-[11px]">=QUERY()</code> formula directly within our virtual offline workspace logs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyQuery}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer font-sans"
              title="Copy active query formula block"
            >
              {copiedQuery ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Formula
                </>
              )}
            </button>
            <button
              onClick={() => setQueryInput(defaultQuery)}
              className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer font-sans"
              title="Reset query input back to requested query"
            >
              <RefreshCw className="w-3 h-3" />
              Reset Requested
            </button>
          </div>
        </div>

        {/* Input box */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Active Query Formula
          </label>
          <div className="relative">
            <textarea
              className="font-mono text-xs text-emerald-950 bg-emerald-50/20 border border-emerald-200 rounded-xl p-3 w-full h-20 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="Enter Google Sheets =QUERY(range, query, [headers]) formulation here..."
            />
            <div className="absolute right-3.5 bottom-3.5 flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Live Sandbox Engine
            </div>
          </div>
        </div>

        {/* Preset selections */}
        <div className="flex flex-wrap gap-2 items-center text-xs">
          <span className="text-slate-400 font-medium">Quick Presets:</span>
          <button
            onClick={() => setQueryInput(defaultQuery)}
            className={`px-3 py-1 rounded-full border transition-all text-[11px] font-medium cursor-pointer ${
              queryInput === defaultQuery 
                ? "bg-slate-900 border-slate-900 text-white" 
                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
            }`}
          >
            📋 B, C, SUM(O), AVG(Q), AVG(R) GroupBy B, C
          </button>
          <button
            onClick={() => setQueryInput(`=QUERY('Daily Input'!A:R, "SELECT A, SUM(O), AVG(R) WHERE A IS NOT NULL GROUP BY A LABEL SUM(O) 'Total Team Prod', AVG(R) 'Avg Team Eff'")`)}
            className={`px-3 py-1 rounded-full border transition-all text-[11px] font-medium cursor-pointer ${
              queryInput.includes("GROUP BY A") 
                ? "bg-slate-900 border-slate-900 text-white" 
                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
            }`}
          >
            📅 Daily Team Output (SUM O, AVG R)
          </button>
          <button
            onClick={() => setQueryInput(`=QUERY('Daily Input'!A:R, "SELECT B, C, N, O WHERE F = 'Yes'")`)}
            className={`px-3 py-1 rounded-full border transition-all text-[11px] font-medium cursor-pointer ${
              queryInput.includes("WHERE F =") 
                ? "bg-slate-900 border-slate-900 text-white" 
                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
            }`}
          >
            🌴 Off Day Output Only
          </button>
        </div>

        {/* Execution Output Grid - mimic spreadsheet */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="bg-emerald-800 text-white p-2.5 flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Simulated Spreadsheet Calculation Output</span>
            </span>
            <span className="text-[10px] font-mono bg-emerald-700 text-emerald-100 px-2 py-0.5 rounded">
              Mock-Sheets Grid View
            </span>
          </div>

          <div className="overflow-x-auto bg-slate-50 p-4 max-h-[350px]">
            {simulatedResult.error ? (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800 text-xs font-medium font-sans">
                ⚠️ {simulatedResult.error}
              </div>
            ) : simulatedResult.headers.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 font-sans">
                No output columns resolved. Provide query statements containing columns from A to R.
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 font-sans space-y-2">
                <p>📭 Spreadsheet input has zero local records to evaluate.</p>
                <p className="text-[10px] text-slate-400">Please record production shifts in the Daily Worksheet first or click and apply seeds down in the database tools panel.</p>
              </div>
            ) : (
              <div className="border border-slate-200 bg-white shadow-3xs rounded-lg overflow-hidden min-w-[600px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200 font-semibold text-[11px]">
                      {simulatedResult.headers.map((h, i) => (
                        <th key={i} className="p-2.5 border-r border-slate-200 last:border-r-0">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {simulatedResult.rows.map((row, rIdx) => (
                      <tr 
                        key={rIdx} 
                        className="hover:bg-slate-50/50 border-b border-slate-100 last:border-b-0 font-sans text-slate-600 odd:bg-slate-50/20"
                      >
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-2.5 border-r border-slate-100 last:border-r-0 font-medium">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left Column: Apps Script Code */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-bold text-slate-900 font-display flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Midnight Schutz (Locking Script)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Runs every night at 12:00 AM via a daily trigger to lock edited rows.
                </p>
              </div>

              <button
                onClick={handleCopyScript}
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer font-sans"
              >
                {copiedScript ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Script
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <pre className="text-[10px] font-mono leading-relaxed bg-slate-950 text-slate-200 p-4 rounded-xl max-h-96 overflow-y-auto border border-slate-800">
                <code>{scriptCode}</code>
              </pre>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed font-sans">
            <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <p>
              <strong>Setup instruction:</strong> paste code into Google Sheets via <strong>Extensions &gt; Apps Script</strong>. Rename your working sheet to exactly <code className="bg-slate-100 text-slate-800 font-mono text-[10px] px-1 py-0.5 rounded">Daily Input</code>. In Apps Script, click the clock/trigger icon on the left rail, add a daily time-driven trigger for <code className="bg-slate-100 text-slate-800 font-mono text-[10px] px-1 py-0.5 rounded">lockPastDates</code> between midnight and 1 AM.
            </p>
          </div>
        </div>

        {/* Right Column: Spreadsheet Formulas */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xs space-y-4">
          <div>
            <h4 className="font-bold text-slate-900 font-display flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              Column Formula Configuration Guide
            </h4>
            <p className="text-[11px] text-slate-500">
              The exact Excel/Google Sheets formula syntax deployed on Columns L through R.
            </p>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {formulas.map((item) => (
              <div
                key={item.col}
                className="p-3 border border-slate-100 rounded-xl hover:border-indigo-100/50 hover:bg-indigo-50/20 transition-all font-sans"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono">
                      Col {item.col}
                    </span>
                    <h5 className="text-xs font-bold text-slate-900 mt-1">{item.name}</h5>
                  </div>

                  <button
                    onClick={() => handleCopyFormula(item.col, item.formula)}
                    className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors cursor-pointer"
                    title="Copy cell formula"
                  >
                    {copiedFormula === item.col ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                
                <p className="font-mono text-[10px] text-slate-800 bg-slate-50 p-1.5 rounded border border-slate-100 mt-1.5 overflow-x-auto whitespace-nowrap">
                  {item.formula}
                </p>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Dynamic Custom IFrame Sandbox Warning Overlay Modal */}
      {showIframeWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/65 backdrop-blur-xs transition-opacity" 
            onClick={() => setShowIframeWarning(false)}
          />
          
          {/* Card Body */}
          <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden p-6 text-slate-800 font-sans transform transition-all animate-in zoom-in-95 duration-150">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-500 border border-amber-200">
                <FolderOpen className="w-6 h-6 animate-pulse" />
              </div>

              <div className="space-y-1.55">
                <h3 className="text-base font-black text-slate-900 tracking-tight font-display">
                  Directory Access requires Full Wide Tab
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Chromium security policies strictly disallow cross-origin frames (iframes) from opening direct device file/folder pickers.
                </p>
              </div>

              <div className="bg-indigo-50/50 rounded-2xl p-4.5 text-left border border-indigo-100/30 space-y-2">
                <p className="text-[11px] font-semibold text-slate-700">How to solve this instantly:</p>
                <div className="space-y-2 text-[10px] text-slate-600 leading-normal">
                  <div className="flex gap-2.5">
                    <span className="font-bold text-indigo-600">1.</span>
                    <span>Click the <strong>Open in New Tab</strong> button (either below or on your top-right preview header panel) to run this app on its own full browser page.</span>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="font-bold text-indigo-600">2.</span>
                    <span>Or, activate <strong>Sandboxed Browser Auto-Download Fallback</strong>. This auto-updates and triggers real-time backup files cleanly in the background without needing folder storage selectors!</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowIframeWarning(false)}
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Launch App in New Tab ↗
                </a>

                <button
                  onClick={() => {
                    setFallbackDownloadEnabled(true);
                    safeStorage.setItem("productivity_auto_backup_fallback", "true");
                    setShowIframeWarning(false);
                    const timeStr = new Date().toLocaleTimeString();
                    setBackupLogs(prev => [`[${timeStr}] 🟢 Enabled Fallback CSV download automatically.`, ...prev].slice(0, 10));
                  }}
                  className="w-full inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs py-2 px-4 rounded-xl transition-all cursor-pointer"
                >
                  Enable Auto-Download Fallback instead
                </button>

                <button
                  onClick={() => setShowIframeWarning(false)}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors pt-1 cursor-pointer"
                >
                  Cancel and Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

