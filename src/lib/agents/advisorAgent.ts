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
      const recentTransactions = transactions.slice(0, 30);
      
      // Expense categories summary
      const expenseSummary = recentTransactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + t.amount;
          return acc;
        }, {} as Record<string, number>);

      const totalIncome = recentTransactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
      const totalExpense = recentTransactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);

      let contextBlock = '';
      if (snapshot) {
        contextBlock = `
# Genel Finansal Durum
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
Türkiye ekonomi koşullarını (yüksek enflasyon, mevduat faizleri, altın/döviz fırsatları) göz önünde bulundur.
Markdown formatı kullan. Maksimum 6 madde. Her madde kısa ve uygulanabilir olsun.

${contextBlock}

# Bu Ayın Özeti
- Toplam Gelir: ${totalIncome.toLocaleString('tr-TR')} ₺
- Toplam Gider: ${totalExpense.toLocaleString('tr-TR')} ₺
- Net: ${(totalIncome - totalExpense).toLocaleString('tr-TR')} ₺
- Tasarruf Oranı: %${totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(0) : '0'}

# Harcama Kategorileri
${Object.entries(expenseSummary).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v.toLocaleString('tr-TR')} ₺`).join('\n')}

# Bütçe Limitleri
${budgets.length > 0 ? budgets.map(b => `- ${b.category}: Limit ${b.limit_amount.toLocaleString('tr-TR')} ₺`).join('\n') : 'Henüz bütçe belirlenmemiş.'}

# Hedefler
${goals.length > 0 ? goals.map(g => `- ${g.name}: ${g.current_amount.toLocaleString('tr-TR')} / ${g.target_amount.toLocaleString('tr-TR')} ₺`).join('\n') : 'Henüz hedef belirlenmemiş.'}

Cevabını "## 📊 Finansal Analiz Raporu" başlığıyla başlat.
`.trim();

      const content = await groqChat([
        { role: 'system', content: 'Sen Türkiye\'de yaşayan bir kullanıcıya yardım eden profesyonel bir kişisel finans danışmanısın. Kısa, net ve uygulanabilir tavsiyeler verirsin.' },
        { role: 'user', content: prompt }
      ]);

      return content;
    } catch (error) {
      console.error('Advisor Agent Error:', error);
      const errMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
      throw new Error(`AI analizi sırasında hata: ${errMsg}`);
    }
  }
};
