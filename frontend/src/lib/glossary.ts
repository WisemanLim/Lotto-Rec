/** 용어 사전 (PRD §E6 공통 UX v1.2) — 통계 지식이 없는 사용자를 위한 쉬운 설명 + 참고 링크. Term 툴팁·/glossary 페이지 공용. */

export type GlossaryCategory = '기본 개념' | '검정과 보정' | '전역 검정' | '쌍·집합' | '그룹·시간' | '추천·검증' | '성과·평가';

export interface GlossaryLink {
  label: string;
  url: string;
}

export interface GlossaryTerm {
  id: string;
  label: string;
  category: GlossaryCategory;
  /** 1~2문장, 일상 언어 우선. */
  short: string;
  /** 선택: 조금 더 자세한 설명 또는 이 플랫폼에서의 사용 방식. */
  detail?: string;
  links?: GlossaryLink[];
}

const W = (t: string) => `https://ko.wikipedia.org/wiki/${encodeURIComponent(t)}`;
const WE = (t: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(t)}`;

export const GLOSSARY: GlossaryTerm[] = [
  // ── 기본 개념 ──────────────────────────────────────────────
  {
    id: 'null_hypothesis',
    label: '영가설 (공정 추첨 가정)',
    category: '기본 개념',
    short: '"45개 번호 중 6개가 매 회 똑같은 확률로, 서로 독립적으로 뽑힌다"는 가정. 이 플랫폼의 모든 검정은 이 가정과 데이터가 얼마나 맞는지를 본다.',
    detail: '기호 H₀. 검정은 영가설을 "증명"하지 못하고, 데이터가 영가설과 "충돌하는지"만 말해 준다.',
    links: [{ label: '위키백과: 귀무가설', url: W('귀무가설') }],
  },
  {
    id: 'null_distribution',
    label: '영분포',
    category: '기본 개념',
    short: '공정한 추첨이라면 어떤 값들이 어떤 빈도로 나오는지의 분포. 관측값이 이 분포에서 얼마나 극단적인지로 p-value 를 계산한다.',
    detail: '그룹 패턴에서는 홀짝·저고·구간처럼 "몇 개가 그룹에 속하나"는 하이퍼지오메트릭 분포로 정확히, 합·연속수·끝수처럼 수식이 복잡한 특성은 몬테카를로(MC) 시뮬레이션으로 영분포를 만든다.',
    links: [
      { label: '위키백과(영): Null distribution', url: WE('Null_distribution') },
      { label: '위키백과: 초기하분포', url: W('초기하분포') },
    ],
  },
  {
    id: 'hypergeom',
    label: '하이퍼지오메트릭(초기하) 분포',
    category: '기본 개념',
    short: '공 45개 중 특정 그룹(예: 홀수 23개)이 있을 때, 6개를 뽑으면 그중 몇 개가 그룹에 속할지의 정확한 확률분포. 비복원 추출(뽑은 공은 다시 넣지 않음)에 맞는 분포다.',
    detail: '홀수 개수의 기대값은 6×23/45 ≈ 3.07. 홀수 3개·짝수 3개가 가장 흔하고, 6개 전부 홀수는 약 2.2%.',
    links: [{ label: '위키백과: 초기하분포', url: W('초기하분포') }],
  },
  {
    id: 'mc',
    label: '몬테카를로(MC) 시뮬레이션',
    category: '기본 개념',
    short: '공정한 추첨을 컴퓨터로 수천~수십만 번 흉내 내어 "공정하면 이 정도 값이 나온다"는 영분포를 만드는 방법. 수식으로 풀기 어려운 통계량에도 쓸 수 있다.',
    detail: 'quick 프리셋 10,000회, report 100,000회, deep 500,000회. p_MC = (1 + 관측값 이상인 시뮬 횟수) / (시뮬 횟수 + 1).',
    links: [{ label: '위키백과: 몬테카를로 방법', url: W('몬테카를로_방법') }],
  },
  {
    id: 'p_value',
    label: 'p-value (유의확률)',
    category: '기본 개념',
    short: '공정한 추첨이라고 가정했을 때, 지금 관측한 값 이상으로 극단적인 결과가 우연히 나올 확률. 작을수록 "우연으로 보기 어렵다"는 뜻이지만, 0.05 는 관례적 기준일 뿐 증명은 아니다.',
    links: [{ label: '위키백과: 유의확률', url: W('유의_확률') }],
  },
  {
    id: 'alpha',
    label: '유의수준 α',
    category: '기본 개념',
    short: '"이 정도로 드물면 우연이 아니라고 보자"는 기준선. 보통 0.05(5%). 공정한 추첨이어도 검정 20개 중 1개는 이 기준을 넘는다.',
    links: [{ label: '위키백과: 유의수준', url: W('유의_수준') }],
  },
  {
    id: 'z_score',
    label: 'z 점수 (표준화 잔차)',
    category: '기본 개념',
    short: '관측값이 기대값에서 표준편차 몇 배만큼 떨어져 있는지. |z| 가 2 를 넘으면 대략 5% 수준의 드문 값, 3 을 넘으면 0.3% 수준.',
    detail: '번호별 z = (출현수 − 133.3) / 10.75 (1,000회 기준).',
    links: [{ label: '위키백과: 표준 점수', url: W('표준_점수') }],
  },
  {
    id: 'ci',
    label: '신뢰구간 (CI)',
    category: '기본 개념',
    short: '같은 실험을 반복하면 95% 는 이 범위 안에 참값이 들어온다는 구간. 구간이 0 을 포함하면 "차이 없음"과 구별할 수 없다는 뜻.',
    links: [{ label: '위키백과: 신뢰 구간', url: W('신뢰_구간') }],
  },
  {
    id: 'prediction_interval',
    label: '예측구간 (PI 95%/99%)',
    category: '기본 개념',
    short: '공정한 추첨이라면 번호별 출현 횟수가 이 범위 안에 들어올 확률이 95%(또는 99%)인 구간. 밖에 있어도 45개 중 2~3개는 우연히 벗어나는 것이 정상.',
    links: [{ label: '위키백과(영): Prediction interval', url: WE('Prediction_interval') }],
  },
  {
    id: 'effect_size',
    label: '효과크기',
    category: '기본 개념',
    short: '"유의한가"가 아니라 "얼마나 다른가"를 나타내는 크기. 이 플랫폼에서는 설계 보정 Lift*, 평균 일치수 차이, z 등이 효과크기 역할을 한다.',
    links: [{ label: '위키백과: 효과 크기', url: W('효과_크기') }],
  },
  {
    id: 'cohort',
    label: '군 A / 군 B',
    category: '기본 개념',
    short: '군 A(1~1,000회)는 통계분석·전략 학습용, 군 B(1,001회~)는 그 결과를 검증하는 시험지. 군 B 를 보고 군 A 규칙을 고치면(look-ahead) 검증이 무의미해진다.',
    detail: '경계는 .env 의 LOTTO_TRAIN_END_DRAW.',
    links: [{ label: '위키백과(영): Training, validation, and test data sets', url: WE('Training,_validation,_and_test_data_sets') }],
  },
  {
    id: 'interpretation',
    label: '해석 원칙',
    category: '기본 개념',
    short: '통계적으로 유의하다 ≠ 예측할 수 있다 ≠ 조작되었다. 공정한 추첨이라면 어떤 전략도 당첨확률을 높이지 못하며, 이 플랫폼은 그 사실을 스스로 측정해 보여준다.',
  },

  // ── 검정과 보정 ────────────────────────────────────────────
  {
    id: 'multiple_testing',
    label: '다중검정 문제',
    category: '검정과 보정',
    short: '검정을 990번(번호쌍) 하면 공정한 추첨에서도 약 50개는 우연히 p<0.05 가 나온다. 그래서 "보정" 없이 p<0.05 만으로 패턴을 주장할 수 없다.',
    links: [{ label: '위키백과: 다중 비교', url: W('다중_비교') }],
  },
  {
    id: 'bonferroni',
    label: 'Bonferroni 보정',
    category: '검정과 보정',
    short: '가장 단순하고 엄격한 보정: 기준 α 를 검정 개수로 나눈다(0.05/990 ≈ 0.00005). 거짓 양성은 거의 없지만 진짜 패턴도 놓치기 쉽다.',
    links: [{ label: '위키백과: 본페로니 교정', url: W('본페로니_교정') }],
  },
  {
    id: 'holm',
    label: 'Holm 보정',
    category: '검정과 보정',
    short: 'Bonferroni 처럼 "단 하나라도 거짓 양성이 나올 확률(FWER)"을 통제하지만 덜 보수적. 핵심 결론을 확인할 때 쓴다.',
    links: [{ label: '위키백과(영): Holm–Bonferroni method', url: WE('Holm%E2%80%93Bonferroni_method') }],
  },
  {
    id: 'fdr_bh',
    label: 'BH q-value (FDR)',
    category: '검정과 보정',
    short: '"유의하다고 뽑은 것들 중 거짓의 비율(FDR)"을 통제하는 보정값. q<0.05 는 "발견 중 5% 정도는 거짓일 수 있음"이라는 뜻. 탐색용 기본 보정.',
    links: [
      { label: '위키백과: 거짓 발견율', url: W('거짓_발견율') },
      { label: 'Benjamini & Hochberg (1995)', url: 'https://academic.oup.com/jrsssb/article/57/1/289/7035855' },
    ],
  },
  {
    id: 'fdr_by',
    label: 'BY q-value',
    category: '검정과 보정',
    short: 'BH 의 보수적 버전. 검정들이 서로 얽혀 있어도(같은 회차를 공유하는 번호쌍처럼) FDR 을 보장한다. 3개 이상 조합에 사용.',
    links: [{ label: '위키백과: 거짓 발견율', url: W('거짓_발견율') }],
  },
  {
    id: 'maxT',
    label: 'maxT (FWER, Westfall–Young)',
    category: '검정과 보정',
    short: '시뮬레이션마다 "가장 극단적인 값"만 모아 만든 분포로 판정. "990쌍 중 가장 특이한 쌍조차 공정 추첨에서 흔한가?"에 답한다. 사후 선택 편향을 정확히 반영.',
    links: [{ label: '위키백과(영): Familywise error rate', url: WE('Family-wise_error_rate') }],
  },
  {
    id: 'exploratory',
    label: '탐색 후보',
    category: '검정과 보정',
    short: '보정 전 p<0.05 인 항목. "우연일 수 있는 관심 후보"일 뿐 결론이 아니다. 보정 후(q, maxT)에도 남아야 유의.',
  },
  {
    id: 'exact_binomial',
    label: '정확 이항검정',
    category: '검정과 보정',
    short: '번호 i 가 T 회 중 나온 횟수는 이항분포(T, 6/45)를 따른다. 그 분포에서 관측 횟수의 양측 p 를 정확히 계산한다.',
    links: [{ label: '위키백과: 이항 검정', url: W('이항_검정') }],
  },

  // ── 전역 검정 ──────────────────────────────────────────────
  {
    id: 'joe_J',
    label: 'Joe 보정 카이제곱 J',
    category: '전역 검정',
    short: '45개 번호 빈도가 전체적으로 균등한지 보는 검정. 비복원 추출 때문에 일반 카이제곱은 p 를 과대평가하므로 (N−1)/(N−k)=44/39 배 보정한다(Joe 1993, Bellhouse 1982).',
    links: [
      { label: '위키백과: 카이제곱 검정', url: W('카이제곱_검정') },
      { label: 'Genest, Lockhart & Stephens (2002) χ² and the lottery', url: 'https://www.sfu.ca/~lockhart/Research/Papers/GenestLockhartStephensJRSSD02.pdf' },
    ],
  },
  {
    id: 'pearson_naive',
    label: 'Pearson χ² (참고용)',
    category: '전역 검정',
    short: '교과서의 카이제곱 적합도 통계량. 로또처럼 6개를 비복원으로 뽑는 데이터에는 분포가 맞지 않아 참고용으로만 표시한다.',
    links: [{ label: '위키백과: 카이제곱 검정', url: W('카이제곱_검정') }],
  },
  {
    id: 'g_test',
    label: 'G-test',
    category: '전역 검정',
    short: '카이제곱과 같은 목적의 우도비 기반 검정. 여기서는 Joe 계수로 보정해 보조 지표로 쓴다.',
    links: [{ label: '위키백과(영): G-test', url: WE('G-test') }],
  },
  {
    id: 'order_stat_Q',
    label: '순서통계량 Q 검정',
    category: '전역 검정',
    short: '정렬된 6개 번호의 각 자리(가장 작은 수, 두 번째 …)의 평균이 이론값(6.6, 13.1, 19.7, 26.3, 32.9, 39.4)과 맞는지 보는 검정. 자유도 6 카이제곱.',
    links: [{ label: 'Coronel-Brizio et al. (2008) arXiv:0806.4595', url: 'https://arxiv.org/abs/0806.4595' }],
  },
  {
    id: 'genest',
    label: 'Genest 쌍 전역 검정',
    category: '전역 검정',
    short: '990개 번호쌍의 공출현 편차를 한 번에 합산한 검정. 점근분포가 두 카이제곱의 가중합이라(Genest 2002) 몬테카를로로 p 를 구한다.',
    links: [{ label: 'Genest, Lockhart & Stephens (2002)', url: 'https://www.sfu.ca/~lockhart/Research/Papers/GenestLockhartStephensJRSSD02.pdf' }],
  },
  {
    id: 'verdict',
    label: '판정 (균등 영가설과 일치)',
    category: '전역 검정',
    short: '전역 검정(J·Q·Genest)·FWER 유의 쌍·시간 의존성 경보 중 하나라도 유의하면 "불일치". 모두 비유의면 "공정 추첨 가정과 일치".',
  },

  // ── 쌍·집합 ───────────────────────────────────────────────
  {
    id: 'cooccurrence',
    label: '공출현',
    category: '쌍·집합',
    short: '두 번호가 같은 회차의 본번호 6개에 함께 들어간 횟수. 공정하면 1,000회 중 약 15.2회(1/66) 가 기대값.',
  },
  {
    id: 'calibrated_lift',
    label: '설계 보정 Lift*',
    category: '쌍·집합',
    short: '관측 공출현 ÷ 공정 추첨 기대 공출현. 1 이면 정상, 1.5 면 기대보다 1.5배 자주 함께 나왔다는 뜻. 일반 lift 는 비복원 추출 탓에 공정해도 0.85 가 나와 부적합하다.',
    links: [{ label: '위키백과(영): Lift (data mining)', url: WE('Lift_(data_mining)') }],
  },
  {
    id: 'lift_naive',
    label: '일반 lift',
    category: '쌍·집합',
    short: 'P(i,j)/(P(i)P(j)). 장바구니 분석에서는 1 이 "독립"이지만, 한 회차에 6개만 뽑는 구조에서는 공정해도 45·5/(6·44)=0.852 가 되므로 그대로 쓰면 오해한다.',
  },
  {
    id: 'structural_negative_corr',
    label: '구조적 음의 상관 (−1/44)',
    category: '쌍·집합',
    short: '한 회차에 6개만 뽑히므로 번호 1 이 나오면 다른 번호가 나올 자리가 줄어든다. 그래서 공정한 추첨에서도 모든 번호쌍의 상관은 −0.0227 이다. "음의 상관 발견"은 이상 징후가 아니다.',
  },
  {
    id: 'conditional_prob',
    label: '조건부 확률 P(1 | 2,3)',
    category: '쌍·집합',
    short: '2 와 3 이 나온 회차 중 1 도 나온 비율. 공정 기준은 4/43 ≈ 9.3% 이고, 무조건부 13.3% 와 비교하면 틀린 결론이 난다.',
    links: [{ label: '위키백과: 조건부 확률', url: W('조건부_확률') }],
  },
  {
    id: 'itemset',
    label: '3-집합 (삼중항)',
    category: '쌍·집합',
    short: '세 번호가 함께 나온 횟수. 1,000회에서 기대값은 약 1.4회로 매우 희소해 "유의" 판정보다 탐색용이다. 4개 이상은 0회가 정상.',
  },
  {
    id: 'network',
    label: '공출현 네트워크',
    category: '쌍·집합',
    short: '번호를 점, 유의한(또는 상위) 쌍을 선으로 그린 그림. 선의 굵기는 |z|. 시각화 보조이며 선 하나하나가 독립 증거는 아니다.',
  },

  // ── 그룹·시간 ─────────────────────────────────────────────
  {
    id: 'group_pattern',
    label: '그룹 패턴 (홀짝·저고·구간)',
    category: '그룹·시간',
    short: '6개 중 홀수·저번호(1~22)·구간(1~10 등)·생일수(1~31)·소수 가 몇 개인지의 분포를 하이퍼지오메트릭 이론값과 비교한다.',
    links: [{ label: '위키백과: 초기하분포', url: W('초기하분포') }],
  },
  {
    id: 'typicality',
    label: '전형성 (마할라노비스)',
    category: '그룹·시간',
    short: '합·홀짝·연속수·끝수 등 특성이 "보통 조합"에 얼마나 가까운지. 1,2,3,4,5,6 은 매우 비전형적이지만 당첨확률은 다른 조합과 똑같이 1/8,145,060 이다.',
    links: [{ label: '위키백과: 마할라노비스 거리', url: W('마할라노비스_거리') }],
  },
  {
    id: 'overlap',
    label: '인접 회차 중복수',
    category: '그룹·시간',
    short: '연속 두 회차에 같은 번호가 몇 개 겹치는지. 공정하면 평균 0.8개 — 1개 겹침은 매우 정상이고 3개 이상 겹침도 가끔 나온다.',
  },
  {
    id: 'autocorr',
    label: '자기상관 (lag ℓ)',
    category: '그룹·시간',
    short: '어떤 번호가 나온 뒤 ℓ 회 후에 다시 나오는(또는 안 나오는) 경향. 공정하면 0 근처. 45개 번호 × 10 lag 를 보므로 보정·maxT 필수.',
    links: [{ label: '위키백과: 자기상관', url: W('자기상관') }],
  },
  {
    id: 'runs_test',
    label: 'Runs 검정',
    category: '그룹·시간',
    short: '한 번호의 출현/미출현 열이 뭉쳐서 나오는지(군집) 또는 너무 규칙적으로 교대하는지 보는 검정.',
    links: [{ label: '위키백과(영): Wald–Wolfowitz runs test', url: WE('Wald%E2%80%93Wolfowitz_runs_test') }],
  },
  {
    id: 'gap',
    label: '출현 간격 (기하분포)',
    category: '그룹·시간',
    short: '한 번호가 다시 나오기까지 걸린 회차 수. 공정하면 평균 7.5회이고 기하분포를 따른다. "오래 안 나왔으니 나올 차례"는 성립하지 않는다(도박사의 오류).',
    links: [{ label: '위키백과: 도박사의 오류', url: W('도박사의_오류') }],
  },
  {
    id: 'ljung_box',
    label: 'Ljung–Box 검정',
    category: '그룹·시간',
    short: '회차별 합·홀수 개수 같은 시계열이 여러 lag 에 걸쳐 자기상관을 갖는지 한 번에 보는 검정.',
    links: [{ label: '위키백과(영): Ljung–Box test', url: WE('Ljung%E2%80%93Box_test') }],
  },
  {
    id: 'cusum',
    label: 'CUSUM 변화점',
    category: '그룹·시간',
    short: '기대값과의 편차를 누적한 값. 어느 시점부터 특정 번호가 갑자기 많이/적게 나오기 시작했는지(장비·규칙 변경 의심)를 탐지. 유의성은 MC 로.',
    links: [{ label: '위키백과(영): CUSUM', url: WE('CUSUM') }],
  },
  {
    id: 'pelt',
    label: 'PELT 변화점 탐지',
    category: '그룹·시간',
    short: '시계열을 구간별로 나눠 통계적 성질이 바뀐 지점을 찾는 알고리즘. 다중 시점 탐색이라 결과는 후보일 뿐 확증이 아니다.',
    links: [{ label: 'Killick et al. (2012) PELT', url: 'https://arxiv.org/abs/1101.1438' }],
  },

  // ── 추천·검증 ─────────────────────────────────────────────
  {
    id: 'uniform_control',
    label: '균등 무작위 (기준선, control)',
    category: '추천·검증',
    short: '아무 정보 없이 45개 중 6개를 동일 확률로 뽑는 전략. 모든 전략은 이 기준선과 같은 조건에서 비교되며, 공정 추첨이면 어떤 전략도 이보다 나을 수 없다.',
  },
  {
    id: 'weighted_sampling',
    label: '가중 비복원 표본추출 (A-Res)',
    category: '추천·검증',
    short: '번호마다 가중치를 두고 중복 없이 6개를 뽑는 방법(Efraimidis–Spirakis). 가중치가 크면 더 자주 뽑히지만, 가중치 1.3 이 곧 포함확률 1.3배는 아니다.',
    links: [{ label: '위키백과(영): Reservoir sampling (A-Res)', url: WE('Reservoir_sampling') }],
  },
  {
    id: 'bayes_shrink',
    label: '베이즈 축소',
    category: '추천·검증',
    short: '관측 빈도를 그대로 믿지 않고 "모든 번호는 6/45" 라는 사전 믿음 쪽으로 끌어당긴 추정. 데이터가 적을수록 균등에 가깝다.',
    links: [{ label: '위키백과(영): Beta-binomial distribution', url: WE('Beta-binomial_distribution') }],
  },
  {
    id: 'winners_model',
    label: '당첨자수 모형 (저경쟁)',
    category: '추천·검증',
    short: '조합의 특성(생일수 개수·연속수·합 등)으로 1등 당첨자 수를 예측하는 회귀. 사람들이 많이 고르는 조합은 당첨 시 나눠 갖는 인원이 많다. 당첨확률이 아니라 당첨 시 분배금에 영향.',
    links: [
      { label: 'Haigh (1997) The statistics of the National Lottery', url: 'https://doi.org/10.1111/1467-985X.00056' },
      { label: 'Baker & McHale (2009) conscious selection', url: 'https://academic.oup.com/jrsssa/article/172/4/813/7084574' },
    ],
  },
  {
    id: 'negative_binomial',
    label: '음이항 회귀',
    category: '추천·검증',
    short: '"몇 명" 처럼 0 이상 정수를 예측할 때 쓰는 회귀. 포아송보다 흩어짐(과분산)을 허용한다.',
    links: [{ label: '위키백과(영): Negative binomial regression', url: WE('Negative_binomial_distribution') }],
  },
  {
    id: 'vif',
    label: 'VIF (공선성)',
    category: '추천·검증',
    short: '회귀에 넣은 특성들이 서로 얼마나 겹치는지(예: 합과 생일수 개수). 4~8 이면 개별 계수 해석에 주의해야 한다.',
    links: [{ label: '위키백과(영): Variance inflation factor', url: WE('Variance_inflation_factor') }],
  },
  {
    id: 'backtest',
    label: '백테스트 (replay)',
    category: '추천·검증',
    short: '과거 실제 추첨(1,001~1,240회)마다 "그 회차 직전까지의 데이터만"으로 추천을 만들고 실제 결과와 대조하는 시뮬레이션. 미래 정보를 쓰지 않는 것(look-ahead 금지)이 핵심.',
    links: [{ label: '위키백과(영): Backtesting', url: WE('Backtesting') }],
  },
  {
    id: 'look_ahead',
    label: 'look-ahead 금지',
    category: '추천·검증',
    short: '회차 t 의 추천을 만들 때 t 이후 데이터를 절대 쓰지 않는 규칙. 이를 어기면 성과가 과장된다.',
    links: [{ label: '위키백과(영): Look-ahead bias', url: WE('Look-ahead_bias') }],
  },
  {
    id: 'holdout',
    label: '튠(B₁) / 홀드아웃(B₂)',
    category: '추천·검증',
    short: '튠 구간에서 후보 파라미터 중 최고를 고르고, 고르는 데 쓰지 않은 홀드아웃 구간에서 한 번만 평가한다. 홀드아웃 성과만이 "진짜 성과"다.',
    links: [{ label: '위키백과(영): Training, validation, and test data sets', url: WE('Training,_validation,_and_test_data_sets') }],
  },
  {
    id: 'best_of_k',
    label: 'best-of-K 선택 편향',
    category: '추천·검증',
    short: '후보 K개 중 최고를 고르면 공정한 추첨에서도 "최고"는 항상 좋아 보인다. 관측한 최고 성과를 "우연 최고"의 분포(정규근사)와 비교해야 한다.',
    links: [{ label: '위키백과(영): Selection bias', url: WE('Selection_bias') }],
  },
  {
    id: 'optimism',
    label: 'optimism (과적합)',
    category: '추천·검증',
    short: '튠 성과 − 홀드아웃 성과. 양수가 정상(튠에 맞춰졌기 때문). 이 값이 크고 홀드아웃이 0 근처면 튠 결과는 우연이었다는 뜻.',
    links: [{ label: '위키백과: 과적합', url: W('과적합') }],
  },
  {
    id: 'spearman_trend',
    label: 'Spearman 추세 검정',
    category: '추천·검증',
    short: '실험 세대(1, 2, 3 …)와 홀드아웃 성과의 순위 상관. 유의한 양의 상관이 계속되어야 "개선이 진짜"라고 할 수 있다. 공정 추첨이면 유의하지 않아야 한다.',
    links: [{ label: '위키백과: 스피어만 상관 계수', url: W('스피어만_상관_계수') }],
  },
  {
    id: 'replication',
    label: '재현성 검정 (A → B)',
    category: '추천·검증',
    short: '군 A 에서 p<0.05 였던 번호·쌍이 군 B 에서도 같은 방향으로 p<0.05 인 비율. 공정하면 약 2.5%. 그 이상이 아니면 A 의 "패턴"은 우연 변동.',
  },
  {
    id: 'homogeneity',
    label: '동질성 검정',
    category: '추천·검증',
    short: '군 A 와 군 B 의 번호별 빈도 분포가 같은 모집단에서 나왔는지(2×45 분할표 카이제곱, Joe 보정). 같으면 A 의 분석을 B 에 적용해도 된다.',
    links: [{ label: '위키백과: 카이제곱 검정', url: W('카이제곱_검정') }],
  },
  {
    id: 'strategy_params',
    label: '전략 파라미터 (γ, β, λ, window…)',
    category: '추천·검증',
    short: '전략의 조절 손잡이. 예: 핫 전략의 γ 는 빈도 가중 강도, 분석 가중 전략의 β 는 z 가중 강도(0 이면 균등), window 는 최근 몇 회만 볼지.',
  },

  // ── 성과·평가 ─────────────────────────────────────────────
  {
    id: 'match_distribution',
    label: '일치수 분포',
    category: '성과·평가',
    short: '임의의 6개 티켓이 실제 추첨과 몇 개 일치할지의 확률: 0개 40%, 1개 42%, 2개 15%, 3개(5등) 2.2%, 4개 0.14%, 5개 0.003%, 6개 1/8,145,060. 어떤 조합이든 똑같다.',
    links: [{ label: '위키백과: 초기하분포', url: W('초기하분포') }],
  },
  {
    id: 'expected_matches',
    label: '기대 일치수 0.8',
    category: '성과·평가',
    short: '티켓 한 장이 실제 6개 중 평균 0.8개를 맞힌다(6×6/45). 전략 성과는 이 값과 균등 기준선 대비로 본다.',
  },
  {
    id: 'rank_rules',
    label: '등수 규칙',
    category: '성과·평가',
    short: '1등 6개 일치, 2등 5개+보너스, 3등 5개, 4등 4개, 5등 3개. 3~5등 당첨금은 회차 데이터에 없어 .env 의 고정값(가정)을 쓴다.',
  },
  {
    id: 'roi',
    label: 'ROI',
    category: '성과·평가',
    short: '(당첨금 − 구매비용) / 구매비용. 로또의 환급률은 약 50% 이므로 장기 ROI 는 음수가 정상이다.',
    links: [{ label: '위키백과: 투자수익률', url: W('투자수익률') }],
  },
  {
    id: 'brier',
    label: 'Brier 점수',
    category: '성과·평가',
    short: '번호별 출현 확률 예보의 정확도(낮을수록 좋음). 균등 예보(모두 6/45)보다 낮아야 예측력이 있다는 뜻. 엄격 고유 스코어링 규칙이라 속일 수 없다.',
    links: [
      { label: '위키백과(영): Brier score', url: WE('Brier_score') },
      { label: 'Gneiting & Raftery (2007)', url: 'https://sites.stat.washington.edu/raftery/Research/PDF/Gneiting2007jasa.pdf' },
    ],
  },
  {
    id: 'log_score',
    label: 'log 점수',
    category: '성과·평가',
    short: '실제로 나온 번호에 예보가 부여한 확률의 로그 합(높을수록 좋음). 확신했는데 틀리면 크게 깎인다.',
    links: [{ label: '위키백과(영): Scoring rule', url: WE('Scoring_rule') }],
  },
  {
    id: 'diff_vs_uniform',
    label: '균등 대비 차이',
    category: '성과·평가',
    short: '같은 회차에서 전략 티켓의 평균 일치수 − 균등 기준선 티켓의 평균 일치수. 부트스트랩 95% CI 가 0 을 포함하면 "차이 없음".',
    links: [{ label: '위키백과: 부트스트랩', url: W('부트스트랩_(통계학)') }],
  },
  {
    id: 'ge3',
    label: '≥3 일치 (5등 이상)',
    category: '성과·평가',
    short: '3개 이상 일치한 티켓 수. 티켓 1장당 확률 2.38% 이므로 2,400장이면 기대 57장 정도.',
  },
];

export const GLOSSARY_BY_ID: Record<string, GlossaryTerm> = Object.fromEntries(GLOSSARY.map((t) => [t.id, t]));
export const GLOSSARY_CATEGORIES: GlossaryCategory[] = ['기본 개념', '검정과 보정', '전역 검정', '쌍·집합', '그룹·시간', '추천·검증', '성과·평가'];
