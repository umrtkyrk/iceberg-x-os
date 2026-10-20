import { lazy, Suspense } from 'react';
import { FORUM_PREVIEW_ENABLED } from './config/features';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { RouteGuard } from './components/RouteGuard';
import { Layout } from './components/Layout';

// Import Pages
import { Welcome } from './pages/Welcome';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Directory } from './pages/Directory';
import { Profile } from './pages/Profile';
import { Missions } from './pages/Missions';
import { MissionDetail } from './pages/MissionDetail';
import { MissionCreateEdit } from './pages/MissionCreateEdit';
import { Teams } from './pages/Teams';
import { DemoSubmission } from './pages/DemoSubmission';
import { Review } from './pages/Review';
import { Badges } from './pages/Badges';
import { CubeVault } from './pages/CubeVault';
import { DemoDays } from './pages/DemoDays';
import { AdminUsers } from './pages/AdminUsers';
import { AdminApplications } from './pages/AdminApplications';
import { ChangePassword } from './pages/ChangePassword';
import { Meetings } from './pages/Meetings';
import { Offboarding } from './pages/Offboarding';
import { Certificate } from './pages/Certificate';
import { VerifyCertificate } from './pages/VerifyCertificate';
import { Notifications } from './pages/Notifications';
import { NotificationHistory } from './pages/NotificationHistory';
import { AdminTestimonials } from './pages/AdminTestimonials';
import { AcceptInvite } from './pages/AcceptInvite';
import { Quests } from './pages/Quests';
import { AdminQuests } from './pages/AdminQuests';
import { AdminNda } from './pages/AdminNda';
import { Fundamentals } from './pages/Fundamentals';

import { PublicProfile } from './pages/PublicProfile';
import { Radar } from './pages/Radar';
import { MVCubes } from './pages/MVCubes';
import { HallOfFame } from './pages/HallOfFame';


