export const formatINR = (n: number) => {
  if (n == null || isNaN(n)) return '₹0';
  const s = Math.round(n * 100) / 100;
  const parts = s.toString().split('.');
  const intPart = parts[0];
  const lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const formatted = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree : lastThree;
  return '₹' + formatted + (parts[1] ? '.' + parts[1] : '');
};

export const formatINRShort = (n: number) => {
  if (n == null || isNaN(n)) return '₹0';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};
