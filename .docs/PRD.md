# PRD — 로또번호 통계분석 플랫폼 (Lotto-Rec)

| 항목 | 내용 |
| :-- | :-- |
| 문서 버전 | 1.8 (S5.5 등록된 번호로 추첨 시도) |
| 작성일 | 2026-09-08 |
| 상태 | Draft → 구현 중 보완 (living document) |
| 근거 문서 | `.docs/Perplexity-로또번호 무작위 추출 통계분석.md`, `.docs/lotto(~1240).xlsx` |
| 운영 모드 | 개인 사용자용 **local 전용** (backend + frontend, 인증·배포 없음) |

---

## 0. 한 페이지 요약

- **무엇을**: 한국 로또 6/45 1~1,240회 추첨 데이터를 대상으로, 비복원추출(k-of-N) 영가설에 기반한 **엄밀한 통계분석 엔진**, 결과를 탐색하는 **대시보드**, 통계에 근거한 **사용자 예측 평가**와 **자동 추천번호 생성**을 제공하는 로컬 웹 플랫폼.
- **어떻게**: 1~1,000회(군 A)로 통계분석·모델 적합, 1,001~1,240회(군 B)로 분석 결과와 추천전략의 **사후 검증(out-of-sample backtest)**. 모든 판정은 원시 p, 보정 q, 효과크기, Monte-Carlo 전역 p를 함께 제시.
- **왜**: 단순 "핫넘버" 도구가 아니라, 탄탄한 통계·알고리즘 이론 위에 사용자 편의 기능을 올린 **검증 가능한 플랫폼**을 만드는 것이 목적. 공정 추첨이라면 어떤 전략도 당첨확률을 높일 수 없다는 사실을 플랫폼이 스스로 측정·보고한다.
- **스택**: Python 3.12 + FastAPI + NumPy/SciPy/statsmodels + SQLite/Parquet (backend) / React + TypeScript + Vite + Plotly (frontend). 로컬 `make local-all` 한 번으로 구동.
- **핵심 설정**: `.env.local`의 `LOTTO_NUMBER_RECOMMENDATION_COUNT=10` (로또번호 추천 갯수).
- **운영 루프**: 새 회차 xlsx/CSV 업로드(또는 직접 입력) → 중복 회차 제외 증분 삽입 → 통계분석 자동 재실행 → 저장된 추천번호와 실제 결과 자동 대조 → **성과 추적 대시보드** 누적.

**범위 (In / Out)**

| In (이번 릴리즈) | Out |
| :-- | :-- |
| xlsx/CSV 증분 적재·검증, 통계 엔진(단일·쌍·집합·그룹·시간·MC·보정), A→B 검증, 추천 8전략, 사용자 번호 평가, 성과 추적, 대시보드 9+1 화면 | 외부 사이트 자동 수집, 다중 사용자·인증·클라우드 배포, 구매 자동화, "당첨 보장" 기능 |

**성공 지표**

| KPI | 기준선 | 목표 | 측정 |
| :-- | :-- | :-- | :-- |
| 이론값 단위테스트 통과율 | 0 | 100% (§12.1 전 항목) | pytest |
| 균등 시뮬 데이터 기각률 | — | α±MC 오차 이내 (§12.2) | 시뮬 리포트 |
| 군 B backtest 리포트 생성 | 불가 | 8전략 × 240회 완료, 균등 대비 CI 표시 | 검증 화면 |
| 재현성 | — | 동일 seed 2회 실행 결과 해시 동일 | 자동 테스트 |
| 새 회차 업로드 → 재분석·대조 완료 | 수동 | quick 프리셋 기준 자동, 5분 이내 (`가정:`) | 실행 이력 |

---

## 1. 배경과 목적

### 1.1 배경

로또 6/45는 45개 번호 중 6개 본번호와 1개 보너스번호를 비복원으로 추출한다. 한 회차 안의 번호들은 **구조적으로 음의 의존성**(이론 상관 $-1/(N-1)\approx-0.0227$)을 가지므로, 일반 Pearson 상관·일반 lift·단순 공출현 순위로 관계를 해석하면 잘못된 결론에 이른다. 시중의 "통계 기반 로또 예측" 도구 대부분이 이 함정에 빠져 있다.

### 1.2 목적

1. **이론적 정확성**: 조합론적 영가설(균등 k-of-N 비복원추출) + 하이퍼지오메트릭/순열 기반 검정 + 다중검정 보정을 중심에 둔 분석 엔진.
2. **검증 가능성**: 군 A(1~1,000회)에서 발견한 패턴과 추천전략이 군 B(1,001~1,240회)에서 재현·성과를 내는지 정량 검증.
3. **사용자 편의**: 대시보드에서 통계 결과 탐색, 사용자가 고른 번호의 통계적 평가, 설정 가능한 개수의 자동 추천번호 생성.
4. **정직한 보고**: 유의성 ≠ 예측력. 추천 전략은 항상 균등 무작위 기준선과 비교하여 성과(또는 무성과)를 그대로 보여준다.

### 1.3 비목표 (Out of Scope)

- 다중 사용자·인증·클라우드 배포 (local 전용).
- 실시간 구매·외부 사이트 자동화.
- "당첨 보장"류 기능. 예측력이 없다는 결론이 나오면 그대로 표시한다.

---

## 2. 용어와 표기

| 기호 | 의미 | 6/45 값 |
| :-- | :-- | :-- |
| $N$ | 번호 풀 크기 | 45 |
| $k$ | 본번호 개수 | 6 |
| $T$ | 분석 회차 수 | 군 A: 1,000 / 군 B: 240 / 전체: 1,240 |
| $D_t$ | 회차 $t$의 본번호 집합 | $\lvert D_t\rvert=6$ |
| $b_t$ | 회차 $t$의 보너스번호 | $b_t\notin D_t$ |
| $X_{t,i}$ | 번호 $i$가 $D_t$에 포함되면 1 | $T\times N$ incidence matrix |
| $C_i, C_{ij}, C_S$ | 단일/쌍/집합 $S$ 출현(공출현) 횟수 | — |
| $(a)_r$ | falling factorial $a(a-1)\cdots(a-r+1)$ | — |
| 군 A | 통계분석·모델 적합용 회차 | 1~1,000회 |
| 군 B | 검증(out-of-sample)용 회차 | 1,001~1,240회 |
| $H_0$ | 균등·독립 비복원추출 영가설 | $P(D_t=S)=1/\binom{45}{6}$ |

---

## 3. 데이터

### 3.1 원천 데이터 (`.docs/lotto(~1240).xlsx`)

| 컬럼 | 타입 | 설명 |
| :-- | :-- | :-- |
| 회차 | int | 1~1,240 (연속, 중복 없음) |
| 번호1~번호6 | int | 본번호, **오름차순 정렬 저장** (추출 순서 아님) |
| 보너스 | int | 보너스번호 |
| 1등 당첨금 | int | 원 |
| 1등 당첨수 | int | 1등 당첨자 수 (0~63) |
| 2등 당첨금 | int | 원 |
| 2등 당첨수 | int | 2등 당첨자 수 |

**사전 정합성 점검 결과 (2026-09-08 실측)**

| 항목 | 결과 |
| :-- | :-- |
| 행 수 | 1,240 (1~1,240 연속) |
| 본번호 중복·범위 위반·보너스 중복 | 0건 |
| 결측 셀 | 0 |
| 6개 번호 정렬 여부 | 1,240회 모두 오름차순 |
| 군 A 번호별 출현 최소/최대 | 106 / 152 (기대 133.3, SD 10.75) |
| 군 A 보정 카이제곱 $J=(N-1)X^2/(N-k)$ | 33.0 (df 44, p ≈ 0.888) |
| 군 A 인접 회차 평균 중복수 | 0.830 (기대 0.8) |

→ 원천 데이터는 깨끗하며, 군 A는 1차 진단상 균등 모형과 일치한다. 플랫폼은 이를 **자동으로 재검증**해야 한다.

### 3.2 파생 데이터

| 산출물 | 정의 | 용도 |
| :-- | :-- | :-- |
| `draws` | 정규화 회차 테이블 (draw_no, n1..n6, bonus, prize/winner 컬럼) | 모든 분석의 원천 |
| `X_main` | $T\times45$ 본번호 incidence matrix (행합 = 6) | 빈도·공출현·순열검정 |
| `X_bonus` | $T\times45$ 보너스 incidence matrix (행합 = 1) | 보너스 분리 분석 |
| `features` | 회차별 파생 특성: 합, 홀수개수, 저번호(1–22)개수, 구간(1–10…41–45)별 개수, 연속쌍 수, 끝수 중복 수, 소수 개수, AC값 | 그룹/패턴 분석, 추천 필터, 당첨자수 모델 |
| `cohort` | 회차 → {A, B} 라벨 (경계 `LOTTO_TRAIN_END_DRAW`) | 학습/검증 분리 |

저장: 정형 테이블은 SQLite(SQLAlchemy 2 + Alembic), 균등 조합 특성 영분포(200k) 캐시는 NumPy `.npy` 파일(`data/cache/`). MC 영분포는 run 마다 재생성(seed 고정)하고 요약만 `null_summary` 섹션에 저장.

### 3.3 군 분할 원칙

- 군 A(1~1,000): 모든 통계량 추정, 유의 패턴 선별, 추천전략 파라미터 적합.
- 군 B(1,001~1,240): **군 A 결과만 이용**하여 재현성·예측성과 평가. 군 B를 본 뒤 군 A 규칙을 수정하는 행위(look-ahead)는 금지하며, 검증 절차에서 확장창(expanding window) 방식은 회차 $t$ 예측 시 $t-1$까지만 사용한다.
- 경계값은 환경변수로 조정 가능하나 기본값은 1,000이다.

### 3.4 데이터 추가 (증분 업로드) — Q1 확정

- 외부 사이트(동행복권) 자동 수집은 **하지 않는다**.
- 사용자가 xlsx 또는 CSV를 업로드하면 회차(draw_no) 기준으로 **이미 존재하는 회차는 제외하고 신규 회차만 삽입**한다(멱등 처리). 단일 회차 직접 입력 폼도 제공한다.
- 동일 회차인데 번호·당첨 정보가 기존 값과 다르면 삽입하지 않고 **충돌 목록으로 보고**한다(덮어쓰기는 사용자가 명시적으로 선택).
- 적재 결과 리포트: 신규 삽입 n건, 중복 제외 n건, 충돌 n건, 검증 실패 n건(회차 목록 포함).
- 신규 회차가 1건 이상 삽입되면 → 파생 데이터 재생성 → **통계분석 자동 재실행**(프리셋 `LOTTO_AUTO_RERUN_PRESET`, 기본 quick) → 저장된 추천·사용자 번호와 자동 대조(§E8). 군 경계(`LOTTO_TRAIN_END_DRAW`)는 그대로 유지되어 신규 회차는 군 B에 누적된다.

---

## 4. 이론적 배경

Perplexity 조사 문서의 프레임워크를 골격으로 하고, 논문 검토로 보강한 항목은 **[보강]** 표시.

### 4.1 확률 모형: 균등 k-of-N 비복원추출

$$
P(X_{t,i}=1)=\frac{k}{N}, \qquad
P(X_{t,i}=1,X_{t,j}=1)=\frac{k(k-1)}{N(N-1)}, \qquad
P(X_{t,j}=1\mid X_{t,i}=1)=\frac{k-1}{N-1}
$$

