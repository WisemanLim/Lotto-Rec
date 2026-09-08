// 숫자 표시 규칙: p-value 는 <0.001 이면 지수표기, 그 외 소수 3자리.
export function fmtP(p: number | null | undefined): string {
  if (p == null || Number.isNaN(p)) return '—';
  if (p === 0) return '<1e-6';
  if (p < 0.001) return p.toExponential(2);
  return p.toFixed(3);
}

export function fmtNum(x: number | null | undefined, digits = 2): string {
  if (x == null || Number.isNaN(x)) return '—';
  if (Number.isInteger(x) && digits <= 2) return x.toLocaleString('ko-KR');
  return x.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtInt(x: number | null | undefined): string {
  if (x == null || Number.isNaN(x)) return '—';
  return Math.round(x).toLocaleString('ko-KR');
}

export function fmtPct(x: number | null | undefined, digits = 1): string {
  if (x == null || Number.isNaN(x)) return '—';
  return `${(x * 100).toFixed(digits)}%`;
}

export function fmtWon(x: number | null | undefined): string {
  if (x == null) return '—';
  return `${Math.round(x).toLocaleString('ko-KR')}원`;
}

export function fmtSigned(x: number | null | undefined, digits = 2): string {
  if (x == null || Number.isNaN(x)) return '—';
  const s = x.toFixed(digits);
  return x > 0 ? `+${s}` : s;
}

// ── 표시 시간대 (PRD §10 LOTTO_TIMEZONE) — 기본 VITE_TIMEZONE(.env.local) → /config.timezone 으로 갱신 ──
let DISPLAY_TZ: string = (import.meta.env.VITE_TIMEZONE as string | undefined) || 'Asia/Seoul';

export function setDisplayTimeZone(tz: string | null | undefined): void {
  if (!tz) return;
  try {
    Intl.DateTimeFormat('ko-KR', { timeZone: tz });
    DISPLAY_TZ = tz;
  } catch {
    /* 잘못된 IANA 이름은 무시 */
  }
}
export function displayTimeZone(): string {
  return DISPLAY_TZ;
}
/** 시간대 약칭 + UTC 오프셋 (예: "KST (UTC+9)"). */
export function displayTimeZoneLabel(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: DISPLAY_TZ, timeZoneName: 'short' }).formatToParts(now);
  const abbr = parts.find((p) => p.type === 'timeZoneName')?.value ?? DISPLAY_TZ;
  const off = new Intl.DateTimeFormat('en-US', { timeZone: DISPLAY_TZ, timeZoneName: 'longOffset' }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value ?? '';
  const kst = DISPLAY_TZ === 'Asia/Seoul' ? 'KST' : abbr;
  return `${kst} (${off.replace('GMT', 'UTC').replace(':00', '').replace(/^UTC([+-])0(\d)$/, 'UTC$1$2')})`;
}

/** 백엔드 ISO(UTC, 오프셋 포함) → 표시 시간대. 오프셋이 없는 문자열은 UTC 로 간주(SQLite 가 tz 를 버리는 경우 대비). */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/i.test(iso);
  const d = new Date(hasOffset ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: DISPLAY_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('year')}. ${g('month')}. ${g('day')}. ${g('hour')}:${g('minute')}:${g('second')}`;
}

export function fmtCI(ci: [number, number] | number[] | null | undefined, digits = 3): string {
  if (!ci || ci.length < 2) return '—';
  return `[${ci[0].toFixed(digits)}, ${ci[1].toFixed(digits)}]`;
}

/** 파라미터 dict → "beta=1.036 · window=516" */
export function fmtParams(p: Record<string, number> | null | undefined): string {
  if (!p || Object.keys(p).length === 0) return '기본(파라미터 없음)';
  return Object.entries(p)
    .map(([k, v]) => `${k}=${Number.isInteger(v) ? v : Number(v).toFixed(3)}`)
    .join(' · ');
}
