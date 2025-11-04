type Report = {
  dateISO: string;
  energyKwh: number;
  waterLiters: number;
  wasteKg: number;
  fuelKg: number;
  fuelType?: 'coal' | 'pellet' | 'wood' | 'gas' | 'hazelnut';
  renewableProductionKwh?: number; // kWh
  fuelCostPerKg?: number;
  fuelSupplier?: string;
  renewablePercent?: number; // %
  recyclingPercent?: number; // %
  organicWasteKg?: number; // kg
  plasticReductionPercent?: number; // %
  occupancy: number;
  guests: number;
  co2Ton: number;
  score: number;
  notes?: string;
};

// Helper: NotoSans yükle ve güvenli font seçimi
async function ensureNotoSans(doc: any) {
  const toBase64 = (buf: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buf);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };
  try {
    const regularRes = await fetch('/fonts/NotoSans-Regular.ttf');
    const boldRes = await fetch('/fonts/NotoSans-Bold.ttf');
    if (regularRes.ok && boldRes.ok) {
      const regularBuf = await regularRes.arrayBuffer();
      const boldBuf = await boldRes.arrayBuffer();
      doc.addFileToVFS('NotoSans-Regular.ttf', toBase64(regularBuf));
      doc.addFileToVFS('NotoSans-Bold.ttf', toBase64(boldBuf));
      doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
      doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
    }
  } catch {
    // yoksa varsayılan fonta düşer
  }
}
function setSafeFont(doc: any, style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal') {
  try { doc.setFont('NotoSans', style); } catch { try { doc.setFont('helvetica', style); } catch {} }
}

export async function generateSustainabilityPDF(report: Report) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await ensureNotoSans(doc);
  setSafeFont(doc, 'bold');
  doc.setFontSize(14);
  doc.text('Kent Otel – Sürdürülebilirlik Günlük Raporu', 15, 18);
  setSafeFont(doc, 'normal');
  doc.setFontSize(10);
  doc.text(`Tarih: ${report.dateISO}`, 15, 26);

  const fuelLabelByType = (t: Report['fuelType'] | undefined) => {
    switch (t) {
      case 'pellet': return 'Pelet';
      case 'wood': return 'Odun';
      case 'gas': return 'Doğal Gaz';
      case 'hazelnut': return 'Fındık Kabuğu';
      case 'coal':
      default: return 'Kömür';
    }
  };

  // Özet kartları gibi metrikler
  autoTable(doc, {
    startY: 32,
    head: [['Metric', 'Value']],
    body: [
      ['Enerji (kWh)', String(report.energyKwh)],
      ['Yenilenebilir Üretim (kWh)', String(report.renewableProductionKwh ?? '-')],
      ['Yenilenebilir (%)', String(report.renewablePercent ?? '-')],
      ['Su (L)', String(report.waterLiters)],
      ['Atık (kg)', String(report.wasteKg)],
      ['Geri Dönüşüm (%)', String(report.recyclingPercent ?? '-')],
      ['Organik Atık (kg)', String(report.organicWasteKg ?? '-')],
      ['Plastik Azaltımı (%)', String(report.plasticReductionPercent ?? '-')],
      ['Yakıt Tipi', String(fuelLabelByType(report.fuelType))],
      ['Katı Yakıt (kg)', String(report.fuelKg)],
      ['Yakıt Maliyeti (₺/kg)', String(report.fuelCostPerKg ?? '-')],
      ['Tedarikçi', String(report.fuelSupplier ?? '-')],
      ['Doluluk (%)', String(report.occupancy)],
      ['Misafir', String(report.guests)],
      ['CO2 (ton)', String(report.co2Ton)],
      ['Skor (%)', String(report.score)],
    ],
    styles: { fontSize: 9 },
    headStyles: { fontStyle: 'bold' },
    theme: 'grid',
  });

  const y = (doc as any).lastAutoTable?.finalY || 32;
  doc.setFontSize(10);
  doc.text('Notlar', 15, y + 10);
  doc.setFontSize(9);
  const notes = report.notes || '-';
  const split = doc.splitTextToSize(notes, 180);
  doc.text(split, 15, y + 16);

  const fileName = `sustainability_${report.dateISO}.pdf`;
  doc.save(fileName);
}