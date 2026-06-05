import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { DiscoverPage } from './pages/DiscoverPage';
import { SearchPage } from './pages/SearchPage';
import { MyBarPage } from './pages/MyBarPage';
import { ProfilePage } from './pages/ProfilePage';

function App() {
  return (
    <BrowserRouter>
      <div style={{ paddingBottom: 'calc(50px + env(safe-area-inset-bottom))' }}>
        <Routes>
          <Route path="/" element={<DiscoverPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/bar" element={<MyBarPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </div>
      <TabBar />
    </BrowserRouter>
  );
}

export default App;
