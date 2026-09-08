<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 로또번호와 같이 6개의 숫자 + 1개의 숫자로 구성된 번호가 있습니다. 무작위로 번호가 추출되는데요. 1,000번의 시행된 결과를 기반으로 추출된 번호의 통계분석을 진행하고자 합니다. 각 번호간의 상관분석은 물론 번호그룹간 예를 들면, 1 2 3 4 5 6이 추출되었을 경우, 1과 2, 1과 3 등, 그리고 1과 (2와 3), 1과 (2와 4) 등, 그리고 (1과 2)와 (3과 4), (1과 2)와 (3과 5)등으로 관계를 분석하고자 합니다. 이를 위한 통계분석의 이론을 상세히 조사해 주세요. 통계분석은 물론 다양한 알고리즘을 적용하고자 하오니 분석에 후보로 사용할 수 있는 이론을 모두 조사하여 비교해 주세요.

무작위로 6개 본번호와 1개 보너스번호를 뽑는 1,000회 데이터는, “다음 회차 예측”보다는 **추출 메커니즘이 균등·독립·무작위라는 가정과 얼마나 일치하는지 검정**하고, 번호·번호집합 사이의 관측된 결합 패턴이 우연 변동 범위인지 평가하는 데 적합합니다. 특히 한 회차 안에서 본번호는 비복원추출이므로, 같은 회차에 나온 번호들 사이에는 구조적으로 음의 의존성이 생깁니다. 따라서 일반 Pearson 상관만으로 관계를 해석하면 잘못된 결론에 이를 수 있으며, **조합론적 영가설 + 하이퍼지오메트릭/순열 기반 검정 + 다중검정 보정**을 중심에 둬야 합니다.[^1_1][^1_2]

아래는 이를 위한 이론·모델·알고리즘의 전체 분석 프레임워크입니다.

## 1. 문제를 통계 모형으로 정의

전체 번호 풀을 $N$개 번호라고 하겠습니다. 예를 들어 한국 로또 6/45라면 $N=45$, 본번호 개수는 $k=6$, 시행 횟수는 $T=1000$입니다. 보너스까지 포함한 7개 번호를 별도로 다루거나, 본번호 6개와 보너스 1개를 **역할이 다른 변수**로 취급해야 합니다.

각 회차 $t$에 대해 번호 $i$의 본번호 출현 여부를 다음과 같이 이진 벡터로 바꿉니다.

$$
X_{t,i} =
\begin{cases}
1, & \text{회차 } t \text{에서 번호 } i \text{가 본번호 6개에 포함}\\
0, & \text{그 외}
\end{cases}
$$

그러면 원본은 아래와 같은 $1000 \times N$의 **다변량 이진 행렬**입니다.


| 회차 | 1 | 2 | 3 | … | $N$ |
| :-- | --: | --: | --: | --: | --: |
| 1 | 1 | 1 | 1 | … | 0 |
| 2 | 0 | 1 | 0 | … | 1 |
| … | … | … | … | … | … |
| 1000 | 0/1 | 0/1 | 0/1 | … | 0/1 |

단, 매 회차 본번호 행 합은 항상 6입니다.

$$
\sum_{i=1}^{N}X_{t,i}=6
$$

이 제약이 가장 중요합니다. 즉, 번호 $1$이 뽑혔다는 사실은 한 회차의 남은 5개 슬롯만 남겼다는 뜻이므로, 다른 특정 번호가 선택될 조건부 확률은 단순한 독립 베르누이 사건의 확률과 다릅니다.

공정한 비복원추출 영가설 $H_0$ 아래:

$$
P(X_{t,i}=1)=\frac{k}{N}
$$

$$
P(X_{t,i}=1,X_{t,j}=1)=\frac{k(k-1)}{N(N-1)}, \quad i\neq j
$$

$$
P(X_{t,j}=1 \mid X_{t,i}=1)=\frac{k-1}{N-1}
$$

따라서 번호 $i,j$의 공분산은:

$$
\mathrm{Cov}(X_i,X_j)
=
\frac{k(k-1)}{N(N-1)}
-
\left(\frac{k}{N}\right)^2
=
-\frac{k(N-k)}{N^2(N-1)}
$$

이며 항상 음수입니다. 이를 표준화한 같은 회차 번호 간 상관은:

$$
\mathrm{Corr}(X_i,X_j)=-\frac{1}{N-1}
$$

입니다. 가령 $N=45$이면, 공정한 6/45 추첨에서도 모든 서로 다른 번호쌍의 이론적 상관은 약 $-0.0227$입니다. 따라서 “음의 상관이 관측됐다”는 사실 자체는 이상 징후가 아니라, **6개를 비복원으로 뽑는 방식이 만들어내는 정상적인 결과**입니다.

보너스 번호는 두 방식 중 하나를 명확히 선택해 모델링하는 것이 좋습니다.


| 분석 범위 | 한 회차의 표본 크기 | 용도 |
| :-- | --: | :-- |
| 본번호 6개만 | $k=6$ | 당첨 조합, 6개 숫자 집합 관계 분석 |
| 본번호+보너스 7개 | $k=7$ | 7개까지 포함한 번호 출현 구조 분석 |
| 본번호와 보너스 분리 | 본번호 $k=6$, 보너스 1개 | “어떤 본번호 조합과 보너스번호가 함께 발생했는가” 분석 |

본번호+보너스를 단순히 7개 집합으로 합치면 보너스의 역할 정보가 사라집니다. 반면 본번호와 보너스를 분리하면, “본번호 $1,2$가 있을 때 보너스 $3$이 나오는가” 같은 비대칭 관계도 모델링할 수 있습니다.

## 2. 기준선: 무작위라면 무엇을 기대해야 하나

분석의 첫 단계는 “많이 나온 것”을 찾는 것이 아니라, **공정한 무작위 추출에서 원래 얼마나 흔들리는지**를 계산하는 것입니다.

### 단일 번호 출현 빈도

특정 번호 $i$의 1,000회 본번호 출현 횟수 $C_i$는 회차 간 독립이라는 가정하에:

$$
C_i \sim \mathrm{Binomial}\left(T,\frac{k}{N}\right)
$$

입니다.

6/45, 1,000회라면:

$$
E[C_i] = 1000 \cdot \frac{6}{45}=133.33
$$

$$
\mathrm{SD}(C_i)
=
\sqrt{1000\cdot\frac{6}{45}\left(1-\frac{6}{45}\right)}
\approx 10.75
$$

즉 어떤 번호가 약 120회 또는 145회 등장하는 것은 충분히 정상적인 변동일 수 있습니다. 45개 번호 중 가장 높거나 낮은 번호가 평균에서 꽤 멀어지는 것도 다중 비교 상황에서는 자연스럽게 발생합니다.

### 번호쌍 동시 출현 빈도

서로 다른 번호 $i,j$가 한 회차의 본번호 6개에 함께 포함될 확률은:

$$
p_{ij}
=
\frac{\binom{N-2}{k-2}}{\binom{N}{k}}
=
\frac{k(k-1)}{N(N-1)}
$$

입니다.

6/45에서는:

$$
p_{ij}
=
\frac{6\cdot5}{45\cdot44}
=
\frac{1}{66}
\approx 0.01515
$$

따라서 1,000회에 특정 번호쌍의 기대 동시출현 횟수는:

$$
E[C_{ij}] \approx 15.15
$$

입니다. 번호쌍별 회차 간 출현은 독립이므로 근사적으로:

$$
C_{ij}\sim\mathrm{Binomial}(1000,p_{ij})
$$

로 검정할 수 있습니다. 단, 서로 다른 번호쌍들끼리는 같은 회차 구조를 공유하므로 서로 독립은 아닙니다.

### $r$개 번호집합 동시 출현 빈도

번호집합 $S$의 크기를 $r=|S|$라 할 때, 이 집합 전체가 한 회차 본번호에 포함될 확률은:

$$
p_S
=
P(S \subseteq D_t)
=
\frac{\binom{N-r}{k-r}}{\binom{N}{k}}
=
\frac{(k)_r}{(N)_r}
$$

여기서 $(a)_r=a(a-1)\cdots(a-r+1)$은 falling factorial입니다.

6/45에서는 다음과 같습니다.


| 번호집합 크기 | 예시 | 한 회차 동시 출현 확률 | 1,000회 기대 횟수 | 해석 |
| --: | :-- | --: | --: | :-- |
| 1 | $\{1\}$ | $6/45=0.1333$ | 133.3 | 안정적으로 검정 가능 |
| 2 | $\{1,2\}$ | $1/66\approx0.01515$ | 15.15 | 쌍 분석의 핵심 |
| 3 | $\{1,2,3\}$ | 약 0.00141 | 약 1.41 | 희소성이 매우 큼 |
| 4 | $\{1,2,3,4\}$ | 약 0.000097 | 약 0.097 | 대부분 0회가 정상 |
| 5 | $\{1,2,3,4,5\}$ | 매우 작음 | 거의 0 | 직접 빈도 분석 부적합 |
| 6 | $\{1,\dots,6\}$ | $1/\binom{45}{6}$ | 거의 0 | 정확한 한 조합 반복은 기대하기 어려움 |

핵심은 $1$과 $(2,3)$, 즉 $\{1,2,3\}$의 관계는 1,000회에서 이론적으로 평균 약 1.4회 수준이라서, 단순 빈도 기반의 유의성 판단이 매우 불안정하다는 점입니다. 4개 이상 집합은 “발견 알고리즘”으로 탐색할 수는 있어도, 일반적인 빈도검정만으로 신뢰도 높은 패턴이라 주장하기 어렵습니다.

번호 $1$과 $(2,3)$의 관계는 아래 두 관점으로 나눠야 합니다.

$$
P(X_1=1\mid X_2=1,X_3=1)
=
\frac{k-2}{N-2}
$$

6/45라면:

$$
P(X_1=1\mid X_2=1,X_3=1)
=
\frac{4}{43}
\approx0.0930
$$

이는 $P(X_1=1)=0.1333$보다 낮습니다. $\{2,3\}$가 이미 2개 슬롯을 차지했기 때문입니다. 따라서 연관규칙의 lift도 일반적인 독립 기준의 $1$이 아니라, **고정 크기 비복원추출에서 유도한 조건부 확률 기준선**과 비교해야 합니다.

## 3. 분석 항목별 이론과 방법

### A. 단일 번호의 공정성·편향 분석

목적은 “특정 번호가 과다 또는 과소하게 등장했는지”입니다.


| 방법 | 검정 또는 추정 대상 | 장점 | 한계 및 주의점 |
| :-- | :-- | :-- | :-- |
| 이항검정 | 번호별 출현 횟수 $C_i$ | 정확하고 직관적 | $N$개 번호를 각각 검정하면 다중검정 필요 |
| 카이제곱 적합도 검정 | 전체 번호 빈도 분포 | 전체 균등성의 전역 검정 | 어느 번호가 기여했는지 잔차 분석 필요 |
| G-test / 우도비 검정 | 전체 빈도와 기대값 차이 | 로그우도 기반, 희소 셀에 상대적으로 유리 | 작은 기대빈도 시 시뮬레이션 권장 |
| 표준화 잔차 | 번호별 편차 크기 | 이상 번호를 랭킹하기 좋음 | 단독 $p$-value 해석 금지 |
| 베이지안 Dirichlet-다항 모형 | 각 번호의 추출확률 불확실성 | 사후구간, shrinkage, 순위 불확실성 제공 | 공정 추첨의 고정크기 구조는 별도 반영 필요 |
| 변화점 탐지 | 시간에 따라 빈도가 바뀌는가 | 장비 교체·운영 변화 의심 시 유용 | 1,000회만으로 약한 변화는 식별이 어려움 |

전체 본번호 슬롯 수는 $6T=6000$이므로, 전역 빈도 검정의 기대도수는 번호당 $6000/N$입니다. 6/45라면 133.33입니다.

$$
\chi^2
=
\sum_{i=1}^{N}
\frac{(C_i-E_i)^2}{E_i}
$$

공정성 가정이 참이면 대략 자유도 $N-1$의 카이제곱 분포와 비교할 수 있습니다. 단, 추첨 구조와 정확한 유의수준을 엄밀히 반영하려면 시뮬레이션 기반 영분포가 더 안전합니다.

### B. 번호쌍: $1$과 $2$, $1$과 $3$

이 단계는 사용자가 언급한 “1과 2, 1과 3”에 직접 대응합니다.

각 번호쌍에 대해 2×2 교차표를 만듭니다.


|  | 번호 $j$ 포함 | 번호 $j$ 미포함 |
| :-- | --: | --: |
| 번호 $i$ 포함 | $n_{11}$ | $n_{10}$ |
| 번호 $i$ 미포함 | $n_{01}$ | $n_{00}$ |

여기서 $n_{11}$은 두 번호가 함께 등장한 회차 수입니다.

#### 사용할 수 있는 연관 지표

| 지표 | 의미 | 이 데이터에서의 권장도 |
| :-- | :-- | :-- |
| 공출현 횟수 | $n_{11}$ | 필수 EDA 지표, 단독 결론에는 부족 |
| 조건부 확률 | $P(j\mid i)=n_{11}/n_{1\cdot}$ | 직관적이지만 비복원 기준선과 비교해야 함 |
| Pearson $\phi$ | 이진변수 상관 | 가능하지만 영가설 상관이 0이 아님 |
| Odds Ratio | 두 번호의 결합 강도 | 고전적이고 해석 용이, 희소 시 불안정 |
| Log Odds Ratio | 대칭적 효과크기 | 네트워크 가중치로 적합 |
| Lift | $P(i,j)/(P(i)P(j))$ | 일반 거래 데이터에는 유용하나 여기서는 보정 필요 |
| Leverage | $P(i,j)-P(i)P(j)$ | 음의 구조적 의존성 때문에 기준 재정의 필요 |
| Mutual Information | 비선형·일반 의존성 | 탐색에는 유용, 순열검정과 함께 사용 |
| Jaccard | 함께 등장한 비율 | 희소 이진 벡터의 유사도 시각화에 유용 |
| Cosine / Ochiai | 출현벡터 유사도 | 빈도 차이가 작을 때 비교 편리 |
| PMI / NPMI | 기대 대비 정보량 | 희귀 사건에서 과대평가 가능 |
| Residual Z-score | 이론 기대 공출현 대비 편차 | 공정 추첨 영가설에 특히 적합 |

일반 독립 가정 아래의 lift는:

$$
\mathrm{Lift}(i,j)
=
\frac{P(i,j)}{P(i)P(j)}
$$

입니다. 그러나 공정한 6/45 추첨에서도:

$$
\mathrm{Lift}_{H_0}
=
\frac{\frac{k(k-1)}{N(N-1)}}{\left(\frac{k}{N}\right)^2}
=
\frac{N(k-1)}{k(N-1)}
$$

가 되어 1보다 작습니다. 6/45에서는 약 0.8864입니다. 따라서 lift가 1보다 작다고 해서 음의 연관이라 결론 내릴 수 없습니다. 공정한 비복원추출에서 기대되는 값 자체가 1보다 작기 때문입니다.