$$
\mathrm{Corr}(X_i,X_j)=-\frac{1}{N-1}\approx-0.0227 \quad (i\ne j)
$$

크기 $r$ 집합 $S$의 동시출현 확률:

$$
p_S=\frac{\binom{N-r}{k-r}}{\binom{N}{k}}=\frac{(k)_r}{(N)_r}
$$

| $r$ | 한 회차 확률 | 1,000회 기대 횟수 | 분석 적합성 |
| --: | --: | --: | :-- |
| 1 | 0.1333 | 133.3 | 주력 |
| 2 | 0.01515 (1/66) | 15.15 | 주력 |
| 3 | 0.00141 | 1.41 | 사전 후보 한정, 검정력 낮음 |
| 4 | 0.000097 | 0.097 | 유의성 판단 부적합 |
| 5·6 | ≈0 | ≈0 | 빈도 분석 부적합 |

**설계 보정 lift** (일반 lift는 $H_0$에서도 $N(k-1)/(k(N-1))=225/264\approx0.852$이므로 부적합. Perplexity 문서의 0.886은 산술 오류이며 본 값이 정확):

$$
\mathrm{Lift}^{*}_{S}=\frac{\widehat P(S\subseteq D_t)}{p_S}
$$

조건부 관계 $1\mid(2,3)$의 기준선은 $(k-2)/(N-2)=4/43\approx0.0930$, $(1,2)\to(3,4)$는 $(k-2)(k-3)/((N-2)(N-3))\approx0.00664$.

### 4.2 전역 균등성 검정 — 비복원 보정 카이제곱 **[보강]**

Pearson $X^2=\sum_i (O_i-E_i)^2/E_i$는 비복원추출 때문에 $\chi^2_{N-1}$을 따르지 않는다.

- **단일 번호 (Joe 1993; Bellhouse 1982)**: $J=\dfrac{(N-1)}{(N-k)}X^2 \;\dot\sim\; \chi^2_{N-1}$. 6/45에서는 $X^2$에 $44/39\approx1.128$을 곱한다.
- **번호쌍 (Genest, Lockhart & Stephens 2002)**: 모든 $\binom{N}{2}$ 쌍의 $X^2$는 점근적으로 $w_1\chi^2_{N-1}+w_2\chi^2_{N(N-3)/2}$,
  $w_1=(k-1)\binom{N-3}{k-2}/\binom{N-2}{k-2}$, $w_2=\binom{N-4}{k-2}/\binom{N-2}{k-2}$. 일반 크기 $c$ 집합은 $c$개 가중 $\chi^2$의 합(동 논문 식 (9)–(10)).
- 구현: 점근 분포는 가중 $\chi^2$ 합의 수치 적분 또는 **Monte-Carlo 영분포**로 p-value 산출(두 값 병기).

### 4.3 순서통계량 기반 공정성 검정 **[보강]**

원천 데이터가 오름차순이므로 Coronel-Brizio et al.(2008)의 **정렬 결과벡터 검정**을 직접 적용할 수 있다. $Y_{(i)}$를 $i$번째로 작은 본번호라 할 때 $H_0$ 아래

$$
\mu_i=E[Y_{(i)}]=\frac{(N+1)\,i}{k+1}, \qquad
v_{ij}=\mathrm{Cov}(Y_{(i)},Y_{(j)})=\frac{i\,(k-j+1)(N+1)(N-k)}{(k+1)^2(k+2)} \;(i\le j)
$$

$$
Q=m(\bar{\mathbf y}-\boldsymbol\mu)'V^{-1}(\bar{\mathbf y}-\boldsymbol\mu)\;\dot\sim\;\chi^2_k
$$

6/45: $\mu=(6.57,13.14,19.71,26.29,32.86,39.43)$. 점근 p와 MC p를 함께 보고한다.

### 4.4 단일·쌍·집합 검정

| 단위 | 통계량 | 영분포 | 보정 |
| :-- | :-- | :-- | :-- |
| 단일 번호 $C_i$ | 관측·기대·잔차·$z$ | $\mathrm{Binomial}(T,k/N)$ 정확검정 | Holm / BH |
| 번호쌍 $C_{ij}$ | 공출현·$\mathrm{Lift}^*$·$z$ | $\mathrm{Binomial}(T,p_{ij})$ + 조건부 MC | BH(기본)·BY, maxT FWER |
| 3-집합 $C_{ijk}$ | 조건부확률 $\widehat P(i\mid j,k)$, Conditional Lift* | Binomial / MC | BY 또는 계층적 FDR, 최소 기대빈도 필터 |
| $(A)\to(B)$ 집합쌍 | 합집합 크기로 표준화 후 집합 포함 사건 | $p_{A\cup B}$ | 사전 후보 한정 |
| 보너스 | $X_{bonus}$ 별도 분석, 본번호 조건부 $P(b=j\mid i\in D_t)$ 기준선 $1/(N-k)$ | Binomial / MC | BH |

Fisher exact test(주변합 고정)는 보조 지표로 제공한다.

### 4.5 그룹 패턴 — 다변량 하이퍼지오메트릭

그룹 $g$의 번호 수 $n_g$, 뽑힌 개수 $x_g$:

$$
P(X_1=x_1,\dots,X_m=x_m)=\frac{\prod_g\binom{n_g}{x_g}}{\binom{N}{k}}
$$

적용: 홀/짝, 저/고(1–22/23–45), 5구간, 끝수, 소수/비소수, 사용자 정의 번호군. 회차별 관측 벡터의 도수분포를 이론 분포와 적합도 검정(정확 다항 또는 MC). 연속쌍 수·합의 분포는 조합 열거(8,145,060 조합 전수 계산은 1회 사전 계산 후 캐시) 또는 MC로 산출한다.

### 4.6 조건부 Monte-Carlo 영분포 (핵심 검정 엔진)

$B$회 반복하여 $T$회짜리 가상 추첨을 생성(`rng.choice(45, 6, replace=False)` 벡터화)하고 동일 통계량을 계산한다.

$$
p_{MC}=\frac{1+\sum_{b=1}^{B} I(|T_b|\ge|T_{obs}|)}{B+1}
$$

| 용도 | $B$ | 분해능 |
| :-- | --: | --: |
| 대시보드 즉시 탐색 | 10,000 | $10^{-4}$ |
| 정식 리포트 | 100,000 | $10^{-5}$ |
| 전역 maxT·희귀 조합 | ≥500,000 | $10^{-6}$ |

maxT(Westfall–Young): 시뮬레이션마다 $\max_{ij}|z_{ij}|$ 등 최대통계량을 저장하여 "가장 특이한 쌍/번호/자기상관"의 FWER p를 산출한다. 모든 MC 실행은 `seed`, `B`, 소프트웨어 버전을 `analysis_run`에 기록하여 재현 가능해야 한다.

### 4.7 다중검정 보정

| 방법 | 제어 | 용도 |
| :-- | :-- | :-- |
| Bonferroni / Holm | FWER | 사전 지정 소수 가설, 감사형 결론 |
| BH-FDR | FDR | 번호쌍 990개 전수 탐색 기본 |
| BY-FDR | FDR(임의 의존) | 삼중항·강한 의존 구조 |
| Westfall–Young maxT | FWER(의존 반영) | 최종 전역 확증 |

원시 $p<0.05$는 "탐색 후보"로만 표시하고, 판정 배지는 보정 후 값에만 부여한다.

### 4.8 시간적 무작위성

- 인접 회차 중복수 $O_t=|D_t\cap D_{t+1}|\sim\mathrm{Hypergeom}(N,k,k)$, $E=k^2/N=0.8$; lag 1~$L$ 확장.
- 번호별 이진 시계열 자기상관 $\rho_i(\ell)$, Ljung–Box, 불균형 확률(6/45)을 반영한 runs test, 출현 간격(gap)의 기하분포 적합.
- lagged cross-correlation은 사전 지정 lag·번호군 또는 maxT로만.
- 변화점: CUSUM, PELT(`ruptures`), 이동창 편향 점수. 후보 변화점은 전후 구간 재검정.
- NIST SP 800-22 계열은 번호별 이진열의 **보조 진단**으로만 사용.

### 4.9 후보 생성기 vs. 검증기 분리

Apriori/FP-Growth(`mlxtend`)는 빈발항목집합 **후보 생성**에만 쓰고, 유의성은 반드시 4.4–4.7의 검정기로 판정한다. 네트워크(NetworkX)는 엣지 조건 $q_{ij}<\alpha \wedge |\mathrm{Lift}^*_{ij}-1|\ge\delta$를 만족하는 쌍만 연결하고, Leiden/Louvain 군집은 시각화 보조로 한정한다.

### 4.10 사용자 편의 기능의 이론적 토대 **[보강]**

#### (a) 티켓 성과 평가 — 하이퍼지오메트릭 일치수 분포

임의 6개 번호 티켓이 실제 추첨과 $i$개 일치할 확률(공정 추첨, 어떤 전략이든 동일):

$$
P(X=i)=\frac{\binom{6}{i}\binom{39}{6-i}}{\binom{45}{6}}
$$

| $i$ | 0 | 1 | 2 | 3 (5등) | 4 (4등) | 5 (3등/2등) | 6 (1등) |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| $P$ | 0.40056 | 0.42413 | 0.15147 | 0.02244 | 0.001365 | 2.87e-5 | 1.23e-7 |

$E[X]=k^2/N=0.8$. 5개 일치는 보너스 일치 여부로 분리한다: 2등 $P=\binom{6}{5}\cdot1/\binom{45}{6}\approx7.37\times10^{-7}$, 3등 $P=\binom{6}{5}\cdot38/\binom{45}{6}\approx2.80\times10^{-5}$. 군 B 240회 × $M$장 티켓의 관측 일치수 분포를 이 영분포와 비교(다항 적합도, 평균 일치수의 z/MC 검정, ≥3 일치율의 이항검정)하는 것이 추천전략 backtest의 표준 절차다.

#### (b) 확률 예보 평가 — 엄격 고유 스코어링 규칙

전략이 번호별 출현확률 $\hat p_{t,i}$를 내면 균등 예보 $6/45$와 **Brier score**·**log score**로 비교한다(Gneiting & Raftery 2007). 공정 추첨에서는 어떤 정보 예보도 균등 예보의 기대 점수를 이길 수 없으므로, 점수 차이의 부호와 신뢰구간이 "예측력 있음/없음"의 정량 근거가 된다.

#### (c) 의식적 선택(conscious selection)과 기대수익 **[보강]**

Haigh(1997), Cook & Clotfelter(1993), Baker & McHale(2009)은 추첨은 무작위지만 **구매자의 번호 선택은 무작위가 아님**(생일수 1–31 선호, 연속수 회피, 대칭 패턴 등)을 보였다. 파리뮤추얼 구조에서는 인기 없는 조합을 고르면 당첨확률은 같아도 **당첨 시 분배금 기대값**이 커진다(Moffitt & Ziemba 2018). 본 데이터에는 회차별 1등·2등 당첨자 수가 있으므로

$$
\log E[W_t]=\beta_0+\beta^\top f(D_t)+\log(\text{판매규모 proxy}_t)
$$

