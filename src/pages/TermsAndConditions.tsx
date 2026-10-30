import React, { useEffect } from 'react';
import { ArrowLeft, BookOpen, AlertCircle, CheckCircle, ShieldCheck, FileText, Ban, ExternalLink, RefreshCw, Mail, Scale } from 'lucide-react';

interface TermsAndConditionsProps {
  onBackToHome: () => void;
  onOpenFeedback?: () => void;
  onOpenDisclaimer?: () => void;
}

export const TermsAndConditions: React.FC<TermsAndConditionsProps> = ({ onBackToHome, onOpenFeedback, onOpenDisclaimer }) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.title = 'Terms & Conditions | Exam Seat Finder';
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 animate-fade-in space-y-8">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToHome}
          className="group px-4 py-2.5 rounded-2xl bg-[#eef2f7] shadow-[5px_5px_10px_#cbd5e1,-5px_-5px_10px_#ffffff] hover:shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff] text-slate-700 hover:text-indigo-600 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer border border-white/80"
        >
          <ArrowLeft className="w-4 h-4 text-indigo-600 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Home</span>
        </button>

        <span className="text-xs font-semibold text-slate-400">
          Legal Agreement
        </span>
      </div>

      {/* Main Document Card */}
      <div className="bg-[#eef2f7] rounded-3xl p-6 sm:p-10 shadow-[10px_10px_24px_#cbd5e1,-10px_-10px_24px_#ffffff] border border-white/70 space-y-8">
        {/* Header Title Section */}
        <div className="border-b border-slate-200/80 pb-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#eef2f7] shadow-[4px_4px_8px_#cbd5e1,-4px_-4px_8px_#ffffff] flex items-center justify-center text-indigo-600 shrink-0">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
                Terms &amp; Conditions
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Last updated: <span className="font-semibold text-slate-700">30 October 2026</span>
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-2">
            Welcome to Exam Seat Finder (&ldquo;Exam Seat Finder,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), hosted at{' '}
            <a href="https://www.examseatfinder.online/" className="text-indigo-600 hover:underline font-semibold">
              https://www.examseatfinder.online/
            </a>
            . These Terms &amp; Conditions govern your access to and use of this website. By accessing or using this portal, you agree to be bound by these terms. If you disagree with any part of these terms, please refrain from using the service.
          </p>
        </div>

        {/* Advisory Callout */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#eef2f7] shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff] border border-white/80 space-y-2">
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Essential Notice for Candidates</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Exam Seat Finder operates as an independent informational aid created to assist university students in quickly looking up room numbers, seat numbers, and examination schedules. Official instructions and hall tickets issued by the university examination division always prevail in the event of any discrepancies.
          </p>
        </div>

        {/* Section 1: Website Purpose & Permitted Use */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <BookOpen className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2>1. Website Purpose &amp; Permitted Use</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Exam Seat Finder provides a rapid search interface enabling university students to look up their assigned room number, seat number, and scheduled examination timing using only their unique admission number.
          </p>
          <ul className="text-xs sm:text-sm text-slate-600 space-y-1.5 list-disc list-inside pl-1">
            <li>You may use this service solely for personal, non-commercial educational purposes.</li>
            <li>You agree to use this site in compliance with all applicable local, institutional, and academic regulations.</li>
          </ul>
        </section>

        {/* Section 2: Seating Information & Accuracy */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2>2. Examination Seating Information &amp; Accuracy</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            While reasonable care is taken to ensure that seating and scheduling details accurately mirror official university distributions:
          </p>
          <ul className="text-xs sm:text-sm text-slate-600 space-y-2 list-disc list-inside pl-1">
            <li><strong className="text-slate-800">No Warranty of Perfection:</strong> Unforeseen administrative changes, emergency room shifts, course code alterations, or last-minute seating rearrangements may occur prior to examination commencement.</li>
            <li><strong className="text-slate-800">Verification Requirement:</strong> Students are strictly required to double-check their examination room and seating details on physical institutional notice boards or official portal announcements before entering the examination hall.</li>
            <li><strong className="text-slate-800">No Liability for Tardiness or Missed Exams:</strong> The developers and platform operators assume no responsibility for missed exams, late entry, or examination disqualification arising from reliance on this website.</li>
          </ul>
        </section>

        {/* Section 3: Student Responsibilities */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <CheckCircle className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2>3. Student Responsibilities</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            As a student or user accessing Exam Seat Finder, you agree to:
          </p>
          <ul className="text-xs sm:text-sm text-slate-600 space-y-1.5 list-disc list-inside pl-1">
            <li>Enter your own accurate admission number without attempting to probe or enumerate batches of other students&rsquo; records.</li>
            <li>Arrive at the designated examination room at least 20 to 30 minutes prior to the reporting time published by the university.</li>
            <li>Carry your physical University Identity Card and official Examination Admit Card / Hall Ticket to all examination venues.</li>
            <li>Promptly notify the examination supervisory staff if your physical seating desk differs from the online display.</li>
          </ul>
        </section>

        {/* Section 4: Prohibited Misuse of Student Information */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <Ban className="w-5 h-5 text-red-600 shrink-0" />
            <h2>4. Prohibited Misuse &amp; Security Violations</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            You expressly agree that you shall NOT engage in any of the following unauthorized activities:
          </p>
          <div className="p-4 rounded-2xl bg-red-50/60 border border-red-200 text-slate-700 text-xs sm:text-sm space-y-2">
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Deploying automated crawlers, bots, headless scrapers, or scripts to bulk-download or harvest student seating databases.</li>
              <li>Attempting to bypass, probe, reverse-engineer, or breach backend database access controls or API rate limits.</li>
              <li>Conducting denial-of-service (DoS) or distributed denial-of-service (DDoS) attacks that impair service availability for fellow candidates.</li>
              <li>Injecting malicious code, SQL injection payloads, or cross-site scripting (XSS) vectors into input fields or feedback forms.</li>
              <li>Commercializing or republishing student seating rosters for financial gain.</li>
            </ul>
          </div>
        </section>

        {/* Section 5: Third-Party Services & External Links */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <ExternalLink className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2>5. Third-Party Services &amp; External Links</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Exam Seat Finder may include links to external websites and services, including university homepages, mentor and developer LinkedIn profiles, and Google services. We do not endorse, manage, or accept liability for the content, privacy practices, or availability of third-party websites.
          </p>
        </section>

        {/* Section 6: Website Availability & Limitations */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <RefreshCw className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2>6. Service Availability &amp; Limitations</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            The service is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis. While our edge-accelerated infrastructure strives for continuous uptime during peak exam hours, we do not guarantee uninterrupted access. Network congestion, upstream maintenance, or university server changes may temporarily affect response times.
          </p>
        </section>

        {/* Section 7: Intellectual Property */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2>7. Intellectual Property</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            The application design, Neumorphic user interface components, client source code, layout systems, and custom algorithms (including real-time IST time calculations and course code disambiguation) are the intellectual property of the project developers. All university names, school designations, course titles, and logos belong to their respective registered owners and are utilized strictly for descriptive and informational student identification.
          </p>
        </section>

        {/* Section 8: Changes to the Terms */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <Scale className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2>8. Changes to the Terms</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            We reserve the right to modify or replace these Terms &amp; Conditions at our sole discretion. Any revisions will become effective immediately upon posting to this URL with a revised &ldquo;Last updated&rdquo; date. Continued access to the portal signifies your acceptance of any revised terms.
          </p>
        </section>

        {/* Section 9: Contact Information */}
        <section className="pt-4 border-t border-slate-200/80 space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <Mail className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2>9. Contact Information &amp; Support</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            If you have questions regarding these Terms &amp; Conditions, need clarification on data policies, or encounter a technical discrepancy, please reach out to our team:
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
            <a
              href="mailto:examseatfinder@gmail.com"
              className="px-4 py-2.5 rounded-xl bg-[#eef2f7] shadow-[3px_3px_8px_#cbd5e1,-3px_-3px_8px_#ffffff] hover:shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff] text-indigo-600 hover:text-indigo-700 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all border border-white/70"
            >
              <Mail className="w-4 h-4" />
              <span>examseatfinder@gmail.com</span>
            </a>
            {onOpenFeedback && (
              <button
                type="button"
                onClick={onOpenFeedback}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-[3px_3px_8px_#cbd5e1,-3px_-3px_8px_#ffffff] transition-all cursor-pointer"
              >
                Share Feedback
              </button>
            )}
            {onOpenDisclaimer && (
              <button
                type="button"
                onClick={onOpenDisclaimer}
                className="px-4 py-2.5 rounded-xl bg-[#eef2f7] hover:bg-slate-100 text-slate-600 hover:text-slate-900 font-semibold text-xs sm:text-sm shadow-[3px_3px_8px_#cbd5e1,-3px_-3px_8px_#ffffff] transition-all cursor-pointer border border-white/80"
              >
                View Disclaimer
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Bottom Back Button */}
      <div className="flex items-center justify-center pt-2">
        <button
          type="button"
          onClick={onBackToHome}
          className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs sm:text-sm shadow-[5px_5px_12px_#cbd5e1,-5px_-5px_12px_#ffffff] transition-all flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Seat Finder</span>
        </button>
      </div>
    </div>
  );
};
