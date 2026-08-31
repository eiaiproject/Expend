const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const fmtIDR = (n: number) => IDR.format(n);
export const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
export const todayISO = () => new Date().toISOString().slice(0, 10);
