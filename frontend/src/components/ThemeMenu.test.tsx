import { fireEvent, render, screen } from '@testing-library/react';
import ThemeMenu from './ThemeMenu';
import { ThemeProvider } from '../hooks/ThemeProvider';
import { Field, FormSlot } from './States';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

test('테마 메뉴: 다크 선택 → html.dark + localStorage, 시스템으로 복귀', () => {
  render(
    <ThemeProvider>
      <ThemeMenu />
    </ThemeProvider>,
  );
  const btn = screen.getByRole('button', { name: /화면 테마/ });
  fireEvent.click(btn);
  const menu = screen.getByRole('menu', { name: '화면 테마 선택' });
  expect(menu).toBeInTheDocument();
  fireEvent.click(screen.getByRole('menuitemradio', { name: /다크/ }));
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(localStorage.getItem('lotto-rec-theme')).toBe('dark');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument(); // 선택 후 닫힘
  fireEvent.click(btn);
  fireEvent.click(screen.getByRole('menuitemradio', { name: /라이트/ }));
  expect(document.documentElement.classList.contains('dark')).toBe(false);
  fireEvent.click(btn);
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('저장된 테마를 초기 로드 시 적용한다', () => {
  localStorage.setItem('lotto-rec-theme', 'dark');
  render(
    <ThemeProvider>
      <ThemeMenu />
    </ThemeProvider>,
  );
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(screen.getByRole('button', { name: /다크/ })).toBeInTheDocument();
});

test('Field 는 힌트 유무와 무관하게 3줄 구조(라벨·입력·힌트 줄)를 유지한다', () => {
  const { container } = render(
    <div>
      <Field label="A" hint="h">
        <input aria-label="a" />
      </Field>
      <Field label="B">
        <input aria-label="b" />
      </Field>
      <FormSlot>
        <button type="button">go</button>
      </FormSlot>
    </div>,
  );
  const labels = container.querySelectorAll('label');
  expect(labels).toHaveLength(2);
  for (const l of labels) {
    expect(l.children).toHaveLength(3); // 라벨 span · input · 힌트 span
    expect(l.lastElementChild?.textContent?.length).toBeGreaterThan(0); // 빈 줄도 nbsp 로 예약
  }
  const slot = screen.getByRole('button', { name: 'go' }).parentElement?.parentElement;
  expect(slot?.children).toHaveLength(3);
});
