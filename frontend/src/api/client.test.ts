import { ApiError, api, buildUrl } from './client';

describe('api client', () => {
  test('buildUrl 은 null/undefined/빈 문자열 파라미터를 생략한다', () => {
    expect(buildUrl('/api/v1/analysis/runs/latest', { cohort: 'A' })).toBe('/api/v1/analysis/runs/latest?cohort=A');
    expect(buildUrl('/api/v1/analysis/runs', { limit: undefined })).toBe('/api/v1/analysis/runs');
    expect(buildUrl('/api/v1/tracking/summary', { origin: null })).toBe('/api/v1/tracking/summary');
    expect(buildUrl('/api/v1/recommend/history', { limit: 20, strategy: '', batch_id: 'x' })).toBe('/api/v1/recommend/history?limit=20&batch_id=x');
    expect(buildUrl('/api/v1/data/import', { overwrite: false })).toBe('/api/v1/data/import?overwrite=false');
  });

  test('섹션/검증 경로 조립', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    );
    await api.analysis.section('abc', 'pairs');
    await api.validation.result('v1', 'backtest');
    await api.tracking.outcomes({ strategy: 'hybrid', limit: 5 });
    expect(calls).toEqual(['/api/v1/analysis/runs/abc/pairs', '/api/v1/validation/runs/v1/backtest', '/api/v1/tracking/outcomes?strategy=hybrid&limit=5']);
    vi.unstubAllGlobals();
  });

  test('POST 는 JSON 본문을 보내고 detail 오류를 ApiError 로 변환한다', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ numbers: [1, 2, 3, 4, 5, 6], bonus: null });
      return new Response(JSON.stringify({ detail: 'run 없음' }), { status: 404, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.user.evaluate({ numbers: [1, 2, 3, 4, 5, 6], bonus: null })).rejects.toMatchObject({ status: 404, message: 'run 없음' });
    await expect(api.user.evaluate({ numbers: [1, 2, 3, 4, 5, 6], bonus: null })).rejects.toBeInstanceOf(ApiError);
    vi.unstubAllGlobals();
  });
});
