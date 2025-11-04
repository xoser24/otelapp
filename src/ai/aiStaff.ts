import { DailyScore, Staff, StaffLog } from '../utils/staff';

export type StaffAIInsight = {
  anomalies: string[];
  forecasts: string[];
  summary: string;
};

// Basit, kurallı analiz: dış servislere bağlanmaz.
export const analyzeStaff = (staff: Staff, logs: StaffLog[], scores: DailyScore[]): StaffAIInsight => {
  const anomalies: string[] = [];
  const forecasts: string[] = [];

  // Trend hesapları (son 7 güne bak)
  const last7 = scores.slice(-7);
  const avg = (arr:number[]) => (arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0);
  const compAvg = Math.round(avg(last7.map(s => s.completionRate)));
  const satAvg = Math.round(avg(last7.map(s => s.satisfaction)));
  const puntAvg = Math.round(avg(last7.map(s => s.punctuality)));
  const totalAvg = Math.round(avg(last7.map(s => s.total)));
  const complaints7 = logs.slice(-7).reduce((a,l)=>a+(l.complaints||0),0);
  const thanks7 = logs.slice(-7).reduce((a,l)=>a+(l.thanks||0),0);
  const lateDays = last7.filter(s => (s.details.checkInDiffMin||0) > 5).length;

  if (compAvg < 65) anomalies.push(`${staff.department} görev tamamlama oranı son hafta düşük (${compAvg}%).`);
  if (puntAvg < 80) anomalies.push(`Giriş/çıkış dakik farkı yüksek: dakiklik ortalaması ${puntAvg}.`);
  if (complaints7 >= 3) anomalies.push(`Şikayet sayısı yükseldi (7 günde ${complaints7}).`);
  if (lateDays >= 3) anomalies.push(`Son 7 günde ${lateDays} kez geç giriş.`);

  // Basit öngörü: toplam skor ve şikayet/teşekkür trendine göre
  if (totalAvg < 70) forecasts.push('Önümüzdeki hafta performans düşebilir, görev dağılımını dengeleyin.');
  if (thanks7 === 0 && complaints7 > 0) forecasts.push('Müşteri memnuniyeti için danışma/sunum iyileştirmeleri önerilir.');
  if (compAvg > 80 && puntAvg > 90) forecasts.push('Yüksek güvenilirlik; yoğun günlerde sorumluluk artışı kaldırabilir.');

  const summary = `Son 7 gün özeti → Tamamlama ${compAvg}%, Memnuniyet ${satAvg}, Dakiklik ${puntAvg}, Genel ${totalAvg}. Şikayet: ${complaints7}, Teşekkür: ${thanks7}.`;
  return { anomalies, forecasts, summary };
};