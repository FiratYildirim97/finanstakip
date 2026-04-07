const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/RecurringTransactionsPage.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Extract the form and modify layout
const formStartMarker = '<form onSubmit={handleManualSubmit} className="space-y-4">';
const formStart = content.indexOf(formStartMarker);

// The form container ends before the List Column
const listColumnMarker = '{/* List Column */}';
const listColumnStart = content.indexOf(listColumnMarker);

const layoutGridMarker = '<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">';
const layoutGridStart = content.indexOf(layoutGridMarker);

if (formStart !== -1 && listColumnStart !== -1 && layoutGridStart !== -1) {
    // 1. ADD ISMODALOPEN
    content = content.replace(
        '  const [showManageList, setShowManageList] = useState(false);',
        '  const [showManageList, setShowManageList] = useState(false);\n  const [isModalOpen, setIsModalOpen] = useState(false);'
    );
    
    content = content.replace(
        'setIsEstimated(false);\n    } else {',
        'setIsEstimated(false);\n      setIsModalOpen(false);\n    } else {'
    );

    // 2. Extract DOM Form
    const buttonsStart = content.indexOf('<div className="flex p-1 bg-black/20 rounded-xl mb-4">', layoutGridStart);
    const formEnd = content.indexOf('</form>', formStart) + 7;
    
    let formContent = content.substring(buttonsStart, formEnd);
    
    // We add z-index to form's absolute dropdown container just in case
    // Wait, the dropdown is absolute z-20, modal z-50 => form component has high enough z-index.
    
    // 3. Layout changes
    const newLayoutStart = `
               <div className="grid grid-cols-1 gap-8">
                  {/* List Column */}
                  <div className="space-y-4">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest font-mono flex items-center gap-2">
                           <AlertTriangle size={18} className="text-[#ffcf70]" /> Aktif Beklentiler ({projectedRecurringItems.length})
                        </h3>
                        <button 
                           onClick={() => setIsModalOpen(true)}
                           className="px-5 py-2.5 bg-gradient-to-r from-[#4edeb3] to-[#3bc49c] text-[#002113] font-bold rounded-xl flex items-center gap-2 text-xs uppercase tracking-wider hover:brightness-110 transition-all shadow-lg shadow-[#4edeb3]/10"
                        >
                           <Plus size={16} /> Yeni Beklenti Ekle
                        </button>
                     </div>
                     <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {projectedRecurringItems.map(rec => {
    `;

    const itemsMapMarker = 'projectedRecurringItems.map(rec => {';
    const itemsMapStart = content.indexOf(itemsMapMarker, layoutGridStart);
    const itemsMapLen = itemsMapMarker.length;
    
    const sectionToRemove = content.substring(layoutGridStart, itemsMapStart + itemsMapLen);
    content = content.replace(sectionToRemove, newLayoutStart);
    
    // 4. Modal append
    const modalHTML = `
        {/* Add New Recurring Form Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#1a1c1e] border border-white/10 rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="p-6 space-y-5 bg-white/[0.02]">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white uppercase tracking-widest">Yeni Beklenti Ekle</h3>
                  <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                    <X size={16} />
                  </button>
                </div>
                
                ${formContent}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    `;
    
    content = content.replace('</AnimatePresence>', modalHTML);

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log("SUCCESS!");
} else {
    console.error("Markers not found");
}
