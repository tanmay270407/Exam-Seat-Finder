import React, { useEffect } from 'react';
import { ArrowLeft, Shield, Lock, Eye, Database, Cookie, Bell, Mail, FileText, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

interface PrivacyPolicyProps {
  onBackToHome: () => void;
  onOpenFeedback?: () => void;
  onOpenDisclaimer?: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBackToHome, onOpenFeedback, onOpenDisclaimer }) => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.title = 'Privacy Policy | Exam Seat Finder';
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
          Official Documentation
        </span>
      </div>

      {/* Main Document Card */}
      <div className="bg-[#eef2f7] rounded-3xl p-6 sm:p-10 shadow-[10px_10px_24px_#cbd5e1,-10px_-10px_24px_#ffffff] border border-white/70 space-y-8">
        {/* Header Title Section */}
        <div className="border-b border-slate-200/80 pb-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#eef2f7] shadow-[4px_4px_8px_#cbd5e1,-4px_-4px_8px_#ffffff] flex items-center justify-center text-indigo-600 shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
                Privacy Policy
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Last updated: <span className="font-semibold text-slate-700">30 October 2026</span>
              </p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-2">
            Exam Seat Finder (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;the portal&rdquo;), available at{' '}
            <a href="https://www.examseatfinder.online/" className="text-indigo-600 hover:underline font-semibold">
              https://www.examseatfinder.online/
            </a>
            , provides university students with instant, accurate access to their assigned examination room numbers, seat numbers, and examination schedules. This Privacy Policy details how we handle, process, and safeguard your data when using our service.
          </p>
        </div>

        {/* Highlight Summary Card */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#eef2f7] shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff] border border-white/80 space-y-2">
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Key Privacy Commitments</span>
          </div>
          <ul className="text-xs sm:text-sm text-slate-600 space-y-1.5 list-disc list-inside">
            <li><strong className="text-slate-800">No Account Required:</strong> Students do not create accounts or submit sensitive passwords.</li>
            <li><strong className="text-slate-800">Ephemeral Lookups:</strong> Admission numbers are processed strictly to query public examination seating lists and are not used to build persistent tracking profiles.</li>
            <li><strong className="text-slate-800">No Commercial Sale:</strong> We never sell, rent, or trade student information to commercial brokers.</li>
          </ul>
        </div>

        {/* Section 1: Information We Collect */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <Database className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2>1. Information We Collect</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            We collect and process minimal information strictly necessary to fulfill the educational utility of the website:
          </p>
          <div className="space-y-3 pt-1">
            <div className="p-3.5 rounded-xl bg-[#eef2f7] shadow-[inset_1px_1px_3px_#cbd5e1,inset_-1px_-1px_3px_#ffffff] text-xs sm:text-sm space-y-1">
              <span className="font-bold text-slate-800 block">A. Admission Number Search Queries</span>
              <p className="text-slate-600 leading-relaxed">
                When searching for seating allocations, you submit your university admission number (e.g., 23SOCE1010038). This value is matched in real-time against the public database of seating arrangements. We do not store queries tied to your personal identity.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#eef2f7] shadow-[inset_1px_1px_3px_#cbd5e1,inset_-1px_-1px_3px_#ffffff] text-xs sm:text-sm space-y-1">
              <span className="font-bold text-slate-800 block">B. Feedback Submissions</span>
              <p className="text-slate-600 leading-relaxed">
                When you share feedback or report an issue via the Feedback modal, we collect your star rating (1–5), feedback category (Appreciation, Suggestion, or Report an Issue), and comments. The Name field is optional for general feedback but mandatory for issue follow-ups, and the Email Address field is mandatory only when submitting a &ldquo;Report an Issue&rdquo; request so our technical team can follow up directly.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#eef2f7] shadow-[inset_1px_1px_3px_#cbd5e1,inset_-1px_-1px_3px_#ffffff] text-xs sm:text-sm space-y-1">
              <span className="font-bold text-slate-800 block">C. Technical &amp; Device Information</span>
              <p className="text-slate-600 leading-relaxed">
                Like most modern web applications, our infrastructure automatically receives standard technical logs, including IP addresses, browser types, language preferences, referring URLs, operating systems, and basic performance timestamps to ensure fast loading times and system availability.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: How We Use Your Information */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <Eye className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2>2. How We Use Your Information</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            The data collected is used solely for the following legitimate purposes:
          </p>
          <ul className="text-xs sm:text-sm text-slate-600 space-y-2 list-disc list-inside pl-1">
            <li>To retrieve and display accurate examination seating, room allocations, course codes, exam dates, and shift timings.</li>
            <li>To investigate and rectify reported seating errors or course code bleed discrepancies.</li>
            <li>To protect against malicious scraping, automated spam, denial-of-service (DDoS) attempts, and brute-force abuse.</li>
            <li>To evaluate aggregate performance metrics and improve the portal&rsquo;s response speed across university network connections.</li>
          </ul>
        </section>

        {/* Section 3: Third-Party Services & Integrations */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <ExternalLink className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2>3. Third-Party Services &amp; Integrations</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            We partner with established cloud and developer infrastructure providers to host and maintain the service:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-[#eef2f7] shadow-[3px_3px_8px_#cbd5e1,-3px_-3px_8px_#ffffff] border border-white/70 space-y-1">
              <span className="font-bold text-slate-800 text-xs block">Supabase (PostgreSQL &amp; Auth)</span>
              <p className="text-slate-500 text-xs leading-relaxed">
                Provides scalable, encrypted database hosting for examination allocations with Row Level Security (RLS) enforcement.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#eef2f7] shadow-[3px_3px_8px_#cbd5e1,-3px_-3px_8px_#ffffff] border border-white/70 space-y-1">
              <span className="font-bold text-slate-800 text-xs block">Google Apps Script &amp; Sheets</span>
              <p className="text-slate-500 text-xs leading-relaxed">
                Transmits and archives user-submitted feedback securely to dedicated spreadsheets for maintenance and issue tracking.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#eef2f7] shadow-[3px_3px_8px_#cbd5e1,-3px_-3px_8px_#ffffff] border border-white/70 space-y-1">
              <span className="font-bold text-slate-800 text-xs block">Vercel &amp; Analytics</span>
              <p className="text-slate-500 text-xs leading-relaxed">
                Provides content delivery network (CDN) edge hosting, SSL/TLS certificates, and privacy-preserving aggregate telemetry.
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#eef2f7] shadow-[3px_3px_8px_#cbd5e1,-3px_-3px_8px_#ffffff] border border-white/70 space-y-1">
              <span className="font-bold text-slate-800 text-xs block">Google AdSense</span>
              <p className="text-slate-500 text-xs leading-relaxed">
                May serve non-intrusive contextual educational advertisements to defray domain and hosting operational expenses.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Cookies & Advertising Policy */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <Cookie className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2>4. Cookies &amp; Advertising Disclosures</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Cookies are small text files stored on your device that enable essential website functions. Exam Seat Finder uses minimal cookies:
          </p>
          <ul className="text-xs sm:text-sm text-slate-600 space-y-2 list-disc list-inside pl-1">
            <li><strong className="text-slate-800">Essential Technical Cookies:</strong> Used for session continuity, load balancing, and preventing repeat popups.</li>
            <li><strong className="text-slate-800">Third-Party Advertising:</strong> Third-party vendors, including Google, use cookies to serve ads based on a user&rsquo;s prior visits to this website or other websites.</li>
            <li><strong className="text-slate-800">Google DoubleClick Cookie:</strong> Google&rsquo;s use of advertising cookies enables it and its partners to serve ads to users based on their visit to our site and/or other sites on the Internet.</li>
            <li><strong className="text-slate-800">Opt-Out:</strong> Users may opt out of personalized advertising by visiting{' '}
              <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-semibold">
                Google Ads Settings
              </a>
              {' '}or by visiting{' '}
              <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-semibold">
                www.aboutads.info
              </a>.
            </li>
          </ul>
        </section>

        {/* Section 5: Data Security & Retention */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <Lock className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2>5. Data Security &amp; Retention</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            We implement technical safeguards to prevent unauthorized access, alteration, or disclosure of data:
          </p>
          <ul className="text-xs sm:text-sm text-slate-600 space-y-1.5 list-disc list-inside pl-1">
            <li>All web traffic between your browser and our servers is encrypted using modern Transport Layer Security (HTTPS / TLS 1.3).</li>
            <li>Student search inputs are not persistently logged in relational databases.</li>
            <li>Feedback records are kept solely for the academic term to ensure verified resolution of reported seating queries.</li>
          </ul>
        </section>

        {/* Section 6: Children and Student Rights */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <Bell className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2>6. Student Rights &amp; Verification Notice</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Students retain full rights to query how their data is handled. If you believe your feedback was submitted in error or wish to request removal of a feedback submission, you can reach out to our team at any time.
          </p>
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Official University Notice:</strong> Exam Seat Finder is an independent student convenience portal. Official university notifications, hall tickets, and the instructions of the Controller of Examinations remain the final authoritative source for all examination schedules.
            </span>
          </div>
        </section>

        {/* Section 7: Changes to This Policy */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2>7. Changes to This Privacy Policy</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            We may occasionally update this Privacy Policy to reflect technical upgrades, changes in applicable data regulations, or modifications to our services. Any updates will be published immediately on this page with an updated &ldquo;Last updated&rdquo; timestamp.
          </p>
        </section>

        {/* Section 8: Contact Information */}
        <section className="pt-4 border-t border-slate-200/80 space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
            <Mail className="w-5 h-5 text-indigo-600 shrink-0" />
            <h2>8. Contact Us</h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            For questions, suggestions, or privacy inquiries regarding this Privacy Policy, please contact our development and maintenance team:
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
                Submit Feedback Form
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
