# 결과 — impl 22nd: 용어 툴팁 내용이 박스를 벗어남 (PRD v1.10.1) — 2026-09-14

## 시도 1 — PASS 3/3

| id | 판정 | 근거 |
|---|---|---|
| 22-1 | PASS (원인 확정) | `DataTable.tsx` th(115행)/td(144행) `whitespace-nowrap` → 자식 툴팁 span 이 상속. 툴팁은 폭 `w-80` 고정이나 nowrap 이라 텍스트가 줄바꿈 없이 박스 밖으로 흘러감(스크린샷과 일치) |
| 22-2 | PASS | `Term.tsx` 툴팁에 `whitespace-normal break-words tracking-normal max-w-[calc(100vw-2rem)]` 추가. 높이는 원래 auto — 줄바꿈이 살아나면 세로로 자동 확장 |
| 22-3 | PASS | `Term.test.tsx` 신규 테스트: nowrap th 안에서 열린 tooltip 에 `whitespace-normal`·`break-words`·`max-w-[calc(100vw-2rem)]` 존재. vitest 40/40, eslint/tsc clean |

## 변경 파일
- frontend `components/Term.tsx`, `components/Term.test.tsx`
- docs `.docs/PRD.md` v1.10.1(변경 이력), `README.md`/`README.en.md`(테스트 표·트러블슈팅)

## 비고
- Vite HMR 로 라이브 반영(재기동 불필요). 다른 `nowrap` 컨테이너(KpiCard 등)에서도 동일하게 보호됨.
