import { DailyLog, Employee } from "../types";

export interface ShiftDetails {
  name: string;
  startStr: string;
  endStr: string;
  startMins: number; // minutes from midnight
  endMins: number;   // minutes from midnight
}

export const SHIFTS: ShiftDetails[] = [
  { name: "Morning", startStr: "07:00", endStr: "16:00", startMins: 420, endMins: 960 },
  { name: "General", startStr: "08:30", endStr: "17:30", startMins: 510, endMins: 1050 },
  { name: "Special", startStr: "10:00", endStr: "19:00", startMins: 600, endMins: 1140 },
  { name: "Afternoon", startStr: "12:00", endStr: "21:00", startMins: 720, endMins: 1260 },
  { name: "Night", startStr: "22:00", endStr: "06:00", startMins: 1320, endMins: 360 },
];

/**
 * Finds the closest shift on a 24-hour circular timeline based on check-in time.
 */
export function getClosestShift(inTime: string): ShiftDetails {
  const [inH, inM] = inTime.split(":").map(Number);
  if (isNaN(inH) || isNaN(inM)) {
    return SHIFTS[1]; // default General
  }
  const inMinutes = inH * 60 + inM;

  let closestShift = SHIFTS[1];
  let minDiff = 1440;

  for (const shift of SHIFTS) {
    const diffRaw = Math.abs(inMinutes - shift.startMins) % 1440;
    const diff = Math.min(diffRaw, 1440 - diffRaw);
    if (diff < minDiff) {
      minDiff = diff;
      closestShift = shift;
    }
  }
  return closestShift;
}

/**
 * Returns adjusted start minutes based on the rule: 
 * If someone check-in up to 30 mins earlier than their shift, count starts from shift start.
 */
export function getAdjustedInMinutes(inTime: string): { 
  inMinutes: number; 
  shiftName: string; 
  shiftStartMins: number; 
  shiftEndMins: number; 
  originalInMinutes: number; 
} {
  const [inH, inM] = inTime.split(":").map(Number);
  if (isNaN(inH) || isNaN(inM)) {
    return { inMinutes: 0, shiftName: "General", shiftStartMins: 510, shiftEndMins: 1050, originalInMinutes: 0 };
  }
  const inMinutes = inH * 60 + inM;
  const shift = getClosestShift(inTime);

  // Calculate standard circular difference in minutes relative to shift start
  let diff = inMinutes - shift.startMins;
  while (diff > 720) diff -= 1440;
  while (diff <= -720) diff += 1440;

  // Grace boundary: if checked in within 30 minutes BEFORE the start time (i.e. [-30, 0])
  const adjusted = (diff >= -30 && diff <= 0) ? shift.startMins : inMinutes;

  return {
    inMinutes: adjusted,
    shiftName: shift.name,
    shiftStartMins: shift.startMins,
    shiftEndMins: shift.endMins,
    originalInMinutes: inMinutes
  };
}

/**
 * Calculates working minutes between "HH:MM" inTime and "HH:MM" outTime.
 * Adjusts start time according to closest shift's early check-in parameters.
 */
export function calculateWorkMins(inTime: string, outTime: string, isOffDay: boolean, isLeave: boolean): number {
  if (isLeave) {
    return 0;
  }
  if (isOffDay) {
    if (!inTime && !outTime) {
      return 0;
    }
    return 300; // Counts as 300 minutes toward the time denominator
  }

  if (!inTime || !outTime) {
    return 0;
  }

  const { inMinutes } = getAdjustedInMinutes(inTime);
  const [outH, outM] = outTime.split(":").map(Number);

  if (isNaN(outH) || isNaN(outM)) {
    return 0;
  }

  let outMinutes = outH * 60 + outM;

  // Handle overnight shift if out time is less than in time
  if (outMinutes < inMinutes) {
    outMinutes += 24 * 60;
  }

  return Math.max(0, outMinutes - inMinutes);
}

/**
 * Calculates extra time (minutes worked over 540).
 */
export function calculateExtraTime(workMins: number): number {
  return Math.max(0, workMins - 540);
}

/**
 * Calculates Actual Productivity: A + B/5 + C * 0.8
 */
export function calculateActualProd(typeA: number, typeB: number, typeC: number): number {
  return typeA + (typeB / 5) + (typeC * 0.8);
}

/**
 * Calculates Final Productivity: Actual Productivity + D (Food Sample)
 */
export function calculateFinalProd(actProd: number, foodSample: number): number {
  return actProd + foodSample;
}

/**
 * Calculates % Productivity: (Final Productivity / Target) * 100
 */
export function calculatePctProd(finalProd: number, target: number = 11): number {
  if (target <= 0) return 0;
  return (finalProd / target) * 100;
}

/**
 * Calculates % Efficiency: (Final Productivity / (Total Working Minutes / (540 / 11))) * 100
 */
