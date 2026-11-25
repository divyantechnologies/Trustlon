import { Fragment } from 'react';

/**
 * A small, safe Markdown renderer for CMS pages (About, Terms, Privacy…). Supports headings
 * (## and ###), paragraphs, bullet and numbered lists, **bold**, *italic*, [links](url) and
 * horizontal rules (---). No HTML is ever injected, so page text can't run scripts.
 * The same file lives in the storefront; keep the two in step.
 */

const SAFE_LINK = /^(\/[^\s]*|https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d\s-]+)$/;

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${i++}`;
    if (match[2]) out.push(<strong key={key}>{match[2]}</strong>);
    else if (match[3]) out.push(<em key={key}>{match[3]}</em>);
    else if (match[4] && match[5]) {
      const href = match[5];
      out.push(
        SAFE_LINK.test(href) ? (
          <a
            key={key}
            href={href}
            {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {match[4]}
          </a>
        ) : (
          <Fragment key={key}>{match[4]}</Fragment>
        ),
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (paragraph.length) {
      const k = `p${blocks.length}`;
      blocks.push(<p key={k}>{inline(paragraph.join(' '), k)}</p>);
      paragraph = [];
    }
    if (list) {
      const k = `l${blocks.length}`;
      const items = list.items.map((item, i) => <li key={i}>{inline(item, `${k}-${i}`)}</li>);
      blocks.push(list.ordered ? <ol key={k}>{items}</ol> : <ul key={k}>{items}</ul>);
      list = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const k = `h${blocks.length}`;
      const level = heading[1].length;
      blocks.push(
        level === 2 ? (
          <h2 key={k}>{inline(heading[2], k)}</h2>
        ) : level === 3 ? (
          <h3 key={k}>{inline(heading[2], k)}</h3>
        ) : (
          <h4 key={k}>{inline(heading[2], k)}</h4>
        ),
      );
      continue;
    }
    if (/^-{3,}$/.test(line)) {
      flush();
      blocks.push(<hr key={`r${blocks.length}`} />);
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      if (paragraph.length) flush();
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    if (list) flush();
    paragraph.push(line);
  }
  flush();
  return <div className={className}>{blocks}</div>;
}

/** Tailwind classes that give rendered Markdown readable spacing without a typography plugin. */
export const markdownClass =
  'space-y-4 text-slate-700 [&_a]:text-teal-600 [&_a]:underline [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-navy [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-navy [&_h4]:font-semibold [&_h4]:text-navy [&_hr]:my-6 [&_hr]:border-slate-200 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:ps-6 [&_strong]:font-semibold [&_strong]:text-navy [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:ps-6';
