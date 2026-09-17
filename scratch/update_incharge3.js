const fs = require('fs');
const path = 'src/app/incharge/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add globalStudentSearchQuery state
const oldState = `  const [targetStudentForDebit, setTargetStudentForDebit] = useState<(Student & { balance: number }) | null>(null);`;
const newState = `  const [targetStudentForDebit, setTargetStudentForDebit] = useState<(Student & { balance: number }) | null>(null);
  const [globalStudentSearchQuery, setGlobalStudentSearchQuery] = useState('');`;
if(content.includes(oldState)) {
    content = content.replace(oldState, newState);
    console.log('State updated');
} else { console.log('State not found'); }

// 2. Update openDebitModal
const oldOpenFunc = `  // Open Log Print Job Modal
  const openDebitModal = (student: Student & { balance: number }) => {
    setTargetStudentForDebit(student);
    setPrintItems([{ id: Date.now().toString(), type: 'bw', side: 'single', pages: 1, discount: 0 }]);
    setPaidImmediately(false);
    setDebitDesc('');
    setDebitError(null);
    setIsDebitModalOpen(true);
  };`;
const newOpenFunc = `  // Open Log Print Job Modal
  const openDebitModal = (student?: Student & { balance: number } | null) => {
    setTargetStudentForDebit(student || null);
    setGlobalStudentSearchQuery('');
    setPrintItems([{ id: Date.now().toString(), type: 'bw', side: 'single', pages: 1, discount: 0 }]);
    setPaidImmediately(false);
    setDebitDesc('');
    setDebitError(null);
    setIsDebitModalOpen(true);
  };

  const openGlobalDebitModal = () => {
    openDebitModal(null);
  };`;
if(content.includes(oldOpenFunc)) {
    content = content.replace(oldOpenFunc, newOpenFunc);
    console.log('Open func updated');
} else { console.log('Open func not found'); }

// 3. Update handleDebitSubmit to block on null
const oldSubmitTop = `  const handleDebitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingDebit(true);
    setDebitError(null);`;
const newSubmitTop = `  const handleDebitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStudentForDebit) {
      setDebitError('Please select a student first.');
      return;
    }
    setSubmittingDebit(true);
    setDebitError(null);`;
if(content.includes(oldSubmitTop)) {
    content = content.replace(oldSubmitTop, newSubmitTop);
    console.log('Submit block updated');
} else { console.log('Submit block not found'); }

// 4. Render searchable dropdown inside Modal 1 (isDebitModalOpen)
const oldModalHeader = `<div className="bg-white p-3 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Target Student</span>
                <span className="text-slate-900 font-bold text-sm">{targetStudentForDebit.name}</span>
                <span className="text-slate-500 font-mono block text-[11px] mt-0.5">
                  Current Balance: <span className="font-sans font-bold mr-0.5">₹</span><span className="font-mono font-bold">{Math.abs(targetStudentForDebit.balance).toFixed(2)}</span>
                </span>
              </div>

              {debitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {debitError}
                </div>
              )}

              <form onSubmit={handleDebitSubmit} className="space-y-4">`;

const newModalHeader = `<div className="bg-white p-3 rounded-xl border border-slate-200 text-xs">
                {targetStudentForDebit ? (
                  <>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Target Student</span>
                        <span className="text-slate-900 font-bold text-sm">{targetStudentForDebit.name}</span>
                        <span className="text-slate-500 font-mono block text-[11px] mt-0.5">
                          Current Balance: <span className="font-sans font-bold mr-0.5">₹</span><span className="font-mono font-bold">{Math.abs(targetStudentForDebit.balance).toFixed(2)}</span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTargetStudentForDebit(null)}
                        className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors"
                      >
                        Change
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase text-slate-500 font-bold tracking-wider">
                      Search & Select Student
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search name, batch, phone..."
                        value={globalStudentSearchQuery}
                        onChange={(e) => setGlobalStudentSearchQuery(e.target.value)}
                        autoFocus
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono h-9"
                      />
                      <svg className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      
                      {globalStudentSearchQuery.trim() !== '' && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-slate-300 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-200 shadow-xl">
                          {students
                            .filter(
                              (s) =>
                                s.name.toLowerCase().includes(globalStudentSearchQuery.toLowerCase().trim()) ||
                                (s.batch_name || '').toLowerCase().includes(globalStudentSearchQuery.toLowerCase().trim()) ||
                                s.phone.includes(globalStudentSearchQuery.trim())
                            )
                            .slice(0, 10)
                            .map((s) => (
                              <button
                                type="button"
                                key={s.id}
                                onClick={() => {
                                  setTargetStudentForDebit(s);
                                  setGlobalStudentSearchQuery('');
                                }}
                                className="w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors"
                              >
                                <div>
                                  <span className="font-semibold text-slate-900">{s.name}</span>
                                  <span className="text-[10px] text-slate-500 font-mono ml-2">({s.batch_name || 'General'})</span>
                                </div>
                                <span className="text-[10px] font-mono font-bold text-indigo-700 whitespace-nowrap">
                                  ₹{Math.abs(s.balance).toFixed(2)}
                                </span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {debitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {debitError}
                </div>
              )}

              {targetStudentForDebit && (
              <form onSubmit={handleDebitSubmit} className="space-y-4">`;

if(content.includes(oldModalHeader)) {
    content = content.replace(oldModalHeader, newModalHeader);
    console.log('Modal header updated');
} else { console.log('Modal header not found'); }

const oldModalFooter = `              </form>
            </div>
          </div>
        )}`;
const newModalFooter = `              </form>
              )}
            </div>
          </div>
        )}`;
if(content.includes(oldModalFooter)) {
    content = content.replace(oldModalFooter, newModalFooter);
    console.log('Modal footer updated');
} else { console.log('Modal footer not found'); }

// 5. Modify Top Header button
const oldTopBtn = `onClick={handleOpenIndividualAction}`;
const newTopBtn = `onClick={openGlobalDebitModal}`;
if(content.includes(oldTopBtn)) {
    content = content.replace(oldTopBtn, newTopBtn);
    console.log('Top btn updated');
} else { console.log('Top btn not found'); }

// 6. Add Log Print button to Quick Actions
const oldQuickActions = `{/* Collect Cash Payment Button */}
                                  <button
                                    type="button"
                                    onClick={() => openCreditModal(stud)}
                                    className="bg-emerald-600/90 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-all shadow-md flex items-center gap-1"
                                    title="Collect cash payment from student"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <span>Collect Cash</span>
                                  </button>`;

const newQuickActions = `{/* Log Print Job Button */}
                                  <button
                                    type="button"
                                    onClick={() => openDebitModal(stud)}
                                    className="bg-indigo-600/90 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-all shadow-md flex items-center gap-1"
                                    title="Log print job for student"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                    </svg>
                                    <span>Log Print</span>
                                  </button>

                                  {/* Collect Cash Payment Button */}
                                  <button
                                    type="button"
                                    onClick={() => openCreditModal(stud)}
                                    className="bg-emerald-600/90 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-all shadow-md flex items-center gap-1"
                                    title="Collect cash payment from student"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <span>Collect Cash</span>
                                  </button>`;

if(content.includes(oldQuickActions)) {
    content = content.replace(oldQuickActions, newQuickActions);
    console.log('Quick actions updated');
} else { console.log('Quick actions not found'); }

fs.writeFileSync(path, content, 'utf8');
console.log('All done!');
