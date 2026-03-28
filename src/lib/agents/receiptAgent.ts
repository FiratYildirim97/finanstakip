import { groq } from './groq';

export interface ParsedReceipt {
  amount: number;
  category: string;
  merchant: string;
  description: string;
  items: string[];
  installments: number;
}

const VISION_MODEL = 'llama-3.2-90b-vision-preview';

export const receiptAgent = {
  /**
   * Parses a receipt/dekont image using Groq Vision AI
   * Fotoğraftan (fiş, dekont) harcama bilgilerini çıkarır
   */
  parseImage: async (base64Image: string, mimeType: string = 'image/jpeg'): Promise<ParsedReceipt | null> => {
    try {
      const response = await groq.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Bu bir fiş veya dekont fotoğrafı. Lütfen aşağıdaki bilgileri çıkar ve JSON formatında döndür.
Sadece geçerli bir JSON çıktısı ver, etrafına markdown veya backtick ekleme.

Kategoriler: Market, Yemek, Giyim, Elektronik, Fatura, Sağlık, Ulaşım, Eğlence, Eğitim, Ev, Diğer.

Beklenen JSON Şeması:
{
  "amount": toplam tutar (sayı, TL olarak),
  "category": "uygun kategori",
  "merchant": "mağaza/işyeri adı",
  "description": "kısa bir özet",
  "items": ["ürün 1", "ürün 2"] (eğer okunabiliyorsa, en fazla 5 tane),
  "installments": taksit sayısı (eğer fişte belirtilmişse, yoksa 1)
}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1024,
      });

      const responseText = response.choices[0]?.message?.content || '{}';
      
      // Try parsing the JSON - handle potential markdown wrapping
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
      }
      
      const parsedData = JSON.parse(cleanJson);

      return {
        amount: Number(parsedData.amount) || 0,
        category: parsedData.category || 'Diğer',
        merchant: parsedData.merchant || '',
        description: parsedData.description || '',
        items: Array.isArray(parsedData.items) ? parsedData.items.slice(0, 5) : [],
        installments: Number(parsedData.installments) || 1,
      };
    } catch (error) {
      console.error('Receipt Vision Parsing Error:', error);
      return null;
    }
  },

  /**
   * Parses text input for credit card expenses
   * Metin girişinden kredi kartı harcama bilgilerini çıkarır
   */
  parseText: async (text: string): Promise<ParsedReceipt | null> => {
    try {
      const prompt = `
Sen bir finansal asistan alt-ajanısın (subagent). Kredi kartı harcamaları konusunda uzmanlaşmışsın.
Kullanıcının girdiği şu metni analiz et ve harcama bilgilerini JSON formatında döndür.
Sadece geçerli bir JSON çıktısı ver, etrafına markdown veya backtick ekleme.

Kategoriler: Market, Yemek, Giyim, Elektronik, Fatura, Sağlık, Ulaşım, Eğlence, Eğitim, Ev, Diğer.

ÖNEMLİ: Eğer kullanıcı "taksit" veya "taksitli" ifadesi kullanıyorsa, taksit sayısını belirle (örn: "3 taksit" -> installments: 3). Belirtilmemişse installments 1 olsun.

Kullanıcı Metni: "${text}"

Beklenen JSON Şeması:
{
  "amount": toplam tutar (sayı, toplam tutarı yaz, taksit başına değil),
  "category": "uygun kategori",
  "merchant": "mağaza/işyeri adı (eğer belirtilmişse)",
  "description": "kısa bir özet/açıklama",
  "items": [],
  "installments": taksit sayısı (sayı, varsayılan 1)
}
      `.trim();

      const response = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      const responseText = response.choices[0]?.message?.content || '{}';
      const parsedData = JSON.parse(responseText);

      return {
        amount: Number(parsedData.amount) || 0,
        category: parsedData.category || 'Diğer',
        merchant: parsedData.merchant || '',
        description: parsedData.description || text,
        items: Array.isArray(parsedData.items) ? parsedData.items : [],
        installments: Number(parsedData.installments) || 1,
      };
    } catch (error) {
      console.error('Receipt Text Parsing Error:', error);
      return null;
    }
  }
};
