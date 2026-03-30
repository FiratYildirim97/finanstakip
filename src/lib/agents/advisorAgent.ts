import { groqChat } from './groq';
import { Transaction, Budget, Goal } from '../../types';

interface FinancialSnapshot {
  currentMonthIncome: number;
  currentMonthExpense: number;
  totalBankValue: number;
  totalBankInterest: number;
  dailyInterestEarning: number;
  portfolioValue: number;
  savingsValue: number;
  recurringIncome: number;
  recurringExpense: number;
  netWorth: number;
}

export interface AIEOMInsight {
  projectedNet: number;
  advice: string;
  suggestion: string;
}

export const advisorAgent = {
  /**
   * Generates financial advice based on comprehensive user data
   */
  getAdvice: async (
    transactions: Transaction[],
    budgets: Budget[],
    goals: Goal[],
    snapshot?: FinancialSnapshot
  ): Promise<string> => {
    try {
      const recentTransactions = transactions.slice(0, 50);
      
      // Expense categories summary
      const expenseSummary = transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
          return acc;
        }, {} as Record<string, number>);

      const totalIncome = transactions.filter(t => t.type === 'income').reduce((a, b) => a + Number(b.amount), 0);
      const totalExpense = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + Number(b.amount), 0);

      let contextBlock = '';
      if (snapshot) {
        contextBlock = `
# 💰 Genel Finansal Durum
- Net Varlık: ${snapshot.netWorth.toLocaleString('tr-TR')} ₺
- Banka Hesapları Toplamı: ${snapshot.totalBankValue.toLocaleString('tr-TR')} ₺
- Birikmiş Faiz Geliri: ${snapshot.totalBankInterest.toLocaleString('tr-TR')} ₺
- Günlük Net Faiz Kazancı: ${snapshot.dailyInterestEarning.toLocaleString('tr-TR')} ₺
- Yatırım Portföyü: ${snapshot.portfolioValue.toLocaleString('tr-TR')} ₺
- Birikim/BES Toplamı: ${snapshot.savingsValue.toLocaleString('tr-TR')} ₺
- Sabit Aylık Gelir: ${snapshot.recurringIncome.toLocaleString('tr-TR')} ₺
- Sabit Aylık Gider: ${snapshot.recurringExpense.toLocaleString('tr-TR')} ₺
`;
      }

      const prompt = `
Sen bir Türk "Kişisel Finans Danışmanısın". Kullanıcının finansal verilerine bakarak kısa, motive edici ve pragmatik tavsiyeler ver.
Türkiye ekonomi koşullarını (yüksek enflasyon %40-60 aralığı, mevduat faizleri %45-55 aralığı, altın/döviz fırsatları) göz önünde bulundur.
Markdown formatı kullan. Maksimum 6 madde. Her madde kısa ve uygulanabilir olsun.

${contextBlock}

# 📈 Bu Ayın Özeti
- Toplam Gelir: ${totalIncome.toLocaleString('tr-TR')} ₺
- Toplam Gider: ${totalExpense.toLocaleString('tr-TR')} ₺
- Net: ${(totalIncome - totalExpense).toLocaleString('tr-TR')} ₺
- Tasarruf Oranı: %${totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(0) : '0'}

# 📂 En Çok Harcama Yapılan Kategoriler (Top 5)
${Object.entries(expenseSummary)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([k, v]) => `- ${k}: ${v.toLocaleString('tr-TR')} ₺`)
  .join('\n')}

# 🎯 Hedef İlerlemesi
${goals.length > 0 ? goals.slice(0,3).map(g => `- ${g.name}: ${g.current_amount.toLocaleString('tr-TR')} / ${g.target_amount.toLocaleString('tr-TR')} ₺`).join('\n') : 'Henüz hedef belirlenmemiş.'}

Yanıtını "## 📊 Finansal Strateji Raporu" başlığıyla başlat.
`.trim();

      const content = await groqChat([
        { role: 'system', content: 'Sen Türkiye\'de yaşayan bir kullanıcıya yardım eden profesyonel bir kişisel finans danışmanısın. Kısa, net ve uygulanabilir tavsiyeler verirsin.' },
        { role: 'user', content: prompt }
      ]);

      return content;
    } catch (error) {
      console.error('Advisor Agent Error:', error);
      throw new Error('AI analizi sırasında bir hata oluştu.');
    }
  },

  /**
   * Predicts the category based on description
   */
  suggestCategory: async (description: string, existingCategories: string[]): Promise<string | null> => {
    if (description.length < 3) return null;
    try {
      const prompt = `
Açıklamaya göre en uygun kategoriyi sadece tek bir kelime/öbek olarak döndür. 
Mevcut kategoriler: ${existingCategories.join(', ')}

Açıklama: "${description}"
Sadece kategori adını yaz. Hiçbir açıklama yapma.
`;
      const content = await groqChat([
        { role: 'system', content: 'Sen bir finansal veri sınıflandırma asistanısın.' },
        { role: 'user', content: prompt }
      ]);
      return content.trim();
    } catch (e) { return null; }
  },

  /**
   * Question & Answer Interface
   */
  askQuestion: async (question: string, snapshot: FinancialSnapshot): Promise<string> => {
    try {
      const prompt = `
Finansal verilerim hakkında şu soruyu soruyorum: "${question}"

Mevcut Durumum:
- Toplam Varlık: ${snapshot.netWorth.toLocaleString('tr-TR')} ₺
- Bu Ay Gelir: ${snapshot.currentMonthIncome.toLocaleString('tr-TR')} ₺
- Bu Ay Gider: ${snapshot.currentMonthExpense.toLocaleString('tr-TR')} ₺
- Portföy Değeri: ${snapshot.portfolioValue.toLocaleString('tr-TR')} ₺
- Banka Mevduatı: ${snapshot.totalBankValue.toLocaleString('tr-TR')} ₺
- Günlük Faiz Getirisi: ${snapshot.dailyInterestEarning.toLocaleString('tr-TR')} ₺

Sorumu samimi, kısa ve profesyonel bir dille cevapla. 
Yanıtın maksimum 120 kelime olsun. Markdown kullanabilirsin (kalın yazı vb).
`;
      return await groqChat([
        { role: 'system', content: 'Sen bir finansal asistansın. Kullanıcının verilerini analiz ederek sorularına cevap verirsin.' },
        { role: 'user', content: prompt }
      ]);
    } catch (e) { return "Üzgünüm, şu an soruna cevap veremiyorum."; }
  }
};
