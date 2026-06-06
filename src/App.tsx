import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { DiscoverPage } from './pages/DiscoverPage';
import { MyBarPage } from './pages/MyBarPage';
import { ProfilePage } from './pages/ProfilePage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { RecordPage } from './pages/RecordPage';
import { ListPage } from './pages/ListPage';
import { BackgroundSettingsPage } from './pages/BackgroundSettingsPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { HistoryPage } from './pages/HistoryPage';
import { RatingsPage } from './pages/RatingsPage';
import AIBartenderPage from './pages/AIBartenderPage';
import { useBackground } from './hooks/useBackground';

// 包装组件，控制 TabBar 显示
function AppContent() {
  const location = useLocation();
  const showTabBar = !location.pathname.startsWith('/recipe/') && 
                     !location.pathname.startsWith('/background-settings') &&
                     !location.pathname.startsWith('/ai-bartender') &&
                     !location.pathname.startsWith('/favorites') &&
                     !location.pathname.startsWith('/history') &&
                     !location.pathname.startsWith('/ratings');
  
  // 应用背景设置
  useBackground();

  return (
    <>
      <Routes>
        <Route path="/" element={<DiscoverPage />} />
        <Route path="/bar" element={<MyBarPage />} />
        <Route path="/list" element={<ListPage />} />
        <Route path="/record" element={<RecordPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/recipe/:id" element={<RecipeDetailPage />} />
        <Route path="/background-settings" element={<BackgroundSettingsPage />} />
        <Route path="/ai-bartender" element={<AIBartenderPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/ratings" element={<RatingsPage />} />
      </Routes>
      {showTabBar && <TabBar />}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
