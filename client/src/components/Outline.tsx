import { useEffect, useMemo, useRef, useState } from 'react';
import { OutlineItem } from '../lib/markdown';
import './Outline.css';

interface Props {
  items: OutlineItem[];
}

export default function Outline({ items }: Props) {
  const [activeId, setActiveId] = useState<string>('');
  const tickingRef = useRef(false);

  // 只保留 h1;空 markdown 或没有 h1 时不显示
  const h1Items = useMemo(() => items.filter((it) => it.level === 1), [items]);

  useEffect(() => {
    if (h1Items.length === 0) return;
    const headings = h1Items
      .map((it) => document.getElementById(it.id))
      .filter(Boolean) as HTMLElement[];
    if (headings.length === 0) return;

    function findScroller(): HTMLElement | null {
      for (const el of headings) {
        const a = el.closest('.article') as HTMLElement | null;
        if (a) return a;
      }
      for (const el of headings) {
        const w = el.closest('.art-wrap') as HTMLElement | null;
        if (w && getComputedStyle(w).overflowY !== 'visible') return w;
      }
      return null;
    }
    const scroller = findScroller();

    function scrollActiveIntoView(id: string) {
      const a = document.querySelector(
        '.outline-item a[href="#' + id + '"]',
      )?.parentElement as HTMLElement | null;
      const aside = document.querySelector('.outline') as HTMLElement | null;
      if (!a || !aside) return;
      const aRect = a.getBoundingClientRect();
      const sRect = aside.getBoundingClientRect();
      if (aRect.top < sRect.top || aRect.bottom > sRect.bottom) {
        a.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    function onScroll() {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(() => {
        tickingRef.current = false;
        let best: { id: string; top: number } | null = null;
        for (const el of headings) {
          const top = el.getBoundingClientRect().top;
          if (top <= 130) {
            if (!best || top > best.top) best = { id: el.id, top };
          }
        }
        if (best) {
          setActiveId((prev) => {
            if (prev !== best!.id) {
              scrollActiveIntoView(best!.id);
            }
            return best!.id;
          });
        }
      });
    }
    onScroll();

    if (scroller) {
      scroller.addEventListener('scroll', onScroll, { passive: true });
      return () => scroller.removeEventListener('scroll', onScroll);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [h1Items]);

  function findScrollerFor(el: HTMLElement): HTMLElement {
    const a = el.closest('.article') as HTMLElement | null;
    if (a) return a;
    const w = el.closest('.art-wrap') as HTMLElement | null;
    if (w && getComputedStyle(w).overflowY !== 'visible') return w;
    let cur: HTMLElement | null = el.parentElement;
    while (cur && cur !== document.body) {
      const s = getComputedStyle(cur).overflowY;
      if (s === 'auto' || s === 'scroll') return cur;
      cur = cur.parentElement;
    }
    return document.scrollingElement as HTMLElement || document.documentElement;
  }

  function handleJump(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    const target = document.getElementById(id);
    if (!target) {
      console.warn('[outline] target not found:', id);
      return;
    }
    const scroller = findScrollerFor(target);
    const containerRect = scroller.getBoundingClientRect();
    const elRect = target.getBoundingClientRect();
    const useRelative = scroller !== document.documentElement && scroller !== document.body;
    const offset = useRelative
      ? elRect.top - containerRect.top + scroller.scrollTop - 24
      : elRect.top + window.scrollY - 24;
    try {
      scroller.scrollTo({ top: offset, behavior: 'smooth' });
    } catch {
      (scroller as any).scrollTop = offset;
    }
    history.replaceState(null, '', '#' + id);
    setActiveId(id);
  }

  if (h1Items.length === 0) {
    return (
      <aside className="outline empty">
        <div className="outline-eyebrow">OUTLINE</div>
        <div className="outline-empty-hint">正文无标题</div>
      </aside>
    );
  }

  return (
    <aside className="outline">
      <div className="outline-eyebrow">ON THIS PAGE</div>
      <h4 className="outline-title">大纲</h4>
      <ul className="outline-list">
        {h1Items.map((it) => (
          <li
            key={it.id}
            className={'outline-item level-1' + (activeId === it.id ? ' active' : '')}
          >
            <a
              href={'#' + it.id}
              className="outline-link"
              onClick={(e) => handleJump(e, it.id)}
            >
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
