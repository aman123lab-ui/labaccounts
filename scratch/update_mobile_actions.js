const fs = require('fs');
const path = 'src/app/incharge/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add State
const stateAnchor = `const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);`;
const stateAdd = `const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [mobileActionStudent, setMobileActionStudent] = useState<any>(null);`;
content = content.replace(stateAnchor, stateAdd);

// 2. Wrap buttons and add 3-dots menu
const btnAnchorStart = `<div className="flex items-center justify-center gap-2">
                                  {/* Edit Student Button */}`;
const btnAnchorEnd = `{/* WhatsApp Reminder */}
                                  {isOverdue && (
                                    <a
                                      href={generateWhatsAppLink(stud.phone, stud.name, stud.balance)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-emerald-50/90 hover:bg-emerald-100 text-emerald-800 border border-emerald-300/80 px-2 py-1 rounded text-[10px] transition-all font-semibold shadow-sm"
                                      title="Send WhatsApp payment reminder"
                                    >
                                      WhatsApp
                                    </a>
                                  )}
                                </div>`;

const idxStart = content.indexOf(btnAnchorStart);
const idxEnd = content.indexOf('</div>', content.indexOf('WhatsApp', idxStart)) + 6;

if (idxStart !== -1 && idxEnd > idxStart) {
  const block = content.slice(idxStart, idxEnd);
  
  // Replace the parent div class
  let newBlock = block.replace('<div className="flex items-center justify-center gap-2">', '<div className="hidden lg:flex items-center justify-center gap-2">');
  
  // Append the 3-dots button
  newBlock += `\n                                <div className="flex lg:hidden justify-center items-center">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setMobileActionStudent(stud); }}
                                    className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                  >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                    </svg>
                                  </button>
                                </div>`;
  
  content = content.slice(0, idxStart) + newBlock + content.slice(idxEnd);
}

// 3. Add Mobile Actions Modal
const modalAnchor = `{/* ADD STUDENT MODAL */}`;
const modalAdd = `{/* MOBILE ACTIONS MODAL */}
        {mobileActionStudent && (() => {
          const isOverdue = mobileActionStudent.balance > 0;
          return (
          <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
              <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center relative">
                <div className="relative z-10">
                  <h3 className="text-base font-black text-slate-800">Actions for {mobileActionStudent.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileActionStudent(null)}
                  className="relative z-10 text-slate-400 hover:text-slate-600 bg-slate-200/50 hover:bg-slate-200 p-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => { setMobileActionStudent(null); setEditingStudent(mobileActionStudent); }}
                  className="w-full bg-slate-100 text-slate-700 font-semibold px-4 py-3 rounded-xl flex justify-center items-center gap-2 border border-slate-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span>Edit Student</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setMobileActionStudent(null); openDebitModal(mobileActionStudent); }}
                  className="w-full bg-indigo-600 text-white font-semibold px-4 py-3 rounded-xl flex justify-center items-center gap-2 shadow-md shadow-indigo-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  <span>Log Print Job</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setMobileActionStudent(null); openCreditModal(mobileActionStudent); }}
                  className="w-full bg-emerald-600 text-white font-semibold px-4 py-3 rounded-xl flex justify-center items-center gap-2 shadow-md shadow-emerald-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Collect Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setMobileActionStudent(null); setCallingStudent(mobileActionStudent); }}
                  disabled={!isOverdue || !mobileActionStudent.phone}
                  className={\`w-full font-semibold px-4 py-3 rounded-xl flex justify-center items-center gap-2 \${
                    isOverdue && mobileActionStudent.phone 
                      ? 'bg-amber-500 text-amber-950 shadow-md shadow-amber-200' 
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }\`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>Automated Voice Call</span>
                </button>

                {isOverdue && (
                  <a
                    href={generateWhatsAppLink(mobileActionStudent.phone, mobileActionStudent.name, mobileActionStudent.balance)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileActionStudent(null)}
                    className="w-full bg-emerald-50 text-emerald-800 border border-emerald-300/80 px-4 py-3 rounded-xl font-semibold flex justify-center items-center shadow-sm"
                  >
                    Send WhatsApp Reminder
                  </a>
                )}
              </div>
            </div>
          </div>
          );
        })()}

        {/* ADD STUDENT MODAL */}`;
content = content.replace(modalAnchor, modalAdd);

fs.writeFileSync(path, content, 'utf8');
console.log('Update complete.');