형태의 음이항/포아송 회귀로 "조합 특성 $f$(생일수 개수, 연속쌍, 합, 끝수 중복, 저번호 비중 등) → 당첨자 수"를 적합하고, 추천 시 **예상 공유자 수가 적은 조합**을 우선하는 전략을 제공한다. 이는 본 플랫폼에서 이론적으로 정당화 가능한 유일한 "기대값 개선" 축이며, 당첨확률 자체를 높이지는 않음을 UI에 명시한다.

#### (d) 추천 = 가중 비복원 표본추출 문제

전략별 번호 가중치 $w_i$가 주어지면 6개 조합은 **가중 비복원 표본추출**(conditional Poisson sampling / Efraimidis–Spirakis A-Res)로 생성한다. 조합 단위 제약(합·홀짝·연속 등)은 rejection sampling으로 적용하고, 다중 티켓은 커버리지(중복 번호 최소화, 최소 Hamming 거리) 제약을 둘 수 있다. 균등 전략은 $w_i\equiv1$인 특수 경우로, 항상 **기준선(control)**으로 함께 생성한다.

### 4.12 전략 개선 루프의 검증 이론 **[v0.7 보강]**

A(1~1,000회) 분석 → 전략 파라미터 → B(1,001회~) 검증 → 파라미터 조정 → 반복. 이 루프에서 "적중율이 올라간 것처럼 보이는" 현상의 대부분은 **선택 편향(best-of-K)** 과 **과적합(optimism)** 이다. 따라서 다음을 표준으로 둔다.

- **튠/홀드아웃 분할**: B 를 튠 구간 B₁(기본 1,001~1,120)과 홀드아웃 B₂(1,121~1,240)로 나눈다. 후보 파라미터 K 개는 B₁ 성과로 선택하고, 선택된 것만 B₂ 에서 1회 평가한다. B₂ 는 선택에 사용하지 않는다.
- **best-of-K 영분포**: 공정 추첨에서 후보 K 개의 (전략 − 균등) 평균 일치수 차이는 각각 $N(0,\;2\sigma^2/n)$, $\sigma^2=\mathrm{Var}[X]$(하이퍼지오메트릭 일치수 분산), $n$=티켓 수. "최고 후보"의 차이는 그 최대값 분포를 따르므로, 관측된 최고 성과의 **best-of-K 분위수** 를 보고한다. 홀드아웃 기대값은 0 이다(평균으로의 회귀).
- **optimism** = 튠 최고 성과 − 홀드아웃 성과. 양수가 정상이며, 0 근처가 아니면 튠 결과를 신뢰할 수 없다.
- **지속 개선 검정**: 세대(iteration) 대 홀드아웃 성과의 Spearman 상관 및 홀드아웃 누적 평균 vs 0.8 의 z. 공정 추첨이면 유의하지 않아야 한다. 이것이 "1항의 통계분석이 정말 유의미하게 변화하는가"에 대한 정량 답이다.
- **A 분석의 명시적 사용**: 전략 `analysis_weighted` 는 이력의 번호별 표준화 잔차 $z_i$(t−1 시점, 1,001회에서는 곧 군 A run 의 z)에 $w_i \propto e^{\beta z_i}$ 로 가중하고, 선택 번호와의 설계 보정 lift 를 지수 $\lambda$ 로 곱한다. $\beta=\lambda=0$ 이면 균등이므로, 튠 루프가 0 으로 회귀하는지 자체가 검정이다.

### 4.11 해석 원칙 (UI 고정 고지)

1. 공정 추첨에서도 번호쌍 상관은 구조적으로 음수다.
2. 일반 상관·일반 lift·공출현 순위만으로 의존성을 주장할 수 없다.
3. 보정 전 $p<0.05$는 탐색 후보다. 990쌍을 탐색하면 약 50개의 우연한 후보가 나오는 것이 정상이다.
4. 3개 조합 기대 공출현은 약 1.4회, 4개 이상은 0회가 정상이다.
5. 통계적 유의성은 예측력·조작·인과의 증거가 아니다.
6. 추천번호는 균등 무작위와 동일한 당첨확률을 가지며, 차이는 군 B 검증 리포트로 확인한다.

---

## 5. 사용자와 시나리오

| 사용자 | 목표 | 대표 시나리오 |
| :-- | :-- | :-- |
| 개인 분석가(주 사용자) | 추첨 무작위성 검증, 패턴 탐색 | xlsx 적재 → 개요 KPI 확인 → 쌍 히트맵/네트워크 탐색 → 군 B 재현 확인 |
| 로또 구매자(본인) | 번호 선택 보조 | 내 번호 6개 입력 → 통계 스코어카드 → 자동 추천 10개 생성 → 전략별 backtest 성과 비교 |
| 개발자(본인) | 유지보수·확장 | 새 회차 append → 분석 재실행 → 결과 diff |

---

## 6. 기능 요구사항 (Epic / Story)

우선순위: **P0** 필수(MVP), **P1** 중요, **P2** 확장, **P3** 선택.

### E1. 데이터 적재·검증 (P0)

- S1.1 xlsx/CSV 업로드/경로 지정 → 컬럼 매핑 → `draws` **증분 적재**(draw_no 기준 중복 제외, 충돌 보고, §3.4). openpyxl/pandas 기반, 한글 컬럼명 매핑 테이블 내장. 단일 회차 직접 입력 폼 포함.
- S1.5 신규 회차 삽입 시 파생 재생성 → 분석 자동 재실행 → 추천·사용자 번호 자동 대조 트리거(§E8).
- S1.2 정합성 검증: 회차 연속·중복, 번호 범위 1–45, 본번호 6개 유일, 보너스 ≠ 본번호, 결측. 위반 시 회차 목록과 함께 거부.
- S1.3 incidence matrix(본번호/보너스), 파생 특성, 군 라벨 생성·저장(SQLite + Parquet).
- S1.4 데이터 버전(해시)과 `analysis_run_id` 연결. 동일 데이터·설정·seed → 동일 결과.

### E2. 통계분석 엔진 (P0~P1)

| Story | 내용 | 우선 |
| :-- | :-- | :-- |
| S2.1 단일 번호 | 관측/기대/잔차/z, 정확 이항 p, Holm·BH q, 95/99% 예측구간, 본번호·보너스 분리 | P0 |
| S2.2 전역 균등성 | Pearson $X^2$, **보정 $J$**, G-test, MC 전역 p, **순서통계량 $Q$ 검정** | P0 |
| S2.3 번호쌍 | 990쌍 공출현·기대·$\mathrm{Lift}^*$·z·이항 p·BH/BY q·maxT p, Fisher 보조 | P0 |
| S2.4 쌍 전역 | Genest 가중 $\chi^2$ 통계량 + MC p | P1 |
| S2.5 3-집합·조건부 | 후보 한정(쌍 유의 후보 ∪ 사용자 지정 ∪ FP-Growth 빈발) → $C_{ijk}$, $\widehat P(i\mid j,k)$, Conditional Lift*, MC p, BY q | P1 |
| S2.6 집합쌍 $(A)\to(B)$ | 합집합 표준화, $p_{A\cup B}$ 대비 관측, 사용자 지정 후보만 | P1 |
| S2.7 그룹 패턴 | 홀짝·저고·5구간·끝수·소수·연속쌍·합의 관측 vs 다변량 하이퍼지오메트릭/조합 열거 분포 | P0 |
| S2.8 시간 분석 | 인접 overlap, lag 1–10 자기상관 + maxT, runs, gap 분포, Ljung–Box, CUSUM/PELT 변화점 | P1 |
| S2.9 네트워크 | 유의 쌍 그래프, 가중치 $\lvert z\rvert$ 또는 $\lvert\log_2\mathrm{Lift}^*\rvert$, 군집(보조) | P1 |
| S2.10 MC 엔진 | 벡터화 시뮬레이터, 배치·캐시, seed·B 기록, 진행률 스트리밍 | P0 |
| S2.11 다중검정 모듈 | Bonferroni/Holm/BH/BY 공통 함수, maxT 헬퍼 | P0 |
| S2.12 당첨자수 모형 | 조합 특성 → 1등/2등 당첨자수 음이항 회귀, 계수·적합도 리포트 | P1 |

모든 결과는 §9 스키마로 저장되고 `analysis_run_id`로 조회된다.

### E3. 검증 (군 A → 군 B) (P0)

- S3.1 **재현성 검증**: 군 A에서 보정 후 유의한 번호/쌍/그룹 패턴을 군 B에서 동일 통계량으로 재검정. 재현율과 $H_0$ 아래 기대 재현율(MC) 비교. 방향 일치(부호) 검정 포함.
- S3.2 **안정성 검증**: 군 A vs 군 B 빈도 벡터의 동질성(보정 카이제곱 2표본, MC), 쌍 $\mathrm{Lift}^*$ 벡터의 상관(기대 ≈ 0).
- S3.3 **추천전략 backtest**: 군 B 각 회차 $t$에 대해 $t-1$까지 데이터로 전략별 $M$장 생성 → 일치수 기록 → 4.10(a) 영분포와 비교. 지표: 평균 일치수(기대 0.8), 등수별 적중률, ≥3 일치 이항 p, 균등 기준선 대비 차이와 부트스트랩 CI, **당첨자수 모형 기반 기대 분배금**.
- S3.4 **확률 예보 평가**: 전략별 $\hat p_{t,i}$의 Brier/log score vs 균등 예보, 차이의 CI.
- S3.5 검증 리포트: 전략 × 지표 표, "균등 대비 유의한 개선 없음/있음" 판정 배지, 재현 가능한 run 메타데이터.

### E4. 추천번호 자동 생성 (P0)

- S4.1 추천 개수는 `.env.local`의 `LOTTO_NUMBER_RECOMMENDATION_COUNT`(기본 10, 범위 1–50)로 결정. UI에서 세션 단위 override 가능.
- S4.2 전략 목록(모두 균등 기준선과 동시 생성):

| 전략 ID | 가중치/규칙 | 이론 근거 | 기대 |
| :-- | :-- | :-- | :-- |
| `uniform` | $w_i=1$ | 영가설 자체 (control) | 기준선 |
| `frequency_hot` | $w_i\propto C_i$ (군 A 또는 $t-1$까지) | 빈도 편향 가설 검정용 | 개선 없음 예상 |
| `frequency_cold` | $w_i\propto 1/C_i$ 또는 gap 가중 | 도박사의 오류 검정용 | 개선 없음 예상 |
| `bayesian_shrink` | Beta-Binomial 사후 평균 $\propto (C_i+\alpha)/(T+\alpha+\beta)$ | 베이즈 축소 추정 | 균등 수렴 |
| `pair_association` | 첫 번호 후 $\mathrm{Lift}^*$·q로 순차 조건부 가중 | 쌍 공출현 구조 검정용 | 개선 없음 예상 |
| `pattern_typical` | 균등 표본 후 합/홀짝/저고/연속 특성이 다변량 하이퍼지오메트릭 중심 질량(예: 80% HDR) 안인 조합만 채택 | 전형성 필터 (당첨확률 불변) | 기준선과 동일 확률 |
| `low_competition` | 당첨자수 모형 예측 $E[W]$가 낮은 조합 우선 | 의식적 선택 회피(Haigh 1997 등) | 기대 분배금 ↑ |
| `hybrid` | 위 조합(사용자 설정 가중) | — | 검증으로 판단 |

