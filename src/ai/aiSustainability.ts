export type SustainabilityMetrics = {
  energyKwh?: number;
  cleanedRooms?: number;
  totalRooms?: number;
};

export function calculateSustainabilityScore(metrics: SustainabilityMetrics): number {
  const { energyKwh = 280, cleanedRooms = 20, totalRooms = 30 } = metrics;
  const cleaningRatio = totalRooms ? cleanedRooms / totalRooms : 0.66;
  const energyFactor = Math.max(0, 1 - (energyKwh - 250) / 200);
  const score = Math.round((0.5 * cleaningRatio + 0.5 * energyFactor) * 100);
  return Math.min(100, Math.max(0, score));
}