실무적으로는 다음과 같은 **설계 기반 보정 lift**를 권장합니다.

$$
\mathrm{Lift}^{*}(i,j)
=
\frac{\widehat{P}(i,j)}
{P_{H_0}(i,j)}
$$

- $\mathrm{Lift}^{*}=1$: 공정한 비복원추출이 예상하는 수준.
- $\mathrm{Lift}^{*}>1$: 이론 기대보다 함께 많이 등장.
- $\mathrm{Lift}^{*}<1$: 이론 기대보다 함께 적게 등장.

연관규칙에서 support는 동시 출현 비율, confidence는 전건 발생 시 후건 발생 조건부 확률, lift는 기대 대비 결합 강도를 표현합니다. Apriori는 최소 support를 충족하는 빈발항목집합을 생성·가지치기하고, confidence 및 lift로 규칙을 선별하는 고전적 방법입니다.[^1_3]

#### 권장 검정

번호쌍별로는 다음 3단계가 가장 견고합니다.

1. 관측 공출현 수 $n_{11}$을 계산합니다.
2. 공정한 6-of-$N$ 영가설에서 기대값 $T \cdot p_{ij}$와 비교합니다.
3. 정확 이항검정 또는 몬테카를로 순열검정으로 양측 $p$-value를 계산합니다.

$$
H_0:
n_{11}\sim
\mathrm{Binomial}
\left(
T,
\frac{k(k-1)}{N(N-1)}
\right)
$$

단, 번호별 주변빈도 자체를 고정하고 “그 빈도 조건에서 공출현이 과도한가”를 보고 싶으면 Fisher exact test 또는 **행합 6 제약을 보존하는 조건부 순열검정**이 더 타당합니다. Fisher 검정은 2×2 이진 변수의 연관을 다루고, 고정된 주변합 아래에서 하이퍼지오메트릭 분포로 정확 $p$-value를 계산합니다.[^1_2]

### C. 3개 번호: $1$과 $(2,3)$

이 관계는 사실 다음 두 질문으로 분리됩니다.

1. 세 번호 $\{1,2,3\}$가 함께 나오는 빈도가 공정 추첨 기대보다 높은가?
2. 번호 $2,3$이 나온 조건에서 번호 $1$이 나올 확률이 기대보다 높은가?

첫 질문은 3-itemset 동시출현 검정입니다.

$$
C_{123}
=
\sum_{t=1}^{T}
X_{t,1}X_{t,2}X_{t,3}
$$

영가설 분포는:

$$
C_{123}
\sim
\mathrm{Binomial}
\left(
T,
\frac{\binom{N-3}{k-3}}{\binom{N}{k}}
\right)
$$

두 번째 질문은 조건부확률 기반입니다.

$$
\widehat P(1\mid2,3)
=
\frac{C_{123}}{C_{23}}
$$

공정한 비복원추출 기준은:

$$
P_{H_0}(1\mid2,3)
=
\frac{k-2}{N-2}
$$

6/45에서는 $4/43\approx 0.0930$입니다. 즉, 번호 2와 3이 이미 나왔을 때 1이 나올 확률은 13.33%가 아니라 9.30%가 정상 기준입니다.

#### 3자 상호작용 분석 후보

| 방법 | 검정 또는 모델 | 강점 | 주요 제약 |
| :-- | :-- | :-- | :-- |
| 3-itemset 정확 검정 | $\{1,2,3\}$의 동시출현수 | 영가설이 명확함 | 기대도수가 약 1.4 수준이면 검정력 낮음 |
| 조건부 이항검정 | $P(1\mid2,3)$ | “1과 (2,3)” 질문에 직접 대응 | 조건 집합 $(2,3)$ 출현 자체가 적을 수 있음 |
| 3차 로그선형 모형 | $X_1,X_2,X_3$의 3-way interaction | 저차 상호작용과 고차 상호작용 분리 | 모든 조합으로 확장 시 파라미터 폭발 |
| Interaction Information | 3변수 시너지/중복 정보 | 단순 공출현보다 풍부한 의존성 | 표본이 적으면 추정 편향 큼 |
| Conditional Mutual Information | $I(X_1;X_2\mid X_3)$ | 조건부 관계 탐색 | 순열검정 및 보정 필요 |
| Bayesian hierarchical interaction | 3차 상호작용의 shrinkage 추정 | 희소 자료의 과적합 완화 | 구현·추론 난도 높음 |
| Frequent itemset mining | 빈발 3-항목집합 탐색 | 후보 생성 자동화 | “빈발”과 “유의”는 다름 |

3개 이상의 번호집합은 조합 수가 빠르게 폭증합니다.

$$
\binom{45}{2}=990,\quad
\binom{45}{3}=14{,}190,\quad
\binom{45}{4}=148{,}995,\quad
\binom{45}{6}=8{,}145{,}060
$$

따라서 3개 조합 전체를 무차별 검정하면, 우연한 유의결과가 많이 나옵니다. 반드시 다중검정 보정과 최소 기대빈도 기준을 적용해야 합니다.

### D. 두 집합 간 관계: $(1,2)$와 $(3,4)$

사용자가 예로 든 $(1,2)$와 $(3,4)$ 관계는 단순히 4개 번호가 모두 동시 출현하는 빈도로 볼 수 있지만, 더 엄밀하게는 두 방식이 있습니다.

#### 집합 포함 사건으로 정의

$$
A=\{1,2\}\subseteq D_t
$$

$$
B=\{3,4\}\subseteq D_t
$$

그러면 검정하려는 것은 $A$와 $B$의 결합입니다.

$$
P(A)
=
\frac{(k)_2}{(N)_2}
$$

$$
P(A\cap B)
=
\frac{(k)_4}{(N)_4}
$$

서로 겹치지 않는 두 2-번호 집합이면, 공정한 비복원추출 하에서는:

$$
P(B\mid A)
=
\frac{(k-2)(k-3)}{(N-2)(N-3)}
$$

입니다.

6/45라면:

$$
P(\{3,4\}\subseteq D_t
\mid
\{1,2\}\subseteq D_t)
=
\frac{4\cdot3}{43\cdot42}
\approx0.00664
$$

즉, $\{1,2\}$가 나온 회차에서 $\{3,4\}$가 함께 나오는 일은 약 0.664% 수준이 정상입니다. 1,000회 전체로 보면 네 번호가 모두 동시에 출현할 기대 횟수는 약 0.097회로 매우 작습니다.

따라서 “$(1,2)$와 $(3,4)$가 1번 함께 나왔다”는 결과만으로는 아무런 이상도 말할 수 없습니다. 오히려 1번 이상 관찰되는 것 자체가 충분히 가능한 우연입니다.

#### 중첩 집합의 주의점

$(1,2)$와 $(1,3)$처럼 두 집합이 번호 1을 공유하면, 이 관계는 사실상 $\{1,2,3\}$ 3개 집합의 동시출현 문제로 축소됩니다.


| 비교 대상 | 합집합 크기 | 실제로 분석할 사건 |
| :-- | --: | :-- |
| $(1,2)$ vs $(3,4)$ | 4 | $\{1,2,3,4\}$ 전체 포함 |
| $(1,2)$ vs $(3,5)$ | 4 | $\{1,2,3,5\}$ 전체 포함 |
| $(1,2)$ vs $(1,3)$ | 3 | $\{1,2,3\}$ 전체 포함 |
| $(1,2,3)$ vs $(2,3,4)$ | 4 | $\{1,2,3,4\}$ 전체 포함 |

그래서 집합 간 관계를 전수분석할 때는 “좌측 집합과 우측 집합” 자체보다, 먼저 **합집합의 크기와 중복 구조**를 표준화하는 것이 좋습니다.

## 4. 후보 이론·알고리즘 비교

아래 표는 1,000회 데이터에서 실제 후보로 고려할 만한 방법을 목적별로 비교한 것입니다.


| 범주 | 이론·알고리즘 | 해결하는 질문 | 장점 | 주요 한계 | 권장도 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 조합론 | 균등 비복원추출 모형 | 공정 추첨이면 어떤 빈도·공출현을 기대하는가 | 이 문제의 필수 영가설 | 현실 추첨 장비의 물리적 편향을 직접 설명하지는 않음 | 최우선 |
| 단변량 검정 | 이항검정 | 한 번호가 과다/과소 출현했는가 | 정확하고 단순 | 번호별 다중검정 필요 | 높음 |
| 전역 적합도 | 카이제곱, G-test | 전체 번호 분포가 균등한가 | 전반적 편향 탐지 | 국소 패턴 분리는 어려움 | 높음 |
| 쌍 관계 | 공출현 행렬 | 어떤 번호쌍이 자주/드물게 같이 나오는가 | 직관적·시각화 용이 | 기대 빈도를 보정하지 않으면 오해 | 최우선 |
| 쌍 검정 | 이항/Poisson-binomial 근사 | 특정 쌍 공출현이 기대를 벗어나는가 | 빠르고 해석 쉬움 | 수많은 쌍 검정 보정 필요 | 높음 |
| 조건부 검정 | Fisher exact test | 주변빈도 조건에서 쌍 관계가 있는가 | 작은 빈도에서 정확 | 행 합 6 제약을 완전히 반영하지는 않음 | 중간 |
| 비모수 검정 | 순열·몬테카를로 검정 | 임의 통계량이 공정 추첨에서 이례적인가 | 복잡한 통계량에도 적용 가능 | 반복 시뮬레이션 비용 | 최우선 |
| 연관규칙 | Apriori | “$A\Rightarrow B$” 후보를 찾는가 | 해석이 직관적 | support/confidence만으로 허위 패턴 다수 | 중간 |
| 빈발항목집합 | FP-Growth | 많은 후보 조합을 빠르게 열거 | 후보생성이 빠르고 압축 효율적 | 빈발 ≠ 통계적 유의 | 중간 |
| 정보이론 | Mutual Information, PMI, NPMI | 선형이 아닌 의존성이 있는가 | 다양한 의존성 탐색 | 희귀 조합에서 추정편향·불안정 | 탐색용 |
| 로그선형 | 2·3차 interaction 모델 | 주효과·쌍·삼자 상호작용 분리 | 범주형 자료 해석에 강함 | 고차원에서 셀 희소성 심각 | 선택적 |
| 네트워크 | 가중 공출현 그래프 | 번호군·클러스터가 있는가 | 시각화와 군집 탐색 | 그래프 엣지가 독립이 아님 | 보조 |
| 그래프 모델 | Ising model / sparse graphical lasso | 다른 번호들을 조건부로 통제해도 직접 관계가 있는가 | 조건부 의존 네트워크 | 고정 행합 제약과 희소 데이터에 민감 | 연구용 |
| 잠재군집 | 혼합 Ising·latent class | 회차가 서로 다른 생성 체계의 혼합인가 | 비정상성·잠재 모드 탐색 | 1,000회에서는 과적합 위험 | 실험적 |
| 시계열 | Runs test, 자기상관, Ljung–Box | 같은 번호 또는 특성에 시간 의존성이 있는가 | 회차 순서의 이상 탐지 | 올바른 무작위성 검정 설계 필요 | 높음 |
| 변화점 | CUSUM, Bayesian change-point | 어느 시점 이후 추첨 특성이 변했는가 | 장비/규칙 변경 감시 | 다중 번호·다중 시점 문제 | 중간 |
| 차원축소 | MCA, correspondence analysis | 번호와 그룹 특성의 공통 구조는 무엇인가 | 시각화와 탐색 | 검정 자체가 아님 | 보조 |
| 군집 | spectral clustering, community detection | 공출현 기반 번호 군집이 있는가 | 패턴 후보를 시각화 | 우연 상관도 군집처럼 보일 수 있음 | 보조 |
| 이상치 탐지 | isolation forest, autoencoder | 특정 회차가 특이한 조합인가 | 복합 특성에 활용 가능 | 무작위 조합에는 ‘이상’ 정의가 애매 | 낮음 |
| 예측 ML | RF, XGBoost, LSTM, Transformer | 다음 번호를 맞출 수 있는가 | 실험·벤치마크 가능 | 공정 추첨이면 일반화 가능한 예측력 기대 불가 | 검증 목적만 |

연관규칙의 Apriori는 frequent itemset의 downward-closure 성질을 이용하여 후보를 생성·가지치기하고, support·confidence·lift 기준으로 규칙을 선별합니다. FP-Growth는 후보집합을 반복 생성하는 대신 거래 데이터를 FP-tree로 압축해 빈발항목집합을 찾으므로, 조합 탐색을 빠르게 처리하는 데 유리합니다.[^1_4][^1_3]

다만 이 데이터에서는 각 회차의 항목 수가 정확히 6개로 고정되어 있습니다. 따라서 일반 장바구니 데이터처럼 “support가 높다”는 사실만으로 강한 연관을 주장할 수 없습니다. **FP-Growth/Apriori는 후보 생성기**, 하이퍼지오메트릭·순열검정은 **통계적 검증기**로 분리하는 설계를 권장합니다.

## 5. 권장 분석 파이프라인

### 1단계: 데이터 정합성 검증

먼저 통계 분석 전에 데이터 품질을 점검합니다.

- 각 회차의 본번호가 정확히 6개인지 확인
- 한 회차 안에 중복 본번호가 없는지 확인
- 본번호와 보너스번호가 중복되지 않는지 확인
- 번호 범위가 $1$부터 $N$까지인지 확인
- 회차·추첨일·추첨기/장비 변경 이력 등 메타데이터 확보
- 정렬된 번호 표현인지, 실제 추출 순서인지 구분

특히 본번호를 오름차순 정렬해 저장했다면, “첫 번째 번호와 두 번째 번호의 상관”은 추출 순서가 아니라 정렬순서의 인위적 구조를 측정하게 됩니다. 번호 관계 분석은 원칙적으로 순서 없는 **집합(set)** 표현으로 수행해야 합니다.

### 2단계: 공정 추첨 기준선 생성

실제 번호 범위 $N$, 본번호 개수 $k=6$, 회차 $T=1000$을 사용하여 다음을 계산합니다.

- 번호별 기대 출현 수, 분산, 95%·99% 예측구간
- 모든 쌍의 이론적 공출현 확률
- 3개 번호 조합의 이론적 공출현 확률
- 번호군 조합의 조건부 확률
- 합·홀짝 수·연속수·구간별 개수 등의 이론 분포

홀수 개수나 특정 구간 번호의 선택 개수는 비복원추출이므로 하이퍼지오메트릭 분포로 모델링할 수 있습니다. 다변량 범주별 개수는 다변량 하이퍼지오메트릭 분포를 따르며, 확률질량함수는 다음과 같습니다.[^1_1]

$$
P(X_1=x_1,\dots,X_m=x_m)
=
\frac{\prod_{g=1}^{m}\binom{n_g}{x_g}}
{\binom{N}{k}}
$$

예를 들어 1–10, 11–20, 21–30, 31–40, 41–45의 다섯 구간으로 나누면, 각 회차에서 구간별 선택 개수 벡터를 다변량 하이퍼지오메트릭 분포와 비교할 수 있습니다.

### 3단계: EDA와 효과크기 산출

다음 산출물을 만들면 분석 전반의 기반이 됩니다.

