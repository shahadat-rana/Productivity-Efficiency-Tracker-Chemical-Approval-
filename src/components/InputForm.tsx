import React, { useState, useEffect } from "react";
import { DailyLog, Employee } from "../types";
import { computeLogCalculations, getAdjustedInMinutes } from "../utils/productivity";
import { PlusCircle, HelpCircle, Save, XCircle, Calculator, RotateCcw } from "lucide-react";

interface InputFormProps {
  onAddLog: (newLog: DailyLog) => void;
  onClose: () => void;
  existingLogs: DailyLog[];
  employees: Employee[];
}

export default function InputForm({ onAddLog, onClose, existingLogs, employees }: InputFormProps) {
  // Custom or selected employee
  const [selectedEmpId, setSelectedEmpId] = useState<string>("NEW");
  
  // Form fields
  const [date, setDate] = useState<string>(() => {
    const local = new Date();
    const year = local.getFullYear();
    const month = String(local.getMonth() + 1).padStart(2, "0");
    const day = String(local.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  const [empId, setEmpId] = useState<string>("");
  const [empName, setEmpName] = useState<string>("");
  const [inTime, setInTime] = useState<string>("08:00");
  const [outTime, setOutTime] = useState<string>("17:00");
  const [isOffDay, setIsOffDay] = useState<boolean>(false);
  const [isLeave, setIsLeave] = useState<boolean>(false);
  const [isWastewater, setIsWastewater] = useState<boolean>(false);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [typeA, setTypeA] = useState<number | "">(0);
  const [typeB, setTypeB] = useState<number | "">(0);
  const [typeC, setTypeC] = useState<number | "">(0);
  const [foodSample, setFoodSample] = useState<number | "">(0);
  const [combinedSample, setCombinedSample] = useState<number | "">(0);
  const [cnASample, setCnASample] = useState<number | "">(0);

  // Validation state
  const [errorMess, setErrorMess] = useState<string | null>(null);

  // Update employee names when ID drops down
  useEffect(() => {
    if (selectedEmpId === "NEW") {
      setEmpId("");
      setEmpName("");
    } else {
      const match = employees.find((e) => e.id === selectedEmpId);
      if (match) {
        setEmpId(match.id);
        setEmpName(match.name);
      }
    }
  }, [selectedEmpId, employees]);

  // Real-time calculated previews
  const [preview, setPreview] = useState<Partial<DailyLog>>({});

  useEffect(() => {
    const rawIsLeaveOrTraining = isLeave || isTraining;
    const rawData = {
      uid: "preview",
      date,
      id: empId || "DEMO",
      name: empName || "Awaiting Name",
      inTime: rawIsLeaveOrTraining ? "" : inTime,
      outTime: rawIsLeaveOrTraining ? "" : outTime,
      isOffDay,
      isLeave,
      isWastewater,
      isTraining,
      typeA: rawIsLeaveOrTraining ? 0 : Number(typeA),
      typeB: rawIsLeaveOrTraining ? 0 : Number(typeB),
      typeC: rawIsLeaveOrTraining ? 0 : Number(typeC),
      foodSample: rawIsLeaveOrTraining ? 0 : Number(foodSample),
      combinedSample: rawIsLeaveOrTraining ? 0 : Number(combinedSample),
      cnASample: rawIsLeaveOrTraining ? 0 : Number(cnASample),
    };
    
    setPreview(computeLogCalculations(rawData));
  }, [date, empId, empName, inTime, outTime, isOffDay, isLeave, isWastewater, isTraining, typeA, typeB, typeC, foodSample, combinedSample, cnASample]);

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMess(null);

    // Basic Validations
    if (!empId.trim()) {
      setErrorMess("Please provide an Employee ID.");
      return;
    }
    if (!empName.trim()) {
      setErrorMess("Please provide an Employee Name.");
      return;
    }

    // Check duplicate key (Employee + Date) to match standard sheet logic
    const exists = existingLogs.some(
      (log) => log.date === date && log.id.toLowerCase() === empId.toLowerCase().trim()
    );
    if (exists) {
      setErrorMess(`A journal entry for ID ${empId} already exists for ${date}.`);
      return;
    }

    // Capture calculated data
    const rawIsLeaveOrTraining = isLeave || isTraining;
    const finalData = computeLogCalculations({
      uid: `log_${Date.now()}`,
      date,
      id: empId.trim().toUpperCase(),
      name: empName.trim(),
      inTime: rawIsLeaveOrTraining ? "" : inTime,
      outTime: rawIsLeaveOrTraining ? "" : outTime,
      isOffDay,
      isLeave,
      isWastewater,
      isTraining,
      typeA: rawIsLeaveOrTraining ? 0 : Number(typeA),
      typeB: rawIsLeaveOrTraining ? 0 : Number(typeB),
      typeC: rawIsLeaveOrTraining ? 0 : Number(typeC),
      foodSample: rawIsLeaveOrTraining ? 0 : Number(foodSample),
      combinedSample: rawIsLeaveOrTraining ? 0 : Number(combinedSample),
      cnASample: rawIsLeaveOrTraining ? 0 : Number(cnASample),
    });

    onAddLog(finalData);
    onClose();
  };

  const handleResetForm = () => {
    setSelectedEmpId("NEW");
    setEmpId("");
    setEmpName("");
    setInTime("");
    setOutTime("");
    setIsOffDay(false);
    setIsLeave(false);
    setIsWastewater(false);
    setIsTraining(false);
    setTypeA("");
    setTypeB("");
    setTypeC("");
    setFoodSample("");
    setCombinedSample("");
    setCnASample("");
    setErrorMess(null);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-6 max-w-4xl mx-auto mb-8 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-950 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-indigo-600" />
            New Daily Work
          </h2>
          <p className="text-xs text-slate-500 font-sans mt-0.5">
            Add raw values. Standard production quotas and times are converted automatically.
          </p>
        </div>
        <button
          onClick={onClose}
          type="button"
          className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-50 rounded-lg"
        >
          <XCircle className="w-6 h-6" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns - Form Entry fields */}
        <div className="lg:col-span-2 space-y-4">
          {errorMess && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 rounded-xl border border-rose-100 flex items-center gap-2 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
              {errorMess}
            </div>
          )}

          {/* Step 1: Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Target Log Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Staff Directory Match
              </label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
              >
                <option value="NEW">+ Add New / Custom Staff</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.id} - {emp.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  ID Code
                </label>
                <input
                  type="text"
                  placeholder="ID101"
                  required
                  disabled={selectedEmpId !== "NEW"}
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value.toUpperCase())}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="John Smith"
                  required
                  disabled={selectedEmpId !== "NEW"}
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Time and Attendance Options */}
          <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Attendance & Shifts
            </h4>
            
            <div className="flex flex-wrap gap-6">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isOffDay}
                  onChange={(e) => {
                    setIsOffDay(e.target.checked);
                    if (e.target.checked) {
                      setIsLeave(false);
                      setIsTraining(false);
                    }
                  }}
                  className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-xs font-medium text-slate-700">Off Day (Get 300 min credit)</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLeave}
                  onChange={(e) => {
                    setIsLeave(e.target.checked);
                    if (e.target.checked) {
                      setIsOffDay(false);
                      setIsTraining(false);
                      setIsWastewater(false);
                    }
                  }}
                  className="rounded-md border-slate-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                />
                <span className="text-xs font-medium text-purple-700">Leave</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isWastewater}
                  onChange={(e) => {
                    setIsWastewater(e.target.checked);
                    if (e.target.checked) {
                      setIsLeave(false);
                      setIsTraining(false);
                    }
                  }}
                  className="rounded-md border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
                />
                <span className="text-xs font-medium text-teal-700 flex items-center gap-1">
                  Wastewater Sampling
                  <Tooltip text="Checked if the employee undertook wastewater sampling fieldwork on this date. Exempts desk-work production requirements." />
                </span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTraining}
                  onChange={(e) => {
                    setIsTraining(e.target.checked);
                    if (e.target.checked) {
                      setIsOffDay(false);
                      setIsLeave(false);
                      setIsWastewater(false);
                    }
                  }}
                  className="rounded-md border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                <span className="text-xs font-medium text-amber-700 flex items-center gap-1">
                  Training
                  <Tooltip text="Checked if the employee was in training on this date. Sets productivity and work minutes to zero." />
                </span>
              </label>
            </div>

            {!isLeave ? (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Clock In Time {isOffDay && <span className="text-amber-600 font-bold">(Off Day Shift)</span>}
                  </label>
                  <input
                    type="time"
                    required={!isOffDay}
                    value={inTime}
                    onChange={(e) => setInTime(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-1.5 bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
                  />
                  {/* Real-time Shift Match and Grace Guidance */}
                  {(() => {
                    if (!inTime) return null;
                    try {
                      const info = getAdjustedInMinutes(inTime);
                      const displayTime = info.shiftName === "Morning" ? "07:00" : info.shiftName === "General" ? "08:30" : info.shiftName === "Special" ? "10:00" : info.shiftName === "Afternoon" ? "12:00" : "22:00";
                      return (
                        <div className="text-[10px] mt-1 text-slate-500 font-sans flex flex-col gap-0.5">
                          <span className="flex items-center gap-1 font-medium select-none">
                            ⏱️ Closest Shift: <span className="text-indigo-600 font-bold underline decoration-indigo-200">{info.shiftName}</span>
                          </span>
                          {info.inMinutes !== info.originalInMinutes && (
                            <span className="text-teal-700 bg-teal-50 border border-teal-150 px-1.5 py-0.5 rounded-md inline-block w-fit mt-1 font-sans leading-none font-bold text-[9px] select-none">
                              ⚡ Counts starting from {displayTime} (30m grace)
                            </span>
                          )}
                        </div>
                      );
                    } catch {
                      return null;
                    }
                  })()}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Clock Out Time {isOffDay && <span className="text-amber-600 font-bold">(Off Day Shift)</span>}
                  </label>
                  <input
                    type="time"
                    required={!isOffDay}
                    value={outTime}
                    onChange={(e) => setOutTime(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-1.5 bg-white focus:border-indigo-500 focus:outline-hidden transition-all"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic pt-1">
                ✓ Approved Leave selected. 0 working minutes recorded; exempt from standard penalties.
              </p>
            )}
            {isOffDay && (
              <p className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-100 font-sans leading-tight">
                ℹ️ <strong>Off Day enabled:</strong> Under excel configuration specifications, a standard 300-minute denominator credit is automatically assigned. Any voluntary clock timings and production outputs entered below will still be logged and computed!
              </p>
            )}
          </div>

          {/* Step 3: Raw Production Outputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 bg-indigo-50/40 p-4 rounded-xl border border-indigo-100/50">
            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-indigo-950 mb-1 leading-tight min-h-[32px] flex items-center gap-1">
                <span>Short Acknowledgement with final commit</span>
                <Tooltip text="Counts 1:1." />
              </label>
              <input
                type="number"
                min="0"
                required
                disabled={isLeave}
                value={isLeave ? "0" : typeA}
                onChange={(e) => {
                  const val = e.target.value;
                  setTypeA(val === "" ? "" : Math.max(0, parseInt(val) || 0));
                }}
                className="w-full text-sm font-mono border border-indigo-100 rounded-xl px-3 py-1.5 bg-white disabled:opacity-60 focus:outline-hidden focus:border-indigo-500 text-center"
              />
            </div>

            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-indigo-950 mb-1 leading-tight min-h-[32px] flex items-center gap-1">
                <span>Only Short Acknowledgement</span>
                <Tooltip text="Counts as 1 unit for every 5 inputs (Formula: Count/5)." />
              </label>
              <input
                type="number"
                min="0"
                required
                disabled={isLeave}
                value={isLeave ? "0" : typeB}
                onChange={(e) => {
                  const val = e.target.value;
                  setTypeB(val === "" ? "" : Math.max(0, parseInt(val) || 0));
                }}
                className="w-full text-sm font-mono border border-indigo-100 rounded-xl px-3 py-1.5 bg-white disabled:opacity-60 focus:outline-hidden focus:border-indigo-500 text-center"
              />
            </div>

            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-indigo-950 mb-1 leading-tight min-h-[32px] flex items-center gap-1">
                <span>Final commit without Short Acknowledgement</span>
                <Tooltip text="Penalty multiplier is 0.8 (Formula: Count * 0.8)." />
              </label>
              <input
                type="number"
                min="0"
                required
                disabled={isLeave}
                value={isLeave ? "0" : typeC}
                onChange={(e) => {
                  const val = e.target.value;
                  setTypeC(val === "" ? "" : Math.max(0, parseInt(val) || 0));
                }}
                className="w-full text-sm font-mono border border-indigo-100 rounded-xl px-3 py-1.5 bg-white disabled:opacity-60 focus:outline-hidden focus:border-indigo-500 text-center"
              />
            </div>

            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-indigo-950 mb-1 leading-tight min-h-[32px] flex items-center gap-1">
                <span>Food sample</span>
                <Tooltip text="Bonus food sample logs. Counts 1:1 onto final productivity." />
              </label>
              <input
                type="number"
                min="0"
                required
                disabled={isLeave}
                value={isLeave ? "0" : foodSample}
                onChange={(e) => {
                  const val = e.target.value;
                  setFoodSample(val === "" ? "" : Math.max(0, parseInt(val) || 0));
                }}
                className="w-full text-sm font-mono border border-indigo-100 rounded-xl px-3 py-1.5 bg-white disabled:opacity-60 focus:outline-hidden focus:border-indigo-500 text-center"
              />
            </div>

            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-indigo-950 mb-1 leading-tight min-h-[32px] flex items-center gap-1">
                <span>Combined sample</span>
                <Tooltip text="The portion of samples that are combined." />
              </label>
              <input
                type="number"
                min="0"
                required
                disabled={isLeave}
                value={isLeave ? "0" : combinedSample}
                onChange={(e) => {
                  const val = e.target.value;
                  setCombinedSample(val === "" ? "" : Math.max(0, parseInt(val) || 0));
                }}
                className="w-full text-sm font-mono border border-indigo-100 rounded-xl px-3 py-1.5 bg-white disabled:opacity-60 focus:outline-hidden focus:border-indigo-500 text-center"
              />
            </div>

            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-indigo-950 mb-1 leading-tight min-h-[32px] flex items-center gap-1">
                <span>C&A Sample</span>
                <Tooltip text="The portion of C&A samples (no impact on productivity & efficiency)." />
              </label>
              <input
                type="number"
                min="0"
                required
                disabled={isLeave}
                value={isLeave ? "0" : cnASample}
                onChange={(e) => {
                  const val = e.target.value;
                  setCnASample(val === "" ? "" : Math.max(0, parseInt(val) || 0));
                }}
                className="w-full text-sm font-mono border border-indigo-100 rounded-xl px-3 py-1.5 bg-white disabled:opacity-60 focus:outline-hidden focus:border-indigo-500 text-center"
              />
            </div>

            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-indigo-950 mb-1 leading-tight min-h-[32px] flex items-center gap-1">
                <span>Only RSL sample</span>
                <Tooltip text="Calculated dynamically as (Total Productivity - Combined sample)." />
              </label>
              <div className="w-full text-sm font-mono font-bold border border-emerald-100 bg-emerald-50/50 text-emerald-800 rounded-xl px-2 py-1.5 min-h-[38px] flex items-center justify-center text-center">
                {isLeave ? "0" : Math.max(0, Math.round((preview.finalProd || 0) - (Number(combinedSample) || 0)))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Preview Column (Spreadsheet Simulation Panel) */}
        <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl flex flex-col justify-between border border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-4 text-indigo-400">
              <Calculator className="w-4 h-4" />
              <h3 className="text-xs uppercase font-extrabold tracking-widest font-mono">
                Real-Time Sheet Preview
              </h3>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Date Log:</span>
                <span>{preview.date || "None"}</span>
              </div>
              {isWastewater && (
                <div className="flex justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-teal-400 font-bold">Fieldwork:</span>
                  <span className="text-teal-400 font-bold font-mono">Wastewater Sampling</span>
                </div>
              )}
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Work Mins:</span>
                <span className="text-sky-400 font-bold">{preview.workMins || 0} mins</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Extra Mins:</span>
                <span className="text-slate-300">{preview.extra || 0} mins</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5 align-middle">
                <span className="text-slate-400">Act. Prod (A+B/5+0.8C):</span>
                <span>{(preview.actProd || 0).toFixed(0)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Final Prod (Act+D):</span>
                <span className="text-emerald-400 font-bold">{(preview.finalProd || 0).toFixed(0)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5 text-[11px]">
                <span className="text-slate-400 pl-2">- Combined sample:</span>
                <span className="text-slate-300">{preview.combinedSample || 0}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5 text-[11px]">
                <span className="text-slate-400 pl-2">- C&A Sample:</span>
                <span className="text-slate-300">{preview.cnASample || 0}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5 text-[11px]">
                <span className="text-slate-400 pl-2">- Only RSL sample:</span>
                <span className="text-emerald-400">{(preview.onlyRslSample || 0).toFixed(0)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Daily Target:</span>
                <span>{preview.target || 11}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Productivity %:</span>
                <span className={preview.pctProd && preview.pctProd >= 100 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                  {(preview.pctProd || 0).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1.5">
                <span className="text-slate-400">Efficiency %:</span>
                <span className={preview.pctEff && preview.pctEff >= 100 ? "text-emerald-400 font-bold" : "text-purple-400 font-bold"}>
                  {(preview.pctEff || 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleResetForm}
              className="flex-1 border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 px-4 rounded-xl font-medium text-xs tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-2 shadow-3xs"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
              Reset Form
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white py-2.5 px-4 rounded-xl font-medium text-xs tracking-wider uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <Save className="w-4 h-4" />
              Save & Lock Row
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// Tooltip helper
function Tooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-block cursor-pointer">
      <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-600 transition-colors" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 w-48 -translate-x-1/2 mb-2 origin-bottom scale-0 rounded-lg bg-slate-900 border border-slate-800 p-2 text-[10px] leading-normal font-sans text-slate-200 font-normal transition-all duration-150 group-hover:scale-100 opacity-95">
        {text}
      </span>
    </span>
  );
}
