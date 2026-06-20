import { Routes, Route } from 'react-router-dom';
import { AppShell } from './AppShell';
import { Generate } from '../pages/Generate';
import { Progress } from '../pages/Progress';
import { Output } from '../pages/Output';
import { History } from '../pages/History';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Generate />} />
        <Route path="/progress/:adId" element={<Progress />} />
        <Route path="/output/:adId" element={<Output />} />
        <Route path="/history" element={<History />} />
      </Route>
    </Routes>
  );
}
