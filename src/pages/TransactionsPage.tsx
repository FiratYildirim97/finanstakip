import React, { useState, useEffect, FormEvent, useRef, useCallback } from 'react';
import { useCreditCardExpenses } from '../hooks/useCreditCardExpenses';
import { useCreditCards } from '../hooks/useCreditCards';
import { receiptAgent } from '../lib/agents';
import { CreditCard as CreditCardType } from '../types';
import {
  Sparkles, Plus, Trash2, CreditCard, Camera, Upload, X,
  ImageIcon, FileText, Store, Tag, Hash, ChevronDown,
  Receipt, Eye, Loader2, CheckCircle2, AlertCircle,
  PlusCircle, Settings, Wallet, Calendar, List,
  Clock, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

const CREDIT_CARD_CATEGORIES = [
  'Market', 'Yemek', 'Giyim', 'Elektronik', 'Fatura',
  'Sağlık', 'Ulaşım', 'Eğlence', 'Eğitim', 'Ev', 'Diğer'
];

const CATEGORY_COLORS: Record<string, string> = {
  'Market': '#4edea3',
  'Yemek': '#ffb2b7',
  'Giyim': '#adc6ff',
  'Elektronik': '#ffd166',
  'Fatura': '#ff7886',
  'Sağlık': '#a78bfa',
  'Ulaşım': '#67e8f9',
  'Eğlence': '#f472b6',
  'Eğitim': '#34d399',
  'Ev': '#fb923c',
  'Diğer': '#94a3b8',
};

const CATEGORY_EMOJIS: Record<string, string> = {
  'Market': '🛒',
  'Yemek': '🍽️',
  'Giyim': '👗',
  'Elektronik': '📱',
  'Fatura': '📄',
  'Sağlık': '💊',
  'Ulaşım': '🚗',
  'Eğlence': '🎬',
  'Eğitim': '📚',
  'Ev': '🏠',
  'Diğer': '📦',
};

type InputMode = 'ai-text' | 'ai-photo' | 'manual';

export const TransactionsPage = () => {
  const { expenses, loading, addExpense, deleteExpense, uploadReceipt, totalExpenses, expensesByCategory } = useCreditCardExpenses();
  const { cards, addCard, deleteCard, syncCardToRecurring, getCardMonthlyTotal } = useCreditCards();

  // Input mode 
  const [inputMode, setInputMode] = useState<InputMode>('ai-text');

  // AI Text State
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // AI Photo State
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Parsed result preview
  const [parsedPreview, setParsedPreview] = useState<{
    amount: number;
    category: string;
    merchant: string;
    description: string;
    items: string[];
    installments: number;
  } | null>(null);

  // Installments modal
  const [showInstallmentsModal, setShowInstallmentsModal] = useState(false);

  // Manual Form State
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Market');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [installments, setInstallments] = useState('1');
  const [manualReceiptFile, setManualReceiptFile] = useState<File | null>(null);

  // Receipt preview modal
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  // Filter
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  // Card management modal
  const [showCardModal, setShowCardModal] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardBank, setNewCardBank] = useState('');
  const [newCardLastFour, setNewCardLastFour] = useState('');
  const [newCardPaymentDay, setNewCardPaymentDay] = useState('1');
  const [newCardCutOffDay, setNewCardCutOffDay] = useState('');
  const [newCardLimit, setNewCardLimit] = useState('');
  const [newCardColor, setNewCardColor] = useState('#a855f7');

  // Auto-select first card
  useEffect(() => {
    if (cards.length > 0 && !selectedCardId) {
      setSelectedCardId(cards[0].id);
    }
  }, [cards, selectedCardId]);

  // Sync card totals to recurring
  const handleSyncToRecurring = async () => {
    for (const card of cards) {
      const total = getCardMonthlyTotal(card.id, expenses);
      await syncCardToRecurring(card.id, total, card.name, card.payment_day);
    }
    toast.success('Kartlar aylık giderlere senkronize edildi');
  };

  // Add new card
  const handleAddCard = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCardName || !newCardPaymentDay) return;

    const { error } = await addCard({
      name: newCardName,
      bank: newCardBank || null,
      last_four: newCardLastFour || null,
      payment_day: parseInt(newCardPaymentDay),
      cut_off_day: newCardCutOffDay ? parseInt(newCardCutOffDay) : null,
      card_limit: newCardLimit ? parseFloat(newCardLimit) : null,
      color: newCardColor,
    });

    if (!error) {
      toast.success(`${newCardName} kartı kaydedildi`);
      setNewCardName('');
      setNewCardBank('');
      setNewCardLastFour('');
      setNewCardPaymentDay('1');
      setNewCardCutOffDay('');
      setNewCardLimit('');
      setShowCardModal(false);
    } else {
      toast.error('Kart kaydedilemedi');
    }
  };

  // Get selected card info
  const getSelectedCard = (): CreditCardType | undefined => cards.find(c => c.id === selectedCardId);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  // Handle image selection
  const handleImageSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Lütfen bir resim dosyası seçin');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Dosya boyutu 10MB\'dan küçük olmalıdır');
      return;
    }
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setParsedPreview(null);
  }, []);

  // Drag & Drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageSelect(e.dataTransfer.files[0]);
    }
  }, [handleImageSelect]);

  // AI Text Submit
  const handleAiTextSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;
    setIsAiLoading(true);

    const parsed = await receiptAgent.parseText(aiInput);

    if (parsed && parsed.amount > 0) {
      const selectedCard = getSelectedCard();
      const numInstallments = parsed.installments || 1;
      const { error } = await addExpense({
        amount: parsed.amount,
        category: parsed.category,
        description: parsed.description,
        merchant: parsed.merchant || null,
        card_name: selectedCard?.name || null,
        card_id: selectedCard?.id || null,
        installments: numInstallments,
        receipt_url: null,
        date: new Date().toISOString().split('T')[0]
      });

      if (!error) {
        const installmentInfo = numInstallments > 1 ? ` (${numInstallments} taksit, aylık ${new Intl.NumberFormat('tr-TR').format(parsed.amount / numInstallments)} ₺)` : '';
        toast.success(`✅ Eklendi: ${parsed.merchant || parsed.category} - ${new Intl.NumberFormat('tr-TR').format(parsed.amount)} ₺${installmentInfo}`);
        setAiInput('');
        // Sync card total to recurring
        if (selectedCard) {
          const total = getCardMonthlyTotal(selectedCard.id, [...expenses, { card_id: selectedCard.id, amount: parsed.amount, date: new Date().toISOString().split('T')[0] }]);
          syncCardToRecurring(selectedCard.id, total, selectedCard.name, selectedCard.payment_day);
        }
      } else {
        toast.error('Veritabanına eklenirken hata oluştu');
      }
    } else {
      toast.error('Cümle anlaşılamadı. Lütfen tutarı ve detayı net yazın.');
    }
    setIsAiLoading(false);
  };

  // AI Photo Submit - Step 1: Parse
  const handlePhotoAnalyze = async () => {
    if (!selectedImage) return;
    setIsPhotoLoading(true);

    try {
      const base64 = await fileToBase64(selectedImage);
      const parsed = await receiptAgent.parseImage(base64, selectedImage.type);

      if (parsed && parsed.amount > 0) {
        setParsedPreview(parsed);
        toast.success('Fiş başarıyla okundu! Bilgileri kontrol edin.');
      } else {
        toast.error('Fiş okunamadı. Lütfen daha net bir fotoğraf deneyin veya manuel giriş yapın.');
      }
    } catch {
      toast.error('Fotoğraf analiz edilirken bir hata oluştu.');
    }
    setIsPhotoLoading(false);
  };

  // AI Photo Submit - Step 2: Confirm & Save
  const handlePhotoConfirm = async () => {
    if (!parsedPreview) return;
    setIsPhotoLoading(true);

    let receiptUrl: string | null = null;
    if (selectedImage) {
      receiptUrl = await uploadReceipt(selectedImage);
    }

    const selectedCard = getSelectedCard();
    const numInstallments = parsedPreview.installments || 1;
    const { error } = await addExpense({
      amount: parsedPreview.amount,
      category: parsedPreview.category,
      description: parsedPreview.description,
      merchant: parsedPreview.merchant || null,
      card_name: selectedCard?.name || null,
      card_id: selectedCard?.id || null,
      installments: numInstallments,
      receipt_url: receiptUrl,
      date: new Date().toISOString().split('T')[0]
    });

    if (!error) {
      toast.success(`✅ Harcama kaydedildi: ${new Intl.NumberFormat('tr-TR').format(parsedPreview.amount)} ₺`);
      setSelectedImage(null);
      setImagePreview(null);
      setParsedPreview(null);
      // Sync card total to recurring
      if (selectedCard) {
        const total = getCardMonthlyTotal(selectedCard.id, [...expenses, { card_id: selectedCard.id, amount: parsedPreview.amount, date: new Date().toISOString().split('T')[0] }]);
        syncCardToRecurring(selectedCard.id, total, selectedCard.name, selectedCard.payment_day);
      }
    } else {
      toast.error('Kayıt sırasında hata oluştu');
    }
    setIsPhotoLoading(false);
  };

  // Manual Submit
  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || !category) return;

    let receiptUrl: string | null = null;
    if (manualReceiptFile) {
      receiptUrl = await uploadReceipt(manualReceiptFile);
    }

    const selectedCard = getSelectedCard();

    const { error } = await addExpense({
      amount: numAmount,
      category,
      description: description || null,
      merchant: merchant || null,
      card_name: selectedCard?.name || null,
      card_id: selectedCard?.id || null,
      installments: parseInt(installments) || 1,
      receipt_url: receiptUrl,
      date: new Date().toISOString().split('T')[0]
    });

    if (!error) {
      toast.success('Harcama kaydedildi ✅');
      setAmount('');
      setDescription('');
      setMerchant('');
      setInstallments('1');
      setManualReceiptFile(null);
      // Sync this card's total to recurring
      if (selectedCard) {
        const total = getCardMonthlyTotal(selectedCard.id, [...expenses, { card_id: selectedCard.id, amount: numAmount, date: new Date().toISOString().split('T')[0] }]);
        await syncCardToRecurring(selectedCard.id, total, selectedCard.name, selectedCard.payment_day);
      }
    }
  };

  // Clear image
  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setParsedPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Filtered expenses
  const filteredExpenses = selectedFilter === 'all'
    ? expenses
    : expenses.filter(e => e.category === selectedFilter);

  // Top categories for summary
  const sortedCategories = Object.entries(expensesByCategory)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-display flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20">
              <CreditCard size={28} className="text-purple-400" />
            </div>
            Kredi Kartı Harcamaları
          </h1>
          <p className="text-[var(--color-text-variant)] mt-2 text-sm">
            Harcamalarınızı AI ile yazı veya fiş fotoğrafı ile kolayca ekleyin
          </p>
        </div>

        {/* Total Expenses Badge */}
        <div className="glass-panel px-6 py-4 rounded-2xl flex items-center gap-4">
          <div>
            <p className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest font-mono">Toplam Harcama</p>
            <p className="text-2xl font-black text-white font-mono mt-0.5">
              {new Intl.NumberFormat('tr-TR').format(totalExpenses)} <span className="text-[var(--color-brand-tertiary)] text-lg">₺</span>
            </p>
          </div>
        </div>
      </div>

      {/* My Cards Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--color-text-variant)] uppercase tracking-widest font-mono flex items-center gap-2">
            <Wallet size={14} /> Kartlarım
          </h3>
          <div className="flex items-center gap-2">
            {cards.length > 0 && (
              <button
                onClick={handleSyncToRecurring}
                className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)]/20 transition-colors font-medium flex items-center gap-1.5 border border-[var(--color-brand-primary)]/20"
              >
                <Calendar size={12} /> Aylığa Senkronize Et
              </button>
            )}
            <button
              onClick={() => setShowCardModal(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors font-medium flex items-center gap-1.5 border border-purple-500/20"
            >
              <PlusCircle size={12} /> Yeni Kart
            </button>
          </div>
        </div>

        {cards.length === 0 ? (
          <button
            onClick={() => setShowCardModal(true)}
            className="w-full p-6 border-2 border-dashed border-white/10 rounded-2xl text-[var(--color-text-variant)] hover:border-purple-500/30 hover:bg-purple-500/5 transition-all flex flex-col items-center gap-2 cursor-pointer"
          >
            <CreditCard size={24} className="opacity-50" />
            <span className="text-sm font-medium">Henüz kart eklenmemiş</span>
            <span className="text-xs opacity-70">Kart ekleyerek harcamalarınızı kartlara ayırın</span>
          </button>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {cards.map(card => {
              const cardTotal = getCardMonthlyTotal(card.id, expenses);
              const usagePercent = card.card_limit ? Math.min((cardTotal / card.card_limit) * 100, 100) : 0;
              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedCardId(card.id)}
                  className={`relative min-w-[200px] p-4 rounded-2xl cursor-pointer transition-all shrink-0 group ${selectedCardId === card.id
                      ? 'ring-2 ring-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                      : 'hover:scale-[1.02]'
                    }`}
                  style={{
                    background: `linear-gradient(135deg, ${card.color}20, ${card.color}05)`,
                    border: `1px solid ${card.color}30`,
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`${card.name} kartını silmek istediğinize emin misiniz?`)) deleteCard(card.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/30 text-white/50 hover:text-red-400 hover:bg-black/50 transition-all bg-white/5 text-white lg:text-[var(--color-text-variant)] lg:bg-transparent opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${card.color}30` }}>
                      <CreditCard size={14} style={{ color: card.color }} />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{card.name}</p>
                      {card.last_four && <p className="text-[10px] text-[var(--color-text-variant)] font-mono">**** {card.last_four}</p>}
                    </div>
                  </div>
                  {card.bank && <p className="text-[10px] text-[var(--color-text-variant)] mb-2">{card.bank}</p>}
                  <p className="text-lg font-black font-mono text-white">
                    {new Intl.NumberFormat('tr-TR').format(cardTotal)} <span className="text-xs" style={{ color: card.color }}>₺</span>
                  </p>
                  {card.card_limit && (
                    <div className="mt-2">
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${usagePercent}%`,
                            backgroundColor: usagePercent > 80 ? '#f87171' : card.color,
                          }}
                        />
                      </div>
                      <p className="text-[9px] text-[var(--color-text-variant)] mt-1 font-mono">
                        {new Intl.NumberFormat('tr-TR').format(cardTotal)} / {new Intl.NumberFormat('tr-TR').format(card.card_limit)} ₺
                      </p>
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--color-text-variant)]">
                    <Calendar size={10} />
                    <span>Son ödeme: Her ayın <strong className="text-white">{card.payment_day}</strong>'i</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Category Summary Bar */}
      {sortedCategories.length > 0 && (
        <div className="glass-panel rounded-2xl p-4 overflow-x-auto">
          <div className="flex gap-3 min-w-max">
            {sortedCategories.map(([cat, total]) => (
              <button
                key={cat}
                onClick={() => setSelectedFilter(selectedFilter === cat ? 'all' : cat)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-sm font-medium border ${selectedFilter === cat
                    ? 'bg-white/10 border-white/20 text-white shadow-lg'
                    : 'border-transparent hover:bg-white/5 text-[var(--color-text-variant)] hover:text-white'
                  }`}
              >
                <span className="text-lg">{CATEGORY_EMOJIS[cat] || '📦'}</span>
                <span>{cat}</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-lg" style={{ backgroundColor: `${CATEGORY_COLORS[cat] || '#94a3b8'}20`, color: CATEGORY_COLORS[cat] || '#94a3b8' }}>
                  {new Intl.NumberFormat('tr-TR', { notation: 'compact' }).format(total as number)} ₺
                </span>
              </button>
            ))}
            {selectedFilter !== 'all' && (
              <button
                onClick={() => setSelectedFilter('all')}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs text-[var(--color-brand-tertiary)] hover:bg-[var(--color-brand-tertiary)]/10 transition-all"
              >
                <X size={14} /> Filtreyi Kaldır
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Left Panel - Input Area */}
        <div className="lg:col-span-1 space-y-6">
          {/* Input Mode Selector */}
          <div className="glass-panel rounded-2xl p-1.5 flex gap-1">
            <button
              onClick={() => setInputMode('ai-text')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${inputMode === 'ai-text'
                  ? 'bg-gradient-to-br from-purple-500/30 to-pink-500/20 text-purple-300 shadow-lg border border-purple-500/20'
                  : 'text-[var(--color-text-variant)] hover:text-white hover:bg-white/5'
                }`}
            >
              <Sparkles size={16} />
              <span className="hidden sm:inline">AI</span> Yazı
            </button>
            <button
              onClick={() => setInputMode('ai-photo')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${inputMode === 'ai-photo'
                  ? 'bg-gradient-to-br from-purple-500/30 to-pink-500/20 text-purple-300 shadow-lg border border-purple-500/20'
                  : 'text-[var(--color-text-variant)] hover:text-white hover:bg-white/5'
                }`}
            >
              <Camera size={16} />
              <span className="hidden sm:inline">AI</span> Fotoğraf
            </button>
            <button
              onClick={() => setInputMode('manual')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${inputMode === 'manual'
                  ? 'bg-gradient-to-br from-[var(--color-brand-primary)]/20 to-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] shadow-lg border border-[var(--color-brand-primary)]/20'
                  : 'text-[var(--color-text-variant)] hover:text-white hover:bg-white/5'
                }`}
            >
              <Plus size={16} />
              Manuel
            </button>
          </div>

          <AnimatePresence mode="wait">
            {/* AI Text Mode */}
            {inputMode === 'ai-text' && (
              <motion.div
                key="ai-text"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="glass-panel p-6 rounded-3xl relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
              >
                {/* Decorative gradient */}
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-purple-600/10 to-transparent rounded-full blur-2xl -ml-8 -mb-8" />

                <div className="flex items-center gap-2 text-purple-400 font-bold mb-4 font-display text-lg relative z-10">
                  <div className="p-1.5 rounded-lg bg-purple-500/20">
                    <Sparkles size={18} />
                  </div>
                  AI ile Akıllı Ekle
                </div>
                <p className="text-xs text-[var(--color-text-variant)] mb-4 relative z-10">
                  Harcamanızı doğal dilde yazın, AI otomatik olarak çözümleyecek
                </p>
                {/* Card Selector */}
                {cards.length > 0 && (
                  <div className="relative z-10 mb-3">
                    <select
                      value={selectedCardId}
                      onChange={e => setSelectedCardId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)]/50 text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 transition-colors text-sm appearance-none"
                    >
                      {cards.map(c => (
                        <option key={c.id} value={c.id}>
                          💳 {c.name}{c.last_four ? ` (*${c.last_four})` : ''}{c.bank ? ` - ${c.bank}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <form onSubmit={handleAiTextSubmit} className="relative z-10 w-full">
                  <textarea
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Örn: Migros'tan 850 liraya haftalık market alışverişi yaptım, 3 taksit..."
                    className="w-full px-5 py-4 bg-[var(--color-surface-lowest)]/50 border border-white/10 rounded-2xl outline-none focus:ring-1 focus:ring-purple-500/50 focus:bg-[var(--color-surface-lowest)] transition-all resize-none pb-16 text-[var(--color-text-main)] placeholder-[var(--color-text-variant)]/50 text-sm"
                    rows={4}
                  />
                  <button
                    type="submit"
                    disabled={isAiLoading || !aiInput.trim()}
                    className="absolute bottom-3 right-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl px-5 py-2.5 text-sm font-bold transition-all disabled:opacity-40 disabled:grayscale flex items-center gap-2 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isAiLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Çözümleniyor...
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        AI ile Ekle
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* AI Photo Mode */}
            {inputMode === 'ai-photo' && (
              <motion.div
                key="ai-photo"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="glass-panel p-6 rounded-3xl relative overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
              >
                <div className="absolute top-0 left-0 w-40 h-40 bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-full blur-3xl -ml-10 -mt-10" />

                <div className="flex items-center gap-2 text-cyan-400 font-bold mb-4 font-display text-lg relative z-10">
                  <div className="p-1.5 rounded-lg bg-cyan-500/20">
                    <Camera size={18} />
                  </div>
                  Fiş / Dekont ile Ekle
                </div>
                <p className="text-xs text-[var(--color-text-variant)] mb-4 relative z-10">
                  Fiş veya dekont fotoğrafı yükleyin, AI içeriği otomatik okuyacak
                </p>
                {/* Card Selector */}
                {cards.length > 0 && (
                  <div className="relative z-10 mb-4">
                    <select
                      value={selectedCardId}
                      onChange={e => setSelectedCardId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)]/50 text-white border border-white/10 rounded-xl outline-none focus:border-cyan-500/50 transition-colors text-sm appearance-none"
                    >
                      {cards.map(c => (
                        <option key={c.id} value={c.id}>
                          💳 {c.name}{c.last_four ? ` (*${c.last_four})` : ''}{c.bank ? ` - ${c.bank}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Upload Area */}
                {!imagePreview ? (
                  <div className="relative z-10 space-y-4">
                    {/* Hidden file inputs */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                      className="hidden"
                    />
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                      className="hidden"
                    />

                    {/* Two action buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Camera Button */}
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-dashed border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-400/50 transition-all cursor-pointer group"
                      >
                        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/10 group-hover:scale-110 transition-transform">
                          <Camera size={28} className="text-cyan-400" />
                        </div>
                        <div className="text-center">
                          <p className="text-white font-bold text-sm">Kamera ile Çek</p>
                          <p className="text-[var(--color-text-variant)] text-[10px] mt-0.5">Fiş/dekont fotoğrafı çek</p>
                        </div>
                      </button>

                      {/* Gallery Button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-dashed border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-400/50 transition-all cursor-pointer group"
                      >
                        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/10 group-hover:scale-110 transition-transform">
                          <ImageIcon size={28} className="text-purple-400" />
                        </div>
                        <div className="text-center">
                          <p className="text-white font-bold text-sm">Galeriden Seç</p>
                          <p className="text-[var(--color-text-variant)] text-[10px] mt-0.5">Mevcut fotoğraf yükle</p>
                        </div>
                      </button>
                    </div>

                    {/* Drag & Drop Area */}
                    <div
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-2xl p-4 transition-all text-center ${dragActive
                          ? 'border-cyan-400 bg-cyan-400/10 scale-[1.02]'
                          : 'border-white/5 bg-white/[0.02] hover:border-white/15'
                        }`}
                    >
                      <div className="flex items-center justify-center gap-2 text-[var(--color-text-variant)] text-xs">
                        <Upload size={14} />
                        <span>veya dosyayı sürükleyip bırakın</span>
                        <span className="text-white/20">•</span>
                        <span>JPG, PNG, WEBP</span>
                        <span className="text-white/20">•</span>
                        <span>Maks 10MB</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative z-10 space-y-4">
                    {/* Image Preview */}
                    <div className="relative rounded-2xl overflow-hidden border border-white/10">
                      <img
                        src={imagePreview}
                        alt="Fiş önizleme"
                        className="w-full max-h-[300px] object-contain bg-black/40"
                      />
                      <button
                        onClick={clearImage}
                        className="absolute top-2 right-2 p-2 bg-black/60 backdrop-blur-sm rounded-xl text-white/80 hover:text-white hover:bg-black/80 transition-all"
                      >
                        <X size={16} />
                      </button>
                      {selectedImage && (
                        <div className="absolute bottom-2 left-2 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-xs text-white/70 flex items-center gap-1.5">
                          <Receipt size={12} />
                          {selectedImage.name}
                        </div>
                      )}
                    </div>

                    {/* Parsed Preview */}
                    {parsedPreview && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[var(--color-surface-lowest)] rounded-2xl p-4 border border-[var(--color-brand-primary)]/20 space-y-3"
                      >
                        <div className="flex items-center gap-2 text-[var(--color-brand-primary)] text-sm font-bold">
                          <CheckCircle2 size={16} />
                          AI Tarafından Okunan Bilgiler
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-[var(--color-text-variant)] text-xs">Tutar</span>
                            <p className="text-white font-bold font-mono">{new Intl.NumberFormat('tr-TR').format(parsedPreview.amount)} ₺</p>
                          </div>
                          <div>
                            <span className="text-[var(--color-text-variant)] text-xs">Kategori</span>
                            <p className="text-white font-medium">{CATEGORY_EMOJIS[parsedPreview.category] || '📦'} {parsedPreview.category}</p>
                          </div>
                          {parsedPreview.merchant && (
                            <div className="col-span-2">
                              <span className="text-[var(--color-text-variant)] text-xs">Mağaza</span>
                              <p className="text-white font-medium">{parsedPreview.merchant}</p>
                            </div>
                          )}
                          {parsedPreview.items.length > 0 && (
                            <div className="col-span-2">
                              <span className="text-[var(--color-text-variant)] text-xs">Ürünler</span>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {parsedPreview.items.map((item, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-white/5 rounded-lg text-xs text-white/80">{item}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      {!parsedPreview ? (
                        <button
                          onClick={handlePhotoAnalyze}
                          disabled={isPhotoLoading}
                          className="flex-1 bg-gradient-to-r from-cyan-600 to-purple-500 text-white rounded-xl px-5 py-3 text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-[1.01] active:scale-[0.99]"
                        >
                          {isPhotoLoading ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              Fiş Okunuyor...
                            </>
                          ) : (
                            <>
                              <Sparkles size={16} />
                              AI ile Oku
                            </>
                          )}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={clearImage}
                            className="px-5 py-3 rounded-xl border border-white/10 text-[var(--color-text-variant)] hover:bg-white/5 text-sm font-medium transition-all"
                          >
                            İptal
                          </button>
                          <button
                            onClick={handlePhotoConfirm}
                            disabled={isPhotoLoading}
                            className="flex-1 bg-gradient-to-r from-[var(--color-brand-primary-container)] to-[var(--color-brand-primary)] text-green-950 rounded-xl px-5 py-3 text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(78,222,163,0.3)]"
                          >
                            {isPhotoLoading ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={16} />
                            )}
                            Onayla ve Kaydet
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Manual Mode */}
            {inputMode === 'manual' && (
              <motion.div
                key="manual"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bento-card"
              >
                <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2 uppercase tracking-wide font-mono">
                  <Plus size={18} className="text-[var(--color-brand-secondary)]" /> Manuel Harcama Girişi
                </h3>
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  {/* Amount */}
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Tutar (₺)</label>
                    <div className="relative">
                      <input
                        type="number"
                        required
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 transition-colors font-mono text-lg pl-10"
                        placeholder="0"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-variant)]">₺</span>
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">
                      <Tag size={10} className="inline mr-1" /> Kategori
                    </label>
                    <div className="relative">
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 transition-colors appearance-none cursor-pointer"
                      >
                        {CREDIT_CARD_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{CATEGORY_EMOJIS[cat]} {cat}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-variant)] pointer-events-none" />
                    </div>
                  </div>

                  {/* Merchant */}
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">
                      <Store size={10} className="inline mr-1" /> Mağaza / İşyeri
                    </label>
                    <input
                      type="text"
                      value={merchant}
                      onChange={e => setMerchant(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 transition-colors"
                      placeholder="Migros, Zara, Trendyol..."
                    />
                  </div>

                  {/* Card & Installments Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">
                        <CreditCard size={10} className="inline mr-1" /> Kart
                      </label>
                      {cards.length > 0 ? (
                        <select
                          value={selectedCardId}
                          onChange={e => setSelectedCardId(e.target.value)}
                          className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 transition-colors text-sm appearance-none"
                        >
                          {cards.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name}{c.last_four ? ` (*${c.last_four})` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowCardModal(true)}
                          className="w-full px-4 py-2.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl text-sm font-medium hover:bg-purple-500/20 transition-colors flex items-center justify-center gap-2"
                        >
                          <PlusCircle size={14} /> Kart Ekle
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">
                        <Hash size={10} className="inline mr-1" /> Taksit
                      </label>
                      <select
                        value={installments}
                        onChange={e => setInstallments(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 transition-colors appearance-none cursor-pointer text-sm"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                          <option key={n} value={n}>{n === 1 ? 'Tek Çekim' : `${n} Taksit`}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Açıklama</label>
                    <input
                      type="text"
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 transition-colors"
                      placeholder="Opsiyonel not..."
                    />
                  </div>

                  {/* Receipt Upload (Optional) */}
                  <div>
                    <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">
                      <Receipt size={10} className="inline mr-1" /> Fiş / Dekont (Opsiyonel)
                    </label>
                    <label className="flex items-center gap-3 px-4 py-3 bg-[var(--color-surface-lowest)] border border-white/10 rounded-xl cursor-pointer hover:bg-[var(--color-surface-container)] transition-colors">
                      <Upload size={16} className="text-[var(--color-text-variant)]" />
                      <span className="text-sm text-[var(--color-text-variant)]">
                        {manualReceiptFile ? manualReceiptFile.name : 'Fotoğraf seçin...'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setManualReceiptFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl py-3.5 font-bold hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all hover:scale-[1.01] active:scale-[0.99]"
                  >
                    Kaydet
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Panel - Expenses List */}
        <div className="lg:col-span-2">
          <div className="bento-card p-0 overflow-hidden flex flex-col h-full">
            <div className="px-6 py-5 border-b border-white/5 bg-[var(--color-surface-container)] flex items-center justify-between">
              <h3 className="font-bold text-white uppercase tracking-wider text-sm font-mono flex items-center gap-2">
                <Receipt size={16} className="text-purple-400" />
                Harcama Geçmişi
                {selectedFilter !== 'all' && (
                  <span className="text-xs normal-case font-normal text-purple-300 ml-1">
                    ({selectedFilter})
                  </span>
                )}
              </h3>
              <span className="text-xs text-[var(--color-text-variant)] font-mono">
                {filteredExpenses.length} kayıt
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-[var(--color-text-variant)] font-mono flex flex-col items-center gap-3">
                <Loader2 size={24} className="animate-spin text-purple-400" />
                Veri Senkronize Ediliyor...
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center gap-4">
                <div className="p-5 rounded-3xl bg-purple-500/5 border border-purple-500/10">
                  <CreditCard size={40} className="text-purple-400/40" />
                </div>
                <div>
                  <p className="text-white font-medium">Henüz harcama bulunmuyor</p>
                  <p className="text-[var(--color-text-variant)] text-sm mt-1">
                    AI ile yazı yazarak veya fiş fotoğrafı çekerek ilk harcamanızı ekleyin
                  </p>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-white/5 max-h-[700px] overflow-y-auto">
                {filteredExpenses.map((expense, idx) => (
                  <li
                    key={expense.id}
                    className={`p-4 md:p-5 hover:bg-[var(--color-surface-container)] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${idx % 2 === 0 ? 'bg-[var(--color-surface-lowest)]' : 'bg-transparent'}`}
                  >
                    <div className="flex items-center gap-4 md:gap-5 min-w-0">
                      {/* Category Icon */}
                      <div
                        className="p-2.5 rounded-2xl shrink-0 text-lg"
                        style={{
                          backgroundColor: `${CATEGORY_COLORS[expense.category] || '#94a3b8'}15`,
                        }}
                      >
                        {CATEGORY_EMOJIS[expense.category] || '📦'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-white text-base">{expense.merchant || expense.category}</p>
                          {expense.installments > 1 && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/10">
                              {expense.installments} Taksit
                            </span>
                          )}
                          {expense.receipt_url && (
                            <button
                              onClick={() => setPreviewReceiptUrl(expense.receipt_url)}
                              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                              title="Fişi Görüntüle"
                            >
                              <Eye size={14} className="text-cyan-400" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[var(--color-text-variant)] mt-1 font-mono flex-wrap">
                          <span>{expense.date}</span>
                          {expense.card_name && (
                            <>
                              <span className="text-white/20 hidden sm:inline">•</span>
                              <span className="flex items-center gap-1">
                                <CreditCard size={10} /> {expense.card_name}
                              </span>
                            </>
                          )}
                          {expense.merchant && expense.category && (
                            <>
                              <span className="text-white/20 hidden sm:inline">•</span>
                              <span style={{ color: CATEGORY_COLORS[expense.category] || '#94a3b8' }}>{expense.category}</span>
                            </>
                          )}
                          {expense.description && (
                            <>
                              <span className="text-white/20 hidden sm:inline">•</span>
                              <span className="truncate max-w-[180px] block sm:inline">{expense.description}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto mt-2 sm:mt-0 shrink-0">
                      <span className="font-black font-mono text-lg text-white">
                        -{new Intl.NumberFormat('tr-TR').format(expense.amount)} <span className="text-[var(--color-brand-tertiary)]">₺</span>
                      </span>
                      <button
                        onClick={() => deleteExpense(expense.id)}
                        className="p-2.5 text-[#ff7886] bg-[#ffb4ab]/10 lg:bg-transparent lg:text-[var(--color-text-variant)] lg:hover:text-[#ff7886] lg:hover:bg-[#ffb4ab]/10 rounded-xl transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Taksitler Bolumu (Inline Installments Section) */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl space-y-6 mt-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20">
            <List size={22} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Gelecek Taksitler</h2>
            <p className="text-xs text-[var(--color-text-variant)]">
              {expenses.filter(e => e.installments > 1).length} aktif taksitli işlemin aylık dağılımı
            </p>
          </div>
        </div>

        {expenses.filter(e => e.installments > 1).length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-4 bg-white/[0.02] rounded-2xl border border-white/5">
            <div className="p-5 rounded-3xl bg-purple-500/5 border border-purple-500/10">
              <List size={40} className="text-purple-400/40" />
            </div>
            <div>
              <p className="text-white font-medium">Henüz taksitli işlem yok</p>
              <p className="text-[var(--color-text-variant)] text-sm mt-1">
                Taksitli harcama girdiğinizde burada görünecek
              </p>
            </div>
          </div>
        ) : (
          <>
            {(() => {
              const installmentExpenses = expenses.filter(e => e.installments > 1);
              const totalInstallmentAmount = installmentExpenses.reduce((sum, e) => sum + e.amount, 0);
              const monthlyInstallmentAmount = installmentExpenses.reduce((sum, e) => sum + (e.amount / e.installments), 0);
              return (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/10 flex flex-col justify-center">
                    <p className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest font-mono">Toplam Taksitli Tutar</p>
                    <p className="text-2xl font-black text-white font-mono mt-1">
                      {new Intl.NumberFormat('tr-TR').format(totalInstallmentAmount)} <span className="text-purple-400 text-base">₺</span>
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-pink-500/5 border border-pink-500/10 flex flex-col justify-center">
                    <p className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest font-mono">Aylık Taksit Toplamı</p>
                    <p className="text-2xl font-black text-white font-mono mt-1">
                      {new Intl.NumberFormat('tr-TR').format(monthlyInstallmentAmount)} <span className="text-pink-400 text-base">₺</span>
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-4">
              {expenses.filter(e => e.installments > 1).map((expense, idx) => {
                const monthlyAmount = expense.amount / expense.installments;
                const expenseDate = new Date(expense.date);
                const now = new Date();
                const monthsPassed = Math.max(1, (now.getFullYear() - expenseDate.getFullYear()) * 12 + (now.getMonth() - expenseDate.getMonth()) + 1);
                const paidInstallments = Math.min(monthsPassed, expense.installments);
                const remainingInstallments = expense.installments - paidInstallments;
                const progressPercent = (paidInstallments / expense.installments) * 100;
                const isCompleted = remainingInstallments <= 0;

                return (
                  <div
                    key={expense.id}
                    className={`p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-purple-500/20 hover:bg-white/[0.04] transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${isCompleted ? 'opacity-60 grayscale' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className="p-3 rounded-2xl shrink-0 text-xl"
                        style={{
                          backgroundColor: `${CATEGORY_COLORS[expense.category] || '#94a3b8'}15`,
                        }}
                      >
                        {CATEGORY_EMOJIS[expense.category] || '📦'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-white text-base">{expense.merchant || expense.category}</p>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${isCompleted ? 'bg-green-500/15 text-green-400 border border-green-500/10' : 'bg-purple-500/15 text-purple-300 border border-purple-500/10'}`}>
                            {isCompleted ? '✓ Tamamlandı' : `${paidInstallments}/${expense.installments} Taksit`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[var(--color-text-variant)] mt-1 font-mono flex-wrap">
                          <span className="flex items-center gap-1">
                            <Calendar size={10} />
                            {expense.date}
                          </span>
                          {expense.card_name && (
                            <>
                              <span className="text-white/20">•</span>
                              <span className="flex items-center gap-1">
                                <CreditCard size={10} />
                                {expense.card_name}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="mt-3 max-w-[200px] w-full">
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isCompleted ? 'bg-green-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1 text-[10px] text-[var(--color-text-variant)] font-mono">
                            <span>{paidInstallments} ödendi</span>
                            <span>{remainingInstallments > 0 ? `${remainingInstallments} kaldı` : 'Bitti'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-left md:text-right w-full md:w-auto">
                      <p className="text-xl font-black font-mono text-white">
                        {new Intl.NumberFormat('tr-TR').format(expense.amount)} <span className="text-[var(--color-brand-tertiary)] text-sm">₺</span>
                      </p>
                      <p className="text-xs text-pink-400 font-mono mt-0.5 flex items-center md:justify-end gap-1">
                        <Clock size={10} />
                        Aylık: {new Intl.NumberFormat('tr-TR').format(monthlyAmount)} ₺
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Receipt Preview Modal */}
      <AnimatePresence>
        {previewReceiptUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPreviewReceiptUrl(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewReceiptUrl}
                alt="Fiş / Dekont"
                className="w-full h-full object-contain"
              />
              <button
                onClick={() => setPreviewReceiptUrl(null)}
                className="absolute top-3 right-3 p-2.5 bg-black/60 backdrop-blur-sm rounded-xl text-white hover:bg-black/80 transition-all"
              >
                <X size={18} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card Management Modal */}
      {showCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowCardModal(false)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[var(--color-surface-container)] rounded-3xl w-full max-w-md border border-white/10 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2 text-lg">
                <CreditCard size={20} className="text-purple-400" /> Yeni Kart Ekle
              </h3>
              <button onClick={() => setShowCardModal(false)} className="text-[var(--color-text-variant)] hover:text-white transition-colors bg-white/5 p-1.5 rounded-lg hover:bg-white/10">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddCard} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">
                  Kart Adı <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCardName}
                  onChange={e => setNewCardName(e.target.value)}
                  placeholder="Örn: Bonus, Maximum, World..."
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 transition-colors text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">
                    Banka
                  </label>
                  <input
                    type="text"
                    value={newCardBank}
                    onChange={e => setNewCardBank(e.target.value)}
                    placeholder="Garanti, Yapıkredi..."
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">
                    Son 4 Hane
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={newCardLastFour}
                    onChange={e => setNewCardLastFour(e.target.value.replace(/\D/g, ''))}
                    placeholder="1234"
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 transition-colors text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">
                    Son Ödeme Günü <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="31"
                    value={newCardPaymentDay}
                    onChange={e => setNewCardPaymentDay(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">
                    Hesap Kesim Günü
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={newCardCutOffDay}
                    onChange={e => setNewCardCutOffDay(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 transition-colors text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">
                    Kart Limiti (₺)
                  </label>
                  <input
                    type="number"
                    step="100"
                    value={newCardLimit}
                    onChange={e => setNewCardLimit(e.target.value)}
                    placeholder="50000"
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">
                    Kart Rengi
                  </label>
                  <div className="flex gap-2">
                    {['#a855f7', '#06b6d4', '#f97316', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#ec4899'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCardColor(c)}
                        className={`w-7 h-7 rounded-full transition-all ${newCardColor === c ? 'ring-2 ring-offset-2 ring-offset-[var(--color-surface-container)] scale-110' : 'hover:scale-110'}`}
                        style={{ backgroundColor: c, ringColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl font-bold text-sm hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all flex items-center justify-center gap-2"
              >
                <PlusCircle size={16} /> Kartı Kaydet
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Installments Modal */}
      <AnimatePresence>
        {showInstallmentsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowInstallmentsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-[var(--color-surface-container)] rounded-3xl w-full max-w-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-purple-500/20 border border-purple-500/10">
                    <List size={22} className="text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Tüm Taksitler</h3>
                    <p className="text-xs text-[var(--color-text-variant)] mt-0.5">
                      {expenses.filter(e => e.installments > 1).length} taksitli işlem
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInstallmentsModal(false)}
                  className="text-[var(--color-text-variant)] hover:text-white transition-colors bg-white/5 p-2 rounded-xl hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Summary */}
              {(() => {
                const installmentExpenses = expenses.filter(e => e.installments > 1);
                const totalInstallmentAmount = installmentExpenses.reduce((sum, e) => sum + e.amount, 0);
                const monthlyInstallmentAmount = installmentExpenses.reduce((sum, e) => sum + (e.amount / e.installments), 0);
                return (
                  <div className="px-6 py-4 border-b border-white/5 bg-[var(--color-surface-lowest)]/50 shrink-0">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/10">
                        <p className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest font-mono">Toplam Taksitli Tutar</p>
                        <p className="text-xl font-black text-white font-mono mt-1">
                          {new Intl.NumberFormat('tr-TR').format(totalInstallmentAmount)} <span className="text-purple-400 text-sm">₺</span>
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-pink-500/10 border border-pink-500/10">
                        <p className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest font-mono">Aylık Taksit Toplamı</p>
                        <p className="text-xl font-black text-white font-mono mt-1">
                          {new Intl.NumberFormat('tr-TR').format(monthlyInstallmentAmount)} <span className="text-pink-400 text-sm">₺</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Installments List */}
              <div className="overflow-y-auto flex-1">
                {expenses.filter(e => e.installments > 1).length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center gap-4">
                    <div className="p-5 rounded-3xl bg-purple-500/5 border border-purple-500/10">
                      <List size={40} className="text-purple-400/40" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Henüz taksitli işlem yok</p>
                      <p className="text-[var(--color-text-variant)] text-sm mt-1">
                        Taksitli harcama girdiğinizde burada görünecek
                      </p>
                    </div>
                  </div>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {expenses.filter(e => e.installments > 1).map((expense, idx) => {
                      const monthlyAmount = expense.amount / expense.installments;
                      const expenseDate = new Date(expense.date);
                      const now = new Date();
                      // Calculate how many months have passed since the expense date
                      const monthsPassed = Math.max(1, (now.getFullYear() - expenseDate.getFullYear()) * 12 + (now.getMonth() - expenseDate.getMonth()) + 1);
                      const paidInstallments = Math.min(monthsPassed, expense.installments);
                      const remainingInstallments = expense.installments - paidInstallments;
                      const progressPercent = (paidInstallments / expense.installments) * 100;
                      const isCompleted = remainingInstallments <= 0;

                      return (
                        <motion.li
                          key={expense.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className={`p-5 hover:bg-[var(--color-surface-container)] transition-colors ${isCompleted ? 'opacity-60' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4 min-w-0">
                              {/* Category / Merchant Icon */}
                              <div
                                className="p-2.5 rounded-2xl shrink-0 text-lg"
                                style={{
                                  backgroundColor: `${CATEGORY_COLORS[expense.category] || '#94a3b8'}15`,
                                }}
                              >
                                {CATEGORY_EMOJIS[expense.category] || '📦'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-white text-base">{expense.merchant || expense.category}</p>
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${isCompleted ? 'bg-green-500/15 text-green-400 border border-green-500/10' : 'bg-purple-500/15 text-purple-300 border border-purple-500/10'}`}>
                                    {isCompleted ? '✓ Tamamlandı' : `${paidInstallments}/${expense.installments} Taksit`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-[var(--color-text-variant)] mt-1 font-mono flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Calendar size={10} />
                                    {expense.date}
                                  </span>
                                  {expense.card_name && (
                                    <>
                                      <span className="text-white/20">•</span>
                                      <span className="flex items-center gap-1">
                                        <CreditCard size={10} />
                                        {expense.card_name}
                                      </span>
                                    </>
                                  )}
                                  {expense.description && (
                                    <>
                                      <span className="text-white/20">•</span>
                                      <span className="truncate max-w-[180px]">{expense.description}</span>
                                    </>
                                  )}
                                </div>

                                {/* Progress Bar */}
                                <div className="mt-3 w-full max-w-xs">
                                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${progressPercent}%` }}
                                      transition={{ duration: 0.8, delay: idx * 0.05 }}
                                      className={`h-full rounded-full ${isCompleted ? 'bg-green-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}
                                    />
                                  </div>
                                  <div className="flex justify-between mt-1.5 text-[10px] text-[var(--color-text-variant)] font-mono">
                                    <span>{paidInstallments} ödendi</span>
                                    <span>{remainingInstallments > 0 ? `${remainingInstallments} kaldı` : 'Bitti'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Amount Info */}
                            <div className="text-right shrink-0">
                              <p className="text-lg font-black font-mono text-white">
                                {new Intl.NumberFormat('tr-TR').format(expense.amount)} <span className="text-[var(--color-brand-tertiary)] text-sm">₺</span>
                              </p>
                              <p className="text-xs text-[var(--color-text-variant)] font-mono mt-0.5 flex items-center gap-1 justify-end">
                                <Clock size={10} />
                                Aylık: {new Intl.NumberFormat('tr-TR').format(monthlyAmount)} ₺
                              </p>
                            </div>
                          </div>
                        </motion.li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