export function calculatePctEff(finalProd: number, workMins: number): number {
  if (workMins <= 0) return 0;
  const timeDenominator = workMins / (540 / 11);
  return (finalProd / timeDenominator) * 100;
}

/**
 * Helper to check if a date string YYYY-MM-DD corresponds to a Saturday
 */
export function isSaturdayDate(dateStr: string): boolean {
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.getDay() === 6; // Saturday
    }
  } catch (e) {
    // fallback
  }
  return false;
}

/**
 * Checks if a date string is an off day for a specific employee ID.
 * D9771 - Friday & Saturday
 * D9655 - Saturday & Tuesday
 * D9263 - Saturday & Sunday
 * D9998 - Saturday & Thursday
 * D0718 - Saturday & Monday
 * D0732 - Saturday & Wednesday
 */
export function isEmployeeOffDay(empId: string, dateStr: string): boolean {
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday

      const id = empId.toUpperCase();
      if (id === "D9771") {
        return dayOfWeek === 5 || dayOfWeek === 6; // Friday & Saturday
      } else if (id === "D9655") {
        return dayOfWeek === 6 || dayOfWeek === 2; // Saturday & Tuesday
      } else if (id === "D9263") {
        return dayOfWeek === 6 || dayOfWeek === 0; // Saturday & Sunday
      } else if (id === "D9998") {
        return dayOfWeek === 6 || dayOfWeek === 4; // Saturday & Thursday
      } else if (id === "D0718") {
        return dayOfWeek === 6 || dayOfWeek === 1; // Saturday & Monday
      } else if (id === "D0732") {
        return dayOfWeek === 6 || dayOfWeek === 3; // Saturday & Wednesday
      }
      return dayOfWeek === 6; // Default fallback: Saturday
    }
  } catch (e) {
    // fallback
  }
  return false;
}

/**
 * Fully computes all calculated fields for a log entry.
 */
export function computeLogCalculations(
  raw: Omit<DailyLog, "leaveDays" | "offDayDuty" | "onlyRslSample" | "workMins" | "extra" | "actProd" | "finalProd" | "target" | "pctProd" | "pctEff">
): DailyLog {
  const isTrainingCalculated = !!raw.isTraining || (raw.id.toUpperCase() === "D9771" && raw.date === "2026-05-13");
  const isHoliday = GOVERNMENT_HOLIDAYS_2026.has(raw.date);
  const isHolidayOff = isHoliday && (!raw.inTime || !raw.outTime);
  const isScheduledOffDay = isEmployeeOffDay(raw.id, raw.date);

  // Calculate actual worked minutes if there's check-in/out times to evaluate the sub-450 minutes off-day trigger
  let actualWorkMins = 0;
  if (!raw.isLeave && !isTrainingCalculated && raw.inTime && raw.outTime) {
    actualWorkMins = calculateWorkMins(raw.inTime, raw.outTime, false, false);
  }

  // A day counts as Off Day if it was manually submitted as one, if it matches the employee scheduled off days, or if the worked minutes is below 450 minutes
  const isOffDayCalculated = !isTrainingCalculated && (!!raw.isOffDay || isScheduledOffDay || (!!raw.inTime && !!raw.outTime && !raw.isLeave && actualWorkMins < 450));

  const isUnworkedOffDay = isOffDayCalculated && (!raw.inTime || !raw.outTime);

  const workMins = isTrainingCalculated ? 0 : calculateWorkMins(raw.inTime, raw.outTime, isOffDayCalculated, !!raw.isLeave);
  const extra = calculateExtraTime(workMins);
  
  const isZeroProd = raw.isLeave || isTrainingCalculated || isHolidayOff || isUnworkedOffDay;
  const actProd = isZeroProd ? 0 : calculateActualProd(raw.typeA, raw.typeB, raw.typeC);
  const finalProd = isZeroProd ? 0 : calculateFinalProd(actProd, raw.foodSample);
  const onlyRslSample = isZeroProd ? 0 : Math.round(finalProd - raw.combinedSample);
  const leaveDays = raw.isLeave ? 1 : 0;
  const offDayDuty = (isOffDayCalculated && (!!raw.inTime || !!raw.outTime)) ? 1 : 0;
  
  const isZeroTarget = raw.isLeave || isTrainingCalculated || raw.isWastewater || isHolidayOff || isUnworkedOffDay;
  const target = isZeroTarget ? 0 : 11; // target is 0 on leave, wastewater, training, or unworked off/holiday days
  const pctProd = isZeroTarget ? 0 : calculatePctProd(finalProd, target);
  const pctEff = isZeroTarget ? 0 : calculatePctEff(finalProd, workMins);

  const { shiftName } = raw.inTime ? getAdjustedInMinutes(raw.inTime) : { shiftName: undefined };

  return {
    ...raw,
    isTraining: isTrainingCalculated,
    isOffDay: isOffDayCalculated,
    leaveDays,
    offDayDuty,
    onlyRslSample,
    workMins,
    extra,
    actProd,
    finalProd,
    target,
    pctProd,
    pctEff,
    shiftName,
  };
}

