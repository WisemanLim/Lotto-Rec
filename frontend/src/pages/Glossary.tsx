import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { GLOSSARY, GLOSSARY_CATEGORIES, type GlossaryCategory } from '../lib/glossary';
import PolicyBanner from '../components/PolicyBanner';
import { Field, PageTitle, Section, inputCls } from '../components/States';

/** 용어 사전 페이지 (PRD §E6 공통 UX v1.2) — 화면 툴팁과 같은 데이터. */
export default function Glossary() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'' | GlossaryCategory>('');
  const loc = useLocation();
  useEffect(() => {
    const id = loc.hash.replace('#', '');
    if (!id) return;
    const el = document.getElementById(`term-${id}`);
    if (el) {
      el.scrollIntoView({ block: 'center' });
      el.classList.add('ring-2', 'ring-blue-400');
      const t = setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400'), 2500);
      return () => clearTimeout(t);
    }
  }, [loc.hash]);
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    return GLOSSARY.filter((t) => (!cat || t.category === cat) && (!k || t.label.toLowerCase().includes(k) || t.short.toLowerCase().includes(k) || t.id.includes(k)));
  }, [q, cat]);
  return (
    <div className="space-y-4">
      <PageTitle title="용어 사전" sub={`이 플랫폼에 나오는 통계·알고리즘 용어 ${GLOSSARY.length}개 — 화면의 점선 밑줄 용어에 마우스를 올리면 같은 설명이 보입니다.`} />
      <PolicyBanner compact lines={['설명은 이해를 돕기 위한 요약입니다. 정확한 정의는 각 항목의 위키·논문 링크를 참고하세요. 통계적 유의성은 예측력·조작·인과의 증거가 아닙니다.']} />
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <Field label="검색" hint="용어·설명·id">
          <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 영분포, maxT, holdout" aria-label="용어 검색" />
        </Field>
        <Field label="분류">
          <select className={inputCls} value={cat} onChange={(e) => setCat(e.target.value as '' | GlossaryCategory)} aria-label="분류 필터">
            <option value="">전체</option>
            {GLOSSARY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c} ({GLOSSARY.filter((t) => t.category === c).length})
              </option>
            ))}
          </select>
        </Field>
      </div>
      {GLOSSARY_CATEGORIES.filter((c) => !cat || c === cat).map((c) => {
        const items = filtered.filter((t) => t.category === c);
        if (!items.length) return null;
        return (
          <Section key={c} title={c} right={<span className="text-xs text-neutral-500">{items.length}개</span>}>
            <dl className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {items.map((t) => (
                <div key={t.id} id={`term-${t.id}`} className="grid gap-1 py-3 md:grid-cols-[220px_1fr] md:gap-4 rounded transition">
                  <dt className="text-sm font-semibold">
                    {t.label}
                    <span className="ml-2 font-mono text-[11px] text-neutral-400">{t.id}</span>
                  </dt>
                  <dd className="text-sm">
                    <p>{t.short}</p>
                    {t.detail && <p className="mt-1 text-neutral-600 dark:text-neutral-300">{t.detail}</p>}
                    {t.links && t.links.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {t.links.map((l) => (
                          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline dark:text-blue-300">
                            ↗ {l.label}
                          </a>
                        ))}
                      </p>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>
        );
      })}
      {filtered.length === 0 && <p className="text-sm text-neutral-500">검색 결과 없음.</p>}
    </div>
  );
}