- 번호별 출현 빈도 막대그래프 및 표준화 잔차
- 번호별 회차 간 간격(gap) 분포
- $N\times N$ 공출현 행렬
- 기대 공출현 행렬
- 관측/기대 비율 행렬, 즉 $\mathrm{Lift}^{*}$
- 공출현 잔차 행렬 및 $z$-score heatmap
- 상위·하위 번호쌍 목록
- 3-itemset의 관측·기대·$p$-value 목록
- 번호군별 선택 개수, 홀짝, 저·고번호, 합계, 연속수, 끝수 등의 분포

쌍 $i,j$의 잔차는 간단히:

$$
Z_{ij}
=
\frac{C_{ij}-T p_{ij}}
{\sqrt{T p_{ij}(1-p_{ij})}}
$$

로 근사할 수 있습니다. 그러나 작은 기대빈도나 고차 집합에서는 정규근사 대신 정확검정 또는 시뮬레이션 기반 $p$-value를 사용하는 편이 안전합니다.

### 4단계: 순열 기반 통합 검정

가장 권장하는 핵심 절차입니다.

1. 실제 1,000회 데이터에서 관심 통계량을 계산합니다.
2. 공정한 $k$-of-$N$ 비복원추출로 1,000회짜리 가상 데이터를 $B$회 생성합니다.
3. 매 시뮬레이션에서 동일한 통계량을 계산합니다.
4. 관측 통계량이 영분포의 어느 위치에 있는지 $p$-value와 분위수로 평가합니다.

예를 들어:

$$
p_{\mathrm{MC}}
=
\frac{
1+
\sum_{b=1}^{B}
I\left(|T_b|\ge |T_{\mathrm{obs}}|\right)
}
{B+1}
$$

여기서 $B$는 최소 10,000회, 매우 작은 $p$-value를 구하려면 100,000회 이상이 바람직합니다.

이 방식의 강점은 다음과 같습니다.

- 단일번호 빈도, 쌍 공출현, 삼중항, 그룹 통계, 최대 편차 등 어떤 통계량에도 적용 가능
- “한 회차에 정확히 6개”라는 설계 제약을 정확히 보존
- 복잡한 분포 근사와 독립성 가정을 줄일 수 있음
- 전체 분석에서 가장 큰 쌍 공출현값, 가장 큰 $z$-score 같은 **선택 후 편향**까지 family-wise하게 평가 가능


### 5단계: 다중검정 보정

번호쌍만 해도 6/45에서는 990개이며, 3개 조합은 14,190개입니다. 유의수준 0.05로 독립 검정을 14,190번 하면, 영가설이 모두 참이어도 수백 개의 겉보기 유의 결과가 나올 수 있습니다.

따라서 다음 중 하나를 반드시 적용해야 합니다.


| 목적 | 권장 보정 | 설명 |
| :-- | :-- | :-- |
| 단 하나의 거짓 양성도 강하게 억제 | Bonferroni | 매우 보수적이지만 단순 |
| 전체 탐색에서 최대 통계량 기준 | Westfall–Young maxT 순열 | 의존된 검정에도 강력하며 권장 |
| 발견 후보를 넓게 탐색 | Benjamini–Hochberg FDR | 유의 발견 중 거짓 발견의 기대 비율 제어 |
| 강한 의존성·보수적 FDR | Benjamini–Yekutieli | BH보다 보수적 |
| 계층 구조 활용 | Hierarchical FDR | 단일→쌍→삼중항 순서로 탐색 |

Benjamini–Hochberg 절차는 다중가설검정에서 거짓 발견 비율(FDR), 즉 기각된 가설 중 잘못 기각된 비율의 기대값을 제어하도록 제안된 방법입니다.[^1_5][^1_6]

권장 전략은 다음과 같습니다.

- **전역 검정**: 전체 추첨이 균등 모델과 일치하는가.
- **단일 번호 검정**: 전역 검정 또는 탐색 목적에서 FDR 보정.
- **쌍 검정**: BH-FDR $q \le 0.05$와 효과크기 임계값을 동시에 적용.
- **3개 이상 조합**: 사전에 정의된 후보 또는 쌍 분석에서 선별된 후보군에 한정.
- **전체 최대값 검정**: 순열 기반 max-statistic으로 “가장 특이한 쌍도 공정 추첨에서 흔한가”를 판단.


### 6단계: 시간적 무작위성

번호들의 동시출현과 별개로, 회차 순서에 시간 의존성이 있는지도 볼 수 있습니다.

- 각 번호의 출현 여부 시퀀스에 대한 runs test
- 번호별 출현 간격 분포 및 기하분포 적합도
- $X_{t,i}$와 $X_{t-\ell,j}$의 lagged cross-correlation
- 포트만토 검정(Ljung–Box 계열)
- CUSUM, Page–Hinkley, Bayesian change-point
- 회차를 구간으로 나눈 sliding-window 빈도·공출현 변화
- 장비·볼 세트·운영 방식 변경 시점 전후의 분포 비교

NIST SP 800-22는 난수 및 의사난수 비트열에 대해 빈도, 블록 빈도, runs 등 15개 통계검정을 제시합니다. 다만 로또 데이터는 임의 비트열이 아니라 “매 회차 정확히 6개가 선택되는 다중범주 비복원표본”이므로, NIST 검정을 그대로 적용하는 것이 아니라 **번호별 이진 시계열 또는 적절히 정의한 파생 시퀀스의 보조진단**으로 사용해야 합니다.[^1_7][^1_8]

## 해석 원칙

분석 결과를 해석할 때 다음 원칙이 핵심입니다.

- 통계적으로 유의한 편차가 나와도, 그것이 곧바로 추첨 조작·예측 가능성·인과적 번호 관계를 의미하지는 않습니다.
- 사후적으로 수많은 번호쌍·번호군을 탐색하면, 드문 극단값은 우연히 발견됩니다. 다중검정 보정이 없는 “핫 페어”는 증거가 아닙니다.
- 3개 이상 번호 조합은 1,000회에서 매우 희소합니다. 특히 4개·5개·6개 완전 조합 분석은 관측 0 또는 1이 정상인 영역이므로, 빈도 순위만으로 패턴을 주장하면 안 됩니다.
- 추출이 정말 독립적·균등하다면, 과거 데이터로 미래 특정 조합의 실질적인 예측력을 얻을 수 없습니다. 분석의 과학적 목표는 예측이 아니라 **무작위성 가정의 적합성 검증, 데이터 품질 감시, 운영 변화 탐지**가 되어야 합니다.
- 유의성뿐 아니라 효과크기, 신뢰구간, FDR 보정 $q$-value, 순열 기반 family-wise $p$-value를 함께 보고해야 합니다.


## 구현 권장안

실제 구현에서는 Python 기반으로 아래의 계층을 권장합니다.

- 데이터 변환: `pandas`, `numpy`
- 조합·확률: `scipy.stats`의 `binom`, `hypergeom`, `multivariate_hypergeom`
- 빈도·교차표 검정: `scipy.stats.fisher_exact`, `chi2_contingency`, `binomtest`
- 다중검정: `statsmodels.stats.multitest.multipletests`
- 연관규칙 후보 발굴: `mlxtend.frequent_patterns.apriori`, `fpgrowth`, `association_rules`
- 네트워크·군집: `networkx`, `igraph`, `leidenalg`
- 로그선형·GLM: `statsmodels`
- 변화점 탐지: `ruptures`
- 몬테카를로 병렬화: `numpy.random.Generator`, `joblib` 또는 `ray`

가장 실용적인 최소 분석 단위는 아래 네 가지입니다.

1. 번호별 빈도와 균등성 검정
2. 번호쌍별 공출현 행렬, 설계 보정 lift, 순열/이항 기반 $p$-value
3. 3개 번호 조합에 대한 조건부확률 및 희소성 인지 검정
4. 시간 구간별 빈도·공출현 변화와 변화점 감시

이 구조라면 사용자가 원하는 $1$–$2$, $1$–$3$, $1$–$(2,3)$, $(1,2)$–$(3,4)$ 유형을 일관된 확률모형 안에서 모두 다룰 수 있으며, 단순 상관분석이 갖는 비복원추출 편향도 피할 수 있습니다.

<span style="display:none">[^1_10][^1_11][^1_12][^1_13][^1_14][^1_15][^1_16][^1_17][^1_18][^1_19][^1_20][^1_21][^1_22][^1_23][^1_24][^1_25][^1_26][^1_27][^1_28][^1_29][^1_30][^1_31][^1_32][^1_33][^1_34][^1_35][^1_36][^1_37][^1_38][^1_39][^1_40][^1_41][^1_42][^1_43][^1_44][^1_45][^1_9]</span>

<div align="center">⁂</div>

[^1_1]: https://search.r-project.org/CRAN/refmans/extraDistr/html/MultiHypergeometric.html

[^1_2]: https://utstat.utoronto.ca/brunner/oldclass/441s20/lectures/441s20RandomizationTests.pdf

[^1_3]: https://www.nature.com/articles/s41598-024-64360-6

[^1_4]: https://link.springer.com/article/10.1007/s10462-018-9629-z

[^1_5]: https://academic.oup.com/jrsssb/article/57/1/289/7035855

[^1_6]: https://pubmed.ncbi.nlm.nih.gov/18052910/

[^1_7]: https://csrc.nist.gov/projects/random-bit-generation/documentation-and-software/guide-to-the-statistical-tests

[^1_8]: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-22r1a.pdf

[^1_9]: https://www.govinfo.gov/content/pkg/GOVPUB-C13-e8db07d485605c6d37134230c95720d7/pdf/GOVPUB-C13-e8db07d485605c6d37134230c95720d7.pdf

[^1_10]: https://www.cs.utexas.edu/~ai-lab/pubs/eunhoNIPS2012.pdf

[^1_11]: https://eprint.iacr.org/2016/863.pdf

[^1_12]: https://acad.ro/sectii2002/proceedings/doc2017-4s/08artSupl.pdf

[^1_13]: https://iris.polito.it/bitstream/11583/2696608/1/TIFS2012-final-double.pdf

[^1_14]: https://arxiv.org/abs/2305.00588

[^1_15]: https://arxiv.org/pdf/0803.0966.pdf

[^1_16]: https://arxiv.org/pdf/1208.5740.pdf

[^1_17]: https://iris.polito.it/retrieve/e384c42f-f05f-d4b2-e053-9f05fe0a1d67/TIFS2012-final-double.pdf

[^1_18]: https://pure.rug.nl/ws/portalfiles/portal/204292617/1_s2.0_S0277953622000909_main.pdf

[^1_19]: https://ar5iv.labs.arxiv.org/html/2410.02880

[^1_20]: https://www.scribd.com/document/1003687022/Deep-Research-Exploratory-Data-Analysis-and-Combinatorial-Analysis-for-Lotofacil-Style-Lotteries

[^1_21]: http://heinzl.userweb.mwn.de/KategorialeWi1213/maincatVorl.pdf

[^1_22]: https://www.publichealth.columbia.edu/research/population-health-methods/false-discovery-rate

[^1_23]: https://journals.sagepub.com/doi/10.3102/10769986025001060

[^1_24]: https://pmc.ncbi.nlm.nih.gov/articles/PMC3175141/

[^1_25]: https://pmc.ncbi.nlm.nih.gov/articles/PMC3020656/

[^1_26]: https://web.njit.edu/~wguo/Guo \& Rao 2008 (2).pdf

[^1_27]: https://www.stat.cmu.edu/~ryantibs/journalclub/benjamini_2010.pdf

[^1_28]: https://cris.tau.ac.il/en/publications/the-control-of-the-false-discovery-rate-in-multiple-testing-under/

[^1_29]: https://en.wikipedia.org/wiki/False_discovery_rate

[^1_30]: https://arxiv.org/abs/2304.05261

[^1_31]: http://utstat.utoronto.ca/brunner/oldclass/appliedf12/lectures/2101f12PermutationRandomization.pdf

[^1_32]: https://sci-hub.se/10.1111/j.2517-6161.1995.tb02031.x

[^1_33]: https://www.scirp.org/reference/referencespapers?referenceid=3558998

[^1_34]: https://iopscience.iop.org/article/10.1088/1742-6596/1361/1/012036/pdf

[^1_35]: https://www.informatica.si/index.php/informatica/article/viewFile/19/13

[^1_36]: https://www.dbs.ifi.lmu.de/Publikationen/Papers/ProFPGrowth_TR.pdf

[^1_37]: https://www.sciencedirect.com/science/article/pii/S0957417410011917

[^1_38]: https://ijeecs.iaescore.com/index.php/IJEECS/article/view/3477

[^1_39]: https://www.cs.put.poznan.pl/mwojciechowski/papers/kdidlncs07.pdf

[^1_40]: http://infolab.stanford.edu/~echang/recsys08-69.pdf

[^1_41]: https://arxiv.org/pdf/1803.06632.pdf

[^1_42]: https://www.ijais.org/archives/volume12/number14/1036-2018451766/

[^1_43]: https://www.ijcaonline.org/research/volume126/number4/garg-2015-ijca-906030.pdf

[^1_44]: https://www.ijais.org/archives/volume12/number14/albadani-2018-ijais-451766.pdf

[^1_45]: https://www.ijcaonline.org/archives/volume126/number4/22538-2015906030/


---

# 1. 로또 데이터 1,000회분 상관분석 대시보드: 번호 빈도, 조합 연관성(Association Rule), 무작위성 검정 결과 시각화

1. 번호 조합 패턴 분석기: 1,000회 추출 데이터로 번호쌍 및 그룹별 동시 출현 빈도와 통계적 유의성 모델링
2. 비복원추출 환경에서의 다중 변수 공출현 분석 방법
3. 연속된 회차 간의 자기상관성 및 패턴 검정 절차
4. 다중검정 문제 해결을 위한 본페르니 및 FDR 보정 적용

요청하신 5개 항목은 하나의 분석 시스템으로 통합할 수 있습니다. 핵심은 “6개 번호가 한 회차에 함께 뽑히는 비복원추출”이라는 제약을 영가설에 포함하고, 대시보드에서는 **탐색적 패턴·통계적 유의성·무작위성 진단·다중검정 보정 결과**를 분리해 보여주는 것입니다.

아래 설계는 기본적으로 $N$개 번호 중 본번호 $k=6$, 보너스 $b=1$, 총 $T=1000$회라는 구조를 가정합니다. 한국 로또 6/45라면 $N=45$입니다.

## 1. 전체 대시보드 아키텍처

권장 아키텍처는 “데이터 계층 → 통계 엔진 → 시각화/API 계층”의 3계층입니다.

