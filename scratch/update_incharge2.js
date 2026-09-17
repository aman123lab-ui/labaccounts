const fs = require('fs');
const path = 'd:\\\\anfaz\\\\coding\\\\Lab Accounting System\\\\src\\\\app\\\\incharge\\\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

const old_form = `<div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Print Type
                    </label>
                    <select
                      value={printType}
                      onChange={(e) => setPrintType(e.target.value as PrintTypeOption)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="bw">B/W (₹1/page)</option>
                      <option value="color">Color (₹5/page)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Side
                    </label>
                    <select
                      value={printSide}
                      onChange={(e) => setPrintSide(e.target.value as PrintSideOption)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="single">Single Sided</option>
                      <option value="double">Double Sided</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Number of Pages
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={numPages}
                      onChange={(e) => setNumPages(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Discount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discount}
                      onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Entry Description
                  </label>
                  <input
                    type="text"
                    value={debitDesc}
                    onChange={(e) => setDebitDesc(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>`;

const new_form = `<div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                  {printItems.map((item, index) => (
                    <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl relative space-y-3">
                      <div className="absolute -top-2 -left-2 w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-[10px] font-bold border border-indigo-200">
                        {index + 1}
                      </div>
                      {printItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePrintItem(item.id)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-[10px] hover:bg-red-200 border border-red-200 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                      
                      <div className="grid grid-cols-2 gap-3 mt-1">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-700 mb-1">Print Type</label>
                          <select
                            value={item.type}
                            onChange={(e) => updatePrintItem(item.id, 'type', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="bw">B/W (₹1/page)</option>
                            <option value="color">Color (₹5/page)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-700 mb-1">Side</label>
                          <select
                            value={item.side}
                            onChange={(e) => updatePrintItem(item.id, 'side', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                          >
                            <option value="single">Single Sided</option>
                            <option value="double">Double Sided</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-700 mb-1">Num Pages</label>
                          <input
                            type="number"
                            min="1"
                            value={item.pages}
                            onChange={(e) => updatePrintItem(item.id, 'pages', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-700 mb-1">Discount (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discount}
                            onChange={(e) => updatePrintItem(item.id, 'discount', Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={addPrintItem}
                    className="w-full border-2 border-dashed border-indigo-200 text-indigo-600 hover:border-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 bg-white font-semibold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add Another Print Item</span>
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Overall Entry Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={debitDesc}
                    onChange={(e) => setDebitDesc(e.target.value)}
                    placeholder="e.g. Project report and charts"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>`;

if(content.includes(old_form)) { 
    content = content.replace(old_form, new_form); 
    console.log('Form replaced');
}
else { console.log('Form not found'); }

// 4. Modals append: AddStudentModal and StatementModal
const modals_append = `
        {/* STATEMENT MODAL */}
        {statementStudent && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
              <div className="bg-slate-900 p-5 flex justify-between items-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
                <div className="relative z-10">
                  <h3 className="text-lg font-black text-white">Student Account</h3>
                  <p className="text-slate-300 text-[10px] font-mono tracking-wider uppercase">{statementStudent.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStatementStudent(null)}
                  className="relative z-10 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 p-1.5 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="text-center space-y-1">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Total Outstanding Balance</p>
                  <div className={\`text-4xl font-black font-mono \${statementStudent.balance > 0 ? 'text-red-600' : 'text-emerald-600'}\`}>
                    <span className="font-sans mr-1">₹</span>{Math.abs(statementStudent.balance).toFixed(2)}
                  </div>
                  {statementStudent.balance > 0 ? (
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200 mt-2">DUE FROM STUDENT</span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 mt-2">SETTLED / IN ADVANCE</span>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex gap-2">
                  <button 
                    onClick={() => {
                        const s = statementStudent;
                        setStatementStudent(null);
                        openDebitModal(s);
                    }}
                    className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs py-2.5 rounded-xl border border-indigo-200 transition-colors"
                  >
                    Log Print Job
                  </button>
                  <button 
                    onClick={() => {
                        const s = statementStudent;
                        setStatementStudent(null);
                        openCreditModal(s);
                    }}
                    className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs py-2.5 rounded-xl border border-emerald-200 transition-colors"
                  >
                    Collect Cash
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ADD STUDENT MODAL */}
        <AddStudentModal
          isOpen={isAddStudentOpen}
          onClose={() => setIsAddStudentOpen(false)}
          onSuccess={() => {
            setIsAddStudentOpen(false);
            loadDashboardData();
          }}
          batches={batches}
        />
`;

const split_point = '</main>';
if(content.includes(split_point)) {
    content = content.replace(split_point, split_point + modals_append);
    console.log('Modals appended');
} else {
    console.log('Main end tag not found');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Success2');
