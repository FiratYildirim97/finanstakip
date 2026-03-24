import { groq, DEFAULT_MODEL } from './groq';
import { Transaction, Budget, Goal } from '../../types';

export const advisorAgent = {
  /**
   * Generates financial advice based on a user's transactions, budgets, and goals.
   */
  getAdvice: async (
    transactions: Transaction[],
    budgets: Budget[],
    goals: Goal[]
  ): Promise<string> => {
    try {
      const recentTransactions = transactions.slice(0, 50); // limit to avoid massive context
      
      const prompt = `
Olarak sen bir "Kişisel Finans Danışmanı Alt-Ajanısın" (Subagent).
Aşağıdaki kullanıcı verilerine bakarak Türkiye şartlarına uygun, kısa, motive edici ve yapıcı bir finansal tavsiye listesi sun.
Bütçeleri aşan kategoriler varsa uyar, hedeflere giden yolda iyi ilerleniyorsa tebrik et.
Çok uzun laf kalabalığı yapma, direkt nokta atışı ve uygulanabilir maddeler halinde olsun. Markdown kullanabilirsin.

# Son İşlemler (Sadece Özet veya İlk 50 Kayıt)
${JSON.stringify(recentTransactions.map(t => ({ tip: t.type, miktar: t.amount, kategori: t.category, tarih: t.date })))}

# Aktif Bütçeler (Aylık)
${JSON.stringify(budgets)}

# Kullanıcı Hedefleri
${JSON.stringify(goals)}

Cevabını sadece Türkçe ve "Tavsiye:" veya "# Finansal Analizin" gibi bir başlıkla başlat. Maksimum 5 madde.
      `.trim();

      const response = await groq.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: prompt }]
      });

      return response.choices[0]?.message?.content || "Şu an finansal tavsiye oluşturulamadı. Lütfen tekrar deneyin.";
    } catch (error) {
      console.error('Agent Advisor Error:', error);
      return "Üzgünüm, şu an finansal verilerinizi analiz ederken bir sorun oluştu.";
    }
  }
};
