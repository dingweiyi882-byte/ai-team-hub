import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LangProvider } from './i18n';
import Sidebar from './components/Sidebar/Sidebar';
import ChannelView from './components/Channel/ChannelView';
import WelcomeView from './components/Channel/WelcomeView';
import CreateChannelView from './components/Channel/CreateChannelView';
import SettingsPanel from './components/Settings/SettingsPanel';
import CreateTeammateView from './components/Teammate/CreateTeammateView';
import LandingPage from './components/Landing/LandingPage';
import './styles/landing.css';

export default function App() {
  // URL-based routing: #/landing or #/app
  const [route, setRoute] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return hash.startsWith('app') ? 'app' : 'landing';
  });

  const [activeChannelId, setActiveChannelId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateTeammate, setShowCreateTeammate] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lang, setLang] = useState(() => localStorage.getItem('aihub_lang') || 'en');

  // Listen for hash changes
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace('#', '');
      setRoute(h.startsWith('app') ? 'app' : 'landing');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const changeLang = useCallback((newLang) => {
    setLang(newLang);
    localStorage.setItem('aihub_lang', newLang);
  }, []);

  const handleEnterApp = useCallback(() => {
    // 先滚动到顶部，防止 GSAP pin 导致页面位置异常
    window.scrollTo({ top: 0, behavior: 'instant' });
    // 使用 replaceState 避免触发 hashchange 事件监听器的竞态条件
    window.location.replace('#/app');
    setRoute('app');
  }, []);

  const handleGoToLanding = useCallback(() => {
    window.location.hash = '#/landing';
    setRoute('landing');
    setActiveChannelId(null);
    setShowSettings(false);
    setShowCreateTeammate(false);
    setShowCreateChannel(false);
  }, []);

  const triggerRefresh = useCallback(() => setRefreshKey(k => k + 1), []);
  const clearViews = useCallback(() => {
    setShowSettings(false);
    setShowCreateTeammate(false);
    setShowCreateChannel(false);
  }, []);

  const goHome = useCallback(() => { clearViews(); setActiveChannelId(null); }, [clearViews]);

  const handleSelectChannel = useCallback((id) => {
    if (id === null) { goHome(); return; }
    clearViews();
    setActiveChannelId(id);
  }, [clearViews, goHome]);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(s => !s);
    setShowCreateTeammate(false);
    setShowCreateChannel(false);
    setActiveChannelId(null);
  }, []);

  const handleCreateTeammate = useCallback(() => { clearViews(); setShowCreateTeammate(true); }, [clearViews]);
  const handleTeammateDone = useCallback(() => { setShowCreateTeammate(false); triggerRefresh(); }, [triggerRefresh]);
  const handleCreateChannel = useCallback(() => { clearViews(); setShowCreateChannel(true); }, [clearViews]);
  const handleChannelDone = useCallback((channel) => {
    setShowCreateChannel(false);
    setActiveChannelId(channel.id);
    triggerRefresh();
  }, [triggerRefresh]);

  // ── Landing Page ──
  if (route === 'landing') {
    return (
      <LangProvider lang={lang}>
        <AnimatePresence mode="wait">
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{ background: '#000', minHeight: '100vh' }}
          >
            <LandingPage onEnterApp={handleEnterApp} />
          </motion.div>
        </AnimatePresence>
      </LangProvider>
    );
  }

  // ── Product App ──
  let viewKey, ViewComponent, viewProps;
  if (showCreateTeammate) {
    viewKey = 'create-teammate';
    ViewComponent = CreateTeammateView;
    viewProps = { onDone: handleTeammateDone, onCancel: goHome };
  } else if (showCreateChannel) {
    viewKey = 'create-channel';
    ViewComponent = CreateChannelView;
    viewProps = { onDone: handleChannelDone, onCancel: goHome };
  } else if (showSettings) {
    viewKey = 'settings';
    ViewComponent = SettingsPanel;
    viewProps = { onClose: goHome, triggerRefresh, lang, changeLang };
  } else if (activeChannelId) {
    viewKey = activeChannelId;
    ViewComponent = ChannelView;
    viewProps = { channelId: activeChannelId, triggerRefresh, refreshKey };
  } else {
    viewKey = 'welcome';
    ViewComponent = WelcomeView;
    viewProps = { onCreateChannel: handleCreateChannel };
  }

  return (
    <LangProvider lang={lang}>
      <div className="flex h-screen overflow-hidden product-body">
        <Sidebar
          activeChannelId={activeChannelId}
          onSelectChannel={handleSelectChannel}
          onOpenSettings={handleOpenSettings}
          onCreateTeammate={handleCreateTeammate}
          onCreateChannel={handleCreateChannel}
          showSettings={showSettings}
          refreshKey={refreshKey}
          triggerRefresh={triggerRefresh}
        />
        <div className="flex-1 flex flex-col min-w-0 relative">
          <AnimatePresence mode="sync">
            <ViewComponent key={viewKey} {...viewProps} />
          </AnimatePresence>
        </div>
      </div>
    </LangProvider>
  );
}
