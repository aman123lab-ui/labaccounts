const fs = require('fs');
const path = 'src/app/incharge/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Edit button
content = content.replace(
  /className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg text-xs transition-all shadow-sm flex items-center gap-1 border border-slate-200"/g,
  'className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2 py-1 rounded text-[10px] transition-all shadow-sm flex items-center gap-1 border border-slate-200"'
);

// Log Print button
content = content.replace(
  /className="bg-indigo-600\/90 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-all shadow-md flex items-center gap-1"/g,
  'className="bg-indigo-600/90 hover:bg-indigo-500 text-white font-semibold px-2 py-1 rounded text-[10px] transition-all shadow-sm flex items-center gap-1"'
);

// Collect Cash button
content = content.replace(
  /className="bg-emerald-600\/90 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-all shadow-md flex items-center gap-1"/g,
  'className="bg-emerald-600/90 hover:bg-emerald-500 text-white font-semibold px-2 py-1 rounded text-[10px] transition-all shadow-sm flex items-center gap-1"'
);

// Call Reminder button
content = content.replace(
  /className={`font-semibold px-3 py-1.5 rounded-lg text-xs transition-all shadow-md flex items-center gap-1 \${/g,
  'className={`font-semibold px-2 py-1 rounded text-[10px] transition-all shadow-sm flex items-center gap-1 ${'
);

// WhatsApp Reminder link
content = content.replace(
  /className="bg-emerald-50\/90 hover:bg-emerald-100 text-emerald-800 border border-emerald-300\/80 px-2.5 py-1.5 rounded-lg text-xs transition-all font-semibold shadow-sm"/g,
  'className="bg-emerald-50/90 hover:bg-emerald-100 text-emerald-800 border border-emerald-300/80 px-2 py-1 rounded text-[10px] transition-all font-semibold shadow-sm"'
);

// SVG icons inside these buttons (there are exactly 4 of them in this block: Edit, Print, Cash, Call)
// Wait, replacing all `w-3.5 h-3.5` in the file might affect others, but there's a risk.
// Let's replace just inside the buttons block by replacing all `w-3.5 h-3.5` between `Edit Student Button` and `WhatsApp Reminder`.
const startIdx = content.indexOf('{/* Edit Student Button */}');
const endIdx = content.indexOf('{/* WhatsApp Reminder */}');
if (startIdx !== -1 && endIdx !== -1) {
  const before = content.slice(0, startIdx);
  const block = content.slice(startIdx, endIdx);
  const after = content.slice(endIdx);
  
  const modifiedBlock = block.replace(/w-3\.5 h-3\.5/g, 'w-3 h-3');
  content = before + modifiedBlock + after;
}

fs.writeFileSync(path, content, 'utf8');
console.log('Update complete.');
