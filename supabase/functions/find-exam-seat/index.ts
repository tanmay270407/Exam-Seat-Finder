// Supabase Edge Function: find-exam-seat
// Purpose: Securely looks up examination seating records for a student
// using case-insensitive, whitespace-normalized matching on both admission number
// and student name against public.exam_seating, preserving Row Level Security (RLS).
// Dynamically sorts matching records: combines exam_date and shift_timing in Asia/Kolkata (IST).
// Exams whose end time has not passed are marked upcoming and sorted earliest to latest.
// Completed exams are placed below upcoming, sorted most recently completed first.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Normalizes leading/trailing spaces and collapses internal repeated spaces
function normalizeWhitespace(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/\s+/g, ' ');
}

// Case-insensitive name matcher with multi-space and token tolerance
function isNameMatch(inputName: string, dbName: string): boolean {
  const normInput = normalizeWhitespace(inputName).toLowerCase();
  const normDb = normalizeWhitespace(dbName).toLowerCase();

  if (!normInput || !normDb) return false;

  // 1. Direct normalized case-insensitive match
  if (normInput === normDb) return true;

  // 2. Substring match
  if (normDb.includes(normInput) || normInput.includes(normDb)) return true;

  // 3. Word token match (all words in input exist in db name or vice-versa)
  const inputTokens = normInput.split(' ').filter(Boolean);
  const dbTokens = normDb.split(' ').filter(Boolean);

  if (inputTokens.length > 0 && inputTokens.every((token) => normDb.includes(token))) {
    return true;
  }
  if (dbTokens.length > 0 && dbTokens.every((token) => normInput.includes(token))) {
    return true;
  }

  return false;
}

// Parses date strings into { year, month (1-12), day }
function parseExamDateParts(dateStr: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim();
  if (!clean) return null;

  // 1. Check YYYY-MM-DD or YYYY/MM/DD
  const ymd = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    return { year: Number(ymd[1]), month: Number(ymd[2]), day: Number(ymd[3]) };
  }

  // 2. Check DD-MM-YYYY or DD/MM/YYYY
  const dmy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    return { year: Number(dmy[3]), month: Number(dmy[2]), day: Number(dmy[1]) };
  }

  // 3. Check DD-MMM-YYYY or DD MMM YYYY (e.g. 23-Oct-2026, 23 Oct 2026)
  const dmyAlpha = clean.match(/^(\d{1,2})[-/\s]+([A-Za-z]+)[-/\s]+(\d{4})/);
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

  // 4. Fallback to standard JavaScript Date constructor
  const fallback = new Date(clean);
  if (!isNaN(fallback.getTime())) {
    return { year: fallback.getFullYear(), month: fallback.getMonth() + 1, day: fallback.getDate() };
  }

  return null;
}

// Default shift windows when timing is omitted or unparseable
const DEFAULT_SHIFT_TIMINGS: Record<number, { start: { hour: number; minute: number }; end: { hour: number; minute: number } }> = {
  1: { start: { hour: 9, minute: 30 }, end: { hour: 11, minute: 0 } },
  2: { start: { hour: 11, minute: 40 }, end: { hour: 13, minute: 10 } },
  3: { start: { hour: 13, minute: 50 }, end: { hour: 15, minute: 20 } },
  4: { start: { hour: 15, minute: 40 }, end: { hour: 17, minute: 10 } },
};

