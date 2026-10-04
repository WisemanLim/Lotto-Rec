# COMPLIANCE — 정보통신·SaaS (ICT / SaaS — 기본 베이스라인) (KSIC J)

> 자동 생성 (wise-dev-std scaffold, 2026-09-08). 근거: `domains/ict-saas.yaml` + .doc KSIC 통합표.
> 규제는 변하므로 References 로 재확인. **본 프로젝트는 개인 사용자 로컬 전용(PRD §1.3)** — 각 항목의 적용 여부를 병기한다.

## 분류 / Classification

| 체계 | 코드 |
|---|---|
| KSIC | J (58–63) |
| ISIC / NACE | J |
| NAICS | 51 |

## 한국 규제 (1순위)

| 규제 | 시행 | 영향 | 본 프로젝트 적용 |
|---|---|---|---|
| 정보통신망법 | — | 네트워크·정보보호 의무(§47 ISMS 근거), 침해사고 신고 | **해당 없음** — 외부 서비스 제공 아님, 127.0.0.1 바인딩 |
| 개인정보보호법(PIPA) | — | PII 동의·최소화·유출통지(§32-2) | **해당 없음** — PII 미수집(추첨 결과·티켓만) |
| ISMS-P | — | 대형 ICT 서비스 의무, 접근로그·변경관리·암호화 증적 | **해당 없음** |
| CSAP(클라우드) | 2025 온라인 발급 | 공공 클라우드 판매 시 인증 | **해당 없음** |

## 국제 기준

SOC 2 Type II · ISO/IEC 27001 · GDPR — **해당 없음** (배포·고객 없음). 참고만.

## 데이터 등급

| 데이터 | 등급 | 비고 |
|---|---|---|
| 추첨 결과(회차·번호·당첨금·당첨자수) | 공개 | 원천 `.docs/lotto(~1240).xlsx`, 불변 |
| 분석 결과(run 테이블, Parquet 캐시) | 내부 | 재생성 가능, git 제외 |
| 추천·사용자 티켓·성과 추적 | 내부(개인) | 로컬 SQLite. 외부 전송 없음 |
| 설정(`.env.local`, `.env.<env>`) | 내부 | 시크릿 없음. git 제외(예시 `.env.<env>.example` 만 커밋, v1.32) |

규제대상 등급 데이터 **없음**. 비-프로덕션 반입 금지 규칙은 적용 대상이 없다.

## 인프라 패턴 / 스택 오버라이드

| 도메인 표준 | 채택 |
|---|---|
| 멀티테넌트 격리(RLS/스키마) | 미채택 (단일 사용자) |
| 관측성(OpenTelemetry) | 미채택. 실행 이력·run 메타데이터를 SQLite 에 기록(PRD §9 `analysis_run`, `import_log`) |
| 피처플래그·API 게이트웨이·오토스케일 | 미채택 |
| 표준 CI/CD(lint/type/test/build) | **채택** — `.github/workflows/ci.yml` |
| API-first(OpenAPI 계약) | **채택** — FastAPI 자동 OpenAPI, 계약 테스트 |

## 개발환경 특수 요구

- 테넌트 격리 테스트: 해당 없음.
- 표준 CI/CD: 채택.
- OpenAPI 계약 테스트: 채택 (`test/backend/`).
- 텔레메트리 보관/삭제: 해당 없음. 대신 **분석 run 재현성**(데이터 해시·seed·B·버전 기록)을 필수 통제로 둔다(PRD §7).

## 추가 시험 (test/ 반영)

| 도메인 testing_additions | 반영 |
|---|---|
| 크로스테넌트 누출 차단 | 해당 없음 |
| OpenAPI 계약 적합성 | ✅ `test/backend/test_openapi_contract.py` — 스키마 생성·문서화 경로 42개 존재·경로 스냅샷·핵심 응답 형태/ISO UTC 시각 |
| 감사로그 보관기간 삭제 증명 | 해당 없음 → 대체: run 재현성 테스트(동일 seed 2회 결과 해시 동일, PRD §12.3) |

## 프로젝트 고유 준수 사항 (PRD §4.11)

UI 고정 고지: 통계적 유의성 ≠ 예측력·조작·인과. 추천번호는 균등 무작위와 동일 당첨확률. 보정 전 p 는 탐색 후보. 사행성 조장 문구 금지.

## 출처 / References

- https://isms-p.or.kr/sysm/intro/selectSysmCertDetail.do (ISMS-P)
- https://isms.kisa.or.kr/main/csap/notice/ (CSAP 2025)
- https://secureframe.com/blog/soc-2-vs-iso-27001
- https://oneuptime.com/blog/post/2026-02-06-telemetry-retention-soc2-iso27001/view
- https://www.ideadope.com/roadmaps/how-to-build-multi-tenant-saas-2025