/**
 * Checks if a record's date is before "today's" date, in which case it is locked.
 * Supports simulating a specific "current date" in the system to test the lock trigger.
 */
export function isRecordLocked(recordDateStr: string, simulatedTodayStr: string, isOwnerMode: boolean): boolean {
  // Disabled past records auto-locking per user request ("previous data no locking")
  return false;
}

/**
 * Helper to get a past date string subtracting daysAgo from a yyyy-mm-dd date string.
 */
export function getPastDateString(baseDateStr: string, daysAgo: number): string {
  try {
    const parts = baseDateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      d.setDate(d.getDate() - daysAgo);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dy = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dy}`;
    }
  } catch (e) {
    // fallback
  }
  return baseDateStr;
}

export const GOVERNMENT_HOLIDAYS_2026 = new Set([
  "2026-02-04",
  "2026-02-21",
  "2026-03-19",
  "2026-03-20",
  "2026-03-21",
  "2026-03-22",
  "2026-03-26",
  "2026-04-14",
  "2026-05-01",
  "2026-05-27",
  "2026-05-28",
  "2026-05-29",
  "2026-05-30",
  "2026-08-26",
  "2026-10-20",
  "2026-10-21",
  "2026-12-16",
  "2026-12-25",
]);

/**
 * Automatically creates and populates virtual "Leave" entries for any employee
 * who does not have an active daily log entered for a specific date that has inputs in the system,
 * or for the last 2 days (yesterday and the day before) relative to today.
 */
export function getEnrichedLogs(logs: DailyLog[], employees: Employee[], simulatedTodayStr?: string): DailyLog[] {
  if (!employees || employees.length === 0) {
    return logs || [];
  }

  // Get all unique dates from the logs
  const datesSet = new Set((logs || []).map(l => l.date));
  
  // Also guarantee the last 02 days before simulatedToday are automatically included in the target dates
  const todayVal = simulatedTodayStr || (() => {
    const local = new Date();
    const year = local.getFullYear();
    const month = String(local.getMonth() + 1).padStart(2, "0");
    const day = String(local.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();

  datesSet.add(getPastDateString(todayVal, 1)); // Yesterday
  datesSet.add(getPastDateString(todayVal, 2)); // Day before yesterday

  // Find maximum date to avoid showing future holidays far in advance
  let maxDate = todayVal;
  for (const log of logs || []) {
    if (log.date > maxDate) {
      maxDate = log.date;
    }
  }

  // Explicitly add government holidays up to the maximum date in the system so they are always counted & shown as holidays
  GOVERNMENT_HOLIDAYS_2026.forEach(hDate => {
    if (hDate <= maxDate) {
      datesSet.add(hDate);
    }
  });
  
  const uniqueDates = Array.from(datesSet).sort((a, b) => b.localeCompare(a));
  
  // We'll create a copy of logs to enrich
  const enriched: DailyLog[] = [...(logs || [])];
  
  // Create a fast lookup map for existing combinations: "date_id"
  const existingMap = new Set((logs || []).map(l => `${l.date}_${l.id.toUpperCase()}`));
  
  for (const date of uniqueDates) {
    const isHoliday = GOVERNMENT_HOLIDAYS_2026.has(date);
    for (const emp of employees) {
      const isEmpOff = isEmployeeOffDay(emp.id, date);
      const isTrainingDay = (emp.id.toUpperCase() === "D9771" && date === "2026-05-13");
      const key = `${date}_${emp.id.toUpperCase()}`;
      if (!existingMap.has(key)) {
        // Create a virtual leave or training log for this employee on this date
        // If it is a government holiday, scheduled off day, or training day, we do NOT want to count it as leave!
        const rawVirtual = {
          uid: `virtual_${emp.id}_${date}`,
          date,
          id: emp.id.toUpperCase(),
          name: emp.name,
          inTime: "",
          outTime: "",
          isOffDay: !isTrainingDay && isEmpOff,
          isLeave: !isHoliday && !isEmpOff && !isTrainingDay,
          isTraining: isTrainingDay,
          typeA: 0,
          typeB: 0,
          typeC: 0,
          foodSample: 0,
          combinedSample: 0,
          cnASample: 0,
        };
        
        // Fully compute calculated fields to get correct workMins, pctProd, pctEff, leaveDays etc.
        const computed = computeLogCalculations(rawVirtual);
        enriched.push(computed);
      }
    }
  }
  
  return enriched;
}
