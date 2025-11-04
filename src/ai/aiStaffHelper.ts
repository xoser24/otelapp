import { Staff } from '../utils/staff';
import type { StaffEvent } from '../utils/staffEvents';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const endpoint = 'https://api.openai.com/v1/chat/completions';

function getApiKey(): string | undefined {
  // Prefer environment variable, fallback to localStorage for demo usage
  const env = (process.env.REACT_APP_OPENAI_API_KEY || '').trim();
  if (env) return env;
  try { const k = localStorage.getItem('openai_api_key') || ''; return k.trim() || undefined; } catch { return undefined; }
}

function buildPrompt(staff: Staff, events: StaffEvent[], extras?: { monthlyAdvance?: number; leaveUsed?: number }): string {
  const monthlyAdvance = extras?.monthlyAdvance ?? 0;
  const leaveUsed = extras?.leaveUsed ?? (events.filter(e=>e.type==='leave').reduce((s,e)=> s + (Number(e.amount)||1), 0));
  const advTotal = events.filter(e=>e.type==='advance').reduce((s,e)=> s + (Number(e.amount)||0), 0);
  const baseSalary = Number(staff.baseSalary || 0);
  const dep = staff.department;
  const pos = staff.position || '—';
  const status = staff.status || 'active';
  const start = staff.startDate || '—';
  return `Personel: ${staff.name} (${dep} • ${pos}, durum: ${status}). Maaş: ${baseSalary} TL. Bu ay avans: ${monthlyAdvance} TL, toplam avans: ${advTotal} TL. Kullanılan izin gün sayısı: ${leaveUsed}. Başlangıç tarihi: ${start}. Bu personele kısa performans değerlendirmesi ve 2-3 maddelik somut öneri ver.`;
}

export async function analyzeStaffLLM(staff: Staff, events: StaffEvent[], options?: { monthlyAdvance?: number; leaveUsed?: number; userPrompt?: string }): Promise<string> {
  const apiKey = getApiKey();
  const prompt = options?.userPrompt || buildPrompt(staff, events, { monthlyAdvance: options?.monthlyAdvance, leaveUsed: options?.leaveUsed });

  if (!apiKey) {
    // Fallback: no key → return a simple heuristic suggestion so UI stays responsive
    const base = Number(staff.baseSalary || 0);
    const monthAdv = Number(options?.monthlyAdvance || 0);
    const leave = Number(options?.leaveUsed || 0);
    const tips: string[] = [];
    if (monthAdv > (base * 0.4)) tips.push('Avans kullanımı yüksek; limit ve ödeme planı gözden geçirilmeli.');
    if (leave >= 3) tips.push('İzin kullanımı yoğun; vardiya dengelemesi planlanmalı.');
    if (!tips.length) tips.push('Performans dengeli görünüyor; haftalık görev hedefleri netleştirilebilir.');
    return `Anahtar bulunamadı (demo modu). Kısa değerlendirme: Maaş ${base} TL, ay avansı ${monthAdv} TL, izin ${leave} gün. Öneriler: ${tips.join(' ')}`;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: 'Sen bir insan kaynakları asistanısın. Verilen personel verilerini analiz edip kısa, somut öneriler üretirsin.' },
    { role: 'user', content: prompt },
  ];

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages,
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI API error: ${res.status} ${text}`);
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content || 'Yanıt alınamadı.';
    return content.toString();
  } catch (err: any) {
    return `Asistan çağrısında hata: ${err?.message || 'bilinmeyen hata'}. Lütfen anahtarı ve ağ bağlantısını kontrol edin.`;
  }
}