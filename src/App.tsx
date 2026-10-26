/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Search,
  ArrowLeft,
  AlertCircle,
  Building2,
  Layers,
  Calendar,
  Clock,
  BookOpen,
  Linkedin,
  Users,
  MessageSquarePlus,
  Star,
  X,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ChevronDown
} from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import { supabase, isKeyMaskedWithBullets } from './supabase';

interface ExamRecord {
  id: string | number;
  admission_number: string;
  student_name: string;
  program?: string;
  semester?: string;
  subject_code?: string;
  room_number: string;
  seat_number: string;
  exam_date: string;
  shift?: string;
  shift_timing?: string;
  is_upcoming?: boolean;
}

// Extracts single time token like "9:30 AM", "09.30 AM", "11:00 A.M.", "1:30 PM", "13:30"
function extractTime(str: string): { hour: number; minute: number; rawMeridian: string | null } | null {
  if (!str) return null;
  // Match hours (1-2 digits), optional delimiter (: or .), optional minutes (2 digits), optional seconds, optional AM/PM
  const match = str.match(/(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?\s*([ap]\.?m\.?)?/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const rawMeridian = match[3] ? match[3].replace(/\./g, '').toUpperCase() : null;

  if (rawMeridian === 'PM' && hour < 12) {
    hour += 12;
  } else if (rawMeridian === 'AM' && hour === 12) {
    hour = 0;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute, rawMeridian };
}

// Default shift windows when timing is omitted or unparseable
const DEFAULT_SHIFT_TIMINGS: Record<number, { start: { hour: number; minute: number }; end: { hour: number; minute: number } }> = {
  1: { start: { hour: 9, minute: 30 }, end: { hour: 11, minute: 0 } },
  2: { start: { hour: 11, minute: 40 }, end: { hour: 13, minute: 10 } },
  3: { start: { hour: 13, minute: 50 }, end: { hour: 15, minute: 20 } },
  4: { start: { hour: 15, minute: 40 }, end: { hour: 17, minute: 10 } },
};

// Parses shift timing strings like "9:30 AM - 11:00 AM", "09.30 AM to 11.00 AM"
function parseShiftTiming(
  timingStr: string | null | undefined,
  shiftStr?: string | null
): {
  start: { hour: number; minute: number };
  end: { hour: number; minute: number };
} | null {
  const shiftNum = parseShiftNumber(shiftStr);
  const fallback = DEFAULT_SHIFT_TIMINGS[shiftNum] || null;

  if (!timingStr || typeof timingStr !== 'string') return fallback;
  const clean = timingStr.trim();
  if (!clean) return fallback;

  // Split by hyphen, en-dash, em-dash, or "to"
  const parts = clean.split(/\s*(?:[-–—]|\bto\b)\s*/i);
  if (parts.length < 2) return fallback;

  const start = extractTime(parts[0]);
  const end = extractTime(parts[1]);

  if (!start || !end) return fallback;

  // Inherit AM/PM if omitted on start time (e.g. "9:30 - 11:00 AM" or "1:30 - 3:00 PM")
  if (!start.rawMeridian && end.rawMeridian) {
    if (end.rawMeridian === 'AM') {
      start.rawMeridian = 'AM';
      if (start.hour === 12) start.hour = 0;
    } else if (end.rawMeridian === 'PM') {
      if (start.hour >= 7 && start.hour <= 11) {
        start.rawMeridian = 'AM';
      } else {
        start.rawMeridian = 'PM';
        if (start.hour < 12) start.hour += 12;
      }
    }
  }

  // Detect and fix Excel 12-hour AM/PM typo (e.g. 09:30 AM - 11:00 PM which yields 13.5 hours for Shift 1)
  const rawDuration = (end.hour + end.minute / 60) - (start.hour + start.minute / 60);
  if (end.hour >= 12 && rawDuration > 4.5) {
    const correctedEndHour = end.hour - 12;
    const correctedDuration = (correctedEndHour + end.minute / 60) - (start.hour + start.minute / 60);
    if (correctedDuration >= 0.75 && correctedDuration <= 4) {
      end.hour = correctedEndHour;
    }
  }

  return {
    start: { hour: start.hour, minute: start.minute },
    end: { hour: end.hour, minute: end.minute }
  };
}

// Normalizes database record columns (supporting both new schema and legacy schema)
function normalizeExamRecord(raw: any): ExamRecord {
  const room = (raw.room_no || raw.room_number || 'TBA').toString().trim();
  const seat = (raw.seat_no || raw.seat_number || 'TBA').toString().trim();
  const examName = (raw.exam_name || raw.subject_code || '').toString().trim();
  const examTime = (raw.exam_time || raw.shift_timing || '').toString().trim();
  const examDate = (raw.exam_date || '').toString().trim();
  let shift = (raw.shift || '').toString().trim();

  // Infer standard university shift from timing if not explicitly present
  if (!shift && examTime) {
    const timing = parseShiftTiming(examTime, null);
    if (timing) {
      const startMin = timing.start.hour * 60 + timing.start.minute;
      if (startMin <= 10 * 60) shift = 'Shift 1';
      else if (startMin <= 12 * 60 + 30) shift = 'Shift 2';
      else if (startMin <= 14 * 60 + 30) shift = 'Shift 3';
      else shift = 'Shift 4';
    }
  }

  return {
    id: raw.id,
    admission_number: (raw.admission_number || '').toString().trim(),
    student_name: (raw.student_name || '').toString().trim(),
    program: raw.program ? String(raw.program).trim() : undefined,
    semester: raw.semester ? String(raw.semester).trim() : undefined,
    subject_code: examName,
    room_number: room,
    seat_number: seat,
    exam_date: examDate,
    shift: shift || 'Shift 1',
    shift_timing: examTime,
  };
}

// Sanitizes and formats shift display cleanly (removes Excel notes and fixes typos)
function formatShiftDisplay(shift?: string, timing?: string): string {
  const shiftNum = parseShiftNumber(shift);
  let cleanShift = '';
  if (shiftNum !== 999) {
    cleanShift = `Shift ${shiftNum}`;
  } else {
    cleanShift = shift?.trim() || 'Shift 1';
  }

  if (!timing) return cleanShift;

  let cleanTiming = timing.replace(/\s*\([^)]*excel[^)]*\)/gi, '').trim();
  if (/09[:.]30\s*AM\s*[-–—]\s*11[:.]00\s*PM/i.test(cleanTiming)) {
    cleanTiming = cleanTiming.replace(/11[:.]00\s*PM/i, '11:00 AM');
  }

  return `${cleanShift} (${cleanTiming})`;
}

