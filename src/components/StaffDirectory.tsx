import React, { useState } from "react";
import { Employee, DailyLog, TeamSupervisor } from "../types";
import { Users, UserPlus, Trash2, ShieldAlert, CheckCircle2, TrendingUp, Award, Calendar, AlertCircle, Edit, Check, X, Mail, UserCog, ShieldCheck, BellRing } from "lucide-react";

interface StaffDirectoryProps {
  employees: Employee[];
  logs: DailyLog[];
  adminPassword: string;
  isOwnerMode?: boolean;
  onAddEmployee: (id: string, name: string, team?: string, department?: string) => boolean;
  onRemoveEmployee: (id: string) => void;
  onUpdateEmployee?: (updatedEmployee: Employee) => void;
  onRenameTeam?: (oldTeamName: string, newTeamName: string) => void;
  onRenameDepartment?: (oldDeptName: string, newDeptName: string) => void;
  supervisors: Record<string, TeamSupervisor>;
  onUpdateSupervisor: (teamName: string, name: string, email: string) => void;
}

export default function StaffDirectory({
  employees,
  logs,
  adminPassword,
  isOwnerMode = false,
  onAddEmployee,
  onRemoveEmployee,
  onUpdateEmployee,
  onRenameTeam,
  onRenameDepartment,
  supervisors,
  onUpdateSupervisor,
}: StaffDirectoryProps) {
  // Add Employee Form States
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("Team Alpha");
  const [customTeam, setCustomTeam] = useState("");
  const [selectedDept, setSelectedDept] = useState("Assembly");
  const [customDept, setCustomDept] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Search Staff filter
  const [searchTerm, setSearchTerm] = useState("");

  // Remove Employee confirmation state
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletePassVerify, setDeletePassVerify] = useState("");
  const [deletePassVerifyError, setDeletePassVerifyError] = useState<string | null>(null);

  // Edit Employee state hooks
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingTeam, setEditingTeam] = useState("Team Alpha");
  const [editingTeamCustom, setEditingTeamCustom] = useState("");
  const [editingDept, setEditingDept] = useState("Assembly");
  const [editingDeptCustom, setEditingDeptCustom] = useState("");

  // Global Team Rename state hooks
  const [renamingTeamName, setRenamingTeamName] = useState<string | null>(null);
  const [newTeamNameInput, setNewTeamNameInput] = useState("");

  // Global Department Rename state hooks
  const [renamingDeptName, setRenamingDeptName] = useState<string | null>(null);
  const [newDeptNameInput, setNewDeptNameInput] = useState("");

  // Supervisor management state hooks
  const [editingSupTeamName, setEditingSupTeamName] = useState<string | null>(null);
  const [supNameInput, setSupNameInput] = useState("");
  const [supEmailInput, setSupEmailInput] = useState("");

  const handleStartEditingSupervisor = (teamName: string) => {
    setEditingSupTeamName(teamName);
    const sup = supervisors[teamName] || { name: "", email: "" };
    setSupNameInput(sup.name);
    setSupEmailInput(sup.email);
  };

  const handleSaveSupervisor = (teamName: string) => {
    onUpdateSupervisor(teamName, supNameInput.trim(), supEmailInput.trim().toLowerCase());
    setEditingSupTeamName(null);
  };

  // Start employee inline editing
  const handleStartEmployeeEdit = (emp: Employee) => {
    setEditingEmpId(emp.id);
    setEditingName(emp.name);
    setEditingTeam(emp.team || "Team Alpha");
    setEditingTeamCustom("");
    setEditingDept(emp.department || "Assembly");
    setEditingDeptCustom("");
    setPendingDeleteId(null);
  };

  // Save employee inline editing
  const handleSaveEmployeeEdit = (id: string) => {
    if (!onUpdateEmployee) return;

    const trimmedName = editingName.trim();
    const finalTeam = editingTeam === "NEW" ? editingTeamCustom.trim() : editingTeam;
    const finalDept = editingDept === "NEW" ? editingDeptCustom.trim() : editingDept;

    if (!trimmedName) {
      alert("Name cannot be empty.");
      return;
    }

    if (!finalTeam) {
      alert("Team name cannot be empty.");
      return;
    }

    if (!finalDept) {
      alert("Department name cannot be empty.");
      return;
    }

    onUpdateEmployee({
      id,
      name: trimmedName,
      team: finalTeam,
      department: finalDept,
    });
    setEditingEmpId(null);
  };

  // Start global team renaming
  const handleStartTeamRename = (teamName: string) => {
    setRenamingTeamName(teamName);
    setNewTeamNameInput(teamName);
  };

  // Save global team renaming
  const handleSaveTeamRename = (oldTeamName: string) => {
    if (!onRenameTeam) return;
    const cleanNew = newTeamNameInput.trim();
    if (!cleanNew) {
      alert("Team name cannot be empty.");
      return;
    }
    onRenameTeam(oldTeamName, cleanNew);
    setRenamingTeamName(null);
  };

  // Start global department renaming
  const handleStartDeptRename = (deptName: string) => {
    setRenamingDeptName(deptName);
    setNewDeptNameInput(deptName);
    setPendingDeleteId(null);
  };

  // Save global department renaming
  const handleSaveDeptRename = (oldDeptName: string) => {
    if (!onRenameDepartment) return;
    const cleanNew = newDeptNameInput.trim();
    if (!cleanNew) {
      alert("Department name cannot be empty.");
      return;
    }
    onRenameDepartment(oldDeptName, cleanNew);
    setRenamingDeptName(null);
  };

  // Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cleanId = newId.trim().toUpperCase();
    const cleanName = newName.trim();
    const finalTeam = selectedTeam === "NEW" ? customTeam.trim() : selectedTeam;
    const finalDept = selectedDept === "NEW" ? customDept.trim() : selectedDept;

    if (!cleanId) {
      setFormError("Employee ID is required.");
      return;
    }
    if (!cleanName) {
      setFormError("Full Name is required.");
      return;
    }
    if (!finalTeam) {
      setFormError("Team name is required.");
      return;
    }
    if (!finalDept) {
      setFormError("Department name is required.");
      return;
    }

    if (cleanId.length < 3) {
      setFormError("ID must be at least 3 characters long.");
      return;
    }

    // Attempt to add employee
    const success = onAddEmployee(cleanId, cleanName, finalTeam, finalDept);
    if (success) {
      setFormSuccess(`Successfully added ${cleanName} (${cleanId}) to ${finalTeam} in ${finalDept}.`);
      setNewId("");
      setNewName("");
      setCustomTeam("");
      setCustomDept("");
      // Clear success message after 3 seconds
      setTimeout(() => setFormSuccess(null), 3000);
    } else {
      setFormError(`An employee with ID '${cleanId}' already exists.`);
    }
  };

  // Safe Removal Confirmation
  const triggerRemove = (id: string) => {
    if (isOwnerMode) {
      // Direct bypass since we are already authenticated as Owner!
      confirmRemove(id);
    } else {
      setPendingDeleteId(id);
      setDeletePassVerify("");
      setDeletePassVerifyError(null);
    }
  };

  const confirmRemove = (id: string) => {
    onRemoveEmployee(id);
    if (pendingDeleteId === id) {
      setPendingDeleteId(null);
    }
  };

  const cancelRemove = () => {
    setPendingDeleteId(null);
    setDeletePassVerify("");
    setDeletePassVerifyError(null);
  };

  const handleVerifyAndRemove = (id: string) => {
    if (deletePassVerify.trim() === adminPassword.trim()) {
      confirmRemove(id);
      setDeletePassVerify("");
      setDeletePassVerifyError(null);
    } else {
      setDeletePassVerifyError("Incorrect password. Authorized administrator rights required.");
    }
  };

  // Helper to get stats for an employee from the logs
  const getEmployeeStats = (empId: string) => {
    const empLogs = logs.filter((log) => log.id.toUpperCase() === empId.toUpperCase());
    const totalDays = empLogs.length;

    if (totalDays === 0) {
      return { totalDays, avgProd: 0, avgEff: 0 };
    }

    const totalProd = empLogs.reduce((sum, log) => sum + log.finalProd, 0);
    const activeEffLogs = empLogs.filter(log => (log.finalProd || 0) > 0);
    const totalEff = activeEffLogs.reduce((sum, log) => sum + log.pctEff, 0);

    return {
      totalDays,
      avgProd: totalProd / totalDays,
      avgEff: activeEffLogs.length > 0 ? totalEff / activeEffLogs.length : 0,
    };
  };

  // Helper to generate a dynamic colorful background based on name/id
  const getAvatarColor = (id: string) => {
    const colors = [
      "bg-indigo-100 text-indigo-700 border-indigo-200",
      "bg-emerald-100 text-emerald-700 border-emerald-200",
      "bg-amber-100 text-amber-700 border-amber-200",
      "bg-sky-100 text-sky-700 border-sky-200",
      "bg-purple-100 text-purple-700 border-purple-200",
      "bg-rose-100 text-rose-700 border-rose-200",
    ];

    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Filter employees by search and designated team
  const [directoryTeamFilter, setDirectoryTeamFilter] = useState("ALL");

  const filteredEmployees = employees.filter((emp) => {
    const matchSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTeam = directoryTeamFilter === "ALL" || (emp.team || "Team Alpha") === directoryTeamFilter;
    return matchSearch && matchTeam;
  });

  // Calculate dynamic team-wide metrics
  const uniqueTeams = Array.from(new Set(employees.map(e => e.team || "Team Alpha")));
  const teamSummaries = uniqueTeams.map(teamName => {
    const teamEmps = employees.filter(e => (e.team || "Team Alpha") === teamName);
    const empIds = teamEmps.map(e => e.id.toUpperCase());
    const teamLogs = logs.filter(log => empIds.includes(log.id.toUpperCase()));
    
    const staffCount = teamEmps.length;
    const totalDays = teamLogs.length;
    const totalProd = teamLogs.reduce((sum, log) => sum + log.finalProd, 0);
    const avgProd = totalDays > 0 ? totalProd / totalDays : 0;
    
    const activeEffLogs = teamLogs.filter(log => (log.finalProd || 0) > 0);
    const totalEff = activeEffLogs.reduce((sum, log) => sum + log.pctEff, 0);
    const avgEff = activeEffLogs.length > 0 ? totalEff / activeEffLogs.length : 0;

    return {
      teamName,
      staffCount,
      totalDays,
      avgProd,
      avgEff,
    };
  });

  // Calculate dynamic department-wide metrics
  const uniqueDepts = Array.from(new Set(employees.map(e => e.department || "Assembly")));
  const deptSummaries = uniqueDepts.map(deptName => {
    const deptEmps = employees.filter(e => (e.department || "Assembly") === deptName);
    const empIds = deptEmps.map(e => e.id.toUpperCase());
    const deptLogs = logs.filter(log => empIds.includes(log.id.toUpperCase()));
    
    const staffCount = deptEmps.length;
    const totalDays = deptLogs.length;
    const totalProd = deptLogs.reduce((sum, log) => sum + log.finalProd, 0);
    const avgProd = totalDays > 0 ? totalProd / totalDays : 0;
    
    const activeEffLogs = deptLogs.filter(log => (log.finalProd || 0) > 0);
    const totalEff = activeEffLogs.reduce((sum, log) => sum + log.pctEff, 0);
    const avgEff = activeEffLogs.length > 0 ? totalEff / activeEffLogs.length : 0;

    return {
      deptName,
      staffCount,
      totalDays,
      avgProd,
      avgEff,
    };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Add New Employee Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs h-fit">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm font-sans">
              Add New Staff Member
            </h3>
            <p className="text-[11px] text-slate-500 font-sans">
              Expand the active assembly line directory.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 rounded-xl border border-rose-100 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3 text-xs bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{formSuccess}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Employee ID Code
            </label>
            <input
              type="text"
              placeholder="e.g. D9999"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className="w-full text-xs font-mono border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Staff Full Name
            </label>
            <input
              type="text"
              placeholder="e.g. Clara Oswald"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Designated Team
            </label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all font-semibold text-slate-700"
            >
              {Array.from(new Set(employees.map(e => e.team || "Team Alpha"))).map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
              <option value="NEW">+ Create Custom Team</option>
            </select>
          </div>

          {selectedTeam === "NEW" && (
            <div className="animate-in slide-in-from-top-2 duration-150 relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Custom Team Name
              </label>
              <input
                type="text"
                placeholder="e.g. Team Gamma"
                value={customTeam}
                onChange={(e) => setCustomTeam(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Designated Department
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all font-semibold text-slate-700"
            >
              {Array.from(new Set(employees.map(e => e.department || "Assembly"))).map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
              <option value="NEW">+ Create Custom Department</option>
            </select>
          </div>

          {selectedDept === "NEW" && (
            <div className="animate-in slide-in-from-top-2 duration-150 relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Custom Department Name
              </label>
              <input
                type="text"
                placeholder="e.g. Logistics"
                value={customDept}
                onChange={(e) => setCustomDept(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs py-2 px-4 rounded-xl cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register Employee</span>
          </button>
        </form>
      </div>

      {/* Directory List & Search Block */}
      <div className="lg:col-span-2 space-y-4">
        
        {/* Team calculations summaries panel */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Team Performance Overview</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {teamSummaries.map((team) => (
              <div key={team.teamName} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs hover:shadow-2xs transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 flex-grow min-w-0 mr-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0"></span>
                    {renamingTeamName === team.teamName ? (
                      <div className="flex items-center gap-1 flex-grow">
                        <input
                          type="text"
                          value={newTeamNameInput}
                          onChange={(e) => setNewTeamNameInput(e.target.value)}
                          className="text-xs px-2 py-0.5 border border-slate-300 rounded-md font-semibold text-slate-800 bg-slate-50 w-full focus:outline-hidden focus:border-indigo-500"
                          placeholder="Rename team..."
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveTeamRename(team.teamName);
                            } else if (e.key === "Escape") {
                              setRenamingTeamName(null);
                            }
                          }}
                        />
                        <button
                          onClick={() => handleSaveTeamRename(team.teamName)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer shrink-0"
                          title="Save Team Name"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setRenamingTeamName(null)}
                          className="p-1 text-slate-400 hover:bg-slate-100 rounded-md cursor-pointer shrink-0"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 group truncate">
                        <h5 className="font-bold text-slate-900 text-sm font-sans truncate">{team.teamName}</h5>
                        {onRenameTeam && (
                          <button
                            onClick={() => handleStartTeamRename(team.teamName)}
                            className="p-1 opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-50 transition-all cursor-pointer shrink-0"
                            title="Rename this team globally"
                          >
                            <Edit className="w-3 h-3 text-slate-400 hover:text-indigo-600" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {renamingTeamName !== team.teamName && (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100 shrink-0">
                      {team.staffCount} staff
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center pt-2.5 border-t border-slate-100 font-sans">
                  <div>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Entries</span>
                    <span className="font-bold text-[11px] text-slate-700">{team.totalDays} days</span>
                  </div>
                  <div className="border-x border-slate-100">
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Avg Prod</span>
                    <span className="font-extrabold text-[11px] text-indigo-700">{team.avgProd.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Avg Eff</span>
                    <span className={`font-extrabold text-[11px] ${team.avgEff >= 100 ? "text-emerald-600" : "text-amber-600"}`}>
                      {team.avgEff.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Supervisor Management Option */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 font-sans text-xs">
                  {editingSupTeamName === team.teamName ? (
                    <div className="space-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-150 animate-in slide-in-from-top-1 duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <UserCog className="w-3 h-3 text-indigo-500" /> Team Supervisor
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveSupervisor(team.teamName)}
                            className="p-1 px-2 text-[9px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md cursor-pointer transition-colors shadow-3xs"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSupTeamName(null)}
                            className="p-1 px-2 text-[9px] font-bold text-slate-505 bg-white hover:bg-slate-100 border border-slate-200 rounded-md cursor-pointer transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <input
                            type="text"
                            required
                            value={supNameInput}
                            onChange={(e) => setSupNameInput(e.target.value)}
                            placeholder="Supervisor Name (e.g. John Miller)"
                            className="w-full text-[11px] px-2 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:border-indigo-500 font-medium"
                          />
                        </div>
                        <div>
                          <input
                            type="email"
                            required
                            value={supEmailInput}
                            onChange={(e) => setSupEmailInput(e.target.value)}
                            placeholder="Supervisor Email (e.g. jmiller@workspace.com)"
                            className="w-full text-[11px] px-2 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:border-indigo-500 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0 flex-grow mr-2">
                        <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${supervisors[team.teamName] ? "text-indigo-600" : "text-slate-350"}`} />
                        <div className="min-w-0">
                          <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Supervisor Contact</span>
                          {supervisors[team.teamName] && supervisors[team.teamName].name ? (
                            <span className="font-semibold text-[11px] text-slate-700 block truncate">
                              {supervisors[team.teamName].name} <span className="font-mono text-slate-400 font-normal text-[10px] block truncate">{supervisors[team.teamName].email}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic block">None assigned (no email alerts)</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartEditingSupervisor(team.teamName)}
                        className="px-2 py-1 text-[9px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 shrink-0"
                      >
                        <Edit className="w-2.5 h-2.5" />
                        {supervisors[team.teamName] ? "Edit" : "Assign"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Department calculations summaries panel */}
        <div className="space-y-2 mt-4">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Department Performance Overview</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {deptSummaries.map((dept) => (
              <div key={dept.deptName} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs hover:shadow-2xs transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 flex-grow min-w-0 mr-1">
                    <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse shrink-0"></span>
                    {renamingDeptName === dept.deptName ? (
                      <div className="flex items-center gap-1 flex-grow">
                        <input
                          type="text"
                          value={newDeptNameInput}
                          onChange={(e) => setNewDeptNameInput(e.target.value)}
                          className="text-xs px-2 py-0.5 border border-slate-300 rounded-md font-semibold text-slate-800 bg-slate-50 w-full focus:outline-hidden focus:border-teal-500"
                          placeholder="Rename department..."
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveDeptRename(dept.deptName);
                            } else if (e.key === "Escape") {
                              setRenamingDeptName(null);
                            }
                          }}
                        />
                        <button
                          onClick={() => handleSaveDeptRename(dept.deptName)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md cursor-pointer shrink-0"
                          title="Save Department Name"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setRenamingDeptName(null)}
                          className="p-1 text-slate-400 hover:bg-slate-100 rounded-md cursor-pointer shrink-0"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 group truncate">
                        <h5 className="font-bold text-slate-900 text-sm font-sans truncate">{dept.deptName} Department</h5>
                        {onRenameDepartment && (
                          <button
                            onClick={() => handleStartDeptRename(dept.deptName)}
                            className="p-1 opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-50 transition-all cursor-pointer shrink-0"
                            title="Rename this department globally"
                          >
                            <Edit className="w-3 h-3 text-slate-400 hover:text-indigo-600" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {renamingDeptName !== dept.deptName && (
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-100 shrink-0">
                      {dept.staffCount} staff
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center pt-2.5 border-t border-slate-100 font-sans">
                  <div>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Entries</span>
                    <span className="font-bold text-[11px] text-slate-700">{dept.totalDays} days</span>
                  </div>
                  <div className="border-x border-slate-100">
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Avg Prod</span>
                    <span className="font-extrabold text-[11px] text-teal-700">{dept.avgProd.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Avg Eff</span>
                    <span className={`font-extrabold text-[11px] ${dept.avgEff >= 100 ? "text-emerald-600" : "text-emerald-500"}`}>
                      {dept.avgEff.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Search header utility */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold text-xs text-slate-800 font-sans">
              Active Staff Pool ({filteredEmployees.length} of {employees.length})
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Team Filter selector */}
            <select
              value={directoryTeamFilter}
              onChange={(e) => setDirectoryTeamFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden transition-colors shrink-0 w-28"
            >
              <option value="ALL">All Teams</option>
              {uniqueTeams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>

            <div className="relative flex-1 sm:w-48">
              <input
                type="text"
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl pl-3 pr-2 py-1.5 focus:border-indigo-500 focus:outline-hidden bg-slate-50 hover:bg-slate-100/50 focus:bg-white transition-all font-sans"
              />
            </div>
          </div>
        </div>

        {/* Directory bento-style list */}
        {filteredEmployees.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-xs">
            No employees match "{searchTerm}". Let's register a new employee on the left!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEmployees.map((emp) => {
              const stats = getEmployeeStats(emp.id);
              const initials = emp.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .substring(0, 2)
                .toUpperCase();

              const isPendingDelete = pendingDeleteId === emp.id;
              const isEditing = editingEmpId === emp.id;

              return (
                <div
                  key={emp.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-3xs hover:shadow-2xs transition-all relative flex flex-col justify-between"
                >
                  {isEditing ? (
                    <div className="space-y-3 w-full animate-in fade-in duration-100 pb-1">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                          Edit Member: {emp.id}
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleSaveEmployeeEdit(emp.id)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-2 py-1 rounded-md text-[10px] cursor-pointer flex items-center gap-1 transition-colors shadow-3xs"
                          >
                            <Check className="w-3 h-3" />
                            Save
                          </button>
                          <button
                            onClick={() => setEditingEmpId(null)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-2 py-1 rounded-md text-[10px] cursor-pointer flex items-center gap-1 transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Cancel
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 font-sans">
                            Staff Full Name
                          </label>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="w-full text-xs font-semibold text-slate-800 border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 font-sans">
                            Designated Team
                          </label>
                          <select
                            value={editingTeam}
                            onChange={(e) => setEditingTeam(e.target.value)}
                            className="w-full text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
                          >
                            {uniqueTeams.map((teamName) => (
                              <option key={teamName} value={teamName}>
                                {teamName}
                              </option>
                            ))}
                            <option value="NEW">+ Create Custom Team</option>
                          </select>
                        </div>

                        {editingTeam === "NEW" && (
                          <div className="animate-in slide-in-from-top-1 duration-100 pt-0.5">
                            <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 font-sans">
                              Custom Team Name
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Team Gamma"
                              value={editingTeamCustom}
                              onChange={(e) => setEditingTeamCustom(e.target.value)}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
                              required
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 font-sans">
                            Designated Department
                          </label>
                          <select
                            value={editingDept}
                            onChange={(e) => setEditingDept(e.target.value)}
                            className="w-full text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
                          >
                            {Array.from(new Set(employees.map(e => e.department || "Assembly"))).map((deptName) => (
                              <option key={deptName} value={deptName}>
                                {deptName}
                              </option>
                            ))}
                            <option value="NEW">+ Create Custom Department</option>
                          </select>
                        </div>

                        {editingDept === "NEW" && (
                          <div className="animate-in slide-in-from-top-1 duration-100 pt-0.5">
                            <label className="block text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 font-sans">
                              Custom Department Name
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Logistics"
                              value={editingDeptCustom}
                              onChange={(e) => setEditingDeptCustom(e.target.value)}
                              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
                              required
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        {/* User Profile avatar & info */}
                        <div className="flex gap-3">
                          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-bold font-mono text-sm shrink-0 ${getAvatarColor(emp.id)}`}>
                            {initials || "EM"}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-bold text-slate-900 text-sm font-sans leading-tight">
                                {emp.name}
                              </h4>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              <span className="inline-block px-2 py-0.5 text-[9px] font-bold font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md">
                                {emp.id}
                              </span>
                              <span className="inline-block px-2 py-0.5 text-[9px] font-bold font-sans text-slate-600 bg-slate-100 border border-slate-200/60 rounded-md">
                                {emp.team || "Team Alpha"}
                              </span>
                              <span className="inline-block px-2 py-0.5 text-[9px] font-bold font-sans text-teal-700 bg-teal-50 border border-teal-200/60 rounded-md">
                                {emp.department || "Assembly"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions - Edit & Remove Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {onUpdateEmployee && (
                            <button
                              onClick={() => handleStartEmployeeEdit(emp)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit employee details"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {!isPendingDelete ? (
                            <button
                              onClick={() => triggerRemove(emp.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remove employee from directory"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={cancelRemove}
                              className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Pending Delete confirmation slide-in */}
                      {isPendingDelete && (
                        <div className="mt-3 p-3 bg-rose-50/70 border border-rose-100 rounded-xl space-y-2.5 text-[11px] text-rose-800 animate-in slide-in-from-top-2 duration-150">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold">
                              <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
                              <span>Admin Authorization Required</span>
                            </div>
                            <button onClick={cancelRemove} className="text-slate-400 hover:text-slate-600 font-semibold text-[10px]">Cancel</button>
                          </div>
                          
                          <p className="text-[10px] text-slate-500 leading-normal">
                            No profile data should be deleted without admin password. Enter password to delete.
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Hint: password is <span className="font-bold text-slate-600">{adminPassword}</span>
                          </p>
                          
                          <div className="flex gap-2 items-center">
                            <input
                              type="password"
                              placeholder="Enter Admin Password"
                              value={deletePassVerify}
                              onChange={(e) => {
                                setDeletePassVerify(e.target.value);
                                setDeletePassVerifyError(null);
                              }}
                              className="flex-1 bg-white border border-rose-200 rounded-lg px-2 text-[11px] h-8 font-semibold text-rose-950 focus:outline-hidden focus:border-rose-500 focus:ring-0 placeholder:text-rose-300 font-mono"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleVerifyAndRemove(emp.id);
                                }
                              }}
                            />
                            <button
                              onClick={() => handleVerifyAndRemove(emp.id)}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 h-8 rounded-lg text-[10px] cursor-pointer transition-all shadow-3xs shrink-0"
                            >
                              Authorize & Delete
                            </button>
                          </div>
                          {deletePassVerifyError && (
                            <p className="text-[10px] text-rose-600 font-bold leading-none select-none">
                              ⚠️ {deletePassVerifyError}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Mini statistics related to logs */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 font-sans">
                    <div className="text-center">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        Days
                      </span>
                      <span className="font-bold text-xs text-slate-700">
                        {stats.totalDays}
                      </span>
                    </div>

                    <div className="text-center border-x border-slate-100">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1">
                        <TrendingUp className="w-2.5 h-2.5" />
                        Avg Prod
                      </span>
                      <span className="font-bold text-xs text-indigo-700">
                        {stats.avgProd > 0 ? stats.avgProd.toFixed(2) : "0.00"}
                      </span>
                    </div>

                    <div className="text-center">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1">
                        <Award className="w-2.5 h-2.5" />
                        Avg Eff
                      </span>
                      <span className={`font-bold text-xs ${stats.avgEff >= 100 ? "text-emerald-600" : "text-amber-600"}`}>
                        {stats.avgEff > 0 ? `${stats.avgEff.toFixed(1)}%` : "0.0%"}
                      </span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

    </div>
  );
}
