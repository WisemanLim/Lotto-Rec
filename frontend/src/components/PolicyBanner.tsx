import { Fragment, type ReactNode } from 'react';
import Term from './Term';

const DEFAULT_POLICY = [
  '공정 추첨에서도 번호쌍 상관은 구조적으로 음수다.',
  '일반 상관·일반 lift·공출현 순위만으로 의존성을 주장할 수 없다.',
  '보정 전 p<0.05는 탐색 후보다. 990쌍을 탐색하면 약 50개의 우연한 후보가 나오는 것이 정상이다.',
  '3개 조합 기대 공출현은 약 1.4회, 4개 이상은 0회가 정상이다.',
  '통계적 유의성은 예측력·조작·인과의 증거가 아니다.',
  '추천번호는 균등 무작위와 동일한 당첨확률을 가지며, 차이는 군 B 검증 리포트로 확인한다.',
];

interface Props {
  lines?: ReactNode[] | null;
  compact?: boolean;
  title?: string;
}

/** 해석 원칙 고정 고지 (PRD §4.11). API 가 주는 문장이 있으면 그것을, 없으면 PRD 문장. */
export default function PolicyBanner({ lines, compact, title = '해석 원칙' }: Props) {
  const items = lines && lines.length > 0 ? lines : DEFAULT_POLICY;
  if (compact) {
    return (
      <p
        role="note"
        className="rounded-md border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
      >
        {items.map((l, i) => (
          <Fragment key={i}>
            {i > 0 && ' '}
            {l}
          </Fragment>
        ))}
      </p>
    );
  }
  return (
    <aside
      role="note"
      className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <div className="mb-1 font-semibold">
        <Term id="interpretation" icon>
          {title}
        </Term>
      </div>
      <ol className="list-decimal space-y-0.5 pl-5">
        {items.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>
    </aside>
  );
}
