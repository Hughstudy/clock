import type { ReactNode } from 'react'
import '../../styles/records-thoughts.css'

type PaperKind = 'book' | 'note' | 'marker'

/** Stationery identifies the notebook and its two types of entry. */
export function ThoughtPaper({ kind }: { kind: PaperKind }) {
  return <span className="memory-stamp thought-paper" data-stationery={kind} aria-hidden="true">
    <span className="memory-stamp-print">
      <svg viewBox="0 0 64 64" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        {kind === 'book' && <g transform="rotate(-9 32 32)">
          <path d="M10 11Q10 8 14 8H46V52H13Q10 52 10 49Z" fill="#839a8c" stroke="#687e72"/>
          <path d="M15 48H46V54H15Q11 54 11 51Q11 48 15 48Z" fill="#f6ebd0" stroke="#8e8065"/>
          <path d="M15 8H47V48H15Q12 48 11 50V13Q11 9 15 8Z" fill="#abc4ad" stroke="#6c8575"/>
          <path d="M17 10V45M15 52H43" stroke="#728a7d"/>
          <path d="M21 18H41V27H21Z" fill="#fff5d9" stroke="#95a48a"/><path d="M25 23H36" stroke="#ad9c82"/>
          <path d="M33 49H39V58L36 56L33 58Z" fill="#cc9079" stroke="#aa7968"/>
          <g transform="rotate(36 48 34)"><path d="M46 15H51V47L48.5 54L46 47Z" fill="#efc47d" stroke="#947758"/>
            <path d="M46 18H51M46 46H51M48 20V44" stroke="#ce9759"/><path d="m48 51 .5 3 1-3" fill="#766555" stroke="#766555"/></g>
        </g>}
        {kind === 'note' && <g transform="rotate(-7 32 32)">
          <path d="M14 11H41L51 21V53H14Z" fill="#fff6dc" stroke="#978568"/>
          <path d="M41 11V21H51" fill="#dacaa6" stroke="#978568"/>
          <path d="M21 27H41M21 34H43M21 41H35" stroke="#829a93" strokeWidth="2.4"/>
        </g>}
        {kind === 'marker' && <g transform="rotate(8 32 32)">
          <path d="M20 12Q19 9 23 9H42Q45 9 44 13L44 53L32 45L20 53Z" fill="#e9ba83" stroke="#96704b"/>
          <path d="M25 16H39M24 20V44" stroke="#f9ddaa"/><circle cx="32" cy="16" r="2" fill="#f9e8bf" stroke="#96704b"/>
        </g>}
      </svg>
    </span>
  </span>
}

export function ThoughtNotebook({ empty, showArt, children }: { empty: boolean; showArt: boolean; children: ReactNode }) {
  return <section className="album-paper thought-notebook" aria-labelledby="thought-notebook-title">
    <div className="album-paper-surface thought-notebook-cover">
      <div className="thought-notebook-heading">
        <h2 id="thought-notebook-title">随手便笺</h2>
        <p>{empty ? '在专注页记下的想法和标记，会收在这里。' : '用记得的几个字找一找。'}</p>
      </div>
      {showArt && <span className="postcard-art" aria-hidden="true"><ThoughtPaper kind="book"/><span className="postmark"/></span>}
    </div>
    {children}
  </section>
}
