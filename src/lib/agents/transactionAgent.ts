import { groq, DEFAULT_MODEL } from './groq';
import { TransactionType } from '../../types';

export interface ParsedTransaction {
  amount: number;
  category: string;
  type: TransactionType;
  description: string;
}

export const transactionAgent = {
  /**
   * Parses a natural language sentence into a structured transaction.
   * Örneğin: "Bimden 500 liraya market alışverişi yaptım"
   */
  parseText: async (text: string): Promise<ParsedTransaction | null> => {
    try {
      const prompt = `
Sen bir finansal asistan alt-ajanısın (subagent). 
Kullanıcının girdiği şu metni analiz et ve bunun "harcama" (expense) mi "gelir" (income) mi olduğunu, miktarını, kategorisini ve kısa açıklamasını JSON formatında döndür.
Sadece geçerli bir JSON çıktısı ver, etrafına markdown veya backtick ekleme.

Kategoriler (Önerilen): Yemek, Market, Ulaşım, Fatura, Eğlence, Sağlık, Eğitim, Giyim, Maaş, Diğer.

Kullanıcı Metni: "${text}"

Beklenen JSON Şeması:
{
  "type": "expense" veya "income",
  "amount": sayı (sadece rakam, örn 500),
  "category": "kategori ismi",
  "description": "kısa bir özet/açıklama"
}
      `.trim();

      const response = await groq.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      const responseText = response.choices[0]?.message?.content || "{}";
      const parsedData = JSON.parse(responseText);

      return {
        amount: Number(parsedData.amount) || 0,
        category: parsedData.category || 'Diğer',
        type: (parsedData.type === 'income' || parsedData.type === 'expense') ? parsedData.type : 'expense',
        description: parsedData.description || text,
      };
    } catch (error) {
      console.error('Agent Transaction Parsing Error:', error);
      return null;
    }
  }
};
