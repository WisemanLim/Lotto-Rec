import { Route, Routes } from 'react-router-dom';
import AppShell from './layout/AppShell';
import { RunProvider } from './hooks/RunProvider';
import Overview from './pages/Overview';
import Frequency from './pages/Frequency';
import Pairs from './pages/Pairs';
import Groups from './pages/Groups';
import Temporal from './pages/Temporal';
import Validation from './pages/Validation';
import Recommend from './pages/Recommend';
import MyNumbers from './pages/MyNumbers';
import Tracking from './pages/Tracking';
import Settings from './pages/Settings';
import Glossary from './pages/Glossary';

// 화면 목록은 PRD §E6 (개요·빈도·조합·그룹·시간·검증·추천·내 번호·성과 추적·설정).
export default function App() {
  return (
    <RunProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/frequency" element={<Frequency />} />
          <Route path="/pairs" element={<Pairs />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/temporal" element={<Temporal />} />
          <Route path="/validation" element={<Validation />} />
          <Route path="/recommend" element={<Recommend />} />
          <Route path="/my-numbers" element={<MyNumbers />} />
          <Route path="/tracking" element={<Tracking />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/glossary" element={<Glossary />} />
          <Route path="*" element={<p className="text-sm text-neutral-500">페이지를 찾을 수 없습니다.</p>} />
        </Routes>
      </AppShell>
    </RunProvider>
  );
}
