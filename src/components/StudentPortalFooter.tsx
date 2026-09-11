'use client';

import React from 'react';

export default function StudentPortalFooter() {
  const currentYear = new Date().getFullYear();
  const phone = '8593971496';
  const whatsappUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(
    'Hi, I have a question regarding my Lab Accounting statement.'
  )}`;

  return (
    <footer className="w-full max-w-4xl mx-auto border-t border-slate-200 mt-12 pt-8 pb-6 text-slate-500 text-xs print:hidden">
      <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
        {/* Left Column: Branding & Tagline */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center font-black text-white text-xs shadow-xs flex-shrink-0">
              LA
            </div>
            <span className="font-extrabold text-slate-900 text-sm tracking-tight">
              Lab Accounting System
            </span>
          </div>
          <p className="text-slate-500 text-xs max-w-xs">
            Non-profit student accounting &amp; service ledger
          </p>
        </div>

        {/* Right Column: Contact Support & WhatsApp Button & Copyright */}
        <div className="flex flex-col items-center md:items-end text-center md:text-right space-y-3">
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
            <span className="text-slate-600 text-[11px] font-medium">Need help?</span>

            {/* WhatsApp Link / Button */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all shadow-xs group"
            >
              <svg className="w-3.5 h-3.5 fill-current text-emerald-600 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.705 1.754zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.285-.143-1.689-.833-1.95-.928-.261-.095-.451-.143-.641.143-.19.285-.736.928-.902 1.118-.166.19-.332.214-.617.071-.285-.143-1.207-.445-2.299-1.419-.848-.758-1.421-1.694-1.587-1.979-.166-.285-.018-.439.124-.581.128-.127.285-.332.427-.499.143-.166.19-.285.285-.475.095-.19.047-.356-.024-.499-.071-.143-.641-1.545-.878-2.115-.23-.555-.464-.479-.641-.488l-.547-.01c-.19 0-.499.071-.76.356-.261.285-.998.975-.998 2.376 0 1.401 1.021 2.756 1.163 2.946.143.19 2.01 3.07 4.87 4.306.68.294 1.211.469 1.625.6.684.218 1.307.187 1.8.114.549-.082 1.689-.69 1.927-1.356.237-.666.237-1.236.166-1.356-.071-.12-.261-.19-.546-.333z" />
              </svg>
              <span>Chat on WhatsApp</span>
            </a>
          </div>

          <p className="text-slate-400 text-[11px] font-mono">
            &copy; {currentYear} Lab Accounting System. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
