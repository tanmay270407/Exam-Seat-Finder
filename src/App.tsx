/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  BookOpen
} from 'lucide-react';
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
}

export default function App() {
  const [studentName, setStudentName] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<ExamRecord[] | null>(null);
  const [searched, setSearched] = useState(false);

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
        setRecords(matchingRecords);
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
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#eef2f7] shadow-[5px_5px_10px_#cbd5e1,-5px_-5px_10px_#ffffff] flex items-center justify-center text-indigo-600">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-800 leading-tight">Exam Seat Finder</h1>
              <p className="text-xs text-slate-500">Find your exam room & seat.</p>
            </div>
          </div>
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

                {/* Exam Cards */}
                {records.map((rec, index) => (
                  <div
                    key={rec.id || index}
                    className="bg-[#eef2f7] rounded-3xl p-6 sm:p-8 shadow-[10px_10px_24px_#cbd5e1,-10px_-10px_24px_#ffffff] border border-white/60 space-y-6 print:shadow-none print:border print:border-slate-300 print:mb-6"
                  >
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
                            {rec.shift || 'Shift 1'} {rec.shift_timing ? `(${rec.shift_timing})` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-5 text-center text-xs text-slate-400 print:hidden">
        <p>Exam Seat Finder</p>
      </footer>
    </div>
  );
}
