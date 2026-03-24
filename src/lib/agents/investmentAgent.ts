import { groq, DEFAULT_MODEL } from './groq';
import { Investment, Asset } from '../../types';

export const investmentAgent = {
  /**
   * Generates investment advice based on a user's current portfolio.
   */
  analyzePortfolio: async (
    investments: Investment[],
    assets: Asset[]
  ): Promise<string> => {
    try {
      const prompt = `
Sen bir "Bireysel Portföy ve Yatırım Analisti Alt-Ajanısın" (Subagent).

Kullanıcının aşağıdaki Yatırımları ve Varlıkları ışığında mevcut portföy riskini değerlendir, çeşitlendirme tavsiyesi ver. 
Sadece var olan verilere dayanarak yüzeysel, güvenli, YATIRIM TAVSİYESİ OLMAYAN (financial disclaimer ile birlikte) bilgiler sun. Lütfen kısa (maksimum 4-5 cümle) ver.

## Kullanıcının Yatırımları
${JSON.stringify(investments)}

## Kullanıcının Sabit Varlıkları
${JSON.stringify(assets)}

Cevabını doğrudan ver, boş laf kalabalığı yapma. Türkçe dilinde yanıtla. 
Başına veya sonuna her zaman: "Uyarı: Bu bir yatırım tavsiyesi değildir." ekle.
      `.trim();

      const response = await groq.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: prompt }]
      });

      return response.choices[0]?.message?.content || "Şu an portföyünüz için bir analiz oluşturulamadı.";
    } catch (error) {
      console.error('Agent Investment Error:', error);
      return "Üzgünüm, şu an yatırım verilerinizi analiz ederken bir sorun oluştu.";
    }
  }
};
