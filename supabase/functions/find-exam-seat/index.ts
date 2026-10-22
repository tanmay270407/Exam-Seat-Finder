// Supabase Edge Function: find-exam-seat
// Purpose: Securely looks up examination seating records for a student
// using case-insensitive, whitespace-normalized matching on both admission number
// and student name against public.exam_seating, preserving Row Level Security (RLS).

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

    const normalizedAdmission = normalizeWhitespace(rawAdmission);
    const normalizedName = normalizeWhitespace(rawName);

    if (!normalizedAdmission || !normalizedName) {
      return new Response(
        JSON.stringify({
          error: 'Both admission number and student name are required.',
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
          message: "We couldn't find a matching record. Please check your name and admission number.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Filter matching records by:
    // 1. Exact case-insensitive match on normalized admission number
    // 2. Case-insensitive and whitespace-normalized match on student name
    const lowerAdmission = normalizedAdmission.toLowerCase();

    const matchingRecords = data.filter((record: any) => {
      const recordAdmission = normalizeWhitespace(record?.admission_number).toLowerCase();
      const admissionMatches = recordAdmission === lowerAdmission;
      const nameMatches = isNameMatch(normalizedName, record?.student_name || '');

      return admissionMatches && nameMatches;
    });

    if (matchingRecords.length === 0) {
      return new Response(
        JSON.stringify({
          records: [],
          message: "We couldn't find a matching record. Please check your name and admission number.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        records: matchingRecords,
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
