/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Search,
  Printer,
  ArrowLeft,
  AlertCircle,
  Building2,
  Layers,
  Calendar,
  Clock,
  BookOpen,
  Linkedin,
  ExternalLink,
  MessageSquarePlus,
  Star,
  X,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import { supabase } from './supabase';

interface ExamRecord {
  id: string | number;
  admission_number: string;
  enrollment_number?: string;
  student_name: string;
  program?: string;
  semester?: string;
  section?: string;
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

// Sanitizes and formats shift display cleanly (removes Excel notes and fixes typos)
function formatShiftDisplay(shift?: string, timing?: string): string {
  const cleanShift = shift?.trim() || 'Shift 1';
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

// Comprehensive Sorting Algorithm in Asia/Kolkata (IST):
// 1. Evaluates current real-time in Asia/Kolkata.
// 2. An exam is UPCOMING if its end time has not passed yet: now <= endTime.
//    Once its end time has passed: it is COMPLETED.
// 3. All upcoming exams are placed at the TOP, ordered from earliest start time to latest.
// 4. All completed exams are placed at the BOTTOM, with most recently completed first (descending end time).
function sortExamsByDateTimeIST(records: ExamRecord[]): ExamRecord[] {
  if (!records || records.length <= 1) return records;

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
  const [studentName, setStudentName] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<ExamRecord[] | null>(null);
  const [searched, setSearched] = useState(false);

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

  // Close feedback modal on Escape key if not submitting
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFeedbackOpen && !submittingFeedback) {
        setIsFeedbackOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFeedbackOpen, submittingFeedback]);

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
    const normalizedName = studentName.trim().replace(/\s+/g, ' ');
    const normalizedAdmission = admissionNumber.trim();

    if (!normalizedName || !normalizedAdmission) {
      setError('Please enter both details.');
      return;
    }