- S4.3 티켓 간 커버리지 옵션: 번호 중복 최소화, 최소 Hamming 거리.
- S4.4 각 추천 티켓에 스코어카드(§E5) 자동 첨부, 사용 전략·seed·run_id·**대상 회차(생성 시점 최신 회차 + 1)** 표시. 생성 즉시 저장되어 §E8 추적 대상이 된다. CSV 내보내기.
- S4.5 추천 화면 상단에 해당 전략의 **군 B backtest 성과 요약**(균등 대비)을 반드시 표시.
- S4.6 (v0.6) 추천 이력(저장된 티켓)은 **전체 조회 가능**해야 한다: 전략·대상 회차·batch 필터(성과 추적과 동일 방식), 표시 개수 20/50/100/전체 선택, 서버 측 필터·offset 페이징, 필터 결과 건수와 전략별 건수 요약 표시, CSV 내보내기. (v0.8) **출처 필터** `origin=user|backtest|all`(기본 user) — 검증 replay 가 생성한 시뮬레이션 티켓(origin=backtest)도 조회 가능하며 행에 출처를 표시한다. "전체" 표시 = API limit 50,000(현재 데이터 19,220장 수용), 표는 200행 단위 "더 보기", CSV 는 로드된 전체.
- S4.7 (v0.6) 추천 결과의 각 티켓 카드와 추천 이력의 각 행에서 **'내 번호로 등록'** 가능(`POST /user/tickets` 재사용, label = `추천 <전략> #rec_id`, target_draw_no 승계). 등록 후 성과 추적 대상(전략 `user`)이 된다. (v1.7) 추천 카드는 확인 대화상자 후 등록, **추천 이력 행은 확인 없이 즉시 등록**한다(등록 완료 표시·내 번호 링크로 피드백).
- S4.8 (v0.7) 추천 응답은 사용된 파라미터·활성 실험(세대·홀드아웃 성과)·분석 근거(군 A run, 이력 T, 상위 |z| 번호)를 포함하고 UI 에 표시한다(E9 S9.4).
- S4.9 (v1.5, 사용자 요청) **과거 1·2등 일치 표시**: 추천 티켓의 6개 번호가 적재된 과거 회차 중 어느 회차의 1등(본번호 6개 동일) 또는 2등(본번호 5개 + 해당 회차 보너스)에 해당하면, 그 회차 번호를 **'티켓' 열(추천 카드·추천 이력·성과 추적 결과 표)** 에 공 옆에 `(386)` 형식으로 표시한다. 글씨는 기본 데이터보다 작고 회색 계통으로 흐릿하게, 툴팁에 등수(`386회 1등`)를 둔다. 복수 회차는 공백으로 나열한다. 응답 필드 `past_wins: [{draw_no, rank}]`(rank ∈ {1,2}, 회차 오름차순)를 `POST /recommend` 티켓·`GET /recommend/history` 행·`GET /tracking/outcomes` 행에 포함한다. 통계적 의미는 없음(균등 추첨에서 어느 티켓이든 동일 확률)을 §4.11 고지에 따라 해석한다.
- S4.10 (v1.6, 사용자 요청) **내 번호로 자동 등록**: 추천 이력 필터 바의 '필터 초기화' 우측 버튼. 동작 — (a) 대상 회차 $D$(필터의 대상 회차, 미선택 시 최신 회차+1)를 정하고, (b) $1..P$($P$ = 추천 개수 `LOTTO_NUMBER_RECOMMENDATION_COUNT`, 기본 10)에서 서로 다른 5개를 무작위로 뽑는 시행을 **$D$ 회 반복**해 번호별 출현 빈도를 집계, (c) 빈도 상위 5개(동률은 작은 번호 우선)를 **티켓 위치**로 선택, (d) 대상 회차 $D$ 의 사용자 생성(origin=user) 추천 이력에서 **전략별 최신 batch** 의 티켓을 rec_id 오름차순 1..n 으로 번호 매겨 선택 위치의 티켓을 `POST /user/tickets` 와 동일 규칙(label `추천 <전략> #rec_id`, target_draw_no=$D$)으로 등록한다. 같은 번호·대상 회차가 이미 등록돼 있으면 건너뛰고(중복 방지), 위치 > n 인 항목은 누락으로 보고한다. API `POST /recommend/auto-register` {target_draw_no?, seed?} → {selected, counts, rounds, seed, strategies[] (registered/skipped/missing)}. seed 미지정 시 무작위이며 사용된 seed 를 응답에 남겨 재현 가능. 선택 절차는 오락용 규칙일 뿐 어떤 티켓도 당첨확률이 같다(§4.11). (v1.7) 규칙 설명은 버튼 하단 문구가 아니라 **버튼 마우스오버 툴팁**(`title`)으로만 표시한다.

### E5. 사용자 예측(통계기반 평가) (P0)

- S5.1 사용자가 6개(+선택 보너스) 입력 → 유효성 검사.
- S5.2 스코어카드: 각 번호의 빈도 z/q, 포함된 15개 쌍의 $\mathrm{Lift}^*$·q, 합·홀짝·저고·구간·연속·끝수 특성의 $H_0$ 분위수, 과거 동일 조합·5개 일치 이력, 예상 일치수 분포(=4.10(a), 모든 조합 동일임을 명시), 당첨자수 모형 기반 예상 공유자 수와 상대 지수.
- S5.3 "이 조합은 통계적으로 특이한가?"를 MC 기반 전형성 p-value로 답하되, 특이성이 당첨확률과 무관함을 함께 표시.
- S5.4 사용자 저장 목록(로컬 DB), 이후 회차 결과와 자동 대조.
- S5.5 (v1.8, 사용자 요청) **등록된 번호로 추첨 시도**: '저장된 번호' 타이틀 우측 버튼. S4.10 과 같은 규칙이되 위치 풀이 $1..N$($N$ = 현재 저장된 번호 개수, 화면에 로드된 목록 순서 = 위치)이며, $\min(5,N)$개 비복원 추출을 다음 회차 번호(최신 회차+1)만큼 반복해 빈도 상위 $\min(5,N)$ 위치를 선택한다. 선택된 저장 번호는 '삭제' 버튼 좌측에 **별(★) 아이콘**으로 표시하며, 선택 결과는 **DB 에 저장하지 않고 화면 상태로만** 유지한다(재클릭 시 재추첨, 새로고침 시 소멸). 규칙 설명은 버튼 툴팁. 추천 이력의 '내 번호 보기' 링크(S4.7)로 진입해 저장된 번호를 확인할 수 있어야 한다.

### E6. 대시보드 (P0~P1)

| 화면 | 구성 | 우선 |
| :-- | :-- | :-- |
| 개요 | KPI 카드(회차, 전역 p: $J$·$Q$·MC, 유의 번호수, 유의 쌍수, maxT p, 시간 의존성 경보), 빈도 편차 막대, 해석 원칙 고지 | P0 |
| 번호 빈도 | 45개 번호 표/막대(관측·기대·CI), 본/보너스 토글, 기간 필터, 순위 변화 | P0 |
| 조합 연관성 | 공출현·$\mathrm{Lift}^*$·z 히트맵, 보정법·α·δ 필터, 쌍 상세 패널, 3-집합·집합쌍 탐색기, 네트워크 | P0/P1 |
| 그룹 패턴 | 홀짝·저고·구간·합·연속·끝수 관측 vs 이론 분포 | P0 |
| 시간 분석 | overlap 시계열, 자기상관 히트맵, runs, 변화점 표시 | P1 |
| 검증 (A→B) | 재현성 표, 전략 backtest 표·일치수 분포 비교, 스코어링 규칙 차이 CI | P0 |
| 추천 | 전략 선택·개수·커버리지 옵션 → 티켓 카드 + 스코어카드 + backtest 요약 | P0 |
| 내 번호 | 입력 → 스코어카드, 저장 목록 | P0 |
| 용어 사전 | 전 용어 목록(분류·검색·링크) — 화면 곳곳의 `Term` 툴팁과 동일 데이터 | P1 |
| 성과 추적 | 전략별 누적 성과(회차 × 티켓 일치수, 등수별 적중, 균등 영분포 대비 z/p, 누적 기대 vs 실제 곡선), 미추첨 대기 티켓, 추첨 결과 입력/업로드 진입점 | P0 |
| 설정/실행 | 데이터 적재(증분 리포트), 군 경계, α, 보정법, MC 반복수·seed, 자동 재실행 프리셋, 실행 이력 | P0 |

공통: 모든 표는 원시 p·보정 q·효과크기·CI·B·seed 컬럼 포함, CSV 내보내기, 한국어 UI(영어 라벨 병기 선택).

공통 UX (v1.2, 사용자 요청) — **용어 툴팁·용어 사전**: 통계 지식이 없는 사용자를 위해 화면의 전문 용어(영분포·하이퍼지오메트릭·MC·p/q·Joe J·순서통계량 Q·Genest·maxT/FWER·FDR(BH/BY)·Holm·설계 보정 Lift*·z·CI·예측구간·overlap·자기상관·runs·CUSUM/PELT·전형성/마할라노비스·당첨자수 모형(음이항)·VIF·Brier/log 점수·백테스트·튠/홀드아웃·best-of-K·optimism·Spearman·일치수 분포·ROI 등)에 `Term` 컴포넌트를 적용한다. 마우스오버/키보드 포커스 시 1~2문장의 쉬운 설명(예: 그룹 패턴 "영분포" → 하이퍼지오메트릭/MC 설명)과 위키·논문 링크를 툴팁으로 보이고, 별도 **용어 사전 페이지**(`/glossary`, 검색·분류)를 제공한다. 툴팁은 `role=tooltip`·`aria-describedby`, ESC 로 닫힘.

공통 UX (v1.0, 사용자 요청): (a) 플랫폼 표시명 **"Lotto number recommender"**(사이드바 2줄 표기; 저장소·패키지명 Lotto-Rec 유지), (b) 우측 상단 **플로팅 테마 메뉴**(light / dark / system, localStorage 저장, Tailwind class 기반 다크모드, Plotly 차트 테마 연동), (c) 모든 필터·폼 그리드는 **입력창 상단 정렬**: `Field` 는 라벨·입력·힌트 3줄 구조를 항상 유지(힌트 없으면 빈 줄 예약)하고 그리드는 `items-start`, 버튼·체크박스는 라벨 높이만큼 오프셋해 입력창과 같은 줄에 놓는다.

### E7. 설정·환경 (P0)

- `.env.local` 로드(pydantic-settings). 변수는 §10.
- 분석 프리셋: `quick`(B=10k), `report`(B=100k), `deep`(B=500k). **Q3 확정**: deep은 B=500,000을 기본값으로 정의하며 별도 실행 시간 목표를 두지 않는다(백그라운드 실행 + 진행률 표시로 대응).

### E8. 성과 추적 (P0) — Q2 확정

