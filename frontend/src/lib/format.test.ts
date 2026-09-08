import { displayTimeZone, displayTimeZoneLabel, fmtDate, setDisplayTimeZone } from './format';

test('fmtDate: UTC ISO → 표시 시간대(Asia/Seoul, +9h); 오프셋 없는 문자열은 UTC 로 간주', () => {
  setDisplayTimeZone('Asia/Seoul');
  expect(displayTimeZone()).toBe('Asia/Seoul');
  expect(fmtDate('2026-09-08T06:02:55+00:00')).toBe('2026. 9. 8. 15:02:55');
  expect(fmtDate('2026-09-08T06:02:55Z')).toBe('2026. 9. 8. 15:02:55');
  expect(fmtDate('2026-09-08T06:02:55.356324')).toBe('2026. 9. 8. 15:02:55'); // naive → UTC
  expect(fmtDate(null)).toBe('—');
  expect(displayTimeZoneLabel()).toMatch(/KST \(UTC\+0?9\)/);
});

test('setDisplayTimeZone: 유효하지 않은 IANA 는 무시, 다른 시간대는 반영', () => {
  setDisplayTimeZone('Not/AZone');
  expect(displayTimeZone()).toBe('Asia/Seoul');
  setDisplayTimeZone('UTC');
  expect(fmtDate('2026-09-08T06:02:55Z')).toBe('2026. 9. 8. 06:02:55');
  setDisplayTimeZone('Asia/Seoul');
});
