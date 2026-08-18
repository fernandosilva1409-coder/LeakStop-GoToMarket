// Shared CSV helpers for the /dashboard/* import flows (menu, purchases, sales).

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Accepts ISO ("2026-08-01") as-is; converts common spreadsheet-export
// formats ("01/08/2026", "01-08-2026", day/month order) to ISO so they don't
// silently fail the Postgres `date` column on insert. Returns null if the
// value can't be read as a real date.
export function normalizeCsvDate(value) {
  const s = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const match = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    const d = Number(day), m = Number(month);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
}

export function downloadCsvTemplate(filename, header, rows) {
  const csv = [header, ...rows].map((cols) => cols.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