- S8.1 추천 티켓(§E4)과 사용자 번호(§E5)는 저장 시 `target_draw_no`(생성 시점 최신 회차 + 1)를 기록한다. 대상 회차 미지정 저장도 허용(다음 도래 회차에 자동 배정).
- S8.2 새 회차가 삽입되면(업로드 또는 직접 입력, §3.4) 해당 회차를 대상으로 하는 모든 티켓을 자동 대조: 본번호 일치수, 보너스 일치, 등수(1~5등/낙첨), 당첨금(해당 회차 1·2등 실제 당첨금 사용, 3~5등은 고정액 `가정:` 5등 5,000원·4등 50,000원, 3등은 회차 데이터 부재 시 `가정:` 값 표시).
- S8.3 전략별 누적 성과 대시보드: 티켓 수, 일치수 분포 vs 하이퍼지오메트릭 영분포(§4.10(a)), 평균 일치수(기대 0.8)와 z/이항 p, 등수별 적중 횟수 vs 기대 횟수, 누적 "기대 vs 실제" 곡선, 균등 전략(control) 대비 차이 CI. 사용자 번호도 하나의 전략(`user`)으로 집계.
- S8.4 각 회차 삽입 후 통계분석 자동 재실행(§S1.5) 결과와 이전 run의 차이 요약(유의 번호/쌍 변동, 전역 p 변동)을 실행 이력에 기록. (v0.9 구현) run 완료 시 같은 군의 직전 done run 과 비교한 `diff_vs_previous` 섹션(전역 p·유의 번호/쌍 집합 변동·최대 쌍·verdict 변화) 저장, 설정 화면 run 표에 요약 열.
- S8.5 추적 결과 CSV 내보내기, 티켓 단위 상세(어떤 run·전략·seed로 생성됐는지 역추적).
- S8.6 (v1.1, 사용자 요청) 티켓 단위 결과 조회: **회차·전략·출처(source: 추천/내 번호)·origin(사용자/검증 replay) 필터 + 표시 개수(20/50/100/200/500/전체)**, 서버 offset 페이징(limit ≤ 50,000), 필터 건수 요약(`GET /tracking/outcomes/summary`: 총건수·회차 목록·전략 목록·출처별 건수).

---

### E9. 전략 개선 루프 — 시뮬레이션 실험 (P0) — v0.7, 사용자 요청

목표: A 분석으로 전략·파라미터를 구성하고 B 실데이터로 검증·개선을 **반복**하며, 개선이 우연이 아닌지 확인한다. 실제 추첨이 아닌 시뮬레이션이므로 추천 메뉴의 별도 탭("전략 개선 루프")에서 확인한다.

- S9.1 **전략 파라미터화**: 각 전략에 튜닝 가능한 하이퍼파라미터와 범위를 정의(`GET /experiments/strategy-params`). 예: `frequency_hot` γ·window, `bayesian_shrink` strength, `pair_association` lift_power·floor, `pattern_typical` hdr, `analysis_weighted` β·λ·window.
- S9.2 **실험 1회(iteration)**: 전략·기준 파라미터·탐색(random|coordinate)·후보 수 K·튠/홀드아웃 구간·티켓 수·seed 를 받아 (a) K 후보를 B₁ 에서 replay(각 회차 t 는 t−1 이력만 사용, 균등 control 동시) (b) 균등 대비 평균 일치 차이로 최고 후보 선택 (c) 최고 후보만 B₂ 홀드아웃 replay (d) best-of-K 영분포 분위수·optimism·holdout z 계산 → `experiment` 레코드 저장(parent 링크, iteration 번호).
- S9.3 **계보(lineage)와 지속 개선 검정**: 전략별 실험 체인을 세대 순으로 조회, 홀드아웃 성과 추이·Spearman(iteration, holdout mean)·누적 홀드아웃 z 제공.
- S9.4 **활성화**: 특정 실험의 파라미터를 전략의 **활성 버전**으로 지정. 추천 생성은 활성 파라미터를 사용하고, 응답에 `params_used`·`experiment`(세대·홀드아웃 성과)·`analysis_basis`(사용한 군 A run, 이력 T, 상위 |z| 번호)를 포함한다 → 사용자 지시 2항("추천에서 군 A/B 내용 확인").
- S9.5 UI: 추천 화면 탭 "전략 개선 루프(시뮬레이션)": 활성 버전 카드, 새 실험 폼, 실험 표(튠 diff·best-of-K 분위수·홀드아웃 diff·optimism·판정), 세대별 홀드아웃 추이 차트(0.8 기준선, H0 best-of-K 대역), 활성화 버튼. 추천 생성 결과에 파라미터·세대·분석 근거 표시.
- 수용 기준: 시뮬 균등 데이터에서 K=8 실험의 홀드아웃 diff 가 0 을 포함하는 CI, best-of-K 분위수 계산 검증; 실 데이터 실험 1회 sync 완료; 활성화 후 추천 응답 `params_used` 일치.

## 7. 비기능 요구사항

| 항목 | 요구 |
| :-- | :-- |
| 운영 | local 전용. `make local-all`로 backend(8000)+frontend(5173) 동시 기동(honcho). 인증 없음, 외부 네트워크 불필요 |
| 성능 | 1,240회 기준 단일·쌍·그룹 분석 < 2초(MC 제외). MC B=10k 쌍 maxT < 60초(벡터화, 배치). 장기 작업은 백그라운드 + 진행률 |
| 재현성 | 모든 run에 데이터 해시·설정·seed·패키지 버전 저장. 동일 입력 → 동일 출력 |
| 정확성 | 이론값 단위테스트(예: $p_{ij}=1/66$, $E[O_t]=0.8$, $\mu_i$, $J$ 계수), MC 검정의 균등 데이터 대상 type-I error ≈ α 확인 |
| 유지보수 | 통계 모듈은 순수 함수(NumPy in/out), UI 의존 없음. 타입 힌트, ruff, mypy(basic), ESLint/Prettier |
| 테스트 | pytest 커버리지 ≥ 80%(엔진), vitest 컴포넌트, Playwright 스모크(P2) |
| 데이터 | SQLite 단일 파일(`data/lotto.db`) + `.npy` 캐시(`data/cache/`). 원본 xlsx 불변 |
| 접근성/UX | 색각 안전 팔레트(diverging: 파랑–회색–주황), 다크/라이트, 반응형 |
| 보안 | 로컬 바인딩(127.0.0.1) 기본. 업로드 파일은 xlsx/csv만, 크기 제한 |

---

## 8. 아키텍처와 소프트웨어 스택

### 8.1 선정 원칙

구현·유지보수 용이성 우선: 통계 생태계가 가장 성숙한 Python을 backend로, 인터랙티브 시각화(히트맵·네트워크)에 검증된 React+Plotly를 frontend로. DB는 파일 기반 SQLite(wise-dev-std 표준 local DB)로 설치 부담 제거. `/wise-dev-std:recommend` 결과(2026-09-08): 프로파일 `custom` = `python-fastapi` 베이스 + React SPA, 업종 `ict-saas` 베이스라인(개인 로컬이므로 규제 항목 해당 없음).

### 8.2 스택

| 영역 | 선택 | 대안(비채택 이유) |
| :-- | :-- | :-- |
| 언어/런타임 | Python 3.12, Node 22 | — |
| 패키지 | `uv` (backend), `pnpm` (frontend) | pip/poetry(속도), npm(디스크) |
| API | FastAPI + Pydantic v2, uvicorn, SQLAlchemy 2 + Alembic | Flask(타입·문서 약함) |
| 수치/통계 | NumPy, SciPy(`binom`, `hypergeom`, `multivariate_hypergeom`, `false_discovery_control`), statsmodels(`multipletests`, GLM NegBin), pandas | — |
| 패턴/그래프 | mlxtend(Apriori/FP-Growth), NetworkX | igraph(설치 부담) |
| 변화점 | ruptures | — |
| 저장 | SQLite(파일, 정형 결과·JSON payload) + `.npy`(영분포 캐시) | DuckDB/Parquet(P2), PostgreSQL(로컬 과다) |
| 설정 | pydantic-settings, `.env.local` | — |
| 프론트 | React 18 + TypeScript + Vite, TanStack Query, react-plotly.js, Tailwind CSS, shadcn/ui | Streamlit(단일 앱 요구와 불일치, 커스텀 UI 한계) |
| 테스트 | pytest, hypothesis(속성 테스트), vitest, Playwright(P2) | — |
| 품질 | ruff, mypy, ESLint, Prettier, pre-commit | — |
| 실행 | Makefile(`make local-all/local-logs/local-stop/test/lint`, honcho Procfile.dev), 선택 docker-compose | — |

### 8.3 구조

```text
Lotto-Rec/
├── .docs/                      # PRD, 조사문서, 원천 xlsx
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI 엔트리
│   │   ├── config.py           # pydantic-settings (.env.local)
│   │   ├── api/                # routers: data, analysis, validation, recommend, user
│   │   ├── core/               # 순수 통계 엔진 (UI 무의존)
│   │   │   ├── null_model.py       # 조합 확률, 기대값, MC 시뮬레이터
│   │   │   ├── frequency.py        # 단일 번호, J, G-test
│   │   │   ├── order_stats.py      # Coronel-Brizio Q 검정
│   │   │   ├── pairs.py            # 공출현, Lift*, Genest 가중 χ², maxT
│   │   │   ├── itemsets.py         # 3-집합, 조건부, 집합쌍
│   │   │   ├── groups.py           # 다변량 하이퍼지오메트릭 패턴
│   │   │   ├── temporal.py         # overlap, autocorr, runs, changepoint
│   │   │   ├── multiple_testing.py
│   │   │   ├── winners_model.py    # 당첨자수 회귀
│   │   │   ├── scoring.py          # 일치수 분포, Brier/log score
│   │   │   └── recommend/          # 전략, 가중 비복원 표본, 커버리지
│   │   ├── services/           # run 관리, 캐시, 백그라운드 작업
│   │   ├── db/                 # SQLAlchemy 모델·Alembic·리포지토리
│   │   └── schemas/            # Pydantic 모델
│   ├── tests/
│   └── pyproject.toml
├── frontend/
│   ├── src/{pages,components,api,hooks,lib}/
│   └── package.json
├── data/                       # lotto.db, cache/*.parquet (gitignore)
├── .env.local.example
├── Makefile
└── README.md
```

### 8.4 처리 흐름

```text
xlsx/csv ─► validate ─► 증분 upsert ─► draws/X_main/X_bonus/features/cohort (SQLite + Parquet)
                        │
                        ├─► analysis run (군 A | 군 B | 전체, preset)
                        │      frequency → pairs → itemsets → groups → temporal → MC/maxT → corrections
                        │      → result tables (run_id)
                        ├─► validation run (A→B: replication, homogeneity, backtest, scoring)
                        └─► recommend(strategy, count, seed) ─► tickets + scorecards + backtest summary
frontend ◄── REST/JSON (TanStack Query) ── FastAPI
```

---

## 9. 데이터·결과 스키마 (요지)

> 구현 결정(v0.4): 분석·검증 결과는 정규화 테이블 대신 **섹션별 JSON payload**(`analysis_result.section`, `validation_result.kind`)로 저장한다. 로컬 단일 사용자·재현 가능한 run 단위 조회에 충분하며 스키마 진화가 쉽다. 아래 컬럼 목록은 payload 내부 필드의 기준으로 유지한다.

