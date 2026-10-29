import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Lexer, Token, Tokens, marked } from 'marked';
import { Observable, map, tap } from 'rxjs';

export interface Entry {
  title: string;
  slug: string;
  description: string;
  /** Zero-based table column the chapter link sits in, when the index is a multi-column table. */
  column?: number;
}

export interface Chip {
  title: string;
  /** App route of the sub-chapter, or null when the item has no link. */
  link: string | null;
}

export interface Chapter {
  /** Markdown to render, without the leading list that became chips. */
  markdown: string;
  /** Items of the list that directly follows the chapter heading (sub-chapters). */
  chips: Chip[];
}

const CONTENT_ROOT = 'content';

@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly http = inject(HttpClient);

  /** Entries are the list items of home.md: `- [Biology](biology) - description`. */
  home(): Observable<Entry[]> {
    return this.read('home.md').pipe(map((md) => this.entries(md, (href) => href)));
  }

  /** Chapters are the `.md` links found anywhere in <subject>/index.md (list or table). */
  chapters(subject: string): Observable<Entry[]> {
    return this.read(`${subject}/index.md`).pipe(map((md) => this.chapterLinks(md)));
  }

  /**
   * Raw markdown for a route path under <subject>:
   *  - `index`                          -> <subject>/index.md
   *  - `04-plant-physiology`            -> <subject>/04-plant-physiology/index.md (a chapter)
   *  - `04-plant-physiology/4-1-photo`  -> <subject>/04-plant-physiology/4-1-photo.md (a sub-chapter)
   * Relative images are made absolute and relative `.md` links become app routes.
   * Only a chapter's leading list becomes chips; index and sub-chapter pages render as written.
   */
  chapter(subject: string, path: string): Observable<Chapter> {
    const isChapter = path !== 'index' && !path.includes('/');
    const file = isChapter ? `${path}/index` : path;
    const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/') + 1) : '';
    const base = `${CONTENT_ROOT}/${subject}/${dir}`;
    return this.read(`${subject}/${file}.md`).pipe(
      map((md) =>
        md
          .replace(/(!\[[^\]]*\]\()(?!https?:|\/|data:)([^)\s]+)/g, (_, open, src) => open + base + src)
          .replace(/(<img\b[^>]*?\bsrc=")(?!https?:|\/|data:)([^"]+)/g, (_, open, src) => open + base + src)
          .replace(
            /(?<!!)(\[[^\]]*\]\()(?!https?:|\/|#|mailto:)([^)\s#]+?)\.md(#[^)\s]*)?\)/g,
            (_, open, target, hash = '') => `${open}${this.route(subject, dir + target)}${hash})`,
          ),
      ),
      map((md) => (isChapter ? this.splitChips(md) : { markdown: md, chips: [] })),
    );
  }

  /**
   * Titles of every page whose parent list was loaded, keyed `<subject>/<route path>`. The
   * breadcrumb reads it for sub-chapters that are not chips of their chapter.
   */
  readonly titles = signal<Record<string, string>>({});

  /**
   * The pages directly below a route path, from the `.md` links in its markdown. A chapter's
   * children sit beside its index.md; a sub-chapter `x` keeps its children in the folder `x/`, so
   * only links into that folder count and cross-references to other pages are ignored.
   */
  children(subject: string, path: string): Observable<Entry[]> {
    const isChapter = !path.includes('/');
    const file = isChapter ? `${path}/index` : path;
    const name = path.slice(path.lastIndexOf('/') + 1);
    const parentDir = isChapter ? `${path}/` : path.slice(0, path.length - name.length);
    const prefix = isChapter ? '' : `${name}/`;
    return this.read(`${subject}/${file}.md`).pipe(
      map((md) => {
        const seen = new Set<string>();
        const entries: Entry[] = [];
        marked.walkTokens(Lexer.lex(md), (token) => {
          if (token.type !== 'link') return;
          const href = (token as Tokens.Link).href;
          if (!/^[^:/#][^:#]*\.md(#.*)?$/.test(href)) return;
          const target = href.replace(/\.md.*$/, '');
          if (target === 'index' || !target.startsWith(prefix) || (isChapter && target.includes('/'))) return;
          const slug = parentDir + target;
          if (seen.has(slug)) return;
          seen.add(slug);
          entries.push({ title: (token as Tokens.Link).text, slug, description: '' });
        });
        return entries;
      }),
      tap((entries) =>
        this.titles.update((all) => ({
          ...all,
          ...Object.fromEntries(entries.map((e) => [`${subject}/${e.slug}`, e.title])),
        })),
      ),
    );
  }

  /** App route for a content path:`04-x/index` -> `/biology/04-x`, `04-x/4-1-y` -> `/biology/04-x/4-1-y`. */
  private route(subject: string, path: string): string {
    return `/${subject}/${path}`.replace(/\/index$/, '');
  }

  /** A list right after the heading is shown as chips instead of as page content. */
  private splitChips(md: string): Chapter {
    const tokens = Lexer.lex(md);
    const meaningful = tokens.filter((t) => t.type !== 'space');
    const candidate = meaningful[0]?.type === 'heading' ? meaningful[1] : undefined;
    if (!candidate || candidate.type !== 'list') return { markdown: md, chips: [] };
    const list = candidate as Tokens.List;
    return {
      markdown: tokens
        .filter((t) => t !== list)
        .map((t) => t.raw)
        .join(''),
      chips: list.items.map((item) => this.chip(item)),
    };
  }

  private chip(item: Tokens.ListItem): Chip {
    let link: Tokens.Link | undefined;
    marked.walkTokens(item.tokens, (token) => {
      if (!link && token.type === 'link') link = token as Tokens.Link;
    });
    return link ? { title: link.text, link: link.href } : { title: item.text.trim(), link: null };
  }

  private read(path: string): Observable<string> {
    return this.http.get(`${CONTENT_ROOT}/${path}`, { responseType: 'text' });
  }

  private chapterLinks(md: string): Entry[] {
    const seen = new Set<string>();
    const entries: Entry[] = [];
    const collect = (tokens: Token[], column?: number) =>
      marked.walkTokens(tokens, (token) => {
        if (token.type !== 'link' || !/^[^:/#][^:#]*\.md(#.*)?$/.test(token.href)) return;
        const slug = token.href.replace(/\.md.*$/, '').replace(/\/index$/, '');
        if (slug === 'index' || seen.has(slug)) return;
        seen.add(slug);
        entries.push({ title: token.text, slug, description: '', column });
      });
    for (const block of Lexer.lex(md)) {
      if (block.type === 'table' && (block as Tokens.Table).header.length > 1) {
        // Remember the column, so the panel can colour a link like its table column.
        (block as Tokens.Table).rows.forEach((row) => row.forEach((cell, i) => collect(cell.tokens, i)));
      } else {
        collect([block]);
      }
    }
    // Folder numbers (01-, 02-, ...) set the order, so a table laid out in columns still lists 1, 2, 3.
    return entries.sort((a, b) => a.slug.localeCompare(b.slug, undefined, { numeric: true }));
  }

  private entries(md: string, slug: (href: string) => string): Entry[] {
    const items = Lexer.lex(md).filter((t): t is Tokens.List => t.type === 'list');
    return items
      .flatMap((list) => list.items)
      .flatMap((item) => {
        const link = item.tokens
          .flatMap((t) => ('tokens' in t && t.tokens ? t.tokens : [t]))
          .find((t): t is Tokens.Link => t.type === 'link');
        if (!link) return [];
        const description = item.text.replace(/\[[^\]]*\]\([^)]*\)/, '').replace(/^[\s\-–—:]+/, '');
        return [{ title: link.text, slug: slug(link.href), description: description.trim() }];
      });
  }
}