// Parses individual time tokens like "9:30 AM", "09.30 AM", "11:00 PM", "13:30"
function parseSingleTime(str: string): { hour: number; minute: number; rawMeridian: string | null } | null {
  if (!str) return null;
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

  // Split by '-', '–', '—', or 'to'
  const parts = clean.split(/\s*(?:[-–—]|\bto\b)\s*/i);
  if (parts.length < 2) return fallback;

  const start = parseSingleTime(parts[0]);
  const end = parseSingleTime(parts[1]);

  if (!start || !end) return fallback;

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

  // Detect and fix Excel 12-hour AM/PM typo (e.g. 09:30 AM - 11:00 PM for Shift 1)
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

// Resolves exact start and end Date objects in Asia/Kolkata (IST = UTC+05:30)
function getExamTimingWindow(
  examDateStr: string | null | undefined,
  timingStr: string | null | undefined,
  shiftStr?: string | null
): { startTime: Date; endTime: Date; hasValidTiming: boolean } | null {
  const dateParts = parseExamDateParts(examDateStr);
  if (!dateParts) return null;

  const parsedTiming = parseShiftTiming(timingStr, shiftStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = String(dateParts.year).padStart(4, '0');
  const m = pad(dateParts.month);
  const d = pad(dateParts.day);

  let startH = 9;
  let startM = 30;
  let endH = 11;
  let endM = 0;

  if (parsedTiming) {
    startH = parsedTiming.start.hour;
    startM = parsedTiming.start.minute;
    endH = parsedTiming.end.hour;
    endM = parsedTiming.end.minute;
  }

  // Exact ISO 8601 string with Asia/Kolkata (+05:30) offset
  const startTime = new Date(`${y}-${m}-${d}T${pad(startH)}:${pad(startM)}:00+05:30`);
  const endTime = new Date(`${y}-${m}-${d}T${pad(endH)}:${pad(endM)}:00+05:30`);

  return { startTime, endTime, hasValidTiming: !!parsedTiming };
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

// Dynamic Sorting Algorithm (IST Timezone Aware)
function sortExamsByDateTimeIST(records: any[]): any[] {
  if (!records || records.length <= 1) return records;

  const now = new Date(); // Current epoch milliseconds

  interface EnrichedExam {
    record: any;
    startTime: Date;
    endTime: Date;
    isUpcoming: boolean;
  }

  const upcoming: EnrichedExam[] = [];
  const completed: EnrichedExam[] = [];

  for (const record of records) {
    const window = getExamTimingWindow(record.exam_date, record.shift_timing, record.shift);

    if (!window) {
      upcoming.push({
        record,
        startTime: new Date(8640000000000000),
        endTime: new Date(8640000000000000),
        isUpcoming: true
      });
      continue;
    }

    const isUpcoming = now.getTime() <= window.endTime.getTime();

    const item: EnrichedExam = {
      record,
      startTime: window.startTime,
      endTime: window.endTime,
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

  return [
    ...upcoming.map((u) => ({ ...u.record, is_upcoming: true })),
    ...completed.map((c) => ({ ...c.record, is_upcoming: false })),
  ];
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Validate HTTP method
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Please use POST.' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON request payload.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const rawAdmission = body?.admission_number;
    const rawName = body?.student_name;

    // Accidental leading and trailing spaces trimmed; string preserved including leading zeros
    const normalizedAdmission = typeof rawAdmission === 'string'
      ? rawAdmission.trim()
      : (rawAdmission != null ? String(rawAdmission).trim() : '');
    const normalizedName = typeof rawName === 'string' ? normalizeWhitespace(rawName) : '';

    if (!normalizedAdmission) {
      return new Response(
        JSON.stringify({
          error: 'Admission number is required.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Server-side privileged credentials (keeps secret key off client)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      Deno.env.get('SUPABASE_ANON_KEY') ||
      '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          error: 'Supabase server configuration is missing on the Edge Function.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Safe parameterized database query matching admission_number case-insensitively using ilike
    const { data, error } = await supabase
      .from('exam_seating')
      .select(
        'id, admission_number, enrollment_number, student_name, program, semester, section, subject_code, room_number, seat_number, exam_date, shift, shift_timing'
      )
      .ilike('admission_number', normalizedAdmission);

    if (error) {
      return new Response(
        JSON.stringify({
          error: 'Database query error occurred while searching for seating records.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({
          records: [],
          message: "No matching record found. Please check your admission number.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Filter matching records by exact case-insensitive match on normalized admission number.
    // If student_name was optionally supplied (backward compatibility), check it too.
    const lowerAdmission = normalizedAdmission.toLowerCase();

    const matchingRecords = data.filter((record: any) => {
      const recordAdmission = (typeof record?.admission_number === 'string'
        ? record.admission_number
        : String(record?.admission_number || '')).trim().toLowerCase();
      const admissionMatches = recordAdmission === lowerAdmission;

      if (normalizedName) {
        return admissionMatches && isNameMatch(normalizedName, record?.student_name || '');
      }

      return admissionMatches;
    });

    if (matchingRecords.length === 0) {
      return new Response(
        JSON.stringify({
          records: [],
          message: "No matching record found. Please check your admission number.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Dynamically sort records by exact date & shift timing in Asia/Kolkata (IST)
    const sortedRecords = sortExamsByDateTimeIST(matchingRecords);

    return new Response(
      JSON.stringify({
        records: sortedRecords,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err?.message || 'An unexpected error occurred.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
