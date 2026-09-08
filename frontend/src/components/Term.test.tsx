import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Term from './Term';
import { GLOSSARY, GLOSSARY_BY_ID } from '../lib/glossary';

test('용어 사전: 45개 이상, id 유일, 모든 항목에 설명·대부분 링크', () => {
  expect(GLOSSARY.length).toBeGreaterThanOrEqual(45);
  expect(new Set(GLOSSARY.map((t) => t.id)).size).toBe(GLOSSARY.length);
  for (const t of GLOSSARY) {
    expect(t.short.length).toBeGreaterThan(20);
    expect(t.label.length).toBeGreaterThan(0);
  }
  expect(GLOSSARY.filter((t) => (t.links?.length ?? 0) > 0).length).toBeGreaterThan(GLOSSARY.length * 0.6);
  expect(GLOSSARY_BY_ID.hypergeom.short).toMatch(/비복원/);
});

test('Term: hover 시 tooltip(설명+링크) 표시, ESC 로 닫힘, 미등록 id 는 텍스트만', () => {
  render(
    <MemoryRouter>
      <Term id="null_distribution">영분포</Term>
      <Term id="nope">그냥 텍스트</Term>
    </MemoryRouter>,
  );
  const el = screen.getByText('영분포');
  expect(el).toHaveAttribute('role', 'term');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.mouseEnter(el.parentElement!);
  const tip = screen.getByRole('tooltip');
  expect(tip).toHaveTextContent(/하이퍼지오메트릭/);
  expect(tip).toHaveTextContent(/몬테카를로/);
  expect(tip.querySelector('a[target="_blank"][rel~="noopener"]')).not.toBeNull();
  expect(el).toHaveAttribute('aria-describedby', tip.id);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  expect(screen.getByText('그냥 텍스트').closest('[role=term]')).toBeNull();
});

test('Term icon 모드: (?) 버튼 클릭으로 토글', () => {
  render(
    <MemoryRouter>
      <Term id="maxT" icon>
        maxT p
      </Term>
    </MemoryRouter>,
  );
  const btn = screen.getByRole('button', { name: /maxT.*설명/ });
  fireEvent.click(btn);
  expect(screen.getByRole('tooltip')).toHaveTextContent(/가장 극단적인 값/);
});