// Parses date strings into { year, month (1-12), day }
function parseExamDateParts(dateStr: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim();
  if (!clean) return null;

  // 1. Check YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymd = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day };
    }
  }

  // 2. Check DD-MMM-YYYY or DD MMM YYYY (e.g. 23-Oct-2026, 23 October 2026)
  const dmyAlpha = clean.match(/^(\d{1,2})[-/.\s]+([A-Za-z]+)[-/.\s]+(\d{4})/);
  if (dmyAlpha) {
    const monthNames: Record<string, number> = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
    };
    const m = monthNames[dmyAlpha[2].toLowerCase().slice(0, 3)];
    if (m) {
      return { year: Number(dmyAlpha[3]), month: m, day: Number(dmyAlpha[1]) };
    }
  }

  // 3. Check DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmy = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const p1 = Number(dmy[1]);
    const p2 = Number(dmy[2]);
    const year = Number(dmy[3]);

    if (p1 > 12 && p2 <= 12) {
      return { year, month: p2, day: p1 };
    }
    if (p2 > 12 && p1 <= 12) {
      return { year, month: p1, day: p2 };
    }
    // Default to DD-MM-YYYY (standard Indian convention)
    return { year, month: p2, day: p1 };
  }

  // 4. Fallback to Date constructor
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }

  return null;
}

