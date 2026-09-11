import { Navigate, Route, Routes } from 'react-router';
import { LoginScreen } from '../screens/LoginScreen.js';
import { PwaUpdater } from './PwaUpdater.js';
import { RequireAuth, RootLayout } from './RootLayout.js';

export function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/" element={<Navigate to="/library" replace />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <RootLayout />
            </RequireAuth>
          }
        />
      </Routes>
      <PwaUpdater />
    </>
  );
}
