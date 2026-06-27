import { useEffect, useState } from 'react';
import { getArticle, ArticleFull } from '../lib/api';
import { extractOutline } from '../lib/markdown';
import Outline from './Outline';
import './ArticleView.css';

interface Props {
  category: string;
  id: string;
  isMobile: boolean;
  outlineVisible: boolean;
  onEdit: () => void;
  onDeleted: () => void;
}

export default function ArticleView({
  category,
  id,
  isMobile,
  outlineVisible,
  onEdit,
  onDeleted,
}: Props) {
  const [data, setData] = useState<ArticleFull | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [outline, setOutline] = useState<ReturnType<typeof extractOutline>>([]);

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr(null);
    setOutline([]);
    (async () => {
      try {
        const r = await getArticle(category, id);
        if (!alive) return;
        setData(r);
        const raw = await fetch(
          `/api/raw?category=${encodeURIComponent(category)}&id=${encodeURIComponent(id)}`,
        ).then((x) => (x.ok ? x.json() : null));
        if (raw && alive) setOutline(extractOutline(raw.body || ''));
      } catch (e: any) {
        if (alive) setErr(e.message);
      }
    })();
    return () => { alive = false; };
  }, [category, id]);

  if (err) return <div className="art-error">⚠ {err}</div>;
  if (!data) return <div className="art-loading">读取中…</div>;

  const m = data.meta;

  return (
    <div className="art-wrap">
      <main className="article">
        <header className="art-head">
          <div className="art-eyebrow">
            <span className="art-eyebrow-cat">{category}</span>
            {m.file && <span className="art-eyebrow-file">· {m.file}</span>}
          </div>
          <h1 className="art-title">{m.title}</h1>
          <div className="art-meta">
            {m.tags?.map((t) => (
              <span className="tag" key={t}>{t}</span>
            ))}
            <span className="art-meta-date">
              {m.updatedAt && <>更新于 {new Date(m.updatedAt).toLocaleDateString('zh-CN')}</>}
            </span>
          </div>
          <div className="art-actions">
            <button className="btn" onClick={onEdit}>✎ 编辑</button>
          </div>
        </header>
        <article className="art-body" dangerouslySetInnerHTML={{ __html: data.html }} />
        <footer className="art-foot">
          <div className="art-foot-line">END OF ARTICLE</div>
          <div className="art-foot-sub">created {m.createdAt?.slice(0, 10) || '—'}</div>
        </footer>
      </main>
      <Outline items={outline} isMobile={isMobile} collapsed={!outlineVisible} />
    </div>
  );
}
