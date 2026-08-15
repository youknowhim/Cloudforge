const UNITS = ["B", "KB", "MB", "GB", "TB"];

export const formatBytes = (bytes: number): string => {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const exp = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    UNITS.length - 1
  );

  const scaled = value / 1024 ** exp;

  /* whole numbers for bytes/KB, one decimal beyond that */
  const digits = exp === 0 ? 0 : scaled >= 10 || exp === 1 ? 0 : 1;

  return `${scaled.toFixed(digits)} ${UNITS[exp]}`;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const formatRelative = (value?: string): string => {
  if (!value) return "—";

  const time = new Date(value).getTime();

  if (Number.isNaN(time)) return "—";

  const diff = Date.now() - time;

  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;

  return new Date(time).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(new Date(time).getFullYear() === new Date().getFullYear()
      ? {}
      : { year: "numeric" }),
  });
};

export const formatDateTime = (value?: string): string => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const initialsOf = (name?: string, fallback = "?"): string => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return fallback;

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/* strips the extension so an uploaded file suggests a sane title */
export const baseName = (fileName: string): string =>
  fileName.replace(/\.[^./\\]+$/, "");
