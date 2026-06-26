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

export default function App() {
  const [mode, setMode] = useState<Mode>({ kind: 'welcome' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  // 侧边栏折叠状态：默认展开，记忆到 localStorage
  const [sideCollapsed, setSideCollapsed] = useState<boolean>(() => readSidebarCollapsed());

  const toggleSide = useCallback(() => {
    setSideCollapsed((prev) => {
      const next = !prev;
      writeSidebarCollapsed(next);
      return next;
    });
  }, []);

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

  // Ctrl/Cmd + B 切换侧边栏
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleSide();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSide]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const selectedCategory = mode.kind === 'view' || mode.kind === 'edit' ? mode.category : null;
  const selectedId = mode.kind === 'view' || mode.kind === 'edit' ? mode.id : null;

  return (
    <div className="app">
      <header className="app-top">
        <div className="app-top-left">
          <button
            type="button"
            className={'app-sidebar-toggle' + (sideCollapsed ? ' collapsed' : '')}
            onClick={toggleSide}
            aria-label={sideCollapsed ? '展开侧边栏' : '收起侧边栏'}
            title={sideCollapsed ? '展开侧边栏 (Ctrl+B)' : '收起侧边栏 (Ctrl+B)'}
          >
            ‹
          </button>
          <div className="app-logo" aria-hidden>
            <svg viewBox="0 0 32 32" width="22" height="22">
              <rect width="32" height="32" rx="5" fill="#a8321e" />
              <text x="16" y="22" textAnchor="middle" fontFamily="serif" fontSize="18" fill="#fff" fontWeight="700">面</text>
            </svg>
          </div>
          <div>
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
        <Sidebar
          selectedCategory={selectedCategory}
          selectedId={selectedId}
          onSelect={(category, id) => setMode({ kind: 'view', category, id })}
          onNew={() => setMode({ kind: 'new' })}
          refreshKey={refreshKey}
          collapsed={sideCollapsed}
          onToggle={toggleSide}
        />

        {mode.kind === 'welcome' && (
          <div className="welcome">
            <div className="welcome-eyebrow">ENGINEER'S DESK</div>
            <h1 className="welcome-title">个人 Markdown 仓库</h1>
            <p className="welcome-desc">
              从左侧选一篇文档开始阅读，或点击「新建文档」开始记录。
            </p>
            <div className="welcome-grid">
              <div className="welcome-card">
                <div className="welcome-card-eyebrow">01</div>
                <h3>阅读</h3>
                <p>三栏布局：左文件树 / 中正文 / 右大纲，与 IDE 阅读体验一致。</p>
              </div>
              <div className="welcome-card">
                <div className="welcome-card-eyebrow">02</div>
                <h3>编写</h3>
                <p>分屏 Markdown 编辑器，左输入右实时预览，Ctrl/Cmd + S 发布。</p>
              </div>
              <div className="welcome-card">
                <div className="welcome-card-eyebrow">03</div>
                <h3>归档</h3>
                <p>每个分类一个文件夹，每篇文章一个 <code>.md</code> 文件。纯文本，可 git。</p>
              </div>
            </div>
          </div>
        )}

        {mode.kind === 'view' && (
          <ArticleView
            category={mode.category}
            id={mode.id}
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
