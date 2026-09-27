"""`.env.local` 단일 키 갱신 (PRD S4.13 v1.24 — SEED 값 생성 완료 시 기본 seed 저장).

**오직 `.env.local`**(gitignore 대상, 사용자 실제 값)만 수정한다. 저장소가 공유하는
`.env`·`.env.local.example` 은 절대 건드리지 않는다. local 실행은 uvicorn 이 `.env.local` 을
감시해 저장 즉시 재기동하고(PRD v1.14.1), docker 는 컨테이너 기동 시 1회 주입이라 `make
docker-restart` 가 있어야 반영된다.
"""

from __future__ import annotations

import re
from pathlib import Path

from app.core.config import PROJECT_ROOT

ENV_LOCAL_PATH = PROJECT_ROOT / ".env.local"


def update_env_local(key: str, value: str, path: Path | None = None) -> bool:
    """`.env.local` 에서 `KEY=...` 줄을 `value` 로 교체(없으면 파일 끝에 추가).

    다른 줄·주석·순서는 그대로 둔다. 파일이 없으면 아무 것도 하지 않고 False 를 반환한다
    (예: 아직 `make local-build` 를 실행하지 않은 환경). 반환값은 실제로 파일을 갱신했는지 여부.
    """
    target = ENV_LOCAL_PATH if path is None else path
    if not target.exists():
        return False
    text = target.read_text(encoding="utf-8")
    pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
    new_line = f"{key}={value}"
    if pattern.search(text):
        text = pattern.sub(new_line, text, count=1)
    else:
        sep = "" if text == "" or text.endswith("\n") else "\n"
        text = f"{text}{sep}{new_line}\n"
    target.write_text(text, encoding="utf-8")
    return True