```text
[추첨 원천 데이터]
     │
     ├─ 회차, 추첨일, 본번호 6개, 보너스번호 1개
     │
[검증·정규화]
     │
     ├─ 범위·중복·결측·행합 검증
     ├─ 본번호: T × N binary incidence matrix X
     ├─ 보너스: T × N binary incidence matrix B
     └─ 집합/조합 테이블: pair, triple, group event
     │
[통계 분석 엔진]
     │
     ├─ 번호 빈도·균등성 검정
     ├─ 공출현·조건부확률·연관규칙
     ├─ 비복원추출 영가설·순열검정
     ├─ 자기상관·runs·변화점 분석
     ├─ Bonferroni / Holm / BH-FDR / BY-FDR
     └─ Monte-Carlo null simulation
     │
[분석 저장소]
     │
     ├─ draw_summary
     ├─ number_frequency
     ├─ pair_association
     ├─ itemset_association
     ├─ temporal_tests
     ├─ corrected_pvalues
     └─ simulation_summary
     │
[Dashboard / API]
     │
     ├─ Streamlit / Plotly Dash / React + FastAPI
     ├─ Plotly heatmap, network graph, time series
     ├─ 필터: 기간, 번호, 조합 크기, α, 보정법
     └─ 결과 export: CSV / Parquet / PDF
```


### 권장 기술 스택

| 영역 | 권장 구성 | 이유 |
| :-- | :-- | :-- |
| 데이터 처리 | Python, Polars 또는 Pandas, NumPy | 1,000회 규모에서는 메모리 부담이 거의 없고 조합 분석 구현이 편리 |
| 통계 검정 | SciPy, Statsmodels | 이항검정·카이제곱·Fisher 검정·다중검정 보정 지원 |
| 연관규칙 | `mlxtend`, 자체 조합 열거 | Apriori/FP-Growth는 후보 탐색용, 정확 검정은 별도 구현 권장 |
| 순열 시뮬레이션 | NumPy `Generator`, Numba, Joblib/Ray | 비복원추출 영가설을 보존한 Monte-Carlo 반복 |
| 네트워크 분석 | NetworkX, igraph, Leiden | 번호쌍 관계를 그래프로 표현하고 군집 탐색 |
| 변화점 분석 | `ruptures`, Bayesian online change-point 구현 | 장비·운영 방식 변경 의심 구간 탐지 |
| 웹 대시보드 | Streamlit + Plotly | 빠른 PoC 및 데이터 과학자 친화적 |
| 운영 API | FastAPI + DuckDB/PostgreSQL | 회차 증가·결과 재현·API 제공에 적합 |

Statsmodels의 `multipletests`는 Bonferroni, Holm, Holm–Šidák, BH-FDR, BY-FDR 등 여러 다중검정 보정 방법을 지원합니다.[^2_1][^2_2]

## 2. 대시보드 화면 설계

### A. 개요: 무작위성·공정성 요약

첫 화면에서는 “번호가 많이 나온 순위”가 아니라, 전체 데이터가 공정한 비복원추출 모형에서 얼마나 벗어났는지를 요약합니다.

**상단 KPI 카드**


| KPI | 산식 또는 내용 | 해석 |
| :-- | :-- | :-- |
| 분석 회차 | $T=1000$ | 분석 대상 표본 수 |
| 번호 풀 크기 | $N=45$ 등 | 번호 체계 |
| 본번호 슬롯 수 | $T\times6$ | 6/45, 1,000회면 6,000 |
| 전체 균등성 $p$-value | 카이제곱/G-test/순열검정 | 전체 빈도 분포의 이상 여부 |
| 유의 번호 수 | FDR 보정 후 $q<0.05$ | 번호별 편향 후보 수 |
| 유의 쌍 수 | FDR 보정 후 $q<0.05$ | 기대 공출현에서 벗어난 쌍 수 |
| 최대 쌍 편차 FWER $p$-value | max-statistic 순열검정 | 가장 특이한 쌍이 전체 탐색 기준으로도 특이한가 |
| 시간 의존성 경보 | runs / lag / change point 종합 | 회차 간 비독립성 의심 여부 |

**권장 시각화**

- 전체 번호 빈도의 기대값 대비 편차 막대그래프
- 번호별 표준화 잔차 heatmap
- 번호쌍 공출현 residual heatmap
- $q$-value 기준 필터가 적용된 공출현 네트워크
- 회차별 이동창(window) 기반 편향 점수
- 검정 결과표: 검정명, 통계량, 원시 $p$, 보정 $q$, 판정, 효과크기


### B. 번호 빈도 분석 화면

번호 $i$의 출현 횟수는 공정한 본번호 추출에서 다음을 따릅니다.

$$
C_i \sim \mathrm{Binomial}\left(T,\frac{k}{N}\right)
$$

6/45 및 1,000회라면:

$$
E[C_i]=1000\cdot\frac{6}{45}=133.33
$$

$$
\mathrm{SD}(C_i)
=
\sqrt{
1000\cdot\frac{6}{45}
\left(1-\frac{6}{45}\right)
}
\approx10.75
$$

따라서 번호가 133회가 아닌 120회 또는 145회 나온다는 사실만으로 이상이라고 볼 수 없습니다.

**화면 구성**

- 번호별 관측 빈도, 기대 빈도, 편차, $z$-score
- 이항검정 양측 $p$-value
- Bonferroni/Holm/BH/BY 보정 $q$-value
- 95% 및 99% 이론 예측구간
- 본번호와 보너스번호를 분리한 빈도 비교
- 기간 필터: 전체 1,000회, 최근 100회, 사용자 정의 구간
- 순위 변화: 최근 구간 대비 전체 구간의 빈도 변화

번호별 표준화 편차는 다음으로 표시할 수 있습니다.

$$
Z_i=
\frac{C_i-Tk/N}
{\sqrt{T(k/N)(1-k/N)}}
$$

단, $Z_i$는 이상 후보의 **탐색 지표**이고, 최종 판정은 원시 $p$-value, 다중검정 보정 $q$-value, 그리고 몬테카를로 기반 검증을 함께 사용해야 합니다.

### C. 조합 연관성 화면

이 화면은 사용자가 말한 $1$–$2$, $1$–$(2,3)$, $(1,2)$–$(3,4)$ 관계를 직접 분석합니다.

**필터 조건**

- 번호 또는 번호 그룹 선택
- 분석 레벨: 1개, 2개, 3개, 4개 집합
- 본번호만 / 본번호+보너스 / 보너스 조건부
- 기간 범위
- 최소 관측 지지도
- 보정 방식: none, Bonferroni, Holm, BH-FDR, BY-FDR
- 통계량: 공출현수, 기대 대비 비율, 설계 보정 lift, residual, $p$-value, $q$-value

**핵심 시각화**


| 시각화 | 목적 | 핵심 값 |
| :-- | :-- | :-- |
| 공출현 Heatmap | 모든 번호쌍 비교 | 관측 공출현·기대 공출현·잔차 |
| 설계 보정 Lift Heatmap | 공정 추첨 기대 대비 과다/과소 공출현 | $\mathrm{Lift}^{*}$ |
| 네트워크 그래프 | 유의한 번호쌍 및 군집 탐색 | edge = 보정 후 유의한 잔차 |
| Pair Detail Panel | 특정 번호쌍의 상세 판단 | 교차표, 기대값, exact $p$, FDR $q$ |
| Itemset Table | 3개 이상 조합 후보 목록 | support, conditional probability, null probability |
| Conditional Rule Explorer | $A\Rightarrow B$ 탐색 | confidence, null confidence, calibrated lift |
| Monte-Carlo Distribution | 관측 통계량과 영분포 비교 | empirical $p$, percentile |

## 3. 번호 조합 패턴 분석기

### 번호쌍 공출현

본번호 $k=6$, 번호 풀 $N$에서 두 번호 $i,j$가 같은 회차에 포함될 확률은 다음과 같습니다.

$$
P(i,j\in D_t)
=
\frac{\binom{N-2}{k-2}}{\binom{N}{k}}
=
\frac{k(k-1)}{N(N-1)}
$$

6/45일 때:

$$
P(i,j\in D_t)
=
\frac{6\cdot5}{45\cdot44}
=
\frac{1}{66}
\approx0.01515
$$

따라서 1,000회에서 특정 번호쌍의 기대 공출현 수는:

$$
E[C_{ij}]
=
1000\cdot \frac{1}{66}
\approx15.15
$$

입니다.

이때 분석기는 각 쌍에 대해 아래 값을 계산합니다.


| 항목 | 수식 또는 정의 | 용도 |
| :-- | :-- | :-- |
| 공출현 횟수 | $C_{ij}=\sum_tX_{t,i}X_{t,j}$ | 가장 기본적인 관측값 |
| 이론 기대값 | $T\cdot k(k-1)/(N(N-1))$ | 공정 추첨 기준선 |
| 설계 보정 lift | $\widehat P(i,j)/P_{H_0}(i,j)$ | 기대 대비 과다·과소 공출현 |
| 공출현 잔차 | $C_{ij}-E[C_{ij}]$ | 절대적 편차 |
| 표준화 잔차 | $(C_{ij}-E[C_{ij}])/\sqrt{Var(C_{ij})}$ | 쌍 간 비교 |
| 정확/근사 $p$-value | 이항 또는 Monte-Carlo | 유의성 평가 |
| FDR $q$-value | BH 또는 BY 보정 | 다중 탐색 대응 |
| FWER $p$-value | maxT 순열 보정 | “가장 특이한 쌍”의 전역 판단 |

공정 추첨 하에서 $C_{ij}$는 회차별 독립을 가정하면 다음과 같이 모델링할 수 있습니다.

$$
C_{ij}
\sim
\mathrm{Binomial}
\left(
T,
\frac{k(k-1)}{N(N-1)}
\right)
$$

그러나 여러 번호쌍의 검정통계량은 서로 의존합니다. 따라서 개별 쌍의 이항검정은 빠른 1차 분석에, 전체 결론은 **비복원추출 순열 기반 maxT 또는 FDR 보정**에 두는 것이 좋습니다.

### 일반화된 번호집합 공출현

번호집합 $S$의 크기를 $r$이라 할 때, 그 집합 전체가 본번호 6개에 포함될 확률은:

$$
P(S\subseteq D_t)
=
\frac{\binom{N-r}{k-r}}
{\binom{N}{k}}
=
\frac{(k)_r}{(N)_r}
$$

여기서 $r\le k$여야 합니다.

$$
E[C_S]
=
T\cdot
\frac{\binom{N-r}{k-r}}
{\binom{N}{k}}
$$


| 집합 크기 | 6/45 한 회차 출현 확률 | 1,000회 기대 공출현 수 | 분석 적합성 |
| --: | --: | --: | :-- |
| 1개 | 0.1333 | 133.3 | 매우 적합 |
| 2개 | 약 0.01515 | 약 15.15 | 적합 |
| 3개 | 약 0.00141 | 약 1.41 | 탐색 가능, 검정력 제한 |
| 4개 | 약 0.000097 | 약 0.097 | 직접 유의성 판단 부적합 |
| 5개 | 매우 작음 | 거의 0 | 빈발패턴 분석 부적합 |
| 6개 | $1/\binom{45}{6}$ | 사실상 0 | 정확 조합 반복은 정보량 부족 |

따라서 1,000회 데이터에서는 **단일 번호와 쌍 분석을 주력**, 삼중항은 사전 가설 또는 쌍 분석 후보의 후속 분석으로 제한하는 것이 과학적으로 타당합니다.

### $1$과 $(2,3)$ 분석

이 관계는 “번호 2와 3이 나온 회차 중에서 번호 1도 나올 확률이, 공정한 추첨 기준보다 높은가?”로 정의할 수 있습니다.

관측 조건부 확률은:

$$
\widehat{P}(1\mid2,3)
=
\frac{C_{123}}{C_{23}}
$$

공정한 비복원추출에서의 기준값은:

$$
P_{H_0}(1\mid2,3)
=
\frac{k-2}{N-2}
$$

6/45에서는:

$$
P_{H_0}(1\mid2,3)=\frac{4}{43}\approx0.0930
$$

즉 번호 2·3이 나온 회차에서 번호 1이 함께 나올 확률이 9.30% 정도인 것은 정상입니다. 이를 13.33%인 무조건부 출현확률과 비교하면 잘못된 결론이 생깁니다.

이를 보정한 3항 조건부 lift는 다음처럼 정의할 수 있습니다.

$$
\mathrm{ConditionalLift}^{*}
=
\frac{
\widehat{P}(1\mid2,3)
}{
(k-2)/(N-2)
}
$$

- 1보다 큼: 2·3이 등장했을 때 1이 공정 추첨 기준보다 많이 등장
- 1과 같음: 비복원추출이 예상하는 수준
- 1보다 작음: 공정 추첨 기준보다 적게 등장


### $(1,2)$와 $(3,4)$ 분석

두 집합이 겹치지 않는다고 하면 다음의 사건으로 정의합니다.

$$
A=\{1,2\}\subseteq D_t
$$

$$
B=\{3,4\}\subseteq D_t
$$

그리고 관심 확률은 다음입니다.

$$
P(B\mid A)
=
\frac{(k-2)(k-3)}
{(N-2)(N-3)}
$$

6/45에서:

$$
P(\{3,4\}\subseteq D_t\mid\{1,2\}\subseteq D_t)
=
\frac{4\cdot3}{43\cdot42}
\approx0.00664
$$

네 번호가 동시에 등장할 1,000회 기대값은 약 0.097회입니다. 그러므로 4개 조합의 0회, 1회, 드물게 2회 관측은 그 자체로 강한 패턴 증거가 아닙니다.

이런 고차 조합에서는 다음 원칙을 적용해야 합니다.

- **후보 생성**: Apriori, FP-Growth, closed/maximal itemset 탐색
- **통계 검정**: 정확 조합 확률 또는 Monte-Carlo 검정
- **유의성 보정**: 후보 수에 대한 FDR 또는 순열 maxT
- **효과크기**: 관측/기대 비율과 신뢰구간
- **결론 기준**: 최소 관측 횟수와 최소 효과크기를 함께 적용

Apriori는 빈발항목집합의 downward-closure 성질을 이용해 후보를 줄이며, FP-Growth는 후보 생성 과정을 줄이고 FP-tree 기반으로 빈발 패턴을 탐색합니다. 다만 두 방법은 패턴을 **발견**하는 알고리즘이지, 공정 추첨 대비 통계적 이상을 **증명**하는 검정은 아닙니다.[^2_3][^2_4]

## 4. 비복원추출 다변량 공출현 분석

### 왜 일반 상관분석이 부정확한가

번호 $i$가 본번호에 포함되는 이진변수를 $X_i$라고 하면 공정한 $k$-of-$N$ 비복원추출에서:

$$
P(X_i=1)=\frac{k}{N}
$$

$$
P(X_i=1,X_j=1)=\frac{k(k-1)}{N(N-1)}
$$

$$
\mathrm{Corr}(X_i,X_j)
=
-\frac{1}{N-1}, \quad i\neq j
$$

입니다.

즉 6/45에서 서로 다른 모든 번호쌍의 이론적 상관은:

$$
-\frac{1}{44}\approx-0.0227
$$

입니다. 이는 번호들이 “서로 반발하는 숨은 관계”가 있다는 뜻이 아니라, 한 회차에 6개만 선택된다는 고정합 제약에서 자동으로 발생하는 정상적 음의 상관입니다.

따라서 Pearson 상관, $\phi$ 계수, 일반적인 lift를 사용할 수는 있지만 반드시 아래 기준선과 비교해야 합니다.