// Creates Date object with exact Asia/Kolkata (+05:30) offset
function createISTDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = String(year).padStart(4, '0');
  const m = pad(month);
  const d = pad(day);
  const hh = pad(hour);
  const mm = pad(minute);
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:00+05:30`);
}

// Parses shift strings to numbers for secondary ordering (Shift 1, 2, 3, 4)
function parseShiftNumber(shiftStr: string | null | undefined): number {
  if (!shiftStr || typeof shiftStr !== 'string') return 999;
  const clean = shiftStr.trim().toLowerCase();

  const digitMatch = clean.match(/\d+/);
  if (digitMatch) {
    return parseInt(digitMatch[0], 10);
  }

  if (clean.includes('shift i') || clean.includes('morning') || clean === 'i') return 1;
  if (clean.includes('shift ii') || clean.includes('afternoon') || clean === 'ii') return 2;
  if (clean.includes('shift iii') || clean.includes('evening') || clean === 'iii') return 3;
  if (clean.includes('shift iv') || clean === 'iv') return 4;

  return 999;
}

/**
 * Deduplicates exam records while preserving legitimate multiple exams
 * across different dates, shifts, subjects, rooms, and seats for the same student.
 * Seamlessly handles case-insensitive admission numbers (e.g. SCSE, SCAT, SMAS, GSOB),
 * canonical shift representations (e.g. "Shift 2" vs "2"), date formats, and subject codes.
 */
function deduplicateExamRecords<T extends ExamRecord>(records: T[]): T[] {
  if (!Array.isArray(records) || records.length <= 1) return records || [];

  const seenIds = new Set<string>();
  const seenExact = new Set<string>();
  const seenSubjectExam = new Set<string>();
  const seenSeatExam = new Set<string>();
  const uniqueRecords: T[] = [];

  const normalizeClean = (val: unknown): string => {
    if (val == null) return '';
    return String(val).trim().toLowerCase().replace(/\s+/g, ' ');
  };

  const canonicalAlphaNum = (val: unknown): string => {
    if (val == null) return '';
    return String(val).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const getCanonicalDate = (val: unknown): string => {
    if (!val) return '';
    const parts = parseExamDateParts(String(val));
    if (parts) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
    }
    return normalizeClean(val);
  };

  const getCanonicalShift = (shiftVal: unknown, timingVal?: unknown): { shiftNum: number; key: string } => {
    const shiftStr = shiftVal != null ? String(shiftVal) : '';
    const num = parseShiftNumber(shiftStr);
    if (num !== 999) {
      return { shiftNum: num, key: `shift-${num}` };
    }
    // Attempt timing inference if shift label didn't have an explicit number
    if (timingVal != null) {
      const parsed = parseShiftTiming(String(timingVal), shiftStr);
      if (parsed) {
        for (const [sNumStr, defaultWindow] of Object.entries(DEFAULT_SHIFT_TIMINGS)) {
          const sNum = Number(sNumStr);
          if (
            Math.abs(defaultWindow.start.hour * 60 + defaultWindow.start.minute - (parsed.start.hour * 60 + parsed.start.minute)) <= 15 &&
            Math.abs(defaultWindow.end.hour * 60 + defaultWindow.end.minute - (parsed.end.hour * 60 + parsed.end.minute)) <= 15
          ) {
            return { shiftNum: sNum, key: `shift-${sNum}` };
          }
        }
      }
    }
    return { shiftNum: 999, key: normalizeClean(shiftVal) || 'shift-unknown' };
  };

  for (const rawRecord of records) {
    if (!rawRecord) continue;

    // Standardize shift field if numeric (e.g. '2' -> 'Shift 2')
    const shiftInfo = getCanonicalShift(rawRecord.shift, rawRecord.shift_timing);
    const standardShift = shiftInfo.shiftNum !== 999 ? `Shift ${shiftInfo.shiftNum}` : (rawRecord.shift || '');
    const record: T = {
      ...rawRecord,
      shift: standardShift || rawRecord.shift
    };

    const recordId = record.id != null && String(record.id).trim() !== '' ? String(record.id).trim() : null;
    if (recordId && seenIds.has(recordId)) {
      continue;
    }

    const cAdmission = canonicalAlphaNum(record.admission_number);
    const cDate = getCanonicalDate(record.exam_date);
    const cShiftKey = shiftInfo.key;
    const cSubject = canonicalAlphaNum(record.subject_code);
    const cRoom = canonicalAlphaNum(record.room_number);
    const cSeat = canonicalAlphaNum(record.seat_number);

    // 1. Exact canonical identity
    const exactKey = `${cAdmission}|${cDate}|${cShiftKey}|${cSubject}|${cRoom}|${cSeat}`;
    if (seenExact.has(exactKey)) {
      continue;
    }

    // 2. Same course subject on the same date for the student
    // A student cannot have multiple exams for the exact same subject course on the same day.
    const subjectExamKey = cSubject ? `${cAdmission}|${cDate}|${cSubject}` : null;
    if (subjectExamKey && seenSubjectExam.has(subjectExamKey)) {
      continue;
    }

    // 3. Same seat allocation on the same date and shift
    // A student cannot be assigned to the exact same room & seat twice in the same shift on the same day.
    const seatExamKey = (cRoom && cSeat) ? `${cAdmission}|${cDate}|${cShiftKey}|${cRoom}|${cSeat}` : null;
    if (seatExamKey && seenSeatExam.has(seatExamKey)) {
      continue;
    }

    seenExact.add(exactKey);
    if (recordId) seenIds.add(recordId);
    if (subjectExamKey) seenSubjectExam.add(subjectExamKey);
    if (seatExamKey) seenSeatExam.add(seatExamKey);

    uniqueRecords.push(record);
  }

  return uniqueRecords;
}

// Comprehensive Sorting Algorithm in Asia/Kolkata (IST):
// 1. Evaluates current real-time in Asia/Kolkata.
// 2. An exam is UPCOMING if its end time has not passed yet: now <= endTime.
//    Once its end time has passed: it is COMPLETED.
// 3. All upcoming exams are placed at the TOP, ordered from earliest start time to latest.
// 4. All completed exams are placed at the BOTTOM, with most recently completed first (descending end time).
function sortExamsByDateTimeIST(rawRecords: ExamRecord[]): ExamRecord[] {
  if (!rawRecords || rawRecords.length === 0) return [];
  const records = deduplicateExamRecords(rawRecords);
  if (records.length === 0) return [];

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');

  // Determine current date in Asia/Kolkata (IST = UTC+05:30)
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  const istParts = istFormatter.formatToParts(now);
  const getISTPart = (type: string) => parseInt(istParts.find((p) => p.type === type)?.value || '0', 10);
  const istTodayStr = `${String(getISTPart('year')).padStart(4, '0')}-${pad(getISTPart('month'))}-${pad(getISTPart('day'))}`;

  interface EnrichedExam {
    record: ExamRecord;
    startTime: Date;
    endTime: Date;
    isUpcoming: boolean;
  }

  const upcoming: EnrichedExam[] = [];
  const completed: EnrichedExam[] = [];

  for (const record of records) {
    const dateParts = parseExamDateParts(record.exam_date);
    if (!dateParts) {
      // Unparseable dates kept safely at the end of upcoming
      upcoming.push({
        record,
        startTime: new Date(8640000000000000),
        endTime: new Date(8640000000000000),
        isUpcoming: true
      });
      continue;
    }

    const examDateStr = `${String(dateParts.year).padStart(4, '0')}-${pad(dateParts.month)}-${pad(dateParts.day)}`;
    const timing = parseShiftTiming(record.shift_timing, record.shift);

    let startTime: Date;
    let endTime: Date;
    let isUpcoming: boolean;

    if (examDateStr < istTodayStr) {
      // Past calendar date in IST -> fully completed
      isUpcoming = false;
      const sh = timing ? timing.start.hour : 9;
      const sm = timing ? timing.start.minute : 30;
      const eh = timing ? timing.end.hour : 11;
      const em = timing ? timing.end.minute : 0;
      startTime = createISTDate(dateParts.year, dateParts.month, dateParts.day, sh, sm);
      endTime = createISTDate(dateParts.year, dateParts.month, dateParts.day, eh, em);
    } else if (examDateStr > istTodayStr) {
      // Future calendar date in IST -> fully upcoming
      isUpcoming = true;
      const sh = timing ? timing.start.hour : 9;
      const sm = timing ? timing.start.minute : 30;
      const eh = timing ? timing.end.hour : 11;
      const em = timing ? timing.end.minute : 0;
      startTime = createISTDate(dateParts.year, dateParts.month, dateParts.day, sh, sm);
      endTime = createISTDate(dateParts.year, dateParts.month, dateParts.day, eh, em);
    } else {
      // Today in IST -> compare against exact end time
      if (timing) {
        startTime = createISTDate(dateParts.year, dateParts.month, dateParts.day, timing.start.hour, timing.start.minute);
        endTime = createISTDate(dateParts.year, dateParts.month, dateParts.day, timing.end.hour, timing.end.minute);
        isUpcoming = now.getTime() <= endTime.getTime();
      } else {
        const sh = 9;
        const sm = 30;
        const eh = 11;
        const em = 0;
        startTime = createISTDate(dateParts.year, dateParts.month, dateParts.day, sh, sm);
        endTime = createISTDate(dateParts.year, dateParts.month, dateParts.day, eh, em);
        isUpcoming = now.getTime() <= endTime.getTime();
      }
    }

    const item: EnrichedExam = {
      record,
      startTime,
      endTime,
      isUpcoming
    };

    if (isUpcoming) {
      upcoming.push(item);
    } else {
      completed.push(item);
    }
  }

  // Sort upcoming exams: earliest start time first (ascending)
  upcoming.sort((a, b) => {
    const diff = a.startTime.getTime() - b.startTime.getTime();
    if (diff !== 0) return diff;

    const shiftA = parseShiftNumber(a.record.shift);
    const shiftB = parseShiftNumber(b.record.shift);
    if (shiftA !== shiftB) return shiftA - shiftB;

    return (a.record.subject_code || '').localeCompare(b.record.subject_code || '');
  });

  // Sort completed exams: most recently completed first (descending end time)
  completed.sort((a, b) => {
    const diff = b.endTime.getTime() - a.endTime.getTime();
    if (diff !== 0) return diff;

    const shiftA = parseShiftNumber(a.record.shift);
    const shiftB = parseShiftNumber(b.record.shift);
    if (shiftA !== shiftB) return shiftA - shiftB;

    return (a.record.subject_code || '').localeCompare(b.record.subject_code || '');
  });

  // Combine: All upcoming exams at the TOP, followed by completed exams at the BOTTOM
  return [
    ...upcoming.map((u) => ({ ...u.record, is_upcoming: true })),
    ...completed.map((c) => ({ ...c.record, is_upcoming: false })),
  ];
}

export default function App() {
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<ExamRecord[] | null>(null);
  const [searched, setSearched] = useState(false);
  const [isPastExamsExpanded, setIsPastExamsExpanded] = useState(false);

  // Feedback System State
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedbackCategory, setFeedbackCategory] = useState<'Appreciation' | 'Suggestion' | 'Report an Issue'>('Appreciation');
  const [feedbackComments, setFeedbackComments] = useState('');
  const [feedbackName, setFeedbackName] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // Disclaimer Modal State
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDisclaimerOpen) {
          setIsDisclaimerOpen(false);
        } else if (isFeedbackOpen && !submittingFeedback) {
          setIsFeedbackOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFeedbackOpen, isDisclaimerOpen, submittingFeedback]);

  const handleOpenFeedback = () => {
    setIsFeedbackOpen(true);
    setFeedbackError(null);
  };

  const handleCloseFeedback = () => {
    if (submittingFeedback) return;
    setIsFeedbackOpen(false);
  };

  const handleResetFeedbackForm = () => {
    setFeedbackRating(5);
    setHoverRating(0);
    setFeedbackCategory('Appreciation');
    setFeedbackComments('');
    setFeedbackName('');
    setFeedbackError(null);
    setFeedbackSuccess(false);
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingFeedback) return;

    const trimmedComments = feedbackComments.trim();
    if (!trimmedComments) {
      setFeedbackError('Please enter your feedback comments before submitting.');
      return;
    }

    if (!feedbackRating || feedbackRating < 1 || feedbackRating > 5) {
      setFeedbackError('Please select a rating between 1 and 5 stars.');
      return;
    }

    setSubmittingFeedback(true);
    setFeedbackError(null);

    try {
      const { error: insertError } = await supabase.from('website_feedback').insert([
        {
          rating: feedbackRating,
          category: feedbackCategory,
          comments: trimmedComments,
          name: feedbackName.trim() || null,
        },
      ]);

      if (insertError) {
        console.error('Feedback insertion error:', insertError);
        setFeedbackError('Unable to submit feedback right now. Please try again.');
        return;
      }

      setFeedbackSuccess(true);
      setFeedbackError(null);
    } catch (err: any) {
      console.error('Feedback error:', err);
      setFeedbackError('Unable to submit feedback right now. Please try again.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    // Prevent duplicate concurrent searches
    if (loading) return;

    const normalizedAdmission = admissionNumber.trim().toUpperCase();
    if (!normalizedAdmission) {
      setError('Please enter your admission number.');
      return;
    }

    if (isKeyMaskedWithBullets) {
      setError(
        'Configuration Error: Your Supabase Anon Key in Vercel contains masked bullet characters (••••••••). In Supabase Dashboard > Project Settings > API, click the Copy button next to the "anon public" key, paste it into Vercel Environment Variables as VITE_SUPABASE_ANON_KEY, and redeploy.'
      );
      setRecords([]);
      setLoading(false);
      setSearched(true);
      return;
    }

    setLoading(true);
    setError(null);
    setRecords(null);
    setIsPastExamsExpanded(false);

    // Active AbortController with 8-second client-side timeout
    const searchAbortCtrl = new AbortController();
    const clientTimeoutId = setTimeout(() => {
      searchAbortCtrl.abort();
    }, 8000);

    try {
      let fetchedRecords: ExamRecord[] | null = null;
      let lastErrorMessage = '';

      // Primary Strategy: Direct Supabase database query (fastest, most reliable, ~200ms)
      try {
        const { data: dbData, error: dbError } = await supabase
          .from('exam_seating')
          .select('id, admission_number, student_name, exam_name, exam_date, exam_time, room_no, seat_no')
          .eq('admission_number', normalizedAdmission)
          .abortSignal(searchAbortCtrl.signal);

        if (!dbError && Array.isArray(dbData)) {
          fetchedRecords = dbData.map(normalizeExamRecord);
        } else if (dbError) {
          lastErrorMessage = dbError.message || '';
        }
      } catch (directErr: any) {
        if (directErr?.name === 'AbortError' || searchAbortCtrl.signal.aborted) {
          throw directErr;
        }
        lastErrorMessage = directErr?.message || '';
      }

      // Secondary Strategy: Supabase Edge Function fallback if direct query failed or returned an error
      if (fetchedRecords === null && !searchAbortCtrl.signal.aborted) {
        try {
          const { data: edgeData, error: edgeError } = await supabase.functions.invoke('find-exam-seat', {
            body: { admission_number: normalizedAdmission },
            signal: searchAbortCtrl.signal,
          });

          if (!edgeError && Array.isArray(edgeData?.records)) {
            fetchedRecords = edgeData.records.map(normalizeExamRecord);
          } else if (edgeError) {
            // Only use edgeError if we don't already have a more descriptive dbError
            if (!lastErrorMessage) {
              lastErrorMessage = edgeError.message || '';
            }
          } else if (edgeData?.error) {
            lastErrorMessage = edgeData.error;
          }
        } catch (edgeErr: any) {
          if (edgeErr?.name === 'AbortError' || searchAbortCtrl.signal.aborted) {
            throw edgeErr;
          }
        }
      }

      // Process retrieved records or display appropriate feedback
      if (fetchedRecords !== null) {
        if (fetchedRecords.length === 0) {
          setError('No matching record found. Please verify your admission number.');
          setRecords([]);
        } else {
          // Deduplicate records to ensure each unique exam is rendered exactly once
          const uniqueRecords = deduplicateExamRecords(fetchedRecords);
          // Sort in frontend using live IST date & shift timings
          const sortedRecords = sortExamsByDateTimeIST(uniqueRecords);
          setRecords(sortedRecords);
          setError(null);
        }
      } else {
        setRecords([]);
        const isTimeout =
          searchAbortCtrl.signal.aborted ||
          lastErrorMessage.toLowerCase().includes('timeout') ||
          lastErrorMessage.toLowerCase().includes('522');

        if (isTimeout) {
          setError(
            'Connection to the examination database timed out. If your Supabase database was recently paused, please resume it in your Supabase dashboard.'
          );
        } else if (
          lastErrorMessage.toLowerCase().includes('failed to send a request to the edge function') ||
          lastErrorMessage.toLowerCase().includes('invalid api key') ||
          lastErrorMessage.toLowerCase().includes('jwt')
        ) {
          setError(
            'Unable to connect to the database. Please verify your Supabase API credentials in Vercel Environment Variables.'
          );
        } else {
          setError(lastErrorMessage || 'Unable to search right now. Please try again.');
        }
      }
    } catch (err: any) {
      const isTimeout =
        searchAbortCtrl.signal.aborted ||
        String(err?.message || '').toLowerCase().includes('abort') ||
        String(err?.message || '').toLowerCase().includes('timeout');

      setError(
        isTimeout
          ? 'Connection to the examination database timed out. Please try again in a few moments.'
          : 'Unable to search right now. Please try again.'
      );
      setRecords([]);
    } finally {
      // Guaranteed: clear timer, terminate loading, and set searched flag
      clearTimeout(clientTimeoutId);
      setLoading(false);
      setSearched(true);
    }
  };

  const handleReset = () => {
    setAdmissionNumber('');
    setRecords(null);
    setSearched(false);
    setError(null);
    setIsPastExamsExpanded(false);
  };


  const renderExamCard = (rec: ExamRecord, index: number, isUpcoming: boolean) => {
    const cardKey = `exam-card-${rec.id ?? 'row'}-${rec.admission_number}-${rec.exam_date}-${rec.shift ?? 's'}-${rec.subject_code ?? 'subj'}-${index}`;

    return (
      <div
        key={cardKey}
        className="bg-[#eef2f7] rounded-3xl p-6 sm:p-8 shadow-[10px_10px_24px_#cbd5e1,-10px_-10px_24px_#ffffff] border border-white/60 space-y-5 print:shadow-none print:border print:border-slate-300 print:mb-6"
      >
        {/* Status Line */}
        <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-200/50">
          <span
            className={`font-bold tracking-wide uppercase text-[11px] ${
              isUpcoming ? 'text-indigo-600' : 'text-slate-400'
            }`}
          >
            {isUpcoming
              ? index === 0
                ? 'Next Upcoming Exam'
                : 'Upcoming Exam'
              : 'Completed Exam'}
          </span>
          {rec.exam_date && (
            <span className="text-slate-400 text-[11px] font-medium">
              {rec.exam_date}
            </span>
          )}
        </div>

        {/* Room and Seat - Large & Prominent */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Room Number */}
          <div className="bg-[#eef2f7] rounded-2xl p-5 sm:p-6 shadow-[inset_3px_3px_6px_#cbd5e1,inset_-3px_-3px_6px_#ffffff] text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-teal-600">
              <Building2 className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Room</span>
            </div>
            <div className="text-4xl sm:text-5xl font-extrabold font-mono text-slate-800 tracking-tight">
              {rec.room_number || 'TBA'}
            </div>
          </div>

          {/* Seat Number */}
          <div className="bg-[#eef2f7] rounded-2xl p-5 sm:p-6 shadow-[inset_3px_3px_6px_#cbd5e1,inset_-3px_-3px_6px_#ffffff] text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-teal-600">
              <Layers className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Seat</span>
            </div>
            <div className="text-4xl sm:text-5xl font-extrabold font-mono text-slate-800 tracking-tight">
              {rec.seat_number || 'TBA'}
            </div>
          </div>
        </div>

        {/* Essential Exam Details: Course Code, Date, Shift & Timing */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          {rec.subject_code && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#eef2f7] shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff]">
              <BookOpen className="w-4 h-4 text-teal-600 shrink-0" />
              <div className="truncate">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Course Code</span>
                <span className="font-semibold text-slate-800 truncate block">{rec.subject_code}</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#eef2f7] shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff]">
            <Calendar className="w-4 h-4 text-teal-600 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Date</span>
              <span className="font-semibold text-slate-800 block">{rec.exam_date || 'TBA'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#eef2f7] shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff]">
            <Clock className="w-4 h-4 text-teal-600 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Shift</span>
              <span className="font-semibold text-slate-800 block">
                {formatShiftDisplay(rec.shift, rec.shift_timing)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const studentProgram = records?.find((r) => r.program?.trim())?.program?.trim();
  const studentSemester = records?.find((r) => r.semester?.trim())?.semester?.trim();
  const programSemesterText = studentProgram && studentSemester
    ? `${studentProgram} - ${studentSemester}`
    : studentProgram || studentSemester || null;

  return (
    <div className="min-h-screen bg-[#eef2f7] text-slate-700 flex flex-col justify-between font-['Plus_Jakarta_Sans',sans-serif] selection:bg-indigo-600 selection:text-white">
      {/* Header */}
      <header className="w-full bg-[#eef2f7] border-b border-slate-200/70 sticky top-0 z-20 print:hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#eef2f7] shadow-[5px_5px_10px_#cbd5e1,-5px_-5px_10px_#ffffff] flex items-center justify-center text-indigo-600 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">Exam Seat Finder</h1>
            </div>
          </div>

          {/* Share Your Feedback Card */}
          <button
            type="button"
            onClick={handleOpenFeedback}
            className="group flex items-center gap-2 sm:gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-[#eef2f7] shadow-[4px_4px_8px_#cbd5e1,-4px_-4px_8px_#ffffff] hover:shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff] active:shadow-[inset_3px_3px_6px_#cbd5e1,inset_-3px_-3px_6px_#ffffff] border border-white/80 transition-all duration-200 text-slate-700 hover:text-indigo-600 cursor-pointer shrink-0"
            title="Share Your Feedback"
            aria-label="Share Your Feedback"
          >
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9)] shrink-0">
              <MessageSquarePlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <span className="text-xs sm:text-sm font-semibold tracking-tight whitespace-nowrap">
              Share Your Feedback
            </span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 sm:py-14">
        {!searched ? (
          /* 1. Home / Search Page */
          <div className="space-y-8 animate-fade-in">
            <div className="text-center space-y-2">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight">
                Find Your Seat
              </h2>
            </div>

            {/* Search Card */}
            <div className="bg-[#eef2f7] rounded-3xl p-6 sm:p-9 shadow-[10px_10px_24px_#cbd5e1,-10px_-10px_24px_#ffffff] border border-white/60">
              <form onSubmit={handleSearch} className="space-y-5">
                {error && (
                  <div className="p-3.5 rounded-2xl bg-red-50 text-red-700 text-xs font-semibold flex items-center gap-2.5 border border-red-200">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="admission-number-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Admission Number
                  </label>
                  <input
                    id="admission-number-input"
                    type="text"
                    required
                    autoFocus
                    value={admissionNumber}
                    onChange={(e) => {
                      setAdmissionNumber(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="Enter your admission number"
                    className="w-full px-4 py-3.5 sm:py-4 rounded-2xl bg-[#eef2f7] text-slate-800 placeholder-slate-400 text-sm sm:text-base font-semibold shadow-[inset_3px_3px_6px_#cbd5e1,inset_-3px_-3px_6px_#ffffff] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono tracking-wide"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm tracking-wide shadow-[6px_6px_14px_#cbd5e1,-6px_-6px_14px_#ffffff] hover:shadow-[3px_3px_8px_#cbd5e1,-3px_-3px_8px_#ffffff] transition-all flex items-center justify-center gap-2.5 disabled:opacity-70 cursor-pointer"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Searching...</span>
                      </div>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Find My Seat</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Verification Notice */}
            <div className="text-center px-3 max-w-lg mx-auto">
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Please verify your examination details against the latest official university notification. Official university instructions prevail in case of discrepancies.
              </p>
            </div>
          </div>
        ) : (
          /* 2. Results Page */
          <div className="space-y-6 animate-fade-in">
            {/* Actions: Search Again & Student Program/Semester */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2.5 rounded-2xl bg-[#eef2f7] shadow-[5px_5px_10px_#cbd5e1,-5px_-5px_10px_#ffffff] hover:shadow-[2px_2px_5px_#cbd5e1,-2px_-2px_5px_#ffffff] text-slate-700 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-600" />
                <span>Search Again</span>
              </button>

              {programSemesterText && (
                <div
                  className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-[#eef2f7] shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff] border border-white/80 text-xs font-bold tracking-tight select-none truncate max-w-[60%] sm:max-w-none text-right"
                  title={programSemesterText}
                >
                  <span className="text-indigo-600 font-bold">{programSemesterText}</span>
                </div>
              )}
            </div>

            {/* Error / No Match State */}
            {error || !records || records.length === 0 ? (
              <div className="bg-[#eef2f7] rounded-3xl p-8 sm:p-10 shadow-[10px_10px_24px_#cbd5e1,-10px_-10px_24px_#ffffff] text-center space-y-4 border border-white/60">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff]">
                  <AlertCircle className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-slate-700 text-sm font-semibold max-w-md mx-auto leading-relaxed">
                  {error || 'No matching record found.'}
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={(e) => handleSearch(e)}
                    disabled={loading}
                    className="px-5 py-2.5 rounded-2xl bg-indigo-600 text-white font-bold text-xs shadow-[4px_4px_8px_#cbd5e1,-4px_-4px_8px_#ffffff] hover:bg-indigo-700 disabled:opacity-60 transition-all cursor-pointer flex items-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>{loading ? 'Retrying...' : 'Retry Search'}</span>
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-5 py-2.5 rounded-2xl bg-[#eef2f7] text-slate-700 font-semibold text-xs shadow-[4px_4px_8px_#cbd5e1,-4px_-4px_8px_#ffffff] hover:shadow-[2px_2px_4px_#cbd5e1,-2px_-2px_4px_#ffffff] transition-all cursor-pointer flex items-center gap-2"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                    <span>Search Different Number</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Essential Results Display */
              <div className="space-y-5">
                {/* Student info header */}
                <div className="bg-[#eef2f7] rounded-2xl p-5 shadow-[6px_6px_14px_#cbd5e1,-6px_-6px_14px_#ffffff] border border-white/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">Student</span>
                    <span className="text-base font-bold text-slate-800">{records[0].student_name || 'Student'}</span>
                  </div>
                  <div className="text-xs font-mono font-bold bg-[#eef2f7] px-3 py-1.5 rounded-xl shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff] text-indigo-600 w-fit">
                    {records[0].admission_number}
                  </div>
                </div>

                {/* Exam Cards - Dynamically Sorted with Collapsible Past Exams */}
                {(() => {
                  const upcomingExams = records.filter((r) => r.is_upcoming);
                  const pastExams = records.filter((r) => !r.is_upcoming);

                  return (
                    <>
                      {/* Upcoming Exams (Full visibility or Empty State) */}
                      {upcomingExams.length > 0 ? (
                        upcomingExams.map((rec, index) => renderExamCard(rec, index, true))
                      ) : (
                        <div className="bg-[#eef2f7] rounded-3xl p-6 sm:p-8 shadow-[10px_10px_24px_#cbd5e1,-10px_-10px_24px_#ffffff] border border-white/60 text-center py-8 sm:py-10 space-y-3 print:shadow-none print:border print:border-slate-300 print:mb-6">
                          <div className="w-12 h-12 rounded-2xl bg-[#eef2f7] shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff] flex items-center justify-center text-indigo-600 mx-auto">
                            <Calendar className="w-6 h-6 text-indigo-600" />
                          </div>
                          <div className="space-y-1.5 max-w-md mx-auto">
                            <h3 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                              No Upcoming Exams Right Now
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
                              Your upcoming examination details will appear here once the university updates the schedule.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Past Exams Section */}
                      {pastExams.length > 0 && (
                        <div>
                          {/* Centered Clickable Heading between two dividers */}
                          <button
                            type="button"
                            id="past-exams-toggle"
                            aria-expanded={isPastExamsExpanded}
                            aria-controls="past-exams-container"
                            aria-label={isPastExamsExpanded ? 'Collapse past exams' : 'Expand past exams'}
                            onClick={() => setIsPastExamsExpanded((prev) => !prev)}
                            className="w-full pt-3 pb-1 flex items-center gap-3 group cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 rounded-xl transition-all"
                          >
                            <div className="h-px bg-slate-300/80 flex-1 group-hover:bg-slate-400/80 transition-colors" />
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] font-bold uppercase tracking-wide text-indigo-600 group-hover:text-indigo-700 transition-colors">
                                Past Exams
                              </span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 text-indigo-600 group-hover:text-indigo-700 transition-transform duration-300 ease-in-out print:hidden ${
                                  isPastExamsExpanded ? 'rotate-180' : ''
                                }`}
                                aria-hidden="true"
                              />
                            </div>
                            <div className="h-px bg-slate-300/80 flex-1 group-hover:bg-slate-400/80 transition-colors" />
                          </button>

                          {/* Collapsible Past Exam Cards (Clean, unclipped neomorphic shadows) */}
                          <div
                            id="past-exams-container"
                            role="region"
                            aria-labelledby="past-exams-toggle"
                            className={`transition-all duration-300 ease-in-out print:!block print:!opacity-100 print:!max-h-none print:!mt-5 ${
                              isPastExamsExpanded
                                ? 'opacity-100 max-h-[5000px] mt-5 overflow-visible'
                                : 'opacity-0 max-h-0 overflow-hidden pointer-events-none mt-0'
                            }`}
                          >
                            <div className="space-y-5">
                              {pastExams.map((rec, pIndex) =>
                                renderExamCard(rec, upcomingExams.length + pIndex, false)
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full px-4 pb-6 pt-3 print:hidden">
        <div className="max-w-2xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#eef2f7] shadow-[8px_8px_20px_#cbd5e1,-8px_-8px_20px_#ffffff] border border-white/80 p-5 sm:p-6 transition-all duration-300">
            {/* Top row: Heading with horizontal divider lines */}
            <div className="flex items-center gap-3 w-full justify-center pb-4">
              <div className="h-px bg-slate-300/80 flex-1 max-w-[60px] sm:max-w-[120px]" />
              <span className="text-[10px] sm:text-[11px] font-bold text-indigo-600 uppercase tracking-widest select-none">
                DEVELOPED BY
              </span>
              <div className="h-px bg-slate-300/80 flex-1 max-w-[60px] sm:max-w-[120px]" />
            </div>

            {/* Middle row: Two Developer Profiles */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 pb-4">
              {/* Tanmay Kumar */}
              <a
                href="https://www.linkedin.com/in/tanmay-kumar-219a322a9/"
                target="_blank"
                rel="noopener noreferrer"
                title="View Tanmay Kumar's LinkedIn profile"
                aria-label="Tanmay Kumar LinkedIn profile"
                className="group flex items-center gap-2.5 py-2 px-3.5 rounded-2xl bg-[#eef2f7] shadow-[3px_3px_8px_#cbd5e1,-3px_-3px_8px_#ffffff] hover:shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff] border border-white/70 transition-all duration-200 cursor-pointer w-full sm:w-auto justify-center"
              >
                <div className="relative shrink-0 p-[2px] rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-blue-500 shadow-sm transition-transform duration-200 group-hover:scale-105">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-inner select-none">
                    TK
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors">
                    Tanmay Kumar
                  </span>
                  <Linkedin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0a66c2] group-hover:scale-110 transition-transform duration-200 shrink-0" />
                </div>
              </a>

              {/* Dibya Upadhyay */}
              <a
                href="https://www.linkedin.com/in/dibya-upadhyay-659701388/"
                target="_blank"
                rel="noopener noreferrer"
                title="View Dibya Upadhyay's LinkedIn profile"
                aria-label="Dibya Upadhyay LinkedIn profile"
                className="group flex items-center gap-2.5 py-2 px-3.5 rounded-2xl bg-[#eef2f7] shadow-[3px_3px_8px_#cbd5e1,-3px_-3px_8px_#ffffff] hover:shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff] border border-white/70 transition-all duration-200 cursor-pointer w-full sm:w-auto justify-center"
              >
                <div className="relative shrink-0 p-[2px] rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-blue-500 shadow-sm transition-transform duration-200 group-hover:scale-105">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-inner select-none">
                    DU
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors">
                    Dibya Upadhyay
                  </span>
                  <Linkedin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0a66c2] group-hover:scale-110 transition-transform duration-200 shrink-0" />
                </div>
              </a>
            </div>

            {/* Bottom row: Department, University & Mentorship */}
            <div className="pt-3.5 border-t border-slate-200/80 flex flex-col items-center gap-1.5 text-center text-xs text-slate-500 font-medium">
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-slate-700 font-semibold">
                  Department of AI &amp; ML | SoAI, Galgotias University
                </span>
              </div>
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-slate-500">
                  Mentored by Dr. Gaurav Agarwal, Dr. Tarun Maini and Priyanka Rai
                </span>
              </div>
            </div>
          </div>

          {/* Subtle Centered Footer */}
          <div className="mt-3.5 text-center text-xs text-slate-400 font-medium flex items-center justify-center gap-2 flex-wrap select-none">
            <span>© 2026 Exam Seat Finder</span>
            <span className="text-slate-300" aria-hidden="true">•</span>
            <button
              type="button"
              onClick={() => setIsDisclaimerOpen(true)}
              className="text-slate-500 hover:text-indigo-600 underline underline-offset-4 decoration-slate-300 hover:decoration-indigo-500 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 rounded"
            >
              Disclaimer
            </button>
            <span className="text-slate-300" aria-hidden="true">•</span>
            <a
              href="mailto:examseatfinder@gmail.com"
              className="text-slate-500 hover:text-indigo-600 underline underline-offset-4 decoration-slate-300 hover:decoration-indigo-500 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 rounded"
            >
              Contact Us
            </a>
          </div>
        </div>
      </footer>
      <Analytics />

      {/* Neumorphic Disclaimer Modal */}
      {isDisclaimerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm overflow-y-auto animate-fade-in print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disclaimer-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsDisclaimerOpen(false);
            }
          }}
        >
          <div className="relative w-full max-w-lg bg-[#eef2f7] rounded-3xl shadow-[20px_20px_60px_#cbd5e1,-20px_-20px_60px_#ffffff] border border-white/90 p-6 sm:p-8 my-auto transition-all animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#eef2f7] shadow-[4px_4px_8px_#cbd5e1,-4px_-4px_8px_#ffffff] flex items-center justify-center text-indigo-600 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="disclaimer-modal-title" className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                    Disclaimer
                  </h2>
                  <p className="text-xs text-slate-500">
                    Important notice for students
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDisclaimerOpen(false)}
                aria-label="Close disclaimer dialog"
                className="w-9 h-9 rounded-xl bg-[#eef2f7] shadow-[3px_3px_6px_#cbd5e1,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff] active:shadow-[inset_3px_3px_6px_#cbd5e1,inset_-3px_-3px_6px_#ffffff] flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="pt-5 space-y-5">
              <div className="p-4 sm:p-5 rounded-2xl bg-[#eef2f7] shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff] border border-white/70">
                <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed text-justify">
                  Exam Seat Finder is provided as an informational service for students’ convenience. While reasonable efforts are made to ensure the accuracy of the information displayed, the developer shall not be held responsible for errors, omissions, or discrepancies in the seating information or for consequences arising from reliance on such information, to the extent permitted by applicable law. Students are advised to verify all examination details through official university notifications before their examination.
                </p>
              </div>

              {/* Action Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setIsDisclaimerOpen(false)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-3.5 px-6 rounded-2xl shadow-[5px_5px_12px_#cbd5e1,-5px_-5px_12px_#ffffff] hover:shadow-[3px_3px_8px_#cbd5e1,-3px_-3px_8px_#ffffff] active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)] transition-all duration-200 text-sm cursor-pointer"
                >
                  I Understand
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Neumorphic Feedback Modal */}
      {isFeedbackOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm overflow-y-auto animate-fade-in print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submittingFeedback) {
              handleCloseFeedback();
            }
          }}
        >
          <div className="relative w-full max-w-lg bg-[#eef2f7] rounded-3xl shadow-[20px_20px_60px_#cbd5e1,-20px_-20px_60px_#ffffff] border border-white/90 p-6 sm:p-8 my-auto transition-all animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#eef2f7] shadow-[4px_4px_8px_#cbd5e1,-4px_-4px_8px_#ffffff] flex items-center justify-center text-indigo-600 shrink-0">
                  <MessageSquarePlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="feedback-modal-title" className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
                    Share Your Feedback
                  </h2>
                  <p className="text-xs text-slate-500">
                    Your suggestions help us improve the exam portal.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseFeedback}
                disabled={submittingFeedback}
                aria-label="Close feedback dialog"
                className="w-9 h-9 rounded-xl bg-[#eef2f7] shadow-[3px_3px_6px_#cbd5e1,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff] active:shadow-[inset_3px_3px_6px_#cbd5e1,inset_-3px_-3px_6px_#ffffff] flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            {feedbackSuccess ? (
              <div className="py-6 sm:py-8 text-center space-y-5 animate-fade-in">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-50 border border-emerald-200/80 shadow-[inset_2px_2px_6px_rgba(16,185,129,0.15)] flex items-center justify-center mx-auto text-emerald-600">
                  <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11" />
                </div>
                <div className="space-y-2 max-w-sm mx-auto">
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                    Feedback Received
                  </h3>
                  <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
                    Thank you for your feedback! Your input helps us improve Exam Seat Finder.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      handleResetFeedbackForm();
                      setIsFeedbackOpen(false);
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-[4px_4px_10px_#a5b4fc,-4px_-4px_10px_#ffffff] transition-all cursor-pointer"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={handleResetFeedbackForm}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#eef2f7] hover:bg-slate-100 text-slate-600 hover:text-slate-900 font-semibold text-sm shadow-[3px_3px_6px_#cbd5e1,-3px_-3px_6px_#ffffff] border border-white/60 transition-all cursor-pointer"
                  >
                    Submit Another
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitFeedback} className="pt-5 space-y-5">
                {/* 1-5 Star Rating */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Rating <span className="text-red-500">*</span>
                    </label>
                    <span className="text-xs font-semibold text-indigo-600">
                      {['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][(hoverRating || feedbackRating) - 1]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-2xl bg-[#eef2f7] shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff] justify-center">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isFilled = (hoverRating || feedbackRating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          disabled={submittingFeedback}
                          onClick={() => {
                            setFeedbackRating(star);
                            if (feedbackError) setFeedbackError(null);
                          }}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                          className="p-1.5 rounded-xl transition-all duration-150 hover:scale-115 focus:outline-none cursor-pointer disabled:opacity-60"
                        >
                          <Star
                            className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                              isFilled
                                ? 'text-amber-400 fill-amber-400 drop-shadow-[0_2px_4px_rgba(251,191,36,0.35)]'
                                : 'text-slate-300 hover:text-slate-400'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Category Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(['Appreciation', 'Suggestion', 'Report an Issue'] as const).map((cat) => {
                      const isSelected = feedbackCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          disabled={submittingFeedback}
                          onClick={() => {
                            setFeedbackCategory(cat);
                            if (feedbackError) setFeedbackError(null);
                          }}
                          className={`py-2 px-3 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer text-center ${
                            isSelected
                              ? 'bg-[#eef2f7] text-indigo-700 shadow-[inset_3px_3px_6px_#cbd5e1,inset_-3px_-3px_6px_#ffffff] border border-indigo-200/80 font-bold'
                              : 'bg-[#eef2f7] text-slate-600 shadow-[3px_3px_6px_#cbd5e1,-3px_-3px_6px_#ffffff] hover:text-slate-900 border border-transparent'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Comments (Required) */}
                <div>
                  <label htmlFor="feedback-comments" className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Comments <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="feedback-comments"
                    rows={4}
                    required
                    disabled={submittingFeedback}
                    value={feedbackComments}
                    onChange={(e) => {
                      setFeedbackComments(e.target.value);
                      if (feedbackError) setFeedbackError(null);
                    }}
                    placeholder="Tell us what worked well or what can be improved..."
                    className="w-full bg-[#eef2f7] text-slate-800 placeholder-slate-400 rounded-2xl p-3.5 sm:p-4 shadow-[inset_3px_3px_6px_#cbd5e1,inset_-3px_-3px_6px_#ffffff] border border-transparent focus:border-indigo-400 focus:outline-none transition-all text-sm resize-none disabled:opacity-60"
                  />
                </div>

                {/* Name (Optional) */}
                <div>
                  <label htmlFor="feedback-name" className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Name (Optional)
                  </label>
                  <input
                    id="feedback-name"
                    type="text"
                    disabled={submittingFeedback}
                    value={feedbackName}
                    onChange={(e) => setFeedbackName(e.target.value)}
                    placeholder="e.g. Your name"
                    className="w-full bg-[#eef2f7] text-slate-800 placeholder-slate-400 rounded-2xl px-4 py-3 shadow-[inset_3px_3px_6px_#cbd5e1,inset_-3px_-3px_6px_#ffffff] border border-transparent focus:border-indigo-400 focus:outline-none transition-all text-sm disabled:opacity-60"
                  />
                </div>

                {/* Error Banner */}
                {feedbackError && (
                  <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-red-50 text-red-700 text-xs font-medium border border-red-200/80 shadow-sm animate-fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{feedbackError}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-3.5 px-6 rounded-2xl shadow-[5px_5px_12px_#cbd5e1,-5px_-5px_12px_#ffffff] hover:shadow-[3px_3px_8px_#cbd5e1,-3px_-3px_8px_#ffffff] active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)] transition-all duration-200 flex items-center justify-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submittingFeedback ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Submitting Feedback...</span>
                    </>
                  ) : (
                    <span>Submit Feedback</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
