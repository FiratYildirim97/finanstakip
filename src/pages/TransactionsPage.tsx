import React, { useState, useEffect, FormEvent, useRef, useCallback, useMemo } from 'react';
import { useCreditCardExpenses } from '../hooks/useCreditCardExpenses';
import { useCreditCards } from '../hooks/useCreditCards';
import { useCardInstallments } from '../hooks/useCardInstallments';
import { receiptAgent } from '../lib/agents';
import { CreditCard as CreditCardType } from '../types';
import { advisorAgent } from '../lib/agents/advisorAgent';
import {
  Sparkles, Plus, Trash2, CreditCard, Camera, Upload, X,
  ImageIcon, FileText, Store, Tag, Hash, ChevronDown,
  Receipt, Eye, Loader2, CheckCircle2, AlertCircle,
  PlusCircle, Settings, Wallet, Calendar, List,
  Clock, ArrowRight, Shield, Pencil, History, TrendingUp,
  Info, ArrowUpRight, ArrowDownRight, Check, ChevronRight
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
  const { expenses, loading, addExpense, deleteExpense, updateExpense, uploadReceipt } = useCreditCardExpenses();
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
  const [isExempt, setIsExempt] = useState(false);
  const [manualReceiptFile, setManualReceiptFile] = useState<File | null>(null);

  // Receipt preview modal
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  // Filter
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [filterCardId, setFilterCardId] = useState<string | null>(null);

  // Card management modal
  const [showCardModal, setShowCardModal] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardBank, setNewCardBank] = useState('');
  const [newCardLastFour, setNewCardLastFour] = useState('');
  const [newCardPaymentDay, setNewCardPaymentDay] = useState('1');
  const [newCardCutOffDay, setNewCardCutOffDay] = useState('');
  const [newCardLimit, setNewCardLimit] = useState('');
  const [newCardColor, setNewCardColor] = useState('#a855f7');

  // AI Category Suggestion State
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false);

  // Quick Import Installment Modal
  const [showQuickInstallModal, setShowQuickInstallModal] = useState(false);
  const [qiMerchant, setQiMerchant] = useState('');
  const [qiAmount, setQiAmount] = useState('');
  const [qiTotalInstallments, setQiTotalInstallments] = useState('12');
  const [qiCurrentInstallment, setQiCurrentInstallment] = useState('1');
  const [qiCategory, setQiCategory] = useState('Diğer');
  const [qiCardId, setQiCardId] = useState('');
  const [isQiSubmitting, setIsQiSubmitting] = useState(false);

  // Edit expense modal
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editInstallments, setEditInstallments] = useState('1');
  const [editCategory, setEditCategory] = useState('Market');
  const [editMerchant, setEditMerchant] = useState('');
  const [editCardId, setEditCardId] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isEditSaving, setIsEditSaving] = useState(false);

  const openEditModal = (expense: any) => {
    setEditingExpense(expense);
    setEditAmount(String(expense.amount));
    setEditInstallments(String(expense.installments || 1));
    setEditCategory(expense.category || 'Market');
    setEditMerchant(expense.merchant || '');
    setEditCardId(expense.card_id || '');
    setEditDescription(expense.description || '');
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    setIsEditSaving(true);
    const { error } = await updateExpense(editingExpense.id, {
      amount: parseFloat(editAmount),
      installments: parseInt(editInstallments),
      category: editCategory,
      merchant: editMerchant || null,
      card_id: editCardId || null,
      card_name: cards.find(c => c.id === editCardId)?.name || editingExpense.card_name,
      description: editDescription || null,
    });
    if (!error) {
      toast.success('Harcama güncellendi ✅');
      setEditingExpense(null);
    } else {
      toast.error('Güncelleme başarısız');
    }
    setIsEditSaving(false);
  };

  // Auto-select first card
  useEffect(() => {
    if (cards.length > 0 && !selectedCardId) {
      setSelectedCardId(cards[0].id);
    }
    if (cards.length > 0 && !qiCardId) {
      setQiCardId(cards[0].id);
    }
  }, [cards, selectedCardId, qiCardId]);

  // Handle quick-import installment submit
  const handleQuickInstallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalAmt = parseFloat(qiAmount);
    const total = parseInt(qiTotalInstallments);
    const current = parseInt(qiCurrentInstallment);
    if (!totalAmt || !total || !current || current > total) return;

    setIsQiSubmitting(true);
    // Calculate the start date: go back (current - 1) months from today
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - (current - 1));
    const startDateStr = startDate.toISOString().split('T')[0];

    const selectedCard = cards.find(c => c.id === qiCardId);
    const { error } = await addExpense({
      amount: totalAmt,
      category: qiCategory,
      description: `Mevcut Taksit / ${total} taksit`,
      merchant: qiMerchant || null,
      card_name: selectedCard?.name || null,
      card_id: qiCardId || null,
      installments: total,
      is_exempt: false,
      receipt_url: null,
      date: startDateStr,
    });

    if (!error) {
      toast.success(`✅ ${qiMerchant || 'Taksit'} aktarıldı! (${current}/${total} taksit, ${new Intl.NumberFormat('tr-TR').format(totalAmt / total)} ₺/ay)`);
      setQiMerchant('');
      setQiAmount('');
      setQiTotalInstallments('12');
      setQiCurrentInstallment('1');
      setQiCategory('Diğer');
      setShowQuickInstallModal(false);
      // Sync card total
      if (selectedCard) {
        const total2 = getCardMonthlyTotal(selectedCard.id, expenses);
        syncCardToRecurring(selectedCard.id, total2, selectedCard.name, selectedCard.payment_day);
      }
    } else {
      toast.error('Kayıt sırasında hata oluştu');
    }
    setIsQiSubmitting(false);
  };

  // Auto-categorize based on description
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (description.length >= 3 && inputMode === 'manual') {
        setIsSuggestingCategory(true);
        const suggested = await advisorAgent.suggestCategory(description, CREDIT_CARD_CATEGORIES);
        if (suggested && CREDIT_CARD_CATEGORIES.includes(suggested)) {
          setCategory(suggested);
          toast.success(`AI Önerisi: ${suggested}`, { duration: 2000 });
        }
        setIsSuggestingCategory(false);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [description, inputMode]);

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
        is_exempt: false,
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
      is_exempt: false,
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
      is_exempt: isExempt,
      receipt_url: receiptUrl,
      date: new Date().toISOString().split('T')[0]
    });

    if (!error) {
      toast.success('Harcama kaydedildi ✅');
      setAmount('');
      setDescription('');
      setMerchant('');
      setInstallments('1');
      setIsExempt(false);
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
  const selectedCard = cards.find(c => c.id === filterCardId);

  const cardFilteredExpenses = useMemo(() => filterCardId
    ? expenses.filter(e => e.card_id === filterCardId)
    : expenses, [filterCardId, expenses]);

  const filteredExpenses = useMemo(() => selectedFilter === 'all'
    ? cardFilteredExpenses
    : cardFilteredExpenses.filter(e => e.category === selectedFilter), [selectedFilter, cardFilteredExpenses]);

  const filteredTotalExpenses = useMemo(() => cardFilteredExpenses.reduce((sum, expense) => {
    if (expense.is_exempt) return sum;
    if (expense.installments > 1) {
      // Taksitli olunca sadece o aya yansıyan (ilk) taksit tutarını yansıt
      return sum + (expense.amount / expense.installments);
    }
    return sum + expense.amount;
  }, 0), [cardFilteredExpenses]);

  const installmentExpenses = useMemo(() => cardFilteredExpenses.filter(e => e.installments > 1), [cardFilteredExpenses]);

  const installmentGroups = useMemo<Record<string, { cardName: string; items: any[] }>>(() => installmentExpenses.reduce((groups, expense) => {
    const groupKey = expense.card_id || 'no-card';
    if (!groups[groupKey]) {
      groups[groupKey] = {
        cardName: expense.card_name || 'Kartı Belirsiz',
        items: [],
      };
    }
    groups[groupKey].items.push(expense);
    return groups;
  }, {} as Record<string, { cardName: string; items: any[] }>), [installmentExpenses]);

  // Ay bazlı gelecek taksitler hesaplama
  const futureMonthlyInstallments = useMemo(() => {
    const monthlyData: Record<string, { total: number; label: string; items: any[] }> = {};
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    expenses.forEach(expense => {
      if (expense.installments <= 1) return;

      const startDate = new Date(expense.date);
      const amountPerInstallment = expense.amount / expense.installments;

      for (let i = 0; i < expense.installments; i++) {
        const installmentDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);

        // Sadece bu ay ve gelecek ayları ekle
        if (installmentDate >= currentMonthStart) {
          const monthKey = installmentDate.toISOString().substring(0, 7); // "YYYY-MM"
          const monthLabel = installmentDate.toLocaleString('tr-TR', { month: 'long', year: 'numeric' });

          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = { total: 0, label: monthLabel, items: [] };
          }

          monthlyData[monthKey].total += amountPerInstallment;
          monthlyData[monthKey].items.push({
            ...expense,
            currentInstallmentNumber: i + 1,
            monthlyAmount: amountPerInstallment
          });
        }
      }
    });

    return Object.keys(monthlyData)
      .sort()
      .map(key => ({
        key,
        ...monthlyData[key]
      }));
  }, [expenses]);

  const expensesBySelectedCardCategory = useMemo(() => cardFilteredExpenses.reduce<Record<string, number>>((acc, expense) => {
    if (expense.is_exempt) return acc;
    const effectiveAmount = expense.installments > 1 ? expense.amount / expense.installments : expense.amount;
    acc[expense.category] = (acc[expense.category] || 0) + effectiveAmount;
    return acc;
  }, {}), [cardFilteredExpenses]);

  const sortedCategories = useMemo(() => Object.entries(expensesBySelectedCardCategory)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5), [expensesBySelectedCardCategory]);

  // Add-expense modal state
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-purple-500/15 border border-purple-500/20">
            <CreditCard size={18} className="text-purple-400" />
          </div>
          <h1 className="text-lg font-bold text-white font-display">Kredi Kartı</h1>
        </div>
        <div className="flex items-center gap-2">
          {cards.length > 0 && (
            <button onClick={handleSyncToRecurring} title="Aylığa Senkronize Et"
              className="p-1.5 rounded-lg bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary)]/20 transition-colors border border-[var(--color-brand-primary)]/15"
            ><Calendar size={14} /></button>
          )}
          <button onClick={() => setShowQuickInstallModal(true)} title="Mevcut Taksit Aktar"
            className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors border border-amber-500/15"
          ><Clock size={14} /></button>
          <button onClick={() => setShowCardModal(true)} title="Yeni Kart Ekle"
            className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors border border-purple-500/15"
          ><PlusCircle size={14} /></button>
          <button onClick={() => setShowHistoryModal(true)} title="Harcama Geçmişi"
            className="p-1.5 rounded-lg bg-white/5 text-[var(--color-text-variant)] hover:bg-white/10 hover:text-white transition-colors border border-white/10"
          ><History size={14} /></button>
          <button onClick={() => setShowQuickInstallModal(true)} title="Hızlı Taksit Ekle"
            className="p-1.5 rounded-lg bg-white/5 text-[var(--color-text-variant)] hover:bg-white/10 hover:text-[var(--color-brand-primary)] transition-colors border border-white/10"
          ><TrendingUp size={14} /></button>
          <button onClick={() => setShowAddExpenseModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white text-sm font-bold hover:brightness-110 transition-all shadow-lg shadow-purple-500/20"
          >
            <Plus size={15} /> Harcama Ekle
          </button>
        </div>
      </div>

      {/* ── Cards chip strip ── */}
      {cards.length === 0 ? (
        <button onClick={() => setShowCardModal(true)}
          className="w-full py-5 border border-dashed border-white/10 rounded-xl text-[var(--color-text-variant)] hover:border-purple-500/30 hover:bg-purple-500/5 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <CreditCard size={16} className="opacity-50" /> Kart ekleyerek başlayın…
        </button>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button onClick={() => setFilterCardId(null)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-sm font-medium ${
              !filterCardId ? 'bg-white/10 border-white/20 text-white' : 'border-white/8 text-[var(--color-text-variant)] hover:bg-white/5 hover:text-white'
            }`}
          ><Wallet size={13} /> Tümü</button>
          {cards.map(card => {
            const cardTotal = getCardMonthlyTotal(card.id, expenses);
            const usagePercent = card.card_limit ? Math.min((cardTotal / card.card_limit) * 100, 100) : 0;
            const isActive = filterCardId === card.id;
            return (
              <button key={card.id}
                onClick={() => { setFilterCardId(card.id); setSelectedCardId(card.id); }}
                className={`relative shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all group ${
                  isActive ? 'ring-1' : 'hover:bg-white/5'
                }`}
                style={{
                  background: isActive ? `${card.color}15` : 'transparent',
                  borderColor: isActive ? `${card.color}50` : 'rgba(255,255,255,0.08)',
                  boxShadow: isActive ? `0 0 12px ${card.color}20` : 'none'
                }}
              >
                <button onClick={async e => { 
                    e.stopPropagation(); 
                    if (confirm(`${card.name} kartını sil?`)) {
                      const { error } = await deleteCard(card.id);
                      if (error) toast.error("Karta bağlı harcamalar var! Önce harcamaları silin.");
                      else toast.success("Kart başarıyla silindi.");
                    }
                  }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 z-10 hover:bg-red-500 transition-opacity"
                ><X size={9} /></button>
                <div className="p-1 rounded-md" style={{ backgroundColor: `${card.color}25` }}>
                  <CreditCard size={12} style={{ color: card.color }} />
                </div>
                <div className="text-left">
                  <p className="text-white font-semibold text-sm leading-none truncate max-w-[90px]">{card.name}</p>
                  <p className="text-[10px] text-[var(--color-text-variant)] mt-0.5 font-mono">
                    {new Intl.NumberFormat('tr-TR', { notation: 'compact' }).format(cardTotal)}₺
                    {card.card_limit && <span className="opacity-50"> / {new Intl.NumberFormat('tr-TR', { notation: 'compact' }).format(card.card_limit)}₺</span>}
                  </p>
                  {card.card_limit && (
                    <div className="h-0.5 rounded-full mt-1 w-14 bg-white/10 overflow-hidden">
                      <div style={{ width: `${usagePercent}%`, backgroundColor: usagePercent > 80 ? '#f87171' : card.color }} className="h-full rounded-full" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── This month installments ── */}
      {(() => {
        const now = new Date();
        const monthlyInstallmentAmount = installmentExpenses.reduce((sum, e) => sum + (e.amount / e.installments), 0);
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthData = futureMonthlyInstallments.find(m => m.key === currentMonthKey);
        const currentMonthItems = currentMonthData?.items || [];
        const currentMonthTotal = currentMonthData?.total || 0;
        if (installmentExpenses.length === 0) return null;
        return (
          <div className="bento-card p-0 overflow-hidden">
            {/* Summary bar */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-2">
                <List size={14} className="text-purple-400" />
                <span className="text-sm font-bold text-white">Taksitler</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-mono border border-purple-500/10">{installmentExpenses.length} aktif</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[9px] text-[var(--color-text-variant)] font-mono uppercase">Aylık yük</p>
                  <p className="text-sm font-black text-pink-400 font-mono">{new Intl.NumberFormat('tr-TR').format(monthlyInstallmentAmount)}₺</p>
                </div>
                <button onClick={() => setShowQuickInstallModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-white bg-white/10 hover:bg-white/20 transition-colors border border-white/10 font-medium"
                ><Plus size={11} /> Hızlı Ekle</button>
                <button onClick={() => setShowInstallmentsModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-colors border border-purple-500/15 font-medium"
                ><Calendar size={11} /> Takvim</button>
              </div>
            </div>
            {/* This month */}
            {currentMonthItems.length > 0 && (
              <div className="px-4 py-2 bg-amber-500/[0.04] border-b border-amber-500/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest font-mono">Bu Ay Ödenecek</span>
                  <span className="text-sm font-black text-amber-400 font-mono">{new Intl.NumberFormat('tr-TR').format(currentMonthTotal)}₺</span>
                </div>
                <div className="space-y-1">
                  {currentMonthItems.map((item: any) => (
                    <div key={`curr-${item.id}`} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors group/item">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{CATEGORY_EMOJIS[item.category] || '📦'}</span>
                        <div>
                          <p className="text-sm font-semibold text-white leading-none">{item.merchant || item.category}</p>
                          <span className="text-[10px] text-purple-300 font-mono">{item.currentInstallmentNumber}/{item.installments}. taksit</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-white text-sm mr-1">{new Intl.NumberFormat('tr-TR').format(item.monthlyAmount)}₺</span>
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1 rounded-lg text-[var(--color-text-variant)] hover:text-purple-400 hover:bg-purple-500/10 transition-all opacity-0 group-hover/item:opacity-100 focus:opacity-100"
                          title="Düzenle"
                        ><Pencil size={12} /></button>
                        <button
                          onClick={() => { if (confirm(`"${item.merchant || item.category}" taksitini sil?`)) deleteExpense(item.id); }}
                          className="p-1 rounded-lg text-[var(--color-text-variant)] hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover/item:opacity-100 focus:opacity-100"
                          title="Sil"
                        ><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* All installments compact */}
            <div className="divide-y divide-white/5">
              {installmentExpenses.map(expense => {
                const monthlyAmount = expense.amount / expense.installments;
                const expDate = new Date(expense.date);
                const now2 = new Date();
                const mp = Math.max(1, (now2.getFullYear() - expDate.getFullYear()) * 12 + (now2.getMonth() - expDate.getMonth()) + 1);
                const paid = Math.min(mp, expense.installments);
                const remaining = expense.installments - paid;
                const isCompleted = remaining <= 0;
                return (
                  <div key={expense.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03] group ${isCompleted ? 'opacity-50' : ''}`}
                  >
                    <span className="text-base shrink-0">{CATEGORY_EMOJIS[expense.category] || '📦'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-white truncate">{expense.merchant || expense.category}</p>
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-bold ${
                          isCompleted ? 'bg-green-500/15 text-green-400' : 'bg-purple-500/15 text-purple-300'
                        }`}>{isCompleted ? '✓ Bitti' : `${paid}/${expense.installments}`}</span>
                      </div>
                      <div className="mt-1 h-0.5 rounded-full bg-white/10 overflow-hidden w-full max-w-[100px]">
                        <div className={`h-full rounded-full ${isCompleted ? 'bg-green-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}
                          style={{ width: `${(paid / expense.installments) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="text-right mr-1">
                        <p className="text-sm font-bold text-white font-mono">{new Intl.NumberFormat('tr-TR').format(monthlyAmount)}₺<span className="text-[10px] text-[var(--color-text-variant)]">/ay</span></p>
                        {!isCompleted && <p className="text-[10px] text-[var(--color-text-variant)] font-mono">{remaining} kaldı</p>}
                      </div>
                      <button
                        onClick={() => openEditModal(expense)}
                        className="p-1.5 rounded-lg text-[var(--color-text-variant)] hover:text-purple-400 hover:bg-purple-500/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Düzenle"
                      ><Pencil size={13} /></button>
                      <button
                        onClick={() => { if (confirm(`"${expense.merchant || expense.category}" taksitini sil?`)) deleteExpense(expense.id); }}
                        className="p-1.5 rounded-lg text-[var(--color-text-variant)] hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Sil"
                      ><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Extracted to History Modal ── */}

      {/* ── MODALS ── */}

      {/* ── Edit Expense Modal ── */}
      <AnimatePresence>
        {editingExpense && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setEditingExpense(null)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-[var(--color-surface-container)] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md border border-white/10 shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-purple-500/15 border border-purple-500/20"><Pencil size={15} className="text-purple-400" /></div>
                  <div>
                    <h3 className="font-bold text-white">Harcamayı Düzenle</h3>
                    <p className="text-xs text-[var(--color-text-variant)] truncate max-w-[200px]">{editingExpense.merchant || editingExpense.category}</p>
                  </div>
                </div>
                <button onClick={() => setEditingExpense(null)} className="p-1.5 rounded-lg bg-white/5 text-[var(--color-text-variant)] hover:text-white hover:bg-white/10"><X size={16} /></button>
              </div>
              <form onSubmit={handleEditSave} className="p-5 space-y-3">
                {/* Amount */}
                <div className="relative">
                  <input type="number" required value={editAmount} onChange={e => setEditAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-3 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 font-mono text-xl"
                    placeholder="0" step="0.01"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-variant)] text-lg">₺</span>
                </div>
                {/* Category */}
                <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm appearance-none"
                >{CREDIT_CARD_CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-[#1a1c1e]">{CATEGORY_EMOJIS[cat]} {cat}</option>)}</select>
                {/* Merchant + Description */}
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={editMerchant} onChange={e => setEditMerchant(e.target.value)}
                    className="px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm"
                    placeholder="Mağaza"
                  />
                  <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)}
                    className="px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm"
                    placeholder="Not (opsiyonel)"
                  />
                </div>
                {/* Card + Installments */}
                <div className="grid grid-cols-2 gap-2">
                  {cards.length > 0 && (
                    <select value={editCardId} onChange={e => setEditCardId(e.target.value)}
                      className="px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm appearance-none"
                    >{cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  )}
                  <select value={editInstallments} onChange={e => setEditInstallments(e.target.value)}
                    className="px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm appearance-none"
                  >{[1,2,3,4,5,6,7,8,9,10,11,12,18,24,36].map(n => <option key={n} value={n}>{n === 1 ? 'Tek Çekim' : `${n} Taksit`}</option>)}</select>
                </div>
                {/* Preview */}
                {editAmount && parseFloat(editAmount) > 0 && parseInt(editInstallments) > 1 && (
                  <div className="px-3 py-2 bg-purple-500/5 border border-purple-500/15 rounded-xl text-xs font-mono text-purple-300">
                    Aylık: {new Intl.NumberFormat('tr-TR').format(parseFloat(editAmount) / parseInt(editInstallments))} ₺
                    · {parseInt(editInstallments)} taksit
                  </div>
                )}
                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setEditingExpense(null)}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-[var(--color-text-variant)] text-sm hover:bg-white/5 transition-colors"
                  >İptal</button>
                  <button type="submit" disabled={isEditSaving}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl py-2.5 font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                  >{isEditSaving ? <><Loader2 size={14} className="animate-spin" /> Kaydediliyor…</> : <><Pencil size={14} /> Kaydet</>}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Expense Modal ── */}
      <AnimatePresence>
        {showAddExpenseModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowAddExpenseModal(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-[var(--color-surface-container)] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg border border-white/10 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                  {([['ai-text', 'AI Yazı'], ['ai-photo', 'Fiş'], ['manual', 'Manuel']] as const).map(([mode, label]) => (
                    <button key={mode} onClick={() => setInputMode(mode as InputMode)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        inputMode === mode ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow' : 'text-[var(--color-text-variant)] hover:text-white'
                      }`}
                    >
                      {mode === 'ai-text' && <Sparkles size={12} />}
                      {mode === 'ai-photo' && <Camera size={12} />}
                      {mode === 'manual' && <Plus size={12} />}
                      {label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowAddExpenseModal(false)}
                  className="p-1.5 rounded-lg bg-white/5 text-[var(--color-text-variant)] hover:text-white hover:bg-white/10 transition-colors"
                ><X size={16} /></button>
              </div>

              {/* Modal body */}
              <div className="overflow-y-auto flex-1">
                <AnimatePresence mode="wait">
                  {/* AI Text */}
                  {inputMode === 'ai-text' && (
                    <motion.div key="ai-text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}
                      className="p-5 space-y-3"
                    >
                      {cards.length > 0 && (
                        <select value={selectedCardId} onChange={e => setSelectedCardId(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm appearance-none"
                        >{cards.map(c => <option key={c.id} value={c.id}>💳 {c.name}{c.last_four ? ` (*${c.last_four})` : ''}</option>)}</select>
                      )}
                      <form onSubmit={handleAiTextSubmit} className="relative">
                        <textarea value={aiInput} onChange={e => setAiInput(e.target.value)}
                          placeholder="Migros'tan 850₺ market alışverişi, 3 taksit…"
                          className="w-full px-4 py-3 bg-[var(--color-surface-lowest)] border border-white/10 rounded-xl outline-none focus:border-purple-500/50 resize-none pb-14 text-sm text-white placeholder-white/30"
                          rows={4} autoFocus
                        />
                        <button type="submit" disabled={isAiLoading || !aiInput.trim()}
                          className="absolute bottom-2.5 right-2.5 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-lg px-4 py-2 text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5 hover:brightness-110"
                        >{isAiLoading ? <><Loader2 size={12} className="animate-spin" /> Çözümleniyor…</> : <><Sparkles size={12} /> Ekle</>}</button>
                      </form>
                    </motion.div>
                  )}

                  {/* AI Photo */}
                  {inputMode === 'ai-photo' && (
                    <motion.div key="ai-photo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}
                      className="p-5 space-y-3"
                    >
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleImageSelect(e.target.files[0])} className="hidden" />
                      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={e => e.target.files?.[0] && handleImageSelect(e.target.files[0])} className="hidden" />
                      {cards.length > 0 && (
                        <select value={selectedCardId} onChange={e => setSelectedCardId(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-cyan-500/50 text-sm appearance-none"
                        >{cards.map(c => <option key={c.id} value={c.id}>💳 {c.name}{c.last_four ? ` (*${c.last_four})` : ''}</option>)}</select>
                      )}
                      {!imagePreview ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => cameraInputRef.current?.click()}
                              className="flex items-center justify-center gap-2 p-5 rounded-xl border border-dashed border-cyan-500/25 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all text-sm font-medium text-cyan-300"
                            ><Camera size={18} /> Kamera</button>
                            <button type="button" onClick={() => fileInputRef.current?.click()}
                              className="flex items-center justify-center gap-2 p-5 rounded-xl border border-dashed border-purple-500/25 bg-purple-500/5 hover:bg-purple-500/10 transition-all text-sm font-medium text-purple-300"
                            ><ImageIcon size={18} /> Galeri</button>
                          </div>
                          <div onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                            className={`border border-dashed rounded-xl py-3 px-4 flex items-center justify-center gap-2 text-xs text-[var(--color-text-variant)] transition-all ${
                              dragActive ? 'border-cyan-400 bg-cyan-400/8' : 'border-white/8 hover:border-white/15'
                            }`}
                          ><Upload size={12} /> Sürükle & bırak · JPG, PNG, WEBP</div>
                        </>
                      ) : (
                        <div className="space-y-3">
                          <div className="relative rounded-xl overflow-hidden border border-white/10">
                            <img src={imagePreview} alt="Fiş" className="w-full max-h-[200px] object-contain bg-black/40" />
                            <button onClick={clearImage} className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white/80 hover:text-white hover:bg-black/80"><X size={14} /></button>
                          </div>
                          {parsedPreview && (
                            <div className="bg-[var(--color-surface-lowest)] rounded-xl p-3 border border-[var(--color-brand-primary)]/20 space-y-2">
                              <div className="flex items-center gap-1.5 text-[var(--color-brand-primary)] text-xs font-bold"><CheckCircle2 size={13} /> AI Okudu</div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><span className="text-[var(--color-text-variant)]">Tutar</span><p className="text-white font-bold font-mono">{new Intl.NumberFormat('tr-TR').format(parsedPreview.amount)}₺</p></div>
                                <div><span className="text-[var(--color-text-variant)]">Kategori</span><p className="text-white">{CATEGORY_EMOJIS[parsedPreview.category]} {parsedPreview.category}</p></div>
                                {parsedPreview.merchant && <div className="col-span-2"><span className="text-[var(--color-text-variant)]">Mağaza</span><p className="text-white">{parsedPreview.merchant}</p></div>}
                              </div>
                            </div>
                          )}
                          <div className="flex gap-2">
                            {!parsedPreview ? (
                              <button onClick={handlePhotoAnalyze} disabled={isPhotoLoading}
                                className="flex-1 bg-gradient-to-r from-cyan-600 to-purple-500 text-white rounded-xl py-3 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                              >{isPhotoLoading ? <><Loader2 size={14} className="animate-spin" /> Okunuyor…</> : <><Sparkles size={14} /> AI ile Oku</>}</button>
                            ) : (
                              <>
                                <button onClick={clearImage} className="px-4 py-3 rounded-xl border border-white/10 text-[var(--color-text-variant)] text-sm hover:bg-white/5">İptal</button>
                                <button onClick={handlePhotoConfirm} disabled={isPhotoLoading}
                                  className="flex-1 bg-gradient-to-r from-[var(--color-brand-primary-container)] to-[var(--color-brand-primary)] text-green-950 rounded-xl py-3 text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2"
                                >{isPhotoLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Onayla & Kaydet</button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Manual */}
                  {inputMode === 'manual' && (
                    <motion.div key="manual" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}
                      className="p-5"
                    >
                      <form onSubmit={handleManualSubmit} className="space-y-3">
                        <div className="relative">
                          <input type="number" required value={amount} onChange={e => setAmount(e.target.value)}
                            className="w-full px-4 py-3 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 font-mono text-xl pl-8"
                            placeholder="0" autoFocus
                          />
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-variant)] text-lg">₺</span>
                        </div>
                        <select value={category} onChange={e => setCategory(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm appearance-none"
                        >{CREDIT_CARD_CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-[#1a1c1e]">{CATEGORY_EMOJIS[cat]} {cat}</option>)}</select>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" value={merchant} onChange={e => setMerchant(e.target.value)}
                            className="px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm"
                            placeholder="Mağaza (opsiyonel)"
                          />
                          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                            className="px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm"
                            placeholder="Not (opsiyonel)"
                          />
                          {cards.length > 0 ? (
                            <select value={selectedCardId} onChange={e => setSelectedCardId(e.target.value)}
                              className="px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm appearance-none"
                            >{cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                          ) : (
                            <button type="button" onClick={() => setShowCardModal(true)}
                              className="px-3 py-2.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl text-sm flex items-center gap-1.5"
                            ><PlusCircle size={13} /> Kart Ekle</button>
                          )}
                          <select value={installments} onChange={e => setInstallments(e.target.value)}
                            className="px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm appearance-none"
                          >{[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n === 1 ? 'Tek Çekim' : `${n} Taksit`}</option>)}</select>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--color-surface-lowest)] border border-white/10 rounded-xl">
                          <span className="text-xs text-[var(--color-text-variant)]">Muaf (Gider sayılmasın)</span>
                          <button type="button" onClick={() => setIsExempt(!isExempt)}
                            className={`w-9 h-5 rounded-full relative transition-colors ${isExempt ? 'bg-purple-500' : 'bg-white/10'}`}
                          ><div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${isExempt ? 'translate-x-4' : ''}`} /></button>
                        </div>
                        <label className="flex items-center gap-2 px-3 py-2.5 bg-[var(--color-surface-lowest)] border border-white/10 rounded-xl cursor-pointer hover:bg-white/5">
                          <Upload size={13} className="text-[var(--color-text-variant)]" />
                          <span className="text-xs text-[var(--color-text-variant)]">{manualReceiptFile ? manualReceiptFile.name : 'Fiş fotoğrafı (opsiyonel)'}</span>
                          <input type="file" accept="image/*" onChange={e => setManualReceiptFile(e.target.files?.[0] || null)} className="hidden" />
                        </label>
                        <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl py-3 font-bold hover:brightness-110 transition-all">Kaydet</button>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Quick Import Installment Modal ── */}
      <AnimatePresence>
        {showQuickInstallModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowQuickInstallModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-[var(--color-surface-container)] rounded-3xl w-full max-w-md border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 border-b border-white/5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/20">
                    <Clock size={18} className="text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Mevcut Taksit Aktar</h3>
                    <p className="text-xs text-[var(--color-text-variant)]">Dışarıdan gelen taksiti sisteme al</p>
                  </div>
                </div>
                <button onClick={() => setShowQuickInstallModal(false)} className="p-1.5 rounded-lg bg-white/5 text-[var(--color-text-variant)] hover:text-white hover:bg-white/10"><X size={16} /></button>
              </div>
              <div className="overflow-y-auto flex-1 p-5">
                <form onSubmit={handleQuickInstallSubmit} className="space-y-3">
                  <input type="text" required value={qiMerchant} onChange={e => setQiMerchant(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-amber-500/50 text-sm"
                    placeholder="Mağaza / Ürün adı" autoFocus
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input type="number" required value={qiAmount} onChange={e => setQiAmount(e.target.value)}
                        className="w-full pl-6 pr-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-amber-500/50 text-sm font-mono"
                        placeholder="Toplam tutar"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-variant)] text-sm">₺</span>
                    </div>
                    <select value={qiTotalInstallments} onChange={e => setQiTotalInstallments(e.target.value)}
                      className="px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-amber-500/50 text-sm appearance-none"
                    >{[2,3,4,5,6,7,8,9,10,11,12,18,24,36].map(n => <option key={n} value={n}>{n} Taksit</option>)}</select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[var(--color-text-variant)] font-mono uppercase mb-1 block">Şu anki taksit no</label>
                      <select value={qiCurrentInstallment} onChange={e => setQiCurrentInstallment(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-amber-500/50 text-sm appearance-none"
                      >{Array.from({ length: parseInt(qiTotalInstallments) || 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}. taksit</option>)}</select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--color-text-variant)] font-mono uppercase mb-1 block">Kategori</label>
                      <select value={qiCategory} onChange={e => setQiCategory(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-amber-500/50 text-sm appearance-none"
                      >{CREDIT_CARD_CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-[#1a1c1e]">{CATEGORY_EMOJIS[cat]} {cat}</option>)}</select>
                    </div>
                  </div>
                  {cards.length > 0 && (
                    <select value={qiCardId} onChange={e => setQiCardId(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-amber-500/50 text-sm appearance-none"
                    >{cards.map(c => <option key={c.id} value={c.id}>💳 {c.name}{c.last_four ? ` (*${c.last_four})` : ''}</option>)}</select>
                  )}
                  {qiAmount && qiTotalInstallments && (
                    <div className="px-3 py-2.5 bg-amber-500/5 border border-amber-500/15 rounded-xl text-xs font-mono text-amber-300">
                      Aylık: {new Intl.NumberFormat('tr-TR').format(parseFloat(qiAmount) / parseInt(qiTotalInstallments))} ₺
                      · Kalan: {parseInt(qiTotalInstallments) - parseInt(qiCurrentInstallment) + 1} taksit
                      · Toplam kalan: {new Intl.NumberFormat('tr-TR').format((parseInt(qiTotalInstallments) - parseInt(qiCurrentInstallment) + 1) * parseFloat(qiAmount) / parseInt(qiTotalInstallments))} ₺
                    </div>
                  )}
                  <button type="submit" disabled={isQiSubmitting || !qiAmount || !qiTotalInstallments}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black rounded-xl py-3 font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                  >{isQiSubmitting ? <><Loader2 size={14} className="animate-spin" /> Kaydediliyor…</> : <><Clock size={14} /> Taksiti Aktar</>}</button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Receipt Preview Modal ── */}
      <AnimatePresence>
        {previewReceiptUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setPreviewReceiptUrl(null)}
          >
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="relative max-w-lg w-full"
              onClick={e => e.stopPropagation()}
            >
              <img src={previewReceiptUrl} alt="Fiş" className="w-full rounded-2xl border border-white/10 shadow-2xl max-h-[80vh] object-contain bg-black" />
              <button onClick={() => setPreviewReceiptUrl(null)}
                className="absolute top-3 right-3 p-2 bg-black/70 rounded-xl text-white hover:bg-black/90"
              ><X size={18} /></button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Card Modal ── */}
      <AnimatePresence>
        {showCardModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowCardModal(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-[var(--color-surface-container)] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md border border-white/10 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-purple-500/15 border border-purple-500/20"><CreditCard size={16} className="text-purple-400" /></div>
                  <h3 className="font-bold text-white">Yeni Kart Ekle</h3>
                </div>
                <button onClick={() => setShowCardModal(false)} className="p-1.5 rounded-lg bg-white/5 text-[var(--color-text-variant)] hover:text-white hover:bg-white/10"><X size={16} /></button>
              </div>
              <div className="overflow-y-auto flex-1 p-5">
                <form onSubmit={handleAddCard} className="space-y-3">
                  <input type="text" required value={newCardName} onChange={e => setNewCardName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm"
                    placeholder="Kart adı (örn: Ziraat Bonus)" autoFocus
                  />
                  <input type="text" value={newCardBank} onChange={e => setNewCardBank(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm"
                    placeholder="Banka adı (opsiyonel)"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={newCardLastFour} onChange={e => setNewCardLastFour(e.target.value)} maxLength={4}
                      className="px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm font-mono"
                      placeholder="Son 4 hane"
                    />
                    <input type="number" required value={newCardPaymentDay} onChange={e => setNewCardPaymentDay(e.target.value)} min="1" max="31"
                      className="px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm"
                      placeholder="Ödeme günü"
                    />
                    <input type="number" value={newCardCutOffDay} onChange={e => setNewCardCutOffDay(e.target.value)} min="1" max="31"
                      className="px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm"
                      placeholder="Kesim günü (opsiyonel)"
                    />
                    <input type="number" value={newCardLimit} onChange={e => setNewCardLimit(e.target.value)} step="0.01"
                      className="px-3 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm font-mono"
                      placeholder="Limit (opsiyonel)"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--color-text-variant)] font-mono uppercase mb-1.5 block">Kart Rengi</label>
                    <div className="flex gap-2 flex-wrap">
                      {['#8b5cf6', '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#f97316'].map(color => (
                        <button key={color} type="button" onClick={() => setNewCardColor(color)}
                          className={`w-7 h-7 rounded-full border-2 transition-all ${newCardColor === color ? 'scale-110 border-white' : 'border-transparent hover:scale-105'}`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl py-3 font-bold hover:brightness-110 transition-all">Kartı Kaydet</button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Future Installments Calendar Modal ── */}
      <AnimatePresence>
        {showInstallmentsModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowInstallmentsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-[var(--color-surface-container)] rounded-3xl w-full max-w-lg border border-white/10 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/20"><Calendar size={16} className="text-purple-400" /></div>
                  <div>
                    <h3 className="font-bold text-white">Gelecek Taksit Takvimi</h3>
                    <p className="text-xs text-[var(--color-text-variant)]">Ay bazlı taksit yükleri</p>
                  </div>
                </div>
                <button onClick={() => setShowInstallmentsModal(false)} className="p-1.5 rounded-lg bg-white/5 text-[var(--color-text-variant)] hover:text-white hover:bg-white/10"><X size={16} /></button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-3">
                {futureMonthlyInstallments.length === 0 ? (
                  <div className="py-12 flex flex-col items-center gap-3 text-[var(--color-text-variant)]">
                    <Calendar size={32} className="opacity-20" />
                    <p className="text-sm">Gelecek taksit bulunamadı</p>
                  </div>
                ) : futureMonthlyInstallments.map(month => (
                  <div key={month.key} className="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                    <div className="px-4 py-3 flex items-center justify-between bg-white/[0.02] border-b border-white/5">
                      <span className="text-sm font-bold text-white capitalize">{month.label}</span>
                      <span className="font-black font-mono text-purple-400">{new Intl.NumberFormat('tr-TR').format(month.total)} ₺</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {month.items.map((item: any) => (
                        <div key={`${month.key}-${item.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                          <span className="text-base">{CATEGORY_EMOJIS[item.category] || '📦'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{item.merchant || item.category}</p>
                            <span className="text-[10px] text-purple-300 font-mono">{item.currentInstallmentNumber}/{item.installments}. taksit</span>
                          </div>
                          <span className="font-mono font-bold text-white text-sm">{new Intl.NumberFormat('tr-TR').format(item.monthlyAmount)} ₺</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ── History Modal ── */}
      <AnimatePresence>
        {showHistoryModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowHistoryModal(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-[var(--color-surface-container)] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-white/5"><History size={16} className="text-white" /></div>
                  <h3 className="font-bold text-white">Harcama Geçmişi</h3>
                </div>
                <button onClick={() => setShowHistoryModal(false)} className="p-1.5 rounded-lg bg-white/5 text-[var(--color-text-variant)] hover:text-white hover:bg-white/10"><X size={16} /></button>
              </div>
              <div className="flex flex-col flex-1 overflow-hidden p-0">
                {/* ── Category chips ── */}
                {sortedCategories.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto p-4 border-b border-white/5 scrollbar-hide shrink-0">
                    {sortedCategories.map(([cat, total]) => (
                      <button key={cat}
                        onClick={() => setSelectedFilter(selectedFilter === cat ? 'all' : cat)}
                        className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all text-xs font-medium ${
                          selectedFilter === cat ? 'bg-white/10 border-white/20 text-white' : 'border-white/8 text-[var(--color-text-variant)] hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span>{CATEGORY_EMOJIS[cat] || '📦'}</span>
                        <span>{cat}</span>
                        <span className="font-mono opacity-60">{new Intl.NumberFormat('tr-TR', { notation: 'compact' }).format(total as number)}₺</span>
                      </button>
                    ))}
                    {selectedFilter !== 'all' && (
                      <button onClick={() => setSelectedFilter('all')}
                        className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-[var(--color-brand-tertiary)] hover:bg-white/5 transition-all"
                      ><X size={11} /> Tümü</button>
                    )}
                  </div>
                )}
                <div className="px-4 py-2 border-b border-white/5 bg-black/20 flex justify-between items-center text-xs text-[var(--color-text-variant)] font-mono shrink-0">
                   <span>{filteredExpenses.length} kayıt bulunuyor</span>
                   <span>Toplam: {new Intl.NumberFormat('tr-TR').format(filteredTotalExpenses)}₺</span>
                </div>
                {/* ── Expense history list ── */}
                <div className="overflow-y-auto flex-1">
                  {loading ? (
                    <div className="py-12 flex items-center justify-center gap-3 text-[var(--color-text-variant)] text-sm">
                      <Loader2 size={18} className="animate-spin text-purple-400" /> Yükleniyor…
                    </div>
                  ) : filteredExpenses.length === 0 ? (
                    <div className="py-10 flex flex-col items-center gap-3 text-[var(--color-text-variant)]">
                      <CreditCard size={28} className="opacity-20" />
                      <p className="text-sm">Henüz harcama yok</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-white/5">
                      {filteredExpenses.map(expense => (
                        <li key={expense.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors group"
                        >
                          <div className="p-2 rounded-xl shrink-0 text-base"
                            style={{ backgroundColor: `${CATEGORY_COLORS[expense.category] || '#94a3b8'}15` }}
                          >{CATEGORY_EMOJIS[expense.category] || '📦'}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-semibold text-white text-sm">{expense.merchant || expense.category}</p>
                              {expense.installments > 1 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/10 font-bold">{expense.installments}T</span>
                              )}
                              {expense.is_exempt && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/40 font-black uppercase">MUAF</span>}
                              {expense.receipt_url && (
                                <button onClick={() => setPreviewReceiptUrl(expense.receipt_url)}
                                  className="p-0.5 rounded hover:bg-white/10 transition-colors"
                                ><Eye size={12} className="text-cyan-400" /></button>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-variant)] mt-0.5 font-mono">
                              <span>{expense.date}</span>
                              {expense.card_name && <><span className="opacity-30">·</span><span>{expense.card_name}</span></>}
                              {expense.merchant && expense.category && <span style={{ color: CATEGORY_COLORS[expense.category] }}>{expense.category}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-black font-mono text-white text-base">-{new Intl.NumberFormat('tr-TR').format(expense.amount)}<span className="text-[var(--color-brand-tertiary)] text-sm">₺</span></span>
                            <button onClick={async () => {
                                if (confirm(`Silmek istediğinize emin misiniz?`)) {
                                  const { error } = await deleteExpense(expense.id);
                                  if (error) toast.error("Hata oluştu");
                                }
                              }}
                              className="p-1.5 text-red-400/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            ><Trash2 size={14} /></button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Quick Installment Modal ── */}
      <AnimatePresence>
        {showQuickInstallModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowQuickInstallModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-[var(--color-surface-container)] rounded-3xl w-full max-w-sm border border-white/10 shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/20"><TrendingUp size={16} className="text-purple-400" /></div>
                  <div>
                    <h3 className="font-bold text-white">Mevcut Taksit Ekle</h3>
                    <p className="text-xs text-[var(--color-text-variant)]">Önceden kalma taksitler</p>
                  </div>
                </div>
                <button onClick={() => setShowQuickInstallModal(false)} className="p-1.5 rounded-lg bg-white/5 text-[var(--color-text-variant)] hover:text-white hover:bg-white/10"><X size={16} /></button>
              </div>
              <form onSubmit={async e => {
                e.preventDefault();
                setIsQiSubmitting(true);
                if (!qiCardId || !qiAmount || !qiCurrentInstallment || !qiTotalInstallments || !qiMerchant) {
                  setIsQiSubmitting(false);
                  return toast.error("Lütfen tüm alanları doldurun.");
                }
                const totalM = parseInt(qiTotalInstallments);
                const currentM = parseInt(qiCurrentInstallment);
                const amt = parseFloat(qiAmount);
                if (totalM < currentM || amt <= 0) {
                  setIsQiSubmitting(false);
                  return toast.error("Geçersiz taksit veya tutar");
                }
                const totalAmount = amt * totalM;
                
                // Calculate historical start date
                const now = new Date();
                const pastMonths = currentM - 1;
                now.setMonth(now.getMonth() - pastMonths);
                
                const yyyy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                
                const { error } = await addExpense({
                  card_id: qiCardId,
                  amount: totalAmount,
                  category: qiCategory,
                  merchant: qiMerchant,
                  date: `${yyyy}-${mm}-${dd}`,
                  installments: totalM,
                  is_exempt: false,
                  description: 'Hızlı eklenen geçmiş taksit'
                });
                setIsQiSubmitting(false);
                if (error) toast.error("Eklenemedi");
                else {
                  toast.success("Taksit eklendi");
                  setShowQuickInstallModal(false);
                  setQiMerchant(''); setQiAmount(''); setQiTotalInstallments('12'); setQiCurrentInstallment('1');
                }
              }} className="p-5 space-y-4">
                <div className="space-y-3">
                  <input type="text" required value={qiMerchant} onChange={e => setQiMerchant(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm"
                    placeholder="Mağaza veya Alışveriş Adı"
                  />
                  <div className="relative">
                    <label className="text-[10px] text-[var(--color-text-variant)] absolute -top-2 left-3 bg-[var(--color-surface-container)] px-1">Aylık Tutar</label>
                    <input type="number" required value={qiAmount} onChange={e => setQiAmount(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm"
                      placeholder="0.00" step="0.01"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <label className="text-[10px] text-[var(--color-text-variant)] absolute -top-2 left-3 bg-[var(--color-surface-container)] px-1">Toplam Taksit</label>
                      <input type="number" required value={qiTotalInstallments} onChange={e => setQiTotalInstallments(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm"
                        placeholder="Örn: 12" min="2" max="36"
                      />
                    </div>
                    <div className="relative">
                      <label className="text-[10px] text-[var(--color-text-variant)] absolute -top-2 left-3 bg-[var(--color-surface-container)] px-1">Şu An Kaçıncı</label>
                      <input type="number" required value={qiCurrentInstallment} onChange={e => setQiCurrentInstallment(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm"
                        placeholder="Örn: 3" min="1" max="36"
                      />
                    </div>
                  </div>
                  <select required value={qiCategory} onChange={e => setQiCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm appearance-none"
                  >
                    {CREDIT_CARD_CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-[#1a1c1e]">{CATEGORY_EMOJIS[cat]} {cat}</option>)}
                  </select>
                  <select required value={qiCardId} onChange={e => setQiCardId(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-purple-500/50 text-sm appearance-none"
                  >
                    <option value="" disabled>Kart Seçiniz...</option>
                    {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <button type="submit" disabled={isQiSubmitting} className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl py-3 font-bold hover:brightness-110 transition-all text-sm disabled:opacity-50">
                  {isQiSubmitting ? 'Ekleniyor...' : 'Taksiti Ekle'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
