export interface DailyLog {
  uid: string; // unique row id in local database
  date: string; // YYYY-MM-DD
  id: string; // Employee ID
  name: string; // Employee Name
  inTime: string; // HH:MM (24h)
  outTime: string; // HH:MM (24h)
  isOffDay: boolean; // Yes/No
  isLeave: boolean; // Yes/No
  isWastewater?: boolean; // Wastewater sampling visit
  typeA: number; // Short Acknowledgement with final commit (1:1)
  typeB: number; // Only Short Acknowledgement (5:1)
  typeC: number; // Final commit without Short Acknowledgement (subtract 1 for every 5: actual = C * 0.8)
  foodSample: number; // Food sample (Total sample) (1:1)
  combinedSample: number; // Combined sample
  
  // Calculated fields
  leaveDays: number; // calculated as 1 if isLeave is true, else 0
  offDayDuty: number; // calculated as 1 if isOffDay is true, else 0
  onlyRslSample: number; // calculated as finalProd - combinedSample
  workMins: number;
  extra: number;
  actProd: number;
  finalProd: number;
  target: number;
  pctProd: number; // percentage (e.g. 100 for 100%)
  pctEff: number; // percentage (e.g. 100 for 100%)
  shiftName?: string; // "Morning", "General", "Special", "Afternoon", "Night"
}

export interface Employee {
  id: string;
  name: string;
  email?: string; // register email
  password?: string; // register password
  team?: string; // e.g. "Team Alpha" or "Team Beta"
  department?: string; // e.g. "Assembly" or "Packaging"
  target?: number; // defaults to 11
}

export interface TeamSupervisor {
  name: string;
  email: string;
}

export interface EmailNotification {
  id: string;
  timestamp: string;
  employeeId: string;
  employeeName: string;
  teamName: string;
  pctProd: number;
  pctEff: number;
  subject: string;
  body: string;
  supervisorName: string;
  supervisorEmail: string;
  sentByClientMail?: boolean;
  deliveryStatus?: string;
  smtpLog?: string[];
  logUid?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