$$
\text{관측치}
-
\text{비복원추출 영가설 기대치}
$$

### 권장 다변량 분석 방법

| 방법 | 분석 단위 | 비복원추출 보정 | 활용 목적 | 권장도 |
| :-- | :-- | :-- | :-- | :-- |
| 다변량 하이퍼지오메트릭 | 번호 그룹별 선택 개수 | 직접 반영 | 홀짝·구간·끝수·색상·번호군 분포 | 최우선 |
| 일반화된 itemset 확률 | 특정 번호 집합 | 직접 반영 | 2개·3개 번호 공출현 | 최우선 |
| Monte-Carlo 비복원 시뮬레이션 | 모든 통계량 | 직접 반영 | 복합 패턴·최대 편차·네트워크 | 최우선 |
| 조건부 확률 검정 | $A\Rightarrow B$ | 직접 반영 | 번호군 간 관계 | 높음 |
| 로그선형 모형 | 2·3개 이진 변수 | 모형에 제약 반영 필요 | 주효과와 상호작용 분리 | 선택적 |
| Ising graphical model | 다수 이진 변수 | 행합 제약을 명시적으로 다뤄야 함 | 조건부 의존 네트워크 | 연구용 |
| Mutual information | 쌍 또는 삼중항 | 순열 영분포로 보정 | 비선형 의존성 탐색 | 탐색용 |
| Association rules | 번호집합 | null-calibrated lift 필요 | 후보 규칙 생성 | 보조 |
| Network community detection | 공출현 그래프 | 엣지 유의성 보정 필요 | 시각화·군집 후보 | 보조 |

### 그룹별 다변량 하이퍼지오메트릭 분석

번호를 여러 그룹으로 나누면, 각 회차에서 그룹별로 몇 개가 뽑혔는지 분석할 수 있습니다.

예시 그룹:

- 저번호 1–22 / 고번호 23–45
- 홀수 / 짝수
- 1–10, 11–20, 21–30, 31–40, 41–45
- 끝수 0–9
- 연속 번호 블록
- 사용자 정의 번호군

그룹 $g$의 전체 번호 수가 $n_g$이고, 각 그룹에서 뽑힌 개수가 $x_g$이면:

$$
P(X_1=x_1,\dots,X_m=x_m)
=
\frac{
\prod_{g=1}^{m}\binom{n_g}{x_g}
}{
\binom{N}{k}
}
$$

입니다. 이는 다변량 하이퍼지오메트릭 분포이며, 유한 모집단에서 비복원으로 여러 범주의 항목을 뽑을 때 사용하는 모형입니다.[^2_5]

이 방법으로 다음을 검정할 수 있습니다.

- 홀수 3개·짝수 3개가 실제로 기대보다 많거나 적은가
- 1–10 구간에서 2개 이상 나오는 회차가 이론과 다른가
- 저번호와 고번호의 동시 선택 구조가 정상 범위인가
- 끝수 중복의 빈도가 예상보다 높은가
- 연속 번호쌍의 개수가 비복원추출 기준보다 높은가


### 가장 강력한 방법: 조건부 Monte-Carlo

실무 대시보드의 표준 검정 엔진으로는 다음 시뮬레이션을 권장합니다.

```python
for b in range(B):
    simulated_draws = [
        rng.choice(N, size=6, replace=False)
        for _ in range(T)
    ]

    # 단일 빈도, pair co-occurrence, triple,
    # 연속수, 홀짝, 최대 잔차, 네트워크 지표 계산
    simulated_statistic[b] = compute_statistic(simulated_draws)
```

각 분석 통계량 $T_{\text{obs}}$에 대한 양측 Monte-Carlo $p$-value는:

$$
p_{\mathrm{MC}}
=
\frac{
1+
\sum_{b=1}^{B}
I\left(
|T_b|
\ge
|T_{\mathrm{obs}}|
\right)
}
{B+1}
$$

로 계산합니다.

권장 반복 횟수는 다음과 같습니다.


| 목적 | 권장 반복 횟수 $B$ | 구분 가능 최소 $p$-value |
| :-- | --: | --: |
| 대시보드 빠른 탐색 | 10,000 | 약 $10^{-4}$ |
| 정식 분석 보고서 | 100,000 | 약 $10^{-5}$ |
| 전역 maxT·희귀 조합 | 500,000 이상 | 약 $10^{-6}$ 수준 |
| 운영 환경 | 사전 계산 + 증분 업데이트 | 응답성 확보 |

## 5. 연속 회차 자기상관·패턴 검정

같은 번호가 직전 회차에 나온 후 다음 회차에 다시 나오는 현상은 직관적으로 “반복”처럼 보이지만, 독립적 추첨에서도 자연스럽게 발생합니다.

두 연속 회차의 본번호 집합을 $D_t,D_{t+1}$라고 할 때, 겹치는 번호 개수:

$$
O_t=|D_t\cap D_{t+1}|
$$

는 다음 분포를 따릅니다.

$$
O_t
\sim
\mathrm{Hypergeometric}(N,K=k,n=k)
$$

즉:

$$
P(O_t=x)
=
\frac{
\binom{k}{x}
\binom{N-k}{k-x}
}{
\binom{N}{k}
}
$$

6/45에서는 연속 두 회차 간 중복 번호 수의 기댓값이:

$$
E[O_t]=\frac{k^2}{N}=\frac{36}{45}=0.8
$$

입니다. 따라서 연속 회차에서 0개 또는 1개 번호가 겹치는 것은 매우 정상적이며, 2개 이상 겹치는 회차도 일정 비율로 발생합니다.

### 자기상관 검정 절차

#### 1. 번호별 이진 시계열

각 번호 $i$에 대해 다음 시계열을 만듭니다.

$$
X_{1,i}, X_{2,i}, \dots, X_{T,i}
$$

그리고 lag $\ell$에 대한 자기상관을 계산합니다.

$$
\rho_i(\ell)
=
\mathrm{Corr}(X_{t,i},X_{t-\ell,i})
$$

분석 대상:

- $\ell=1$: 직전 회차 반복 출현
- $\ell=2\sim10$: 단기 지연 의존성
- $\ell=20,50$: 중장기 의존성
- 전체 번호에 대한 평균 및 최대 절대 자기상관
- 각 번호별 $p$-value와 FDR 보정


#### 2. 연속 회차 중복수 검정

$$
O_t = |D_t \cap D_{t+1}|
$$

에 대해 다음을 수행합니다.

- 이론 하이퍼지오메트릭 분포 대비 적합도 검정
- $O_t$의 평균이 $k^2/N$과 다른지 검정
- $O_t\ge r$ 사건이 기대보다 많이 발생하는지 검정
- 인접 회차뿐 아니라 lag $1$부터 $L$까지 overlap 분포 분석
- 관측된 최대 중복수의 전역 Monte-Carlo $p$-value 산출


#### 3. Runs test

각 번호별 출현 여부 이진 시퀀스에 대해 runs test를 수행합니다.

- run이 지나치게 적음: 특정 번호의 출현이 군집화될 가능성
- run이 지나치게 많음: 비정상적으로 빠른 출현/비출현 교대 가능성
- 단, 각 번호의 평균 출현확률은 $6/45$이지 0.5가 아니므로, 이 불균형을 반영한 이진 runs 검정을 사용해야 함

NIST SP 800-22의 Runs Test는 연속된 동일 비트의 run 수가 무작위 기대와 일치하는지 평가하며, 빈도 검정을 선행 조건으로 둡니다. 다만 NIST 검정은 일반적인 비트열 난수성 평가를 위한 것이므로, 로또처럼 회차별 6개 고정 선택이 있는 자료에는 번호별 이진 출현 시계열의 **보조 진단**으로만 적용해야 합니다.[^2_6][^2_7]

#### 4. Lagged cross-correlation

번호 $i$의 과거 출현이 번호 $j$의 미래 출현과 관계있는지 검사합니다.

$$
\rho_{ij}(\ell)
=
\mathrm{Corr}(X_{t,i},X_{t+\ell,j})
$$

예를 들면 다음 질문에 답합니다.

- 번호 1이 나온 뒤 1회 후 번호 2가 나오는 경향이 있는가
- 번호군 A의 출현 이후 번호군 B의 출현 확률이 달라지는가
- 직전 회차의 저번호 비중이 다음 회차의 고번호 비중과 관계있는가

하지만 45개 번호, lag 10개만 고려해도:

$$
45\times45\times10=20{,}250
$$

개의 가설이 생길 수 있으므로, 무조건 전수검정하지 말고 다음 중 하나를 사용해야 합니다.

- 사전 정의된 lag와 번호군만 분석
- 전체 최대 상관계수에 대한 순열 maxT 보정
- BH/BY FDR 보정
- sparse regression 또는 regularized VAR 계열의 변수 선택
- rolling-window 또는 change-point 분석으로 사전 후보 축소


#### 5. 변화점 탐지

추첨 장비, 볼 세트, 규칙, 운영 프로세스가 바뀌었다면 분포 변화가 생길 수 있습니다. 다음 통계량의 시계열에 대해 변화점을 탐지합니다.

- 번호별 출현 빈도 벡터
- 회차별 번호 합계
- 홀수 개수
- 저/고 번호 개수
- 연속 번호쌍 개수
- 번호쌍 overlap 수
- 공출현 그래프의 요약 지표
- 전체 균등성 잔차의 moving-window norm

권장 방법은 CUSUM, Page–Hinkley, binary segmentation, PELT, Bayesian change-point입니다. 다만 변화점 검출 결과도 다중 시점·다중 통계량 탐색으로 인한 과대발견 위험이 있으므로, 전후 구간을 고정한 재검정과 순열 기반 유의성 평가를 추가해야 합니다.

## 6. Bonferroni와 FDR 적용 설계

### 왜 보정이 필요한가

6/45에서 번호쌍은:

$$
\binom{45}{2}=990
$$

개입니다.

삼중항은:

$$
\binom{45}{3}=14{,}190
$$

개입니다.

각 가설을 유의수준 0.05로 개별 검정하면, 모든 추첨이 공정해도 번호쌍 분석에서 평균 약 49.5개의 거짓 양성이 나올 수 있습니다.

### Bonferroni 보정

가설 개수가 $m$개일 때:

$$
\alpha_{\mathrm{Bonferroni}}
=
\frac{\alpha}{m}
$$

또는 보정 $p$-value는:

$$
p_{\mathrm{adj}}
=
\min(1,m\cdot p)
$$

입니다.

번호쌍 990개를 $\alpha=0.05$로 분석한다면:

$$
\alpha_{\mathrm{Bonferroni}}
=
\frac{0.05}{990}
\approx0.0000505
$$

입니다.


| 장점 | 단점 | 권장 상황 |
| :-- | :-- | :-- |
| 매우 명확하고 보수적 | 실제 패턴도 놓칠 가능성이 큼 | 감사·규제·강한 결론이 필요한 보고서 |
| FWER 통제 | 검정 간 상관이 있을 때 특히 보수적 | 사전에 정한 소수 가설 |
| “하나라도 거짓 양성 금지”에 적합 | 탐색형 고차원 분석에는 검정력이 낮음 | 핵심 번호쌍만 확인하는 경우 |

### Holm–Bonferroni

Bonferroni보다 덜 보수적인 step-down 방식입니다.

1. $p$-value를 오름차순 정렬합니다.
2. 가장 작은 $p_{(1)}$부터 $\alpha/m$와 비교합니다.
3. 다음 값은 $\alpha/(m-1)$, 그다음은 $\alpha/(m-2)$와 비교합니다.
4. 첫 번째 비기각 시점 이후의 가설은 기각하지 않습니다.

번호쌍의 강한 확인 분석이라면 단순 Bonferroni보다 Holm을 우선 고려할 만합니다.

### Benjamini–Hochberg FDR

BH-FDR은 “발견했다고 선언한 항목들 중 거짓 발견의 기대 비율”을 제어합니다.

$p_{(1)}\le p_{(2)}\le\dots\le p_{(m)}$로 정렬했을 때, 가장 큰 $r$을 찾습니다.

$$
p_{(r)}
\le
\frac{r}{m}q
$$

그리고 $1,\dots,r$ 번째 가설을 유의로 선언합니다.


| 장점 | 단점 | 권장 상황 |
| :-- | :-- | :-- |
| 탐색력이 Bonferroni보다 높음 | 개별 결과의 “절대 확실성”을 뜻하지 않음 | 번호쌍 전체 탐색 |
| 많은 가설에서 유용 | 검정 통계량 의존성 가정 고려 필요 | 네트워크 edge 후보 선별 |
| $q$-value로 우선순위 제공 | 고차 조합 희소성은 별도로 해결해야 함 | 후속 가설 생성 |

BH는 다중검정에서 false discovery rate를 제어하기 위한 대표적 절차입니다.[^2_8][^2_9]

### Benjamini–Yekutieli FDR

번호쌍 공출현 검정은 같은 회차의 고정 6개 선택 구조 때문에 강하게 종속될 수 있습니다. 보수적으로 접근하려면 BY-FDR을 사용합니다.


| 방법 | 제어 대상 | 의존성 전제 | 보수성 | 권장 용도 |
| :-- | :-- | :-- | :-- | :-- |
| Bonferroni | FWER | 없음 | 매우 높음 | 핵심 확인 분석 |
| Holm | FWER | 없음 | 높음 | Bonferroni 대체 |
| BH-FDR | FDR | 독립 또는 특정 양의 의존 구조 | 중간 | 쌍·삼중항 탐색 |
| BY-FDR | FDR | 일반적 의존성 | 높음 | 의존 구조가 강한 전수 탐색 |
| Westfall–Young maxT | FWER | 순열 영가설이 적절하면 반영 가능 | 데이터 기반 | 전체 최대 이상치 검정 |

`statsmodels.stats.multitest.multipletests`는 `bonferroni`, `holm`, `fdr_bh`, `fdr_by` 등을 제공하므로 분석 결과 테이블에 여러 보정 결과를 함께 저장할 수 있습니다.[^2_1]

### 실무 권장 정책

| 분석 대상 | 1차 필터 | 주 보정 | 최종 확증 |
| :-- | :-- | :-- | :-- |
| 단일 번호 45개 | 이항검정 | Holm 또는 BH-FDR | 전체 균등성 순열검정 |
| 번호쌍 990개 | 설계 보정 lift, 최소 공출현 수 | BH-FDR | maxT 순열 FWER |
| 삼중항 14,190개 | 사전후보·최소 support | BY-FDR 또는 계층적 FDR | Monte-Carlo 재검증 |
| 그룹 패턴 | 다변량 하이퍼지오메트릭 | Holm 또는 BH-FDR | 사전 정의된 그룹 우선 |
| 시간 자기상관 | 사전 지정 lag | BH-FDR | 시계열 순열 또는 블록 순열 |
| 변화점 | 후보 변화점 | 재검정·구간 분할 보정 | 외부 운영 변경 이력 대조 |

## 7. 분석 결과 테이블 스키마

대시보드와 재현 가능한 분석을 위해 결과를 아래처럼 정규화해 저장하는 것을 권장합니다.