    setLoading(true);
    setError(null);
    setRecords(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('find-exam-seat', {
        body: {
          admission_number: normalizedAdmission,
          student_name: normalizedName,
        },
      });

      if (functionError) {
        console.warn('Lookup notice:', functionError.message);
        setError('Unable to search right now. Please try again.');
        setRecords([]);
        setSearched(true);
        return;
      }

      if (data?.error) {
        setError('Unable to search right now. Please try again.');
        setRecords([]);
        setSearched(true);
        return;
      }

      const matchingRecords: ExamRecord[] = data?.records || [];
      if (matchingRecords.length === 0) {
        setError('No matching record found.');
        setRecords([]);
      } else {
        // Sort in frontend using live IST date & shift timings
        const sortedRecords = sortExamsByDateTimeIST(matchingRecords);
        setRecords(sortedRecords);
      }
      setSearched(true);
    } catch (err: any) {
      console.warn('Search notice:', err?.message || err);
      setError('Unable to search right now. Please try again.');
      setRecords([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStudentName('');
    setAdmissionNumber('');
    setRecords(null);
    setSearched(false);
    setError(null);
  };

  const handlePrint = () => {
    window.print();
  };

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
              <p className="text-xs text-slate-500">Find your exam room &amp; seat.</p>
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

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-4 py-3.5 rounded-2xl bg-[#eef2f7] text-slate-800 placeholder-slate-400 text-sm font-medium shadow-[inset_3px_3px_6px_#cbd5e1,inset_-3px_-3px_6px_#ffffff] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Admission Number
                  </label>
                  <input
                    type="text"
                    required
                    value={admissionNumber}
                    onChange={(e) => setAdmissionNumber(e.target.value)}
                    placeholder="Enter your admission number"
                    className="w-full px-4 py-3.5 rounded-2xl bg-[#eef2f7] text-slate-800 placeholder-slate-400 text-sm font-medium shadow-[inset_3px_3px_6px_#cbd5e1,inset_-3px_-3px_6px_#ffffff] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
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
          </div>
        ) : (
          /* 2. Results Page */
          <div className="space-y-6 animate-fade-in">
            {/* Actions: Only Print & Search Again */}
            <div className="flex items-center justify-between print:hidden">
              <button
                onClick={handleReset}
                className="px-4 py-2.5 rounded-2xl bg-[#eef2f7] shadow-[5px_5px_10px_#cbd5e1,-5px_-5px_10px_#ffffff] hover:shadow-[2px_2px_5px_#cbd5e1,-2px_-2px_5px_#ffffff] text-slate-700 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-600" />
                <span>Search Again</span>
              </button>

              {records && records.length > 0 && (
                <button
                  onClick={handlePrint}
                  className="px-4 py-2.5 rounded-2xl bg-indigo-600 text-white font-semibold text-xs shadow-[5px_5px_10px_#cbd5e1,-5px_-5px_10px_#ffffff] hover:bg-indigo-700 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print</span>
                </button>
              )}
            </div>

            {/* Error / No Match State */}
            {error || !records || records.length === 0 ? (
              <div className="bg-[#eef2f7] rounded-3xl p-8 sm:p-10 shadow-[10px_10px_24px_#cbd5e1,-10px_-10px_24px_#ffffff] text-center space-y-4 border border-white/60">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff]">
                  <AlertCircle className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-slate-700 text-sm font-semibold">
                  {error || 'No matching record found.'}
                </p>
                <div className="pt-2">
                  <button
                    onClick={handleReset}
                    className="px-5 py-2.5 rounded-2xl bg-indigo-600 text-white font-bold text-xs shadow-[4px_4px_8px_#cbd5e1,-4px_-4px_8px_#ffffff] hover:bg-indigo-700 transition-all cursor-pointer"
                  >
                    Search Again
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
                    <span className="text-base font-bold text-slate-800">{records[0].student_name}</span>
                  </div>
                  <div className="text-xs font-mono font-bold bg-[#eef2f7] px-3 py-1.5 rounded-xl shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff] text-indigo-600 w-fit">
                    {records[0].admission_number}
                  </div>
                </div>

                {/* Exam Cards - Dynamically Sorted by Date and Shift Timing in Asia/Kolkata (IST) */}
                {records.map((rec, index) => {
                  const isFirstCompleted = !rec.is_upcoming && (index === 0 || records[index - 1]?.is_upcoming);

                  return (
                    <React.Fragment key={rec.id || index}>
                      {isFirstCompleted && index > 0 && (
                        <div className="pt-3 pb-1 flex items-center gap-3">
                          <div className="h-px bg-slate-300/80 flex-1" />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Past Exams
                          </span>
                          <div className="h-px bg-slate-300/80 flex-1" />
                        </div>
                      )}

                      <div className="bg-[#eef2f7] rounded-3xl p-6 sm:p-8 shadow-[10px_10px_24px_#cbd5e1,-10px_-10px_24px_#ffffff] border border-white/60 space-y-5 print:shadow-none print:border print:border-slate-300 print:mb-6">
                        {/* Status Line */}
                        <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-200/50">
                          <span
                            className={`font-bold tracking-wide uppercase text-[11px] ${
                              rec.is_upcoming ? 'text-indigo-600' : 'text-slate-400'
                            }`}
                          >
                            {rec.is_upcoming
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
                            <div className="flex items-center justify-center gap-1.5 text-indigo-600">
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

                        {/* Essential Exam Details: Subject, Date, Shift & Timing */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                          {rec.subject_code && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#eef2f7] shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff]">
                              <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                              <div className="truncate">
                                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Subject</span>
                                <span className="font-semibold text-slate-800 truncate block">{rec.subject_code}</span>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 p-3 rounded-xl bg-[#eef2f7] shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff]">
                            <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
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
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full px-4 pb-6 pt-3 print:hidden">
        <div className="max-w-2xl mx-auto">
          <div className="group/footer relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white/70 backdrop-blur-md border border-white/90 shadow-[0_8px_30px_rgba(99,102,241,0.08),0_2px_8px_rgba(15,23,42,0.04)] px-5 py-4 sm:px-6 sm:py-4 transition-all duration-300 hover:shadow-[0_12px_36px_rgba(99,102,241,0.12),0_4px_12px_rgba(15,23,42,0.06)] hover:border-indigo-100/80">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              {/* Developer Profile Info */}
              <div className="flex flex-col sm:flex-row items-center gap-3.5">
                {/* Circular Profile Avatar with Subtle Purple-Blue Gradient Ring */}
                <div className="relative shrink-0 p-[2.5px] rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-blue-500 shadow-sm transition-transform duration-300 group-hover/footer:scale-105">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-inner select-none">
                    TK
                  </div>
                </div>

                {/* Developer Details */}
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest block">
                    DEVELOPED BY
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight leading-snug">
                    Tanmay Kumar
                  </h3>
                  <p className="text-xs text-slate-500 font-normal">
                    Building smart solutions through code &amp; AI
                  </p>
                </div>
              </div>

              {/* LinkedIn CTA Button */}
              <div className="shrink-0 w-full sm:w-auto">
                <a
                  href="https://www.linkedin.com/in/tanmay-kumar-219a322a9/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View Tanmay Kumar's LinkedIn profile"
                  className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/90 hover:bg-white text-slate-700 hover:text-indigo-600 border border-slate-200/80 hover:border-indigo-200 shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-semibold group/btn"
                >
                  <Linkedin className="w-4 h-4 text-[#0a66c2] group-hover/btn:scale-110 transition-transform duration-200" />
                  <span>View on LinkedIn</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-indigo-500 group-hover/btn:translate-x-0.5 transition-all duration-200" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
      <Analytics />

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
