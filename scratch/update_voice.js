const fs = require('fs');
const path = 'src/app/incharge/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add States
const stateAnchor = `  // Modal State for Log Print Job (Debit)`;
const stateAdd = `  // Voice Call state
  const [callingStudent, setCallingStudent] = useState<(Student & { balance: number }) | null>(null);
  const [isMakingCall, setIsMakingCall] = useState(false);
  const [callStatus, setCallStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Modal State for Log Print Job (Debit)`;
content = content.replace(stateAnchor, stateAdd);

// 2. Add Trigger Function
const funcAnchor = `  const openDebitModal = (student?: Student & { balance: number } | null) => {`;
const funcAdd = `  const handleTriggerVoiceCall = async () => {
    if (!callingStudent) return;
    setIsMakingCall(true);
    setCallStatus(null);
    try {
      const res = await fetch('/api/reminders/voice-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: callingStudent.id,
          studentName: callingStudent.name,
          phoneNumber: callingStudent.phone,
          balance: callingStudent.balance
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCallStatus({ type: 'success', message: 'Call triggered successfully!' });
        setTimeout(() => setCallingStudent(null), 2000);
      } else {
        setCallStatus({ type: 'error', message: data.error || 'Failed to trigger call.' });
      }
    } catch (err: any) {
      setCallStatus({ type: 'error', message: err.message || 'Network error occurred.' });
    } finally {
      setIsMakingCall(false);
    }
  };

  const openDebitModal = (student?: Student & { balance: number } | null) => {`;
content = content.replace(funcAnchor, funcAdd);

// 3. Add Call Button to Quick Actions
const buttonAnchor = `{/* WhatsApp Reminder */}`;
const buttonAdd = `{/* Call Reminder Button */}
                                  <button
                                    type="button"
                                    onClick={() => setCallingStudent(stud)}
                                    disabled={!isOverdue || !stud.phone}
                                    className={\`font-semibold px-3 py-1.5 rounded-lg text-xs transition-all shadow-md flex items-center gap-1 \${
                                      isOverdue && stud.phone 
                                        ? 'bg-amber-500/90 hover:bg-amber-400 text-amber-950' 
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                    }\`}
                                    title={!stud.phone ? 'No phone number' : !isOverdue ? 'No pending balance' : 'Send automated voice reminder'}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    <span>Call</span>
                                  </button>

                                  {/* WhatsApp Reminder */}`;
content = content.replace(buttonAnchor, buttonAdd);

// 4. Add Confirmation Modal JSX
const modalAnchor = `{/* ADD STUDENT MODAL */}`;
const modalAdd = `{/* VOICE CALL CONFIRMATION MODAL */}
        {callingStudent && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="bg-amber-500 p-5 flex justify-between items-center relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-lg font-black text-amber-950">Automated Voice Call</h3>
                </div>
                <button
                  type="button"
                  onClick={() => !isMakingCall && setCallingStudent(null)}
                  className="relative z-10 text-amber-900/50 hover:text-amber-950 bg-amber-600/20 hover:bg-amber-600/40 p-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="text-sm text-slate-700">
                  Are you sure you want to trigger a Malayalam voice reminder to <span className="font-bold text-slate-900">{callingStudent.name}</span> (+91 {callingStudent.phone}) for an overdue balance of <span className="font-bold text-rose-600 font-mono">₹{Math.abs(callingStudent.balance).toFixed(2)}</span>?
                </div>

                {callStatus && (
                  <div className={\`p-3 rounded-xl text-xs font-semibold \${
                    callStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                  }\`}>
                    {callStatus.message}
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button 
                    onClick={() => setCallingStudent(null)}
                    disabled={isMakingCall}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleTriggerVoiceCall}
                    disabled={isMakingCall || callStatus?.type === 'success'}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-xs py-2.5 rounded-xl shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isMakingCall ? 'Calling...' : 'Confirm & Call'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ADD STUDENT MODAL */}`;
content = content.replace(modalAnchor, modalAdd);

fs.writeFileSync(path, content, 'utf8');
console.log('Update complete.');