```sql
CREATE TABLE pair_association_result (
    analysis_run_id          VARCHAR,
    number_a                INTEGER,
    number_b                INTEGER,
    draw_count              INTEGER,
    observed_cooccurrence   INTEGER,
    expected_cooccurrence   DOUBLE,
    null_probability        DOUBLE,
    conditional_probability DOUBLE,
    calibrated_lift         DOUBLE,
    residual                DOUBLE,
    z_score                 DOUBLE,
    p_value                 DOUBLE,
    p_bonferroni            DOUBLE,
    p_holm                  DOUBLE,
    q_bh                    DOUBLE,
    q_by                    DOUBLE,
    p_maxT                  DOUBLE,
    is_significant_bh       BOOLEAN,
    is_significant_fwer     BOOLEAN,
    monte_carlo_iterations  INTEGER,
    created_at              TIMESTAMP
);
```

3개 이상의 조합은 별도 itemset 테이블로 분리합니다.

```sql
CREATE TABLE itemset_association_result (
    analysis_run_id          VARCHAR,
    itemset_json             JSON,
    itemset_size             INTEGER,
    observed_support_count   INTEGER,
    observed_support_rate    DOUBLE,
    expected_support_count   DOUBLE,
    null_probability         DOUBLE,
    calibrated_lift          DOUBLE,
    p_value                  DOUBLE,
    q_value                  DOUBLE,
    method                   VARCHAR,
    simulation_iterations    INTEGER,
    created_at               TIMESTAMP
);
```


## 8. 최종 권장 분석 순서

1. 원천 데이터의 범위·중복·결측·본번호 행합 6·보너스 중복 여부를 검증합니다.
2. 본번호와 보너스를 분리해 $T\times N$ 이진 incidence matrix를 생성합니다.
3. 단일 번호 빈도에 대해 이항검정, 전역 카이제곱 또는 G-test, Monte-Carlo 전체 적합도 검정을 수행합니다.
4. 990개 번호쌍에 대해 관측 공출현, 이론 기대 공출현, 설계 보정 lift, 이항 또는 순열 $p$-value를 산출합니다.
5. 번호쌍 결과에는 BH-FDR을 기본 표기하고, 핵심 결론에는 maxT 순열 FWER를 병기합니다.
6. 삼중항은 전수 탐색보다, 쌍 분석·도메인 가설·번호군 기반으로 후보를 제한한 뒤 조건부 확률과 Monte-Carlo 검정을 수행합니다.
7. $(1,2)$–$(3,4)$ 같은 고차 집합 관계는 합집합 크기 4의 희소 사건으로 모델링하고, 단순 빈도 순위가 아니라 이론 기대치와 비교합니다.
8. 연속 회차 overlap, 번호별 runs, lagged autocorrelation, lagged cross-correlation을 분석합니다.
9. 장기 데이터라면 rolling-window 분석과 변화점 탐지를 병행합니다.
10. 모든 결과는 원시 $p$-value, 보정 $q$-value, 효과크기, 신뢰구간, Monte-Carlo 반복 수, 영가설 정의를 함께 저장·표시합니다.

이 구성으로 구현하면 단순한 “당첨번호 빈도 대시보드”를 넘어, 비복원추출의 수학적 제약을 반영한 **검증 가능한 공출현 분석·무작위성 감시·다중검정 통제 플랫폼**으로 발전시킬 수 있습니다.

<span style="display:none">[^2_10][^2_11][^2_12][^2_13][^2_14][^2_15][^2_16][^2_17][^2_18][^2_19][^2_20]</span>

<div align="center">⁂</div>

[^2_1]: https://www.statsmodels.org/dev/generated/statsmodels.stats.multitest.multipletests.html

[^2_2]: https://www.statsmodels.org/devel/generated/statsmodels.stats.multitest.multipletests.html

[^2_3]: https://www.nature.com/articles/s41598-024-64360-6

[^2_4]: https://link.springer.com/article/10.1007/s10462-018-9629-z

[^2_5]: https://search.r-project.org/CRAN/refmans/extraDistr/html/MultiHypergeometric.html

[^2_6]: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-22.pdf

[^2_7]: https://csrc.nist.gov/pubs/sp/800/22/r1/upd1/final

[^2_8]: https://academic.oup.com/jrsssb/article/57/1/289/7035855

[^2_9]: https://pubmed.ncbi.nlm.nih.gov/18052910/

[^2_10]: https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-22r1a.pdf

[^2_11]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12340023/table/Tab11/

[^2_12]: https://csrc.nist.gov/projects/random-bit-generation/documentation-and-software

[^2_13]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12651575/table/entropy-27-01117-t001/

[^2_14]: https://www.statsmodels.org/dev/\_modules/statsmodels/stats/multitest.html

[^2_15]: https://www.statsmodels.org/stable/\_modules/statsmodels/stats/multitest.html

[^2_16]: https://www.cs.fsu.edu/~mascagni/DSoR/Slides/SP800-22.pdf

[^2_17]: https://www.renesas.com/us/en/document/apn/nist-sp800-22r1a-random-number-statistical-test-report-ra4e2

[^2_18]: https://github.com/runk/randomness

[^2_19]: https://deepwiki.com/statsmodels/statsmodels/4.3-multiple-testing

[^2_20]: https://iris.polito.it/bitstream/11583/2696608/1/TIFS2012-final-double.pdf


---

# 1. 로또 1,000회 데이터 기반의 번호 상관관계 분석 및 무작위성 검정 대시보드 구축

1. 번호 조합 패턴 및 자기상관성 시뮬레이션: 통계적으로 유의미한 패턴 찾기
2. 로또 데이터 비복원추출 영가설 Python 구현 방법
3. 통계적 유의성 검정 시 다중검정 보정 방법 종류
4. 로또 번호쌍 공출현 분석 NetworkX 시각화 예제

아래는 실제 구현 가능한 형태의 설계와 Python 예제입니다. 핵심은 각 회차를 “45개 중 6개를 비복원으로 균등 선택한 집합”으로 모델링하고, 번호쌍·그룹·연속 회차 패턴의 관측값을 이 영가설에서 생성한 Monte-Carlo 분포와 비교하는 것입니다. NumPy의 `Generator.choice(..., replace=False)`는 비복원 표본을 생성하므로 이 영가설 시뮬레이션의 기본 구현에 적합합니다.[^3_1][^3_2]

## 1. 권장 프로젝트 구조

```text
lotto-analytics/
├── data/
│   ├── lotto_1000.csv
│   └── lotto_1000.parquet
├── src/
│   ├── config.py
│   ├── data_loader.py
│   ├── validation.py
│   ├── matrix_builder.py
│   ├── null_model.py
│   ├── frequency_analysis.py
│   ├── pair_analysis.py
│   ├── itemset_analysis.py
│   ├── temporal_analysis.py
│   ├── multiple_testing.py
│   ├── network_analysis.py
│   └── dashboard_components.py
├── app.py
├── requirements.txt
└── tests/
    ├── test_validation.py
    ├── test_null_model.py
    └── test_pair_analysis.py
```


### 입력 CSV 권장 스키마

```csv
draw_no,draw_date,n1,n2,n3,n4,n5,n6,bonus
1,2002-12-07,10,23,29,33,37,40,16
2,2002-12-14,9,13,21,25,32,42,2
...
1000,2022-01-29,2,8,19,22,32,42,39
```

주의할 점은 `n1`~`n6`이 정렬된 번호일 수 있다는 것입니다. 번호의 **추출 순서**를 보존한 데이터가 아니라면 `n1`과 `n2`의 관계를 “첫 번째 공의 번호와 두 번째 공의 번호 관계”로 해석하면 안 됩니다. 본 분석에서는 6개 번호를 순서 없는 집합으로 처리합니다.

### 패키지 구성

```txt
numpy>=1.26
pandas>=2.2
scipy>=1.12
statsmodels>=0.14
networkx>=3.2
plotly>=5.20
streamlit>=1.36
mlxtend>=0.23
ruptures>=1.1.9
pytest>=8.0
```

SciPy는 BH 및 BY 방식의 FDR 보정을 `scipy.stats.false_discovery_control`로 제공하며, FDR은 기각한 영가설 가운데 실제로 참인 영가설의 기대 비율을 제어하는 개념입니다. BH는 독립 또는 특정 양의 의존 구조에서 쓰이며, BY는 임의의 의존성 아래에서도 FDR 통제를 보장하는 더 보수적인 방법입니다.[^3_3][^3_4]

## 2. 데이터 검증과 이진 행렬 생성

### 입력 데이터 검증

```python
from __future__ import annotations

import pandas as pd


MAIN_COLS = ["n1", "n2", "n3", "n4", "n5", "n6"]


def validate_lotto_data(
    df: pd.DataFrame,
    n_numbers: int = 45,
    main_cols: list[str] = MAIN_COLS,
    bonus_col: str = "bonus",
) -> pd.DataFrame:
    required = {"draw_no", "draw_date", *main_cols, bonus_col}
    missing = required - set(df.columns)

    if missing:
        raise ValueError(f"필수 컬럼 누락: {sorted(missing)}")

    if df["draw_no"].duplicated().any():
        raise ValueError("중복 회차가 존재합니다.")

    if df[main_cols + [bonus_col]].isna().any().any():
        raise ValueError("본번호 또는 보너스번호에 결측값이 존재합니다.")

    for row in df.itertuples(index=False):
        main = [getattr(row, col) for col in main_cols]
        bonus = getattr(row, bonus_col)

        if len(set(main)) != len(main):
            raise ValueError(f"회차 {row.draw_no}: 본번호에 중복이 있습니다.")

        if bonus in main:
            raise ValueError(f"회차 {row.draw_no}: 보너스번호가 본번호와 중복됩니다.")

        values = main + [bonus]
        if any((x < 1) or (x > n_numbers) for x in values):
            raise ValueError(
                f"회차 {row.draw_no}: 번호는 1~{n_numbers} 범위여야 합니다."
            )

    return df.sort_values("draw_no").reset_index(drop=True)
```


### 본번호 incidence matrix

각 회차를 $N=45$ 차원의 이진 벡터로 변환합니다.

$$
X_{t,i}=
\begin{cases}
1,& \text{회차 }t\text{의 본번호에 }i\text{가 포함}\\
0,& \text{그 외}
\end{cases}
$$

모든 행은 반드시 아래 조건을 만족해야 합니다.

$$
\sum_{i=1}^{N}X_{t,i}=6
$$

```python
import numpy as np
import pandas as pd


def build_incidence_matrix(
    df: pd.DataFrame,
    n_numbers: int = 45,
    main_cols: list[str] = MAIN_COLS,
) -> pd.DataFrame:
    x = np.zeros((len(df), n_numbers), dtype=np.int8)

    for row_idx, row in enumerate(df[main_cols].itertuples(index=False, name=None)):
        numbers = np.asarray(row, dtype=int)
        x[row_idx, numbers - 1] = 1

    result = pd.DataFrame(
        x,
        index=df["draw_no"].to_numpy(),
        columns=np.arange(1, n_numbers + 1),
    )
    result.index.name = "draw_no"

    if not np.all(result.sum(axis=1).to_numpy() == len(main_cols)):
        raise ValueError("Incidence matrix의 행 합이 본번호 개수와 일치하지 않습니다.")

    return result
```

보너스 번호는 본번호 행렬과 혼합하지 않고 별도 $T\times N$ 이진 행렬로 생성하는 것이 바람직합니다. 본번호 6개와 보너스 1개는 추첨 과정에서 위치·의미가 다르기 때문입니다.

## 3. 비복원추출 영가설 구현

### 영가설 정의

본번호만 분석할 때 영가설은 다음과 같습니다.

$$
H_0:
D_t \sim \mathrm{Uniform}
\left(
\left\{
S\subset\{1,\dots,N\}: |S|=k
\right\}
\right)
$$

즉 매 회차는 가능한 모든 $k$-번호 조합 중 하나를 동일한 확률로 선택하고, 회차 간에는 독립이라고 가정합니다.

$$
P(D_t=S)=\frac{1}{\binom{N}{k}}
$$

6/45에서는:

$$
P(D_t=S)=\frac{1}{\binom{45}{6}}
$$

### 1,000회 영가설 시뮬레이터

```python
import numpy as np


def simulate_lotto_draws(
    n_draws: int = 1000,
    n_numbers: int = 45,
    k_main: int = 6,
    include_bonus: bool = False,
    seed: int | None = None,
) -> np.ndarray:
    rng = np.random.default_rng(seed)

    draw_size = k_main + 1 if include_bonus else k_main

    draws = np.empty((n_draws, draw_size), dtype=np.int16)

    for t in range(n_draws):
        draws[t] = rng.choice(
            np.arange(1, n_numbers + 1),
            size=draw_size,
            replace=False,
        )

    return draws
```

`replace=False`가 비복원추출을 의미합니다. 기본값은 복원추출이므로 명시적으로 설정해야 합니다.[^3_2][^3_1]

### 시뮬레이션 결과를 incidence matrix로 변환

```python
def draws_to_incidence(
    draws: np.ndarray,
    n_numbers: int = 45,
    k_main: int = 6,
) -> np.ndarray:
    x = np.zeros((len(draws), n_numbers), dtype=np.int8)

    for row_idx, row in enumerate(draws[:, :k_main]):
        x[row_idx, row - 1] = 1

    if not np.all(x.sum(axis=1) == k_main):
        raise ValueError("시뮬레이션 결과의 본번호 행 합이 올바르지 않습니다.")

    return x
```


### 재현 가능한 Monte-Carlo 영분포 생성

```python
from dataclasses import dataclass
import numpy as np


@dataclass(frozen=True)
class NullModelConfig:
    n_draws: int = 1000
    n_numbers: int = 45
    k_main: int = 6
    n_simulations: int = 100_000
    seed: int = 20260908


def simulate_null_frequency_distribution(
    config: NullModelConfig,
) -> np.ndarray:
    rng = np.random.default_rng(config.seed)

    frequency_samples = np.empty(
        (config.n_simulations, config.n_numbers),
        dtype=np.int16,
    )

    for b in range(config.n_simulations):
        draws = np.array(
            [
                rng.choice(
                    config.n_numbers,
                    size=config.k_main,
                    replace=False,
                )
                for _ in range(config.n_draws)
            ],
            dtype=np.int16,
        )
        x = np.zeros(
            (config.n_draws, config.n_numbers),
            dtype=np.int8,
        )
        x[np.arange(config.n_draws)[:, None], draws] = 1
        frequency_samples[b] = x.sum(axis=0)

    return frequency_samples
```

실무에서는 100,000회 전체 시뮬레이션을 Python 이중 루프로 수행하기보다, 다음 중 하나를 권장합니다.

- 분석 개발 초기에는 10,000회로 빠르게 검증
- 정식 보고서에는 100,000회 이상
- 희귀 조합 또는 전역 maxT 검정에는 500,000회 이상
- NumPy 배치 처리, Numba, Joblib, Ray를 이용한 병렬화
- 입력 데이터·설정·시드·소프트웨어 버전을 분석 실행 ID와 함께 저장
- 대시보드에서는 사전 계산 결과를 DuckDB 또는 Parquet에서 조회