| 테이블 | 키 컬럼 |
| :-- | :-- |
| `draws` | draw_no, n1..n6, bonus, prize1, winners1, prize2, winners2, cohort |
| `analysis_run` | run_id, data_hash, cohort, preset, alpha, correction, mc_iterations, seed, versions, created_at |
| `number_frequency` | run_id, number, role(main/bonus), observed, expected, residual, z, p, p_holm, q_bh, ci95_lo/hi |
| `global_tests` | run_id, test(pearson_x2, joe_J, g_test, order_stat_Q, pairs_genest, mc_uniformity), statistic, df, p_asymptotic, p_mc |
| `pair_association` | run_id, a, b, observed, expected, null_prob, cond_prob, calibrated_lift, residual, z, p, p_bonf, p_holm, q_bh, q_by, p_maxT, sig_bh, sig_fwer |
| `itemset_association` | run_id, itemset(json), size, observed, expected, null_prob, calibrated_lift, cond_target, cond_lift, p, q, method |
| `group_pattern` | run_id, scheme(odd_even/low_high/decade/last_digit/sum/consecutive), category, observed, expected, p, q |
| `temporal_tests` | run_id, test, target(number/lag), statistic, p, q, p_maxT |
| `changepoints` | run_id, series, position, score, p |
| `winners_model` | run_id, target(w1/w2), feature, coef, se, p, dispersion, fit_stats |
| `validation_result` | run_id_A, run_id_B, kind(replication/homogeneity/backtest/scoring), strategy, metric, value, ci_lo, ci_hi, null_value, p |
| `recommendation` | rec_id, run_id, strategy, params(json), seed, ticket(json), scorecard(json), target_draw_no, created_at |
| `user_ticket` | ticket_id, numbers(json), bonus, target_draw_no, created_at |
| `ticket_outcome` | outcome_id, ticket_ref(rec_id or ticket_id), source(recommendation/user), strategy, draw_no, main_matches, bonus_match, rank, prize_amount, evaluated_at |
| `experiment` | experiment_id, name, strategy, params, parent_id, iteration, tune_from/to, holdout_from/to, n_tickets, seed, search, n_candidates, candidates(json), metrics_tune, metrics_holdout, h0_benchmark, status, is_active, created_at |
| `import_log` | import_id, filename, data_hash, inserted, skipped_duplicate, conflicts(json), invalid(json), inserted_draws(json), triggered_run_id, created_at |
| `analysis_result` | id, run_id, section(summary/frequency/frequency_bonus/global/pairs/network/itemsets/groups/temporal/winners_model/null_summary), payload(json) |
| `validation_run` / `validation_result` | validation_id, run_id_a, params, status, progress, stage / kind(meta/backtest/scoring/replication/homogeneity), payload |

---

## 10. 환경변수 (`.env.local`)

변수명은 한국어 용어를 영어로 직역하고 `LOTTO_` 접두어를 붙인다.

| 변수 | 한국어 | 기본 | 설명 |
| :-- | :-- | :-- | :-- |
| `LOTTO_NUMBER_RECOMMENDATION_COUNT` | 로또번호 추천 갯수 | 10 | 자동 추천 티켓 수 (1–50) |
| `LOTTO_POOL_SIZE` | 번호 풀 크기 | 45 | $N$ |
| `LOTTO_MAIN_COUNT` | 본번호 개수 | 6 | $k$ |
| `LOTTO_TRAIN_END_DRAW` | 통계분석 마지막 회차 | 1000 | 군 A 경계 |
| `LOTTO_SOURCE_FILE` | 원천 파일 경로 | `.docs/lotto(~1240).xlsx` | 초기 적재 파일 |
| `LOTTO_DB_PATH` | DB 경로 | `data/lotto.db` | SQLite 파일 |
| `LOTTO_SIGNIFICANCE_LEVEL` | 유의수준 | 0.05 | α |
| `LOTTO_DEFAULT_CORRECTION` | 기본 보정법 | `fdr_bh` | bonferroni/holm/fdr_bh/fdr_by |
| `LOTTO_MC_ITERATIONS` | 몬테카를로 반복수 | 10000 | 프리셋 quick 기준 |
| `LOTTO_MC_ITERATIONS_REPORT` / `LOTTO_MC_ITERATIONS_DEEP` | report/deep 프리셋 반복수 | 100000 / 500000 | Q3: deep 기본값 정의, 시간 목표 없음 |
| `LOTTO_AUTO_RERUN_PRESET` | 자동 재실행 프리셋 | `quick` | 신규 회차 삽입 후 자동 분석 프리셋 (`off`로 비활성) |
| `LOTTO_TIMEZONE` | 표시 시간대 | `Asia/Seoul` | 모든 시각 표시(run·적재·대조·실험 생성 시각)는 이 IANA 시간대로. 백엔드는 UTC 저장·오프셋 포함 ISO 8601 반환, `/config` 로 노출 |
| `LOTTO_RUN_RETENTION` | 분석 run 보존 개수 | 20 | 완료 시 오래된 run 자동 정리 (0=무제한, 군별 최신·활성 실험 참조 run 보존) |
| `LOTTO_PRIZE_RANK3_DEFAULT` / `_RANK4_` / `_RANK5_` | 3·4·5등 고정 당첨금 | 1,500,000 / 50,000 / 5,000 | 회차 데이터 부재 시 성과 추적용 가정값 (Q4) |
| `LOTTO_RANDOM_SEED` | 난수 시드 | 20260908 | 재현성 |
| `LOTTO_MIN_EFFECT_DELTA` | 최소 효과크기 | 0.25 | 네트워크 엣지 $\lvert\mathrm{Lift}^*-1\rvert\ge\delta$ |
| `LOTTO_BACKEND_PORT` / `LOTTO_FRONTEND_PORT` | 포트 | 8000 / 5173 | 로컬 바인딩 127.0.0.1 |

`.env.local.example`을 저장소에 포함하고 `.env.local`은 gitignore.

---

## 11. API 설계 (v1, 요지)

| Method | Path | 설명 |
| :-- | :-- | :-- |
| POST | `/api/v1/data/import` | xlsx/csv **증분** 적재(중복 회차 제외, 충돌 보고) → import_log + 자동 재실행 run_id |
| POST | `/api/v1/data/draws` | 단일 회차 직접 입력(동일 증분 규칙) |
| GET | `/api/v1/data/imports` | 적재 이력 |
| GET | `/api/v1/data/summary` | 회차 범위, 군 분할, 정합성 결과 |
| POST | `/api/v1/analysis/runs` | {cohort, preset, alpha, correction, seed} → run_id (백그라운드) |
| GET | `/api/v1/analysis/runs/{run_id}` | 상태·진행률·메타 |
| GET | `/api/v1/analysis/runs/{run_id}/frequency` | 단일 번호 결과 |
| GET | `/api/v1/analysis/runs/{run_id}/global` | 전역 검정($J$, $Q$, Genest, MC) |
| GET | `/api/v1/analysis/runs/{run_id}/pairs` | 쌍 결과(필터: correction, alpha, min_lift) |
| POST | `/api/v1/analysis/runs/{run_id}/itemsets/query` | 사용자 지정 집합/조건부/집합쌍 조회 |
| GET | `/api/v1/analysis/runs/{run_id}/groups` | 그룹 패턴 |
| GET | `/api/v1/analysis/runs/{run_id}/temporal` | 시간 검정·변화점 |
| GET | `/api/v1/analysis/runs/{run_id}/network` | 노드/엣지(JSON) |
| POST | `/api/v1/validation/runs` | {run_id_A, strategies[], tickets_per_draw} → validation_id |
| GET | `/api/v1/validation/runs/{id}` | 재현성·동질성·backtest·scoring 결과 |
| POST | `/api/v1/recommend` | {strategy, count?, seed?, coverage?, constraints?} → tickets + scorecards + `past_wins`(과거 1·2등 회차, S4.9) + backtest 요약 |
| POST | `/api/v1/recommend/auto-register` | {target_draw_no?, seed?} → 무작위 빈도 상위 5 위치 → 전략별 최신 batch 티켓을 내 번호로 등록 (S4.10) |
| GET | `/api/v1/recommend/history` · `/summary` | 추천 이력(필터: origin, strategy, batch_id, target_draw_no; limit ≤50000, offset) — 행마다 `past_wins` 포함 |
| GET | `/api/v1/experiments/strategy-params` | 전략별 파라미터 스키마 |
| POST | `/api/v1/experiments/runs` | {strategy, base_params?, parent_id?, search, n_candidates, tune_from/to, holdout_from/to, tickets_per_draw, seed, sync} → experiment |
| GET | `/api/v1/experiments/runs[?strategy]` · `/{id}` · `/lineage?strategy=` · `/active` | 실험 목록·상세·계보(추이·Spearman)·활성 버전 |
| POST | `/api/v1/experiments/runs/{id}/activate` | 활성 파라미터 지정 |
| POST | `/api/v1/user/tickets/evaluate` | {numbers[6], bonus?} → 스코어카드 |
| GET/POST/DELETE | `/api/v1/user/tickets` | 저장 목록(target_draw_no 포함) |
| GET | `/api/v1/tracking/summary` | 전략별 누적 성과(일치수 분포·기대 대비·CI) |
| GET | `/api/v1/tracking/outcomes` | 티켓 단위 대조 결과(필터: strategy, draw_no, source, origin; limit ≤50000, offset) — 행마다 `past_wins` 포함 |
| GET | `/api/v1/tracking/outcomes/summary` | 필터 건수·회차/전략 목록·출처별 건수 |
| GET | `/api/v1/tracking/pending` | 미추첨 대기 티켓 |
| GET | `/api/v1/config` | 유효 설정(env) 조회 |

응답은 모든 검정에 `{statistic, p_value, p_adjusted, method, effect_size, ci, mc_iterations, seed}` 공통 블록을 포함한다.

---

## 12. 수용 기준과 검증 계획

### 12.1 이론값 단위테스트 (엔진)

- $p_{ij}=1/66$, $E[C_{ij}]=15.1515$ (T=1000), $\mathrm{Lift}_{H_0}=225/264\approx0.8523$, $\mathrm{Corr}=-1/44$.
- $E[O_t]=0.8$, $P(O_t=r)$ 하이퍼지오메트릭 값.
- $\mu_i=(N+1)i/(k+1)$, $V$의 성분식, $V^{-1}$ 삼중대각 확인.
- $J$ 계수 $44/39$; Genest $w_1,w_2$ 값과 가중 $\chi^2$ 평균 $\binom{N}{2}-\binom{k}{2}$.
- 일치수 분포 표(4.10(a)) 합 = 1, $E[X]=0.8$.
- 다중검정: 알려진 p 벡터에 대해 statsmodels 결과와 일치.

### 12.2 시뮬레이션 기반 검증

- 균등 시뮬 데이터 1,000세트에 대해 각 검정의 기각률 ≈ α(±MC 오차). 특히 보정 안 한 Pearson $X^2$가 과소기각, $J$가 정확함을 확인.
- 편향 주입 데이터(특정 번호 가중치 1.3배)에서 검정력 리포트. (v0.9) `simulate_biased_draws` + 테스트: 번호 하나의 **포함확률** 1.3배(0.133→0.173, A-Res 가중치는 이분탐색으로 보정), T=1,000·60세트 검정력 리포트: 미보정 단일 번호 정확검정 ≥ 0.85, Holm(45개) 보정 ≥ 0.45(이론 ≈0.65), omnibus Joe J ≥ 0.2(관측 ≈0.3). 즉 1.3배 편향은 개별 검정으로는 잘 잡히지만 다중검정 보정·전역 검정에서는 검정력이 절반 수준 — 전역과 개별을 함께 보고하는 이유.

