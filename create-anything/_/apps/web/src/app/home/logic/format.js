// apps/web/src/app/home/logic/format.js

export function pad2(n) {
  return String(Math.max(0, Math.trunc(Number(n) || 0))).padStart(2, "0");
}

export function fmtElapsed(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${pad2(r)}`;
}

export function fmtWhenShort(d) {
  try {
    const dt = d instanceof Date ? d : new Date(d);
    if (!dt || Number.isNaN(dt.getTime())) return "";
    const month = dt.toLocaleString("en-US", { month: "short" });
    const day = dt.getDate();
    const year = dt.getFullYear();
    const hh = pad2(dt.getHours());
    const mm = pad2(dt.getMinutes());
    return `${month} ${day}, ${year} ${hh}:${mm}`;
  } catch {
    return "";
  }
}

export function fmtRemainingHm(ms) {
  const v = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const totalMin = Math.floor(v / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  return `${h}h ${pad2(m)}m`;
}

export function centsToUsd(cents) {
  const n = Number(cents || 0);
  return Math.round(n) / 100;
}

export function fmtUsd(x) {
  const n = Number(x || 0);
  return `$${n.toFixed(2)}`;
}