export function calculateEmi(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRate / 12 / 100;
  if (r === 0) return Math.round(principal / months);
  const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  return Math.round(emi);
}

export function generateCaseId(): string {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `CASE-${num}`;
}

export function generateOrderId(): string {
  const num = Math.floor(100000000 + Math.random() * 900000000);
  return `BD-${num}-IN`;
}

export function generateTrackingId(): string {
  const num = Math.floor(100000000 + Math.random() * 900000000);
  return `BD${num}`;
}

export type EmiStatus = 'PENDING' | 'REVIEW' | 'SANCTIONED' | 'ACTIVE' | 'COMPLETED' | 'REJECTED' | 'EXPIRED';

export const STATUS_COLORS: Record<string, string> = {
  PENDING: '#F59E0B',
  REVIEW: '#3B82F6',
  SANCTIONED: '#06B6D4',
  ACTIVE: '#10B981',
  COMPLETED: '#10B981',
  REJECTED: '#EF4444',
  EXPIRED: '#8B8BA7',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  CONFIRMED: '#3B82F6',
  DISPATCHED: '#06B6D4',
  IN_TRANSIT: '#7C3AED',
  OUT_FOR_DELIVERY: '#F59E0B',
  DELIVERED: '#10B981',
  CANCELLED: '#EF4444',
};

export function getCreditRating(score: number): { label: string; color: string } {
  if (score >= 750) return { label: 'Excellent', color: '#06B6D4' };
  if (score >= 650) return { label: 'Good', color: '#10B981' };
  if (score >= 550) return { label: 'Fair', color: '#F59E0B' };
  return { label: 'Poor', color: '#EF4444' };
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