### 12.3 실데이터 수용 기준

- 군 A 적재·분석(quick 프리셋) 성공, 개요 KPI 표시.
- 990쌍 결과 표에 BH q·maxT p 표시, 네트워크 렌더.
- 검증 화면: 8개 전략 × 240회 × N장 backtest 완료, 균등 대비 차이·CI·판정 표시.
- 추천 화면: `.env.local` 개수만큼 생성, 스코어카드·전략 backtest 요약 첨부, CSV 내보내기.
- 내 번호 화면: 6개 입력 → 스코어카드 < 1초.
- 재현성: 동일 seed로 run 2회 → 결과 테이블 동일(해시 비교).
- 증분 적재: Given 1~1,240회 적재 상태, When 1,235~1,245회 포함 CSV 업로드, Then 5건 삽입·6건 중복 제외 리포트, 자동 재실행 run 생성, 1,241~1,245 대상 티켓 대조 완료.
- 충돌: Given 1,240회 존재, When 번호가 다른 1,240회 업로드, Then 삽입 0건 + 충돌 1건 보고, 기존 데이터 불변.
- 성과 추적: Given 전략별 추천 저장(target 1,241), When 1,241회 입력, Then 전략별 일치수·등수·기대 대비 z 표시.

### 12.3-1 수용 기준 달성 현황 (v1.4, 2026-09-08)

| 기준 | 상태 | 근거 |
| :-- | :-- | :-- |
| §12.1 이론값 단위테스트 | ✅ | test_null_model_constants, test_engine (impl/2nd) |
| §12.2 균등 시뮬 기각률 ≈ α / 편향 검정력 리포트 | ✅ | test_engine (naive χ² 과소기각·J≈α), test_run_diff_retention_power (impl/8th) |
| §12.3 군 A 적재·분석·KPI / 990쌍·네트워크 / 검증 8전략 / 추천 N=env / 내 번호 <1s / 재현성 / 증분·충돌·성과추적 GWT | ✅ | impl/1st~4th, 라이브 스크린샷 |
| COMPLIANCE testing_additions — OpenAPI 계약 테스트 | ✅ | test_openapi_contract (impl/13th, 경로 스냅샷) |
| §7 Playwright 스모크 (P2) | ⏸ 잔여 | 브라우저 바이너리 다운로드가 `make local-build` 범위 밖. 대체: browse 스킬 라이브 스크린샷(impl/4th·9th~11th) |
| §7 pytest 커버리지 ≥80%(엔진) | ⏸ 미측정 | `uv run pytest --cov=app` 로 측정 가능, 게이트 미포함 |

### 12.4 테스트 산출물 저장

- 각 구현 단계 결과는 `test/impl/<Nth>/`에 시나리오·결과(마크다운+CSV) 저장(wise-dev-std 표준 준수).

---

## 13. 구현 로드맵

| Phase | 범위 | 완료 기준 | 상태 |
| :-- | :-- | :-- | :-- |
| 0. 기반 | 스택 확정, scaffold, `.env.local`, Makefile, SQLite 스키마(Alembic), xlsx/CSV 증분 적재·검증(E1) | `make local-all` 기동, 데이터 요약 API | ✅ |
| 1. 엔진 MVP | E2 S2.1/2.2/2.3/2.7/2.10/2.11, 이론값 단위테스트 | 군 A 분석 run 완료, 12.1 통과 | ✅ |
| 2. 대시보드 MVP | 개요·빈도·조합·그룹·설정 화면 | 12.3 첫 3항 | ✅ |
| 3. 검증·추천·추적 | E3, E4, E5, E8, S1.5, S2.12 | backtest·추천·내 번호·성과 추적 화면, 증분 업로드→자동 재실행 | ✅ |
| 4. 심화 | S2.4/2.5/2.6/2.8/2.9, 변화점, 네트워크 군집, `deep` 프리셋 최적화 | 12.2 시뮬 검증 리포트 | ✅ |
| 5. 마감 | README(한/영), 코드 리뷰(`/wise-dev-std:review`), 성능 튜닝, Playwright 스모크 | 전 수용 기준 통과 | ✅ README·문서 완료 / ⏸ Playwright(P2)·`/wise-dev-std:review` 선택 |

각 Phase 종료 시 본 PRD를 보완(변경 이력 §16).

---

## 14. 리스크와 대응

| 리스크 | 영향 | 대응 |
| :-- | :-- | :-- |
| MC 반복 비용(500k × 990쌍) | UI 지연 | 벡터화(incidence 배치 행렬곱), 사전 계산 캐시, 백그라운드 + 진행률, 프리셋 |
| 사용자가 "유의 = 예측 가능"으로 오해 | 잘못된 의사결정 | 고정 고지, 보정 후 값에만 배지, 추천 화면에 backtest 성과 강제 표시 |
| 군 B 표본(240회) 검정력 부족 | 미세 효과 미탐지 | CI 병기, 효과크기 중심 보고, 향후 회차 누적 시 자동 재검증 |
| 당첨자수 모형에 판매량 변수 부재 | 계수 편향 | 회차 추세(스플라인)로 판매규모 proxy, 상대 지수로만 제시 |
| 정렬 저장 데이터로 "추출 순서" 오해석 | 잘못된 분석 | 순서 분석은 순서통계량 검정만 허용, UI에 명시 |
| xlsx/CSV 포맷 변경 | 적재 실패 | 컬럼 매핑 설정화, 검증 리포트 |
| 잘못된 회차 업로드로 기존 데이터 오염 | 분석 왜곡 | draw_no 기준 멱등 삽입, 충돌은 보고만(덮어쓰기 명시 선택), import_log로 역추적 |
| 업로드마다 자동 재실행 부담 | 대기 시간 | 기본 quick 프리셋, `off` 옵션, 백그라운드 + 진행률 |

---

## 15. 참고문헌

**조사 문서**
- Perplexity, 「로또번호 무작위 추출 통계분석」(2026), `.docs/` — 비복원 영가설, 설계 보정 lift, MC/maxT, 다중검정, 시간 분석, 대시보드 설계 골격.

