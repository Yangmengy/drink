import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { DiscoverPage } from './pages/DiscoverPage';
import { MyBarPage } from './pages/MyBarPage';
import { ProfilePage } from './pages/ProfilePage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { RecordPage } from './pages/RecordPage';
import { ListPage } from './pages/ListPage';

// 包装组件，控制 TabBar 显示
function AppContent() {
  const location = useLocation();
  const showTabBar = !location.pathname.startsWith('/recipe/');

  return (
    <>
      <Routes>
        <Route path="/" element={<DiscoverPage />} />
        <Route path="/bar" element={<MyBarPage />} />
        <Route path="/list" element={<ListPage />} />
        <Route path="/record" element={<RecordPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/recipe/:id" element={<RecipeDetailPage />} />
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