## 4. 번호 빈도와 무작위성 검정

### 단일 번호 빈도 분석

번호 $i$의 본번호 출현 횟수 $C_i$는 영가설 아래:

$$
C_i\sim \mathrm{Binomial}\left(T,\frac{k}{N}\right)
$$

입니다.

6/45, 1,000회이면:

$$
E[C_i]=1000\times\frac{6}{45}=133.33
$$

$$
\mathrm{Var}(C_i)
=
1000\times\frac{6}{45}
\left(1-\frac{6}{45}\right)
$$

### Python 구현

```python
import numpy as np
import pandas as pd
from scipy.stats import binomtest


def analyze_number_frequencies(
    x: pd.DataFrame,
    k_main: int = 6,
    n_numbers: int = 45,
) -> pd.DataFrame:
    n_draws = len(x)
    p_number = k_main / n_numbers

    observed = x.sum(axis=0).to_numpy(dtype=int)
    expected = n_draws * p_number
    variance = n_draws * p_number * (1 - p_number)
    z_score = (observed - expected) / np.sqrt(variance)

    p_values = np.array(
        [
            binomtest(
                int(count),
                n=n_draws,
                p=p_number,
                alternative="two-sided",
            ).pvalue
            for count in observed
        ]
    )

    return pd.DataFrame(
        {
            "number": x.columns.to_numpy(dtype=int),
            "observed_count": observed,
            "expected_count": expected,
            "residual": observed - expected,
            "z_score": z_score,
            "p_value": p_values,
        }
    )
```


### 전체 번호 분포 균등성 검정

전체 6,000개 본번호 슬롯의 번호별 분포가 균등한지 보는 전역 검정입니다.

$$
\chi^2=
\sum_{i=1}^{N}
\frac{(C_i-E_i)^2}{E_i}
$$

```python
from scipy.stats import chisquare


def global_uniformity_test(
    frequency_result: pd.DataFrame,
) -> dict:
    observed = frequency_result["observed_count"].to_numpy()
    expected = np.full_like(
        observed,
        fill_value=observed.sum() / len(observed),
        dtype=float,
    )

    statistic, p_value = chisquare(
        f_obs=observed,
        f_exp=expected,
    )

    return {
        "test": "chi_square_goodness_of_fit",
        "statistic": float(statistic),
        "p_value": float(p_value),
        "df": len(observed) - 1,
    }
```

카이제곱 검정은 전역 경보에 유용하지만, 개별 번호·번호쌍·고차 조합의 검정을 대체하지는 않습니다. 또한 각 회차의 6개 선택이라는 구조를 완전히 보존한 전역 검정이 필요하면 동일 통계량을 사용한 비복원 Monte-Carlo 검정을 병행하는 것이 좋습니다.

## 5. 번호쌍 공출현 분석

### 이론적 기준선

서로 다른 두 번호 $i,j$가 같은 본번호 조합에 포함될 확률은:

$$
p_{ij}
=
\frac{\binom{N-2}{k-2}}{\binom{N}{k}}
=
\frac{k(k-1)}{N(N-1)}
$$

6/45에서는:

$$
p_{ij}
=
\frac{6\cdot5}{45\cdot44}
=
\frac{1}{66}
\approx0.0151515
$$

따라서 1,000회에서 특정 쌍의 기대 동시출현 수는:

$$
E[C_{ij}]
=
1000\cdot p_{ij}
\approx15.15
$$

### 공출현 행렬 계산

$X$가 $T\times N$ incidence matrix이면:

$$
C=X^\top X
$$

입니다. 대각 원소는 번호별 출현 횟수이고, 비대각 원소는 번호쌍별 동시출현 횟수입니다.

```python
import numpy as np
import pandas as pd


def cooccurrence_matrix(x: pd.DataFrame) -> pd.DataFrame:
    values = x.to_numpy(dtype=np.int64)
    cooc = values.T @ values

    return pd.DataFrame(
        cooc,
        index=x.columns,
        columns=x.columns,
    )
```


### 번호쌍별 통계량과 이항검정

```python
from itertools import combinations

import numpy as np
import pandas as pd
from scipy.stats import binomtest


def analyze_pairs(
    x: pd.DataFrame,
    k_main: int = 6,
    n_numbers: int = 45,
) -> pd.DataFrame:
    n_draws = len(x)
    cooc = cooccurrence_matrix(x).to_numpy(dtype=int)

    p_pair = (
        k_main * (k_main - 1)
        / (n_numbers * (n_numbers - 1))
    )
    expected = n_draws * p_pair
    variance = n_draws * p_pair * (1 - p_pair)

    records = []

    for i, j in combinations(range(n_numbers), 2):
        observed = int(cooc[i, j])
        p_value = binomtest(
            observed,
            n=n_draws,
            p=p_pair,
            alternative="two-sided",
        ).pvalue

        observed_probability = observed / n_draws
        calibrated_lift = observed_probability / p_pair
        z_score = (observed - expected) / np.sqrt(variance)

        records.append(
            {
                "number_a": i + 1,
                "number_b": j + 1,
                "observed_cooccurrence": observed,
                "expected_cooccurrence": expected,
                "null_probability": p_pair,
                "observed_probability": observed_probability,
                "calibrated_lift": calibrated_lift,
                "residual": observed - expected,
                "z_score": z_score,
                "p_value": p_value,
            }
        )

    return pd.DataFrame(records)
```


### 왜 일반 lift를 그대로 쓰면 안 되는가

일반 거래 데이터의 lift는:

$$
\mathrm{Lift}(i,j)
=
\frac{P(i,j)}
{P(i)P(j)}
$$

입니다. 그러나 비복원추출에서는 본번호 개수가 6개로 고정되어 있으므로, 공정한 추첨에서도 번호쌍의 일반 lift가 1이 되지 않습니다.

$$
\mathrm{Lift}_{H_0}
=
\frac{
k(k-1)/(N(N-1))
}{
(k/N)^2
}
=
\frac{N(k-1)}{k(N-1)}
$$

6/45에서는:

$$
\mathrm{Lift}_{H_0}
=
\frac{45\cdot5}{6\cdot44}
\approx0.8864
$$

따라서 이 분석에서는 아래의 **설계 보정 lift**를 사용해야 합니다.

$$
\mathrm{CalibratedLift}_{ij}
=
\frac{
\widehat P(i,j)
}{
P_{H_0}(i,j)
}
$$

- $=1$: 공정한 비복원추출이 기대하는 공출현 수준
- $>1$: 이론 기대보다 많이 함께 출현
- $<1$: 이론 기대보다 적게 함께 출현


## 6. 다중검정 보정 구현

번호쌍은 6/45에서 990개입니다.

$$
\binom{45}{2}=990
$$

삼중항은 14,190개입니다.

$$
\binom{45}{3}=14{,}190
$$

따라서 원시 $p<0.05$를 그대로 사용하면, 공정한 추첨에서도 번호쌍에서 평균 약 49.5개 정도의 우연한 유의 결과가 발생할 수 있습니다.

### 보정법 비교

| 방법 | 제어 대상 | 장점 | 단점 | 사용 권장 |
| :-- | :-- | :-- | :-- | :-- |
| Bonferroni | FWER | 매우 엄격하고 명확 | 지나치게 보수적 | 감사·공식 보고서·사전 가설 |
| Holm | FWER | Bonferroni보다 검정력 우수 | 여전히 보수적 | 핵심 번호쌍 확증 |
| Holm–Šidák | FWER | Holm보다 약간 완화 가능 | 독립성 가정과 해석 고려 | 보조 옵션 |
| BH-FDR | FDR | 탐색력이 높음 | 강한 임의 의존성에는 주의 | 번호쌍 전수 탐색 기본 |
| BY-FDR | FDR | 일반 의존성에서 보수적 통제 | 매우 보수적 | 쌍·삼중항의 의존성 우려 시 |
| Westfall–Young maxT | FWER | 데이터의 의존성·최대 탐색 효과 반영 | Monte-Carlo 비용 | 최종 전역 확증 |

### Statsmodels 구현

```python
import pandas as pd
from statsmodels.stats.multitest import multipletests


def apply_multiple_testing(
    result: pd.DataFrame,
    p_column: str = "p_value",
    alpha: float = 0.05,
) -> pd.DataFrame:
    output = result.copy()
    p_values = output[p_column].to_numpy()

    methods = {
        "p_bonferroni": "bonferroni",
        "p_holm": "holm",
        "q_bh": "fdr_bh",
        "q_by": "fdr_by",
    }

    for output_col, method in methods.items():
        rejected, adjusted_p, _, _ = multipletests(
            p_values,
            alpha=alpha,
            method=method,
        )
        output[output_col] = adjusted_p
        output[f"{output_col}_significant"] = rejected

    return output
```


### SciPy BH/BY 구현

```python
from scipy.stats import false_discovery_control


def apply_fdr_scipy(
    result: pd.DataFrame,
    p_column: str = "p_value",
) -> pd.DataFrame:
    output = result.copy()
    p_values = output[p_column].to_numpy()

    output["q_bh"] = false_discovery_control(
        p_values,
        method="bh",
    )
    output["q_by"] = false_discovery_control(
        p_values,
        method="by",
    )

    return output
```

SciPy의 `false_discovery_control`은 `'bh'`와 `'by'`를 지원합니다. BY는 검정통계량 또는 $p$-value 간 임의의 의존성이 있을 때도 FDR 통제를 보장하는 대신 BH보다 더 보수적입니다. 번호쌍 공출현처럼 가설들이 동일한 회차·번호를 공유하는 문제에서는 BH와 BY 결과를 함께 표시하는 것이 투명합니다.[^3_4][^3_3]

## 7. 번호쌍 네트워크 시각화

### 네트워크 구성 원칙

노드:

$$
V=\{1,\dots,N\}
$$

엣지:

$$
E=
\left\{
(i,j):
q_{ij}<\alpha
\land
|\mathrm{CalibratedLift}_{ij}-1|
\ge\delta
\right\}
$$

엣지 가중치 후보:

$$
w_{ij}=|z_{ij}|
$$

또는:

$$
w_{ij}
=
|\log_2(\mathrm{CalibratedLift}_{ij})|
$$

단, “관측 공출현 횟수가 높다”는 이유만으로 엣지를 추가하면 빈도가 높은 번호가 과도하게 연결됩니다. 반드시 기대 공출현 기준선, $q$-value, 최소 효과크기를 함께 적용해야 합니다.

### NetworkX 그래프 생성

```python
import math

import networkx as nx
import pandas as pd


def build_pair_network(
    pair_result: pd.DataFrame,
    alpha: float = 0.05,
    min_abs_log2_lift: float = 0.20,
    q_column: str = "q_bh",
) -> nx.Graph:
    graph = nx.Graph()

    all_numbers = sorted(
        set(pair_result["number_a"]) | set(pair_result["number_b"])
    )
    graph.add_nodes_from(all_numbers)

    selected = pair_result[
        (pair_result[q_column] < alpha)
        & (
            pair_result["calibrated_lift"]
            .apply(lambda x: abs(math.log2(x)) >= min_abs_log2_lift)
        )
    ].copy()

    for row in selected.itertuples(index=False):
        graph.add_edge(
            int(row.number_a),
            int(row.number_b),
            observed=int(row.observed_cooccurrence),
            expected=float(row.expected_cooccurrence),
            z_score=float(row.z_score),
            p_value=float(row.p_value),
            q_value=float(getattr(row, q_column)),
            calibrated_lift=float(row.calibrated_lift),
            weight=abs(float(row.z_score)),
            direction=(
                "overrepresented"
                if row.calibrated_lift > 1
                else "underrepresented"
            ),
        )

    return graph
```


### Plotly 기반 인터랙티브 시각화

```python
import numpy as np
import plotly.graph_objects as go
import networkx as nx


def plot_pair_network(
    graph: nx.Graph,
    seed: int = 42,
) -> go.Figure:
    if graph.number_of_edges() == 0:
        return go.Figure(
            layout={
                "title": "선택된 임계값에서 유의한 번호쌍 엣지가 없습니다."
            }
        )

    pos = nx.spring_layout(
        graph,
        seed=seed,
        weight="weight",
        k=1.2,
    )

    edge_x = []
    edge_y = []
    edge_color = []
    edge_width = []
    edge_hover = []

    for u, v, attrs in graph.edges(data=True):
        x0, y0 = pos[u]
        x1, y1 = pos[v]

        edge_x.extend([x0, x1, None])
        edge_y.extend([y0, y1, None])

        color = (
            "rgba(220, 38, 38, 0.70)"
            if attrs["direction"] == "overrepresented"
            else "rgba(37, 99, 235, 0.70)"
        )

        edge_color.extend([color, color, color])
        edge_width.append(max(1.0, min(7.0, attrs["weight"])))

        edge_hover.append(
            f"{u}–{v}<br>"
            f"관측={attrs['observed']}<br>"
            f"기대={attrs['expected']:.2f}<br>"
            f"보정 Lift={attrs['calibrated_lift']:.3f}<br>"
            f"z={attrs['z_score']:.3f}<br>"
            f"p={attrs['p_value']:.5g}<br>"
            f"q={attrs['q_value']:.5g}"
        )

    edge_trace = go.Scatter(
        x=edge_x,
        y=edge_y,
        mode="lines",
        line={"width": 1.5, "color": "rgba(100,100,100,0.45)"},
        hoverinfo="none",
    )

    node_x = []
    node_y = []
    node_text = []
    node_color = []
    node_size = []

    degrees = dict(graph.degree())

    for node in graph.nodes():
        x, y = pos[node]
        node_x.append(x)
        node_y.append(y)
        node_text.append(
            f"번호 {node}<br>"
            f"유의 엣지 수={degrees[node]}"
        )
        node_color.append(degrees[node])
        node_size.append(16 + degrees[node] * 3)

    node_trace = go.Scatter(
        x=node_x,
        y=node_y,
        mode="markers+text",
        text=[str(node) for node in graph.nodes()],
        textposition="middle center",
        hovertext=node_text,
        hoverinfo="text",
        marker={
            "size": node_size,
            "color": node_color,
            "colorscale": "Viridis",
            "showscale": True,
            "colorbar": {"title": "유의 연결 수"},
            "line": {"width": 1, "color": "white"},
        },
    )

    return go.Figure(
        data=[edge_trace, node_trace],
        layout=go.Layout(
            title="번호쌍 공출현 네트워크",
            showlegend=False,
            hovermode="closest",
            margin={"l": 20, "r": 20, "t": 55, "b": 20},
            xaxis={"showgrid": False, "zeroline": False, "visible": False},
            yaxis={"showgrid": False, "zeroline": False, "visible": False},
        ),
    )
```

시각화 색상은 다음처럼 해석할 수 있습니다.

- 빨간 엣지: 공정한 비복원추출 영가설보다 함께 많이 관측된 번호쌍
- 파란 엣지: 영가설보다 함께 적게 관측된 번호쌍
- 노드 크기: 유의한 연결 수 또는 번호별 출현 편차
- 엣지 굵기: $|z|$, $-\log_{10}(q)$, 또는 $|\log_2(\mathrm{Lift}^{*})|$