const Forum = lazy(() => import('./pages/forum/Forum'));

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Welcome Landing Route */}
          <Route path="/" element={<Welcome />} />

          {/* Public Login Route */}
          <Route path="/login" element={<Login />} />

          {/* Public Certificate Verification Route */}
          <Route path="/verify/:certNo" element={<VerifyCertificate />} />

          {/* Public Shareable Cube / Alumni Profile Route */}
          <Route path="/x/:cubeNumber" element={<PublicProfile />} />

          {/* Standalone Certificate & PDF Print Routes (Zero Layout / Standalone Document) */}
          <Route path="/offboarding/certificate/:cubeId" element={<Certificate />} />
          <Route path="/certificate/:cubeId" element={<Certificate />} />

          {/* Public one-time invite acceptance */}
          <Route path="/invite/:token" element={<AcceptInvite />} />

          {/* Secure App Routes */}
          <Route
            element={
              <RouteGuard>
                <Layout />
              </RouteGuard>
            }
          >
            {/* Dashboard Router */}
            <Route path="dashboard" element={<Dashboard />} />
            {FORUM_PREVIEW_ENABLED && <Route path="forum" element={<Suspense fallback={<p role="status">Forum yükleniyor…</p>}><Forum /></Suspense>} />}
            <Route path="change-password" element={<ChangePassword />} />
            <Route path="notification-history" element={<NotificationHistory />} />

            {/* Cube Directory & Profile */}
            <Route path="directory" element={<Directory />} />
            <Route path="cubes/:id" element={<Profile />} />

            {/* Missions List & Details */}
            <Route path="missions" element={<Missions />} />
            <Route path="missions/:id" element={<MissionDetail />} />

            {/* Web Fundamentals Crash Course & Certification Quiz */}
            <Route path="mvcubes" element={<MVCubes />} />
            <Route path="hall-of-fame" element={<HallOfFame />} />
            <Route
              path="radar"
              element={
                <RouteGuard allowedRoles={['ADMIN', 'MENTOR']}>
                  <Radar />
                </RouteGuard>
              }
            />
            <Route path="fundamentals" element={<Fundamentals />} />
            <Route path="quiz" element={<Fundamentals />} />
            
            {/* Mission Create/Edit (Admins & Mentors) */}
            <Route
              path="missions/new"
              element={
                <RouteGuard allowedRoles={['ADMIN', 'MENTOR']}>
                  <MissionCreateEdit />
                </RouteGuard>
              }
            />
            <Route
              path="missions/:id/edit"
              element={
                <RouteGuard allowedRoles={['ADMIN', 'MENTOR']}>
                  <MissionCreateEdit />
                </RouteGuard>
              }
            />
            <Route
              path="missions/:id/review"
              element={
                <RouteGuard allowedRoles={['ADMIN', 'MENTOR']}>
                  <Review />
                </RouteGuard>
              }
            />
            <Route
              path="review"
              element={
                <RouteGuard allowedRoles={['ADMIN', 'MENTOR']}>
                  <Review />
                </RouteGuard>
              }
            />
            <Route
              path="admin/testimonials"
              element={
                <RouteGuard allowedRoles={['ADMIN', 'MENTOR']}>
                  <AdminTestimonials />
                </RouteGuard>
              }
            />
            {/* Teams Management (Admins & Mentors) */}
            <Route
              path="teams"
              element={
                <RouteGuard allowedRoles={['ADMIN', 'MENTOR']}>
                  <Teams />
                </RouteGuard>
              }
            />

            {/* Demo Submissions (Cubes only) */}
            <Route
              path="submit-demo"
              element={
                <RouteGuard allowedRoles={['CUBE']}>
                  <DemoSubmission />
                </RouteGuard>
              }
            />

            {/* Badges Overview & Allocation */}
            <Route path="badges" element={<Badges />} />

            {/* Cube Vault (Archive) */}
            <Route path="vault" element={<CubeVault />} />

            {/* Meetings Management */}
            <Route path="meetings" element={<Meetings />} />

            {/* Notifications Broadcast (Admins & Mentors) */}
            <Route
              path="notifications"
              element={
                <RouteGuard allowedRoles={['ADMIN', 'MENTOR']}>
                  <Notifications />
                </RouteGuard>
              }
            />

            {/* Offboarding & Certificate Management */}
            <Route
              path="offboarding"
              element={
                <RouteGuard allowedRoles={['ADMIN', 'MENTOR']}>
                  <Offboarding />
                </RouteGuard>
              }
            />

            {/* Demo Days Scheduling (Admins & Mentors) */}
            <Route
              path="demodays"
              element={
                <RouteGuard allowedRoles={['ADMIN', 'MENTOR']}>
                  <DemoDays />
                </RouteGuard>
              }
            />

            {/* Admin-only User Administration */}
            <Route
              path="admin/users"
              element={
                <RouteGuard allowedRoles={['ADMIN']}>
                  <AdminUsers />
                </RouteGuard>
              }
            />

            {/* Admin-only Recruitment Applications */}
            <Route
              path="admin/applications"
              element={
                <RouteGuard allowedRoles={['ADMIN']}>
                  <AdminApplications />
                </RouteGuard>
              }
            />

            {/* Quests gamification (Cubes, Mentors, Admins) */}
            <Route path="quests" element={<Quests />} />
            <Route
              path="admin/quests"
              element={
                <RouteGuard allowedRoles={['ADMIN']}>
                  <AdminQuests />
                </RouteGuard>
              }
            />

            {/* Documents & NDA Tracking (Admins & Mentors) */}
            <Route
              path="admin/documents"
              element={
                <RouteGuard allowedRoles={['ADMIN', 'MENTOR']}>
                  <AdminNda />
                </RouteGuard>
              }
            />
            <Route
              path="admin/nda"
              element={
                <RouteGuard allowedRoles={['ADMIN', 'MENTOR']}>
                  <AdminNda />
                </RouteGuard>
              }
            />
          </Route>

          {/* Fallback Catch-all redirecting to Dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
