import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles/index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PageLoader } from './components/ui';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';

const Latest = lazy(() => import('./pages/Latest'));
const Weeks = lazy(() => import('./pages/Weeks'));
const History = lazy(() => import('./pages/History'));
const Roadmap = lazy(() => import('./pages/Roadmap'));
const Highlights = lazy(() => import('./pages/Highlights'));
const Categories = lazy(() => import('./pages/Categories'));
const CategoryDetail = lazy(() => import('./pages/CategoryDetail'));
const UpdateDetail = lazy(() => import('./pages/UpdateDetail'));
const Status = lazy(() => import('./pages/Status'));
const PowerTable = lazy(() => import('./pages/PowerTable'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, refetchOnWindowFocus: false, retryDelay: (n) => Math.min(1000 * 2 ** n, 8000) },
  },
});

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter basename={basename}>
          <Layout>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/novedades" element={<Latest />} />
                <Route path="/semanas" element={<Weeks />} />
                <Route path="/historico" element={<History />} />
                <Route path="/roadmap" element={<Roadmap />} />
                <Route path="/destacadas" element={<Highlights />} />
                <Route path="/categorias" element={<Categories />} />
                <Route path="/categorias/:id" element={<CategoryDetail />} />
                <Route path="/novedad/:id" element={<UpdateDetail />} />
                <Route path="/estado" element={<Status />} />
                <Route path="/powertable" element={<PowerTable />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Layout>
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  </StrictMode>,
);
