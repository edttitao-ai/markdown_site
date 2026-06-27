import { useEffect, useMemo, useState } from 'react';
import { getCategories, getRaw, saveArticle } from '../lib/api';
import { renderMarkdown } from '../lib/markdown';
import './Editor.css';

interface Props {
  initialCategory?: string;
  initialId?: string;
  isMobile?: boolean;
  onSaved: (category: string, id: string) => void;
  onCancel: () => void;
}

export default function Editor({ initialCategory, initialId, isMobile, onSaved, onCancel }: Props) {
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState(initialCategory || '');
  const [newCategory, setNewCategory] = useState('');
  const [useNewCategory, setUseNewCategory] = useState(false);
  const [title, setTitle] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [body, setBody] = useState('');
  const [originalId, setOriginalId] = useState<string | undefined>(initialId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // 移动端 Tab 切换:'edit' | 'preview',默认 'edit'
  const [mobilePane, setMobilePane] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    (async () => {
      try {
        const cs = await getCategories();
        setCategories(cs.map((c) => c.name));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!initialCategory || !initialId) return;
    setCategory(initialCategory);
    setOriginalId(initialId);
    (async () => {
      try {
        const r = await getRaw(initialCategory, initialId);
        setTitle(r.meta.title || '');
        setTagsStr((r.meta.tags || []).join(', '));
        setBody(r.body || '');
      } catch (e: any) {
        setErr(e.message);
      }
    })();
  }, [initialCategory, initialId]);

  const html = useMemo(() => renderMarkdown(body || ''), [body]);
  const isEdit = Boolean(originalId);

  async function handleSave() {
    setErr(null);
    const finalCategory = useNewCategory ? newCategory.trim() : category.trim();
    if (!finalCategory) return setErr('请选择或新建一个分类');
    if (!title.trim()) return setErr('请填写标题');
    if (!body.trim()) return setErr('正文不能为空');
    setBusy(true);
    try {
      const tags = tagsStr
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const r = await saveArticle({
        category: finalCategory,
        title: title.trim(),
        tags,
        body,
        id: originalId,
      });
      onSaved(finalCategory, r.id);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKey as any);
    return () => window.removeEventListener('keydown', handleKey as any);
  });

  return (
    <div className="editor-wrap">
      <div className="editor-topbar">
        <button className="btn" onClick={onCancel}>
          ← 返回
        </button>
        <div className="editor-title">
          {isEdit ? `编辑 · ${title || '(未命名)'}` : '新建文章'}
        </div>
        <div className="editor-spacer" />
        <button className="btn" onClick={() => alert('快捷键：Ctrl/Cmd + S 保存，Esc 取消')}>
          快捷键
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
          {busy ? '发布中…' : isEdit ? '保存修改' : '发布'}
        </button>
      </div>

      <div className="editor-form">
        <label className="editor-field">
          <span className="editor-label">分类</span>
          {!useNewCategory ? (
            <div className="editor-cat-row">
              <select
                className="editor-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">— 选择分类 —</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-ghost editor-cat-new"
                onClick={() => setUseNewCategory(true)}
              >
                + 新分类
              </button>
            </div>
          ) : (
            <div className="editor-cat-row">
              <input
                className="editor-input"
                placeholder="新分类名（例：MySQL、消息队列）"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setUseNewCategory(false);
                  setNewCategory('');
                }}
              >
                取消
              </button>
            </div>
          )}
        </label>

        <label className="editor-field">
          <span className="editor-label">标题</span>
          <input
            className="editor-input editor-title-input"
            placeholder="给这篇文章起一个清晰的名字"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className="editor-field">
          <span className="editor-label">标签（逗号分隔）</span>
          <input
            className="editor-input"
            placeholder="例如：Redis, 缓存, 集群"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
          />
        </label>
      </div>

      {err && <div className="editor-error">⚠ {err}</div>}

      <div className="editor-split">
        <div
          className={
            'editor-pane editor-pane-input' +
            (isMobile ? (mobilePane === 'edit' ? ' mobile-active' : ' mobile-hidden') : '')
          }
        >
          <div className="editor-pane-head">
            <span className="editor-pane-label">MARKDOWN</span>
            <span className="editor-pane-stat">{body.length} 字</span>
          </div>
          <textarea
            className="editor-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={'# 一句话核心结论\n\n**关键概念**:...\n\n## 详细对比\n\n- 要点 1\n- 要点 2\n\n```js\n// 示例代码\n```\n'}
            spellCheck={false}
          />
        </div>

        <div
          className={
            'editor-pane editor-pane-preview-wrap' +
            (isMobile ? (mobilePane === 'preview' ? ' mobile-active' : ' mobile-hidden') : '')
          }
        >
          <div className="editor-pane editor-pane-preview">
            <div className="editor-pane-head">
              <span className="editor-pane-label">PREVIEW</span>
              <span className="editor-pane-stat">实时预览</span>
            </div>
            <div
              className="editor-preview art-body"
              dangerouslySetInnerHTML={{ __html: html || '<p class="editor-preview-empty">(左侧输入内容后会实时渲染)</p>' }}
            />
          </div>
        </div>
      </div>

      {/* 移动端底部 Tab 切换:编辑 / 预览 */}
      {isMobile && (
        <div className="editor-mobile-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === 'edit'}
            className={'editor-mobile-tab' + (mobilePane === 'edit' ? ' active' : '')}
            onClick={() => setMobilePane('edit')}
          >
            ✎ 编辑
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === 'preview'}
            className={'editor-mobile-tab' + (mobilePane === 'preview' ? ' active' : '')}
            onClick={() => setMobilePane('preview')}
          >
            👁 预览
          </button>
        </div>
      )}
    </div>
  );
}