**논문·표준 (보강)**
- Genest, C., Lockhart, R. A., & Stephens, M. A. (2002). χ² and the lottery. *The Statistician (JRSS-D)*, 51(2), 243–257. — 비복원 추첨에서 Pearson 통계량의 가중 χ² 점근분포(단일·쌍·일반 부분집합). [PDF](https://www.sfu.ca/~lockhart/Research/Papers/GenestLockhartStephensJRSSD02.pdf)
- Joe, H. (1993). Tests of uniformity for sets of lotto numbers. *Statistics & Probability Letters*, 16, 181–188. — $J=(N-1)X^2/(N-k)$ 보정.
- Bellhouse, D. R. (1982). Fair is fair: new rules for Canadian lotteries. *Canadian Public Policy*, 8, 311–320.
- Coronel-Brizio, H. F., Hernández-Montoya, A. R., Rapallo, F., & Scalas, E. (2008). Statistical auditing and randomness test of lotto k/N-type games. *Physica A*, 387, 6385–6390. [arXiv:0806.4595](https://arxiv.org/abs/0806.4595) — 정렬 결과벡터의 평균·공분산과 $Q\sim\chi^2_k$ 검정.
- Haigh, J. (1997). The statistics of the National Lottery. *JRSS-A*, 160(2), 187–206. [DOI](https://doi.org/10.1111/1467-985X.00056) — 추첨 무작위성 검정과 의식적 선택.
- Cook, P. J., & Clotfelter, C. T. (1993). The peculiar scale economies of lotto. *American Economic Review*, 83(3), 634–643. — conscious selection 개념.
- Baker, R., & McHale, I. (2009). Modelling the probability distribution of prize winnings in the UK National Lottery: consequences of conscious selection. *JRSS-A*, 172(4), 813–834. [링크](https://academic.oup.com/jrsssa/article/172/4/813/7084574)
- Moffitt, S. D., & Ziemba, W. T. (2018). A method for winning at lotteries. [arXiv:1801.02958](https://arxiv.org/abs/1801.02958) — 비균등 구매 분포 이용한 기대수익 개선.
- Gneiting, T., & Raftery, A. E. (2007). Strictly proper scoring rules, prediction, and estimation. *JASA*, 102(477), 359–378. [PDF](https://sites.stat.washington.edu/raftery/Research/PDF/Gneiting2007jasa.pdf)
- Benjamini, Y., & Hochberg, Y. (1995). Controlling the false discovery rate. *JRSS-B*, 57(1), 289–300. Benjamini & Yekutieli (2001). *Ann. Statist.*, 29(4), 1165–1188.
- Westfall, P. H., & Young, S. S. (1993). *Resampling-Based Multiple Testing*. Wiley.
- NIST SP 800-22 Rev.1a (2010). A Statistical Test Suite for Random and Pseudorandom Number Generators. [링크](https://csrc.nist.gov/pubs/sp/800/22/r1/upd1/final)
- Efraimidis, P. S., & Spirakis, P. G. (2006). Weighted random sampling with a reservoir. *Information Processing Letters*, 97(5), 181–185. — 가중 비복원 표본추출.
- Killick, R., Fearnhead, P., & Eckley, I. A. (2012). Optimal detection of changepoints with a linear computational cost (PELT). *JASA*, 107(500), 1590–1598.

**소프트웨어 문서**
- SciPy `false_discovery_control`, `hypergeom`, `multivariate_hypergeom`; statsmodels `multipletests`; NumPy `Generator.choice(replace=False)`; mlxtend frequent_patterns; NetworkX; ruptures.

---

## 16. 가정·열린 질문·변경 이력

### 16.1 가정 (구현 중 확인)

- A1. 군 경계 1,000회는 고정 기본값이며 UI에서 변경 가능해야 한다.
- A2. 추천 개수 변수명은 `LOTTO_NUMBER_RECOMMENDATION_COUNT`로 확정(사용자 예시 `recommed_number_count`의 직역 대체).
- A3. 보너스번호는 본번호와 분리 모델링(7개 집합 통합 분석은 옵션).
- A4. 당첨자수 모형은 판매량 데이터 부재를 회차 추세 proxy로 대체한다.
- A5. 프론트엔드는 SPA 단일 페이지 라우팅, 서버 사이드 렌더링 불필요.

### 16.2 확정된 질문 (2026-09-08)

- Q1. 외부 자동 수집 **불필요**. xlsx/CSV 업로드 시 중복 회차 제외 증분 삽입(§3.4, §E1).
- Q2. **성과 추적 대시보드**로 진행. 추첨 결과 업로드/직접 입력 시 저장된 추천과 자동 대조하고 통계분석을 자동 재실행(§E8, §S1.5).
- Q3. `deep` 프리셋은 B=500,000 **기본값으로 정의**, 별도 실행 시간 목표 없음(§E7).

### 16.3 남은 열린 질문

- Q4. (v0.4 잠정 확정) 3~5등 고정 당첨금은 환경변수 `LOTTO_PRIZE_RANK{3,4,5}_DEFAULT` 로 설정(기본 1,500,000/50,000/5,000원). 사용자 확인 대기.
- Q5. (v0.9 잠정 확정) run 보존 개수는 환경변수 `LOTTO_RUN_RETENTION`(기본 20, 0=무제한). 완료 시 오래된 done run 을 자동 정리하되 군별 최신 run·활성 실험이 참조한 run 은 보존. 사용자 확인 대기.

### 16.4 변경 이력

| 버전 | 일자 | 내용 |
| :-- | :-- | :-- |
| 1.8 | 2026-09-09 | 사용자 요청: 내 번호 화면 '등록된 번호로 추첨 시도'(S5.5) — 1..N(저장 개수) 무작위 빈도 규칙으로 5개 선택, ★ 표시(UI 상태만, DB 저장 없음) |
| 1.7 | 2026-09-09 | 사용자 요청: '내 번호로 자동 등록' 규칙 문구를 하단 힌트 → 버튼 툴팁으로, 추천 이력 행의 '내 번호로 등록'은 확인 팝업 없이 즉시 등록 (S4.7/S4.10 UX) |
| 1.6 | 2026-09-09 | 사용자 요청: 추천 이력 '필터 초기화' 우측 '내 번호로 자동 등록' — 1..P 중 5개 무작위 추출을 대상 회차 수만큼 반복해 빈도 상위 5 위치 선택 → 전략별 최신 batch 티켓 등록 (S4.10, `POST /recommend/auto-register`) |
| 1.5 | 2026-09-09 | 사용자 요청: 추천 티켓이 과거 회차 1·2등 조합과 일치하면 '티켓' 열에 `(회차)` 를 작고 회색으로 표시 (S4.9, `past_wins` 필드 — recommend 응답·이력·tracking outcomes) |
| 1.4 | 2026-09-08 | PRD 잔여 스캔: OpenAPI 계약 테스트(경로 스냅샷·응답 형태) 추가, §12.3-1 수용기준 현황표, §13 로드맵 상태, Playwright(P2) 잔여 명시 |
| 1.3 | 2026-09-08 | 사용자 요청: 시각 표시 KST(UTC+9). 원인 = SQLite 가 tz 를 버려 naive ISO 반환 → 브라우저가 로컬로 오해. 백엔드 `to_iso()` 로 UTC 오프셋 명시, `LOTTO_TIMEZONE`(.env, 기본 Asia/Seoul) → `/config.timezone` → 프론트 `fmtDate` Intl timeZone |
| 1.2 | 2026-09-08 | 사용자 요청: 비전문가용 용어 툴팁(`Term`, 설명+위키/논문 링크) 전 화면 적용 + 용어 사전 페이지 `/glossary` |
| 1.1 | 2026-09-08 | 사용자 요청: 성과 추적 티켓 단위 결과에 회차·전략·출처 필터 + 표시 개수 + 건수 요약 (S8.6, `GET /tracking/outcomes` offset/limit 확장, `GET /tracking/outcomes/summary`) |
| 1.0 | 2026-09-08 | 사용자 요청: 필터/폼 정렬 오류 수정(Field 3줄 고정·items-start), 표시명 "Lotto number recommender" 2줄, 우측 상단 플로팅 테마 메뉴(light/dark/system) |
| 0.9 | 2026-09-08 | PRD 잔여 스캔: S8.4 run 간 차이 요약(`diff_vs_previous`), Q5 run 보존(`LOTTO_RUN_RETENTION`), §12.2 편향 주입 검정력 테스트 구현 |
| 0.8 | 2026-09-08 | 사용자 보고 "표시 개수 전체인데 20건" → 원인: 사용자 저장 티켓이 20장, replay 19,200장은 origin=backtest 로 제외되던 설계. 이력·요약 API 에 `origin` 필터 추가, UI 출처 셀렉트·출처 열 (S4.6) |
| 0.7 | 2026-09-08 | 사용자 요청: A 분석→추천→B 검증→개선 **반복 루프**와 그 유의성 검증. E9 신설(전략 파라미터화·실험 iteration·튠/홀드아웃·best-of-K 영분포·optimism·계보 Spearman·활성화), §4.12 이론, S4.8 추천 응답에 분석 근거·파라미터 표시, `analysis_weighted` 전략 추가, `experiment` 테이블 |
| 0.6 | 2026-09-08 | 사용자 요청: (a) 추천 이력 20건 제한 → 전략·대상회차·batch 필터 + 표시 개수(전체) + 서버 offset 페이징 + 건수 요약 (S4.6, `GET /recommend/history` 확장, `GET /recommend/history/summary` 추가); (b) 추천 카드·추천 이력에서 '내 번호로 등록' (S4.7) |
| 0.5 | 2026-09-08 | E6 대시보드 10화면 구현·검증(vitest 14, 라이브 스크린샷 6, 콘솔 오류 0). Procfile/Makefile pnpm 호출을 `cd frontend &&` 로 수정(corepack 버전 핀 충돌). 전체 회귀 `make test`(pytest 41 + vitest 14)·`make lint` 통과 |
| 0.4 | 2026-09-08 | 구현 반영: 결과 저장을 섹션별 JSON payload 로 결정, 당첨금 기본값 env 추가, replay backtest 설계(회차별 t-1 이력·전략 8종·티켓 N장, origin=backtest 로 성과추적 공유), 검증 결과 기록(§17), 당첨자수 모형 VIF·공선성 주석 추가 |
| 0.3 | 2026-09-08 | `/wise-dev-std:recommend` 반영: 프로파일 custom(python-fastapi + react SPA), 업종 ict-saas, DuckDB → SQLite + Parquet, 실행 진입점 `make local-all` |
| 0.2 | 2026-09-08 | Q1~Q3 확정 반영: 증분 업로드(중복 회차 제외·충돌 보고), 성과 추적 Epic E8·테이블·API·화면 추가, 업로드 후 자동 재분석, deep 프리셋 기본값 정의, In/Out·성공지표 표 추가, GWT 수용 기준 추가 |
| 0.1 | 2026-09-08 | 초안. Perplexity 조사 반영, 논문 보강(Joe/Genest/Coronel-Brizio/Haigh/Baker-McHale/Moffitt-Ziemba/Gneiting-Raftery), 데이터 정합성 실측, 스택·API·스키마·로드맵 정의 |

---

## 17. 구현 결과 기록 (2026-09-08, v0.4)

### 17.1 군 A(1~1,000회) 분석 — quick 프리셋(B=10,000, seed 20260908, 19.3s)

| 검정 | 통계량 | p | 판정 |
| :-- | --: | --: | :-- |
| Joe 보정 카이제곱 $J$ (df 44) | 33.0 | 0.888 (MC 0.889) | 균등과 일치 |
| 순서통계량 $Q$ (df 6) | — | MC 0.341 | 일치 |
| 번호쌍 최대 \|z\| (11–21) | 3.07 | maxT 0.972 | 우연 범위 |
| Genest 쌍 전역 $X^2$ | — | MC 0.926 | 일치 |
| BH 유의 번호 / 쌍 | 0 / 0 | — | — |
| 인접 회차 중복 평균 | 0.830 (기대 0.8) | — | 일치 |
| CUSUM 최대 (번호 9, 944회) | 2.87 | MC 0.295 | 변화점 없음 |

결론: **군 A 는 균등·독립 비복원추출 영가설과 모든 축에서 일치.** 군 B(240회)·전체(1,240회) run 도 동일 결론(J p=0.393 / 0.877).

### 17.2 replay backtest (1,001~1,240회, 8전략 × 10장 = 19,200장, 34s)

| 전략 | 평균 일치수 (기대 0.800) | z | ≥3 일치 (기대 57.2) | 4등/5등 | 균등 대비 차이 [95% CI] | 판정 |
| :-- | --: | --: | --: | --: | :-- | :-- |
| uniform (control) | 0.795 | −0.29 | 63 | 5 / 58 | — | 기준선 |
| frequency_hot | 0.790 | −0.62 | 56 | 4 / 52 | −0.005 [−0.049, 0.037] | 차이 없음 |
| frequency_cold | 0.766 | −2.11 | 61 | 4 / 57 | −0.029 [−0.083, 0.023] | 차이 없음 |
| bayesian_shrink | 0.810 | +0.62 | 63 | 6 / 57 | +0.015 [−0.032, 0.056] | 차이 없음 |
| pair_association | 0.798 | −0.16 | 51 | 3 / 48 | +0.002 [−0.042, 0.047] | 차이 없음 |
| pattern_typical | 0.798 | −0.10 | 53 | 0 / 53 | +0.003 [−0.043, 0.048] | 차이 없음 |
| low_competition | 0.766 | −2.11 | 67 | 5 / 62 | −0.029 [−0.095, 0.035] | 차이 없음 |
| hybrid | 0.807 | +0.42 | 60 | 6 / 54 | +0.011 [−0.049, 0.073] | 차이 없음 |

- 1~3등 적중 0건(전 전략). ROI −76%~−89%(4·5등 고정 당첨금 가정).
- 스코어링 규칙: 어떤 전략도 균등 예보보다 Brier/log score 개선 없음. `frequency_cold` 는 log score 유의하게 악화(−3.2).
- 재현성: 군 A 원시 p<.05 후보 번호 1개·쌍 29개 중 군 B 같은 방향 재현 **0개**(H0 기대 2.5%). Lift* 벡터 A–B 상관 r=0.039 (p=0.23, 기대 0).
- 동질성: A vs B 빈도 보정 χ² p=0.383 → 동질.

**해석**: 이론과 정확히 일치한다. 통계 기반 전략은 당첨확률을 바꾸지 못하며, 플랫폼은 이를 스스로 측정·표시한다. `low_competition` 의 가치는 당첨확률이 아닌 당첨 시 분배금(공유자 수)에 있으므로 1등 적중이 없는 240회에서는 검증 불가(장기 추적 필요).

### 17.3 당첨자수 모형 (군 A, 음이항)

birthday_count(−0.081, p=.003)·consecutive_pairs(−0.058, p=.005)·sum(−0.004, p=.008) 유의. 단 sum·low_count·birthday_count VIF 4~8 로 공선성 존재(birthday~sum r=−0.82) — 계수는 조건부 효과. 축소 모형(AIC 5191)보다 전체 모형(AIC 5178)이 우수하여 유지. 한국 로또의 높은 자동 구매 비율로 의식적 선택 효과가 약할 가능성 명시.

### 17.4 전략 개선 루프 실험 (v0.7, 2026-09-08) — `analysis_weighted`

| 세대 | 탐색 | K | 튠 B₁(1,001~1,120) 균등 대비 diff | H0 best-of-K 기대 diff | 홀드아웃 B₂(1,121~1,240) diff [95% CI] | optimism | 판정 |
| --: | :-- | --: | --: | --: | :-- | --: | :-- |
| 1 | random | 8 | +0.0067 (분위 1.3%) | +0.0455 (q95 0.079) | −0.0208 [−0.096, 0.059] | +0.0275 | 개선 소멸(평균 회귀) |
| 2 | coordinate | 6 | +0.0250 | — | −0.0583 [−0.142, 0.022] | +0.0833 | 개선 소멸(평균 회귀) |

선택된 파라미터 β≈1.04, λ≈0.57, window 516. 튠 구간에서 최고로 뽑힌 후보조차 H0 best-of-K 기대값(+0.046)에 못 미치고, 홀드아웃에서는 음수로 회귀 — **A 분석 기반 가중이 적중율을 지속적으로 높인다는 증거 없음**. 이것이 §4.12 가 예측한 결과이며, 플랫폼은 세대가 누적될수록 Spearman 추세 검정(n≥4)으로 같은 질문에 계속 답한다.