단, 대시보드에서 “유의 엣지 0개”는 실패가 아니라 매우 정상적이고 중요한 결과일 수 있습니다. 공정하게 추출된 1,000회 데이터라면 다중검정 보정 후 강한 쌍 패턴이 남지 않는 것이 자연스럽습니다.

## 8. 연속 회차 자기상관성 분석

### 연속 회차 중복 번호 수

인접 회차 $t$, $t+1$에서 겹치는 번호 수를:

$$
O_t=|D_t\cap D_{t+1}|
$$

라고 정의합니다.

영가설 하에서:

$$
O_t
\sim
\mathrm{Hypergeometric}(N,K=k,n=k)
$$

$$
P(O_t=r)
=
\frac{
\binom{k}{r}
\binom{N-k}{k-r}
}{
\binom{N}{k}
}
$$

기댓값은:

$$
E[O_t]=\frac{k^2}{N}
$$

6/45에서는:

$$
E[O_t]=\frac{36}{45}=0.8
$$

따라서 직전 회차와 0개 또는 1개가 겹치는 것은 정상이며, 가끔 2개 이상의 중복 번호가 나오는 것도 충분히 가능한 사건입니다.

### overlap 계산 코드

```python
import numpy as np
import pandas as pd
from scipy.stats import hypergeom


def consecutive_overlap(
    x: pd.DataFrame,
    n_numbers: int = 45,
    k_main: int = 6,
) -> pd.DataFrame:
    values = x.to_numpy(dtype=np.int8)
    overlap = (values[:-1] * values[1:]).sum(axis=1)

    result = pd.DataFrame(
        {
            "draw_no_t": x.index[:-1].to_numpy(),
            "draw_no_t_plus_1": x.index[1:].to_numpy(),
            "overlap_count": overlap,
        }
    )

    result["expected_overlap"] = (k_main * k_main) / n_numbers

    return result


def overlap_distribution_test(
    overlap_result: pd.DataFrame,
    n_numbers: int = 45,
    k_main: int = 6,
) -> pd.DataFrame:
    observed = (
        overlap_result["overlap_count"]
        .value_counts()
        .sort_index()
        .reindex(range(k_main + 1), fill_value=0)
    )

    values = np.arange(k_main + 1)

    probabilities = hypergeom.pmf(
        values,
        M=n_numbers,
        n=k_main,
        N=k_main,
    )

    expected = probabilities * len(overlap_result)

    return pd.DataFrame(
        {
            "overlap_count": values,
            "observed_count": observed.to_numpy(),
            "expected_count": expected,
            "null_probability": probabilities,
        }
    )
```


### 번호별 lag-1 자기상관

번호별 이진 시계열 $X_{t,i}$에 대해:

$$
\rho_i(1)
=
\mathrm{Corr}(X_{t,i},X_{t+1,i})
$$

를 계산합니다.

```python
import numpy as np
import pandas as pd
from scipy.stats import pearsonr


def lag1_autocorrelation(x: pd.DataFrame) -> pd.DataFrame:
    values = x.to_numpy(dtype=float)

    records = []

    for col_idx, number in enumerate(x.columns):
        series_t = values[:-1, col_idx]
        series_t1 = values[1:, col_idx]

        if np.std(series_t) == 0 or np.std(series_t1) == 0:
            corr, p_value = np.nan, np.nan
        else:
            corr, p_value = pearsonr(series_t, series_t1)

        records.append(
            {
                "number": int(number),
                "lag": 1,
                "autocorrelation": corr,
                "p_value": p_value,
            }
        )

    return pd.DataFrame(records)
```

이 결과도 45개 번호를 동시에 검사하므로 BH-FDR 또는 Holm 보정을 적용해야 합니다. lag를 1~10까지 확장하면 검정 수는 적어도 $45\times10=450$개가 됩니다.

### Monte-Carlo 기반 최대 자기상관 검정

개별 번호에 대한 자기상관 $p$-value만 보는 것보다, “45개 번호 중 가장 큰 절대 자기상관”을 영가설과 비교하는 방식이 더 실용적입니다.

$$
M_{\mathrm{obs}}
=
\max_i |\widehat{\rho}_i(1)|
$$

시뮬레이션 $b$마다:

$$
M_b=
\max_i|\widehat{\rho}_{i,b}(1)|
$$

를 계산하고 다음을 구합니다.

$$
p_{\mathrm{maxT}}
=
\frac{
1+\sum_{b=1}^{B}I(M_b\ge M_{\mathrm{obs}})
}{
B+1
}
$$

이 방식은 “가장 특이한 번호를 사후 선택한 문제”를 전역적으로 보정합니다.

## 9. Monte-Carlo 기반 번호쌍 maxT 검정

번호쌍 990개 전체를 탐색한 후 가장 큰 $|z|$를 찾았다면, 그 최대값도 무작위 추출에서 흔히 나오는지를 검정해야 합니다.

```python
import numpy as np


def max_pair_z_score(
    x_array: np.ndarray,
    n_numbers: int = 45,
    k_main: int = 6,
) -> float:
    n_draws = x_array.shape[^3_0]
    cooc = x_array.T @ x_array

    p_pair = (
        k_main * (k_main - 1)
        / (n_numbers * (n_numbers - 1))
    )
    expected = n_draws * p_pair
    sd = np.sqrt(n_draws * p_pair * (1 - p_pair))

    upper = np.triu_indices(n_numbers, k=1)
    z_scores = (cooc[upper] - expected) / sd

    return float(np.max(np.abs(z_scores)))
```

```python
def monte_carlo_pair_max_test(
    observed_x: np.ndarray,
    n_simulations: int = 10_000,
    n_numbers: int = 45,
    k_main: int = 6,
    seed: int = 20260908,
) -> dict:
    rng = np.random.default_rng(seed)
    n_draws = observed_x.shape[^3_0]

    observed_max = max_pair_z_score(
        observed_x,
        n_numbers=n_numbers,
        k_main=k_main,
    )

    null_maxima = np.empty(n_simulations, dtype=float)

    for b in range(n_simulations):
        simulated = np.zeros(
            (n_draws, n_numbers),
            dtype=np.int8,
        )

        for t in range(n_draws):
            selected = rng.choice(
                n_numbers,
                size=k_main,
                replace=False,
            )
            simulated[t, selected] = 1

        null_maxima[b] = max_pair_z_score(
            simulated,
            n_numbers=n_numbers,
            k_main=k_main,
        )

    p_value = (
        1 + np.sum(null_maxima >= observed_max)
    ) / (n_simulations + 1)

    return {
        "observed_max_abs_z": observed_max,
        "null_mean": float(null_maxima.mean()),
        "null_q95": float(np.quantile(null_maxima, 0.95)),
        "null_q99": float(np.quantile(null_maxima, 0.99)),
        "maxT_p_value": float(p_value),
        "n_simulations": n_simulations,
    }
```

이 검정은 개별 쌍의 유의성만이 아니라, “990개를 모두 훑어 본 뒤에도 가장 특이한 쌍이 정말 이례적인가?”를 판단합니다. 번호쌍 공출현 네트워크의 엣지를 표시하기 전, 이 전역 검정을 품질 게이트로 사용하는 방식을 권장합니다.

## 10. Streamlit 대시보드 최소 예제

아래는 단일 파일 형태의 최소 PoC입니다. 실제 운영에서는 분석 로직을 모듈화하고, Monte-Carlo 결과를 캐싱 또는 사전 계산하는 구조가 좋습니다.

```python
import streamlit as st
import pandas as pd
import plotly.express as px

from data_loader import load_lotto_data
from validation import validate_lotto_data
from matrix_builder import build_incidence_matrix
from frequency_analysis import analyze_number_frequencies
from pair_analysis import analyze_pairs
from multiple_testing import apply_multiple_testing
from network_analysis import build_pair_network, plot_pair_network


st.set_page_config(
    page_title="로또 무작위성·공출현 분석",
    layout="wide",
)

st.title("로또 1,000회 데이터: 무작위성·공출현 분석 대시보드")

uploaded = st.file_uploader(
    "로또 CSV 업로드",
    type=["csv"],
)

if uploaded is not None:
    raw_df = pd.read_csv(uploaded)
    df = validate_lotto_data(raw_df, n_numbers=45)
    x = build_incidence_matrix(df, n_numbers=45)

    st.sidebar.header("분석 파라미터")

    alpha = st.sidebar.slider(
        "유의수준 α",
        min_value=0.01,
        max_value=0.20,
        value=0.05,
        step=0.01,
    )

    correction = st.sidebar.selectbox(
        "다중검정 보정",
        options=["q_bh", "q_by", "p_holm", "p_bonferroni"],
        index=0,
    )

    min_lift = st.sidebar.slider(
        "최소 |log2(설계 보정 Lift)|",
        min_value=0.0,
        max_value=2.0,
        value=0.20,
        step=0.05,
    )

    frequency = analyze_number_frequencies(
        x,
        k_main=6,
        n_numbers=45,
    )
    frequency = apply_multiple_testing(
        frequency,
        p_column="p_value",
        alpha=alpha,
    )

    pair_result = analyze_pairs(
        x,
        k_main=6,
        n_numbers=45,
    )
    pair_result = apply_multiple_testing(
        pair_result,
        p_column="p_value",
        alpha=alpha,
    )

    col1, col2, col3, col4 = st.columns(4)

    col1.metric("분석 회차", len(df))
    col2.metric("번호 풀", 45)
    col3.metric(
        "BH-FDR 유의 번호",
        int((frequency["q_bh"] < alpha).sum()),
    )
    col4.metric(
        "BH-FDR 유의 번호쌍",
        int((pair_result["q_bh"] < alpha).sum()),
    )

    st.subheader("번호별 출현 빈도")

    fig_frequency = px.bar(
        frequency,
        x="number",
        y="observed_count",
        color="z_score",
        color_continuous_scale="RdBu_r",
        hover_data=[
            "expected_count",
            "residual",
            "p_value",
            "q_bh",
            "q_by",
        ],
    )
    fig_frequency.add_hline(
        y=frequency["expected_count"].iloc[^3_0],
        line_dash="dash",
        line_color="black",
        annotation_text="이론 기대 빈도",
    )
    st.plotly_chart(fig_frequency, use_container_width=True)

    st.subheader("번호쌍 공출현 네트워크")

    graph = build_pair_network(
        pair_result,
        alpha=alpha,
        min_abs_log2_lift=min_lift,
        q_column=correction,
    )

    st.write(
        {
            "nodes": graph.number_of_nodes(),
            "significant_edges": graph.number_of_edges(),
            "correction": correction,
            "alpha": alpha,
        }
    )

    figure = plot_pair_network(graph)
    st.plotly_chart(figure, use_container_width=True)

    st.subheader("번호쌍 분석 결과")

    st.dataframe(
        pair_result.sort_values(
            by=[correction, "p_value"],
            ascending=True,
        ),
        use_container_width=True,
        hide_index=True,
    )
```


## 11. 결과 해석과 운영 원칙

대시보드에는 반드시 다음 경고문 또는 해석 정책을 표시하는 것이 좋습니다.

- 공정한 비복원추출에서도 번호쌍 간 상관은 구조적으로 음수일 수 있습니다.
- 일반적인 Pearson 상관, 일반 lift, 단순 공출현 순위만으로 번호 간 의존성이나 예측 가능성을 주장할 수 없습니다.
- 다중검정 보정 전의 $p<0.05$ 결과는 탐색 후보일 뿐입니다.
- 990개 번호쌍을 동시에 탐색하면 우연한 이상 후보가 발견되는 것이 정상입니다.
- 3개 번호 조합은 1,000회 기준 기대 공출현이 약 1.4회 수준이며, 4개 이상의 조합은 대부분 0회가 정상입니다.
- 통계적 유의성은 예측력, 조작, 인과관계 또는 추첨 불공정의 증거와 동의어가 아닙니다.
- 최종 판단에는 원시 $p$, 보정 $q$, 효과크기, 신뢰구간, Monte-Carlo 전역 $p$, 재현성 검증을 함께 사용해야 합니다.

NIST SP 800-22는 난수·의사난수 비트열에 대해 frequency test, runs test 등을 포함한 통계 검정군을 제시합니다. 다만 로또 데이터는 회차별로 정확히 6개가 선택되는 고정합 비복원 표본이므로, NIST 검정은 번호별 이진 시계열의 보조 진단으로 쓰고, 핵심 영가설은 반드시 $k$-of-$N$ 비복원추출 모델로 유지해야 합니다.[^3_5][^3_6]

이 구현 방향을 따르면, 단순한 번호 빈도 조회 시스템이 아니라 다음을 갖춘 분석 플랫폼을 만들 수 있습니다.

- 비복원추출 기반의 정확한 공출현 영가설
- 번호별·번호쌍별·번호군별 이상 탐지
- BH/BY·Holm·Bonferroni·maxT 기반 다중검정 통제
- 연속 회차 overlap·자기상관·runs·변화점 분석
- NetworkX/Plotly 기반 관계 네트워크
- Monte-Carlo 시뮬레이션에 근거한 재현 가능한 통계적 판단

<span style="display:none">[^3_10][^3_11][^3_12][^3_13][^3_14][^3_15][^3_16][^3_17][^3_7][^3_8][^3_9]</span>

<div align="center">⁂</div>

[^3_1]: https://numpy.org/doc/stable/reference/random/generated/numpy.random.choice.html

[^3_2]: https://numpy.org/doc/stable/reference/random/generated/numpy.random.Generator.choice.html

[^3_3]: https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.false_discovery_control.html

[^3_4]: https://docs.scipy.org/doc/scipy-1.15.0/reference/generated/scipy.stats.false_discovery_control.html

[^3_5]: https://csrc.nist.gov/pubs/sp/800/22/r1/upd1/final

[^3_6]: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-22.pdf

[^3_7]: https://docs.scipy.org/doc/scipy-1.15.1/reference/generated/scipy.stats.false_discovery_control.html

[^3_8]: https://docs.scipy.org/doc/scipy-1.14.0/reference/generated/scipy.stats.false_discovery_control.html

[^3_9]: https://docs.scipy.org/doc/scipy-1.12.0/reference/generated/scipy.stats.false_discovery_control.html

[^3_10]: https://docs.scipy.org/doc//scipy-1.11.2/reference/generated/scipy.stats.false_discovery_control.html

[^3_11]: https://numpy.org/doc/2.5/reference/random/generated/numpy.random.choice.html

[^3_12]: https://numpy.org/devdocs/reference/random/generated/numpy.random.choice.html

[^3_13]: https://numpy.org/doc/2.1/reference/random/generated/numpy.random.choice.html

[^3_14]: https://numpy.org/doc/2.1/reference/random/generated/numpy.random.Generator.choice.html

[^3_15]: https://numpy.org/doc/2.3/reference/random/generated/numpy.random.Generator.choice.html

[^3_16]: https://numpy.org/doc/2.2/reference/random/generated/numpy.random.Generator.choice.html

[^3_17]: https://numpy.org/doc/2.4/reference/random/generated/numpy.random.Generator.choice.html

