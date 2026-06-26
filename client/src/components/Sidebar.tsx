import { useEffect, useState } from 'react';
import { getCategories, getArticles, ArticleMeta, Category } from '../lib/api';
import './Sidebar.css';

interface Props {
  selectedCategory: string | null;
  selectedId: string | null;
  onSelect: (category: string, id: string) => void;
  onNew: () => void;
  refreshKey: number;
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({
  selectedCategory,
  selectedId,
  onSelect,
  onNew,
  refreshKey,
  collapsed,
  onToggle,
}: Props) {
  const [cats, setCats] = useState<Category[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [articlesByCat, setArticlesByCat] = useState<Map<string, ArticleMeta[]>>(new Map());
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await getCategories();
        if (!alive) return;
        setCats(list);
        // 默认展开所有
        setExpanded(new Set(list.map((c) => c.name)));
      } catch (e: any) {
        setErr(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    let alive = true;
    (async () => {
      // 只加载展开中的分类
      for (const cat of cats) {
        if (!expanded.has(cat.name)) continue;
        try {
          const arts = await getArticles(cat.name);
          if (!alive) return;
          setArticlesByCat((prev) => new Map(prev).set(cat.name, arts));
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [cats, expanded, refreshKey]);

  function toggle(cat: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  return (
    <aside className={'sidebar' + (collapsed ? ' collapsed' : '')}>
      {/* 收起来时：朱砂指示线 + 浮动展开按钮 */}
      <div className="sidebar-rail" aria-hidden />
      <button
        type="button"
        className="sidebar-expand-btn"
        onClick={onToggle}
        aria-label="展开侧边栏"
        title="展开侧边栏 (Ctrl+B)"
      >
        ›
      </button>

      <div className="sidebar-inner">
        <div className="side-head">
          <div className="side-eyebrow">FILE TREE</div>
          <h3 className="side-title">个人 Markdown 仓库</h3>
          <p className="side-desc">
            {cats.reduce((s, c) => s + c.count, 0)} 篇 · {cats.length} 个分类
          </p>
          <button className="btn btn-primary side-new" onClick={onNew}>
            + 新建文档
          </button>
        </div>

        {err && <div className="side-error">⚠ {err}</div>}

        <div className="side-tree">
          {cats.length === 0 && !err && (
            <div className="side-empty">暂无分类，去创建第一篇吧</div>
          )}
          {cats.map((cat) => {
            const isOpen = expanded.has(cat.name);
            return (
              <div key={cat.name} className="tree-cat">
                <button className="tree-cat-head" onClick={() => toggle(cat.name)}>
                  <span
                    className="tree-caret"
                    style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                  >
                    ▾
                  </span>
                  <span className="tree-folder">📁</span>
                  <span className="tree-cat-name">{cat.name}</span>
                  <span className="tree-cat-count">{cat.count}</span>
                </button>
                <ul className={'tree-list' + (isOpen ? '' : ' collapsed')}>
                  {(articlesByCat.get(cat.name) || []).map((a) => (
                    <li
                      key={a.file}
                      className={
                        'tree-item ' +
                        (selectedCategory === cat.name && selectedId === a.id ? 'active' : '')
                      }
                      onClick={() => onSelect(cat.name, a.id)}
                    >
                      <span className="tree-file-icon">📄</span>
                      <span className="tree-item-title" title={a.title}>
                        {a.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="side-foot">
          <div className="side-foot-line">ENGINEER'S DESK</div>
          <div className="side-foot-sub">STUDY · 2026</div>
        </div>
      </div>
    </aside>
  );
}
