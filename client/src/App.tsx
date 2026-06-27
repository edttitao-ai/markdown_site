import { useCallback, useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import ArticleView from './components/ArticleView';
import Editor from './components/Editor';
import ThemeToggle from './components/ThemeToggle';
import { getCategories } from './lib/api';
import './App.css';

type Mode =
  | { kind: 'view'; category: string; id: string }
  | { kind: 'new' }
  | { kind: 'edit'; category: string; id: string }
  | { kind: 'welcome' };

const SIDEBAR_COLLAPSED_KEY = 'side.collapsed';
const MOBILE_BREAKPOINT = 768;

function readSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSidebarCollapsed(v: boolean) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function useIsMobile(): boolean {
  const get = () => (typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false);
  const [isMobile, setIsMobile] = useState<boolean>(get);
  useEffect(() => {
    const onResize = () => setIsMobile(get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

export default function App() {
  const [mode, setMode] = useState<Mode>({ kind: 'welcome' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const isMobile = useIsMobile();
  const [sideCollapsed, setSideCollapsed] = useState<boolean>(() => readSidebarCollapsed());
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [outlineDrawerOpen, setOutlineDrawerOpen] = useState<boolean>(false);

  const toggleSide = useCallback(() => {
    if (isMobile) {
      setDrawerOpen((v) => !v);
      setOutlineDrawerOpen(false);
    } else {
      setSideCollapsed((prev) => {
        const next = !prev;
        writeSidebarCollapsed(next);
        return next;
      });
    }
  }, [isMobile]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const toggleOutlineDrawer = useCallback(() => {
    setOutlineDrawerOpen((v) => !v);
    setDrawerOpen(false);
  }, []);
  const closeOutlineDrawer = useCallback(() => setOutlineDrawerOpen(false), []);

  useEffect(() => {
    (async () => {
      try {
        await getCategories();
        setServerOk(true);
      } catch {
        setServerOk(false);
      }
    })();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        if (!isMobile) toggleSide();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSide, isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        setOutlineDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    const open = drawerOpen || outlineDrawerOpen;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobile, drawerOpen, outlineDrawerOpen]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const selectedCategory = mode.kind === 'view' || mode.kind === 'edit' ? mode.category : null;
  const selectedId = mode.kind === 'view' || mode.kind === 'edit' ? mode.id : null;

  return (
    <div className={'app' + (isMobile ? ' mobile' : '')}>
      <header className="app-top">
        <div className="app-top-left">
          <button
            type="button"
            className={
              'app-sidebar-toggle' +
              (isMobile ? (drawerOpen ? ' open' : '') : sideCollapsed ? ' collapsed' : '')
            }
            onClick={toggleSide}
            aria-label={
              isMobile
                ? drawerOpen
                  ? '关闭文件树'
                  : '打开文件树'
                : sideCollapsed
                ? '展开侧边栏'
                : '收起侧边栏'
            }
            title={
              isMobile
                ? drawerOpen
                  ? '关闭'
                  : '文件树'
                : sideCollapsed
                ? '展开侧边栏 (Ctrl+B)'
                : '收起侧边栏 (Ctrl+B)'
            }
            aria-expanded={isMobile ? drawerOpen : !sideCollapsed}
          >
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 5h14M3 10h14M3 15h14" />
            </svg>
          </button>
          <div className="app-logo" aria-hidden>
            <svg viewBox="0 0 32 32" width="22" height="22">
              <rect width="32" height="32" rx="5" fill="#a8321e" />
              <text x="16" y="22" textAnchor="middle" fontFamily="serif" fontSize="18" fill="#fff" fontWeight="700">面</text>
            </svg>
          </div>
          <div className="app-title-block">
            <div className="app-title">个人 Markdown 仓库 · Engineer's Desk</div>
            <div className="app-subtitle">本地 Markdown 文档管理 · 按文件夹归档</div>
          </div>
        </div>
        <div className="app-top-right">
          {serverOk === false && (
            <span className="app-status err">⚠ 后端 :3001 未连接</span>
          )}
          {serverOk === true && (
            <span className="app-status ok">● 后端已连接</span>
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="app-body">
        {isMobile && drawerOpen && (
          <div className="app-drawer-mask" onClick={closeDrawer} aria-hidden />
        )}
        {isMobile && outlineDrawerOpen && (
          <div className="app-drawer-mask" onClick={closeOutlineDrawer} aria-hidden />
        )}

        <Sidebar
          selectedCategory={selectedCategory}
          selectedId={selectedId}
          onSelect={(category, id) => {
            setMode({ kind: 'view', category, id });
            if (isMobile) setDrawerOpen(false);
          }}
          onNew={() => {
            setMode({ kind: 'new' });
            if (isMobile) setDrawerOpen(false);
          }}
          refreshKey={refreshKey}
          collapsed={isMobile ? !drawerOpen : sideCollapsed}
          onToggle={toggleSide}
        />

        {mode.kind === 'welcome' && (
          <div className="welcome">
            <div className="welcome-eyebrow">ENGINEER'S DESK</div>
            <h1 className="welcome-title">个人 Markdown 仓库</h1>
            <p className="welcome-desc">
              从左侧选一篇文档开始阅读,或点击「新建文档」开始记录。
            </p>
            <div className="welcome-grid">
              <div className="welcome-card">
                <div className="welcome-card-eyebrow">01</div>
                <h3>阅读</h3>
                <p>三栏布局:左文件树 / 中正文 / 右大纲,与 IDE 阅读体验一致。</p>
              </div>
              <div className="welcome-card">
                <div className="welcome-card-eyebrow">02</div>
                <h3>编写</h3>
                <p>分屏 Markdown 编辑器,左输入右实时预览,Ctrl/Cmd + S 发布。</p>
              </div>
              <div className="welcome-card">
                <div className="welcome-card-eyebrow">03</div>
                <h3>归档</h3>
                <p>每个分类一个文件夹,每篇文章一个 <code>.md</code> 文件。纯文本,可 git。</p>
              </div>
            </div>
          </div>
        )}

        {mode.kind === 'view' && (
          <ArticleView
            category={mode.category}
            id={mode.id}
            isMobile={isMobile}
            outlineOpen={outlineDrawerOpen}
            onToggleOutline={toggleOutlineDrawer}
            onCloseOutline={closeOutlineDrawer}
            onEdit={() => setMode({ kind: 'edit', category: mode.category, id: mode.id })}
            onDeleted={() => {
              setMode({ kind: 'welcome' });
              refresh();
            }}
          />
        )}

        {(mode.kind === 'new' || mode.kind === 'edit') && (
          <Editor
            initialCategory={mode.kind === 'edit' ? mode.category : undefined}
            initialId={mode.kind === 'edit' ? mode.id : undefined}
            isMobile={isMobile}
            onCancel={() => {
              if (mode.kind === 'edit') {
                setMode({ kind: 'view', category: mode.category, id: mode.id });
              } else {
                setMode({ kind: 'welcome' });
              }
            }}
            onSaved={(category, id) => {
              refresh();
              setMode({ kind: 'view', category, id });
            }}
          />
        )}
      </div>
    </div>
  );
}
