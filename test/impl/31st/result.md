# 결과 — impl 31st: `.env.local` 변경 즉시 반영 (PRD v1.14.3) — 2026-09-14

## 시도 1 — 1 부수 수정 후 PASS 4/4

| id | 판정 | 근거 |
|---|---|---|
| 31-1 | PASS(재현) | `.env.local:26 LOTTO_RECENT_DRAWS=4`, 라이브 `/config lotto_recent_draws = 5`. 원인: `uvicorn --reload` 기본 감시 = cwd(`backend/`)의 `*.py` 만. `.env.local` 은 루트에 있고 dot-file 이라 기본 exclude `.*` 대상 |
| 31-2 | PASS | uvicorn 0.52.4 `FileFilter`: include 패턴이 경로 suffix 와 일치하면 exclude 검사 전 True → `--reload-include .env.local` 로 dot-file 감시 가능. 기동 로그 `Will watch for changes in these directories: ['/Users/wise/Developer/wise-project/Lotto-Rec']` |
| 31-3 | PASS | 4→6: 1초 후 `/config = 6`, 로그 `WatchFiles detected changes in '…/.env.local'. Reloading...`(`logs/watchfiles-reload.log`). 6→4 복원: 1초 후 `= 4`. 스크린샷 `logs/my-numbers-recent4.png` 4회차(2열 2+2) |
| 31-4 | PASS(1 수정) | 첫 `make local-restart`: 새 uvicorn 이 이전 프로세스 포트 해제 전 기동 → `ERROR: [Errno 48] Address already in use` → 신·구 모두 종료(스택 다운). Makefile `local-restart` 에 `pgrep -f "uvicorn app.main:app"` 종료 대기(최대 10s) 추가 후 `make local-all` 정상 |

## 변경 파일
`Procfile.dev`, `Makefile`(local-restart), `.docs/PRD.md`(v1.14.3 §10·§16.4), `README.md`/`README.en.md`(env 표·트러블슈팅·시험 표)

## 비고
- 감시 범위가 프로젝트 루트로 넓어짐(frontend/data/test 는 FileFilter 로 이벤트 제외). macOS FSEvents 기준 부담 없음. Linux inotify 환경이면 `--reload-dir` 를 좁히는 것을 고려.
- docker(api 컨테이너)는 `.env.local` 을 env_file 로 주입 → 여전히 `make docker-restart` 필요.
- 검증 중 사용자 `.env.local` 의 `LOTTO_RECENT_DRAWS` 를 4→6→4 로 왕복 수정하고 4 복원을 확인했으나, 이후 `make local-restart` 검증 시 디스크 값이 **다시 6** 으로 바뀌어 있었음(다른 행 변경 없음). 외부 쓰기(편집기에 열린 버퍼 저장 또는 사용자 수정)로 추정 — 라이브 `/config` 도 6 으로 디스크와 일치해 반영 자체는 정상. **사용자가 의도한 값(4 또는 6)을 `.env.local` 에서 확인 필요.**
- `make local-restart` 재검증: 2초 내 healthy, `Address already in use` 0건, frontend 200.
