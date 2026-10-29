import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BreadcrumbComponent, Crumb } from '../../core/components/breadcrumb/breadcrumb.component';
import { DocViewerComponent } from '../../core/components/doc-viewer/doc-viewer.component';
import { NavNodeComponent } from '../../core/components/nav-node/nav-node.component';
import { Chapter, ContentService } from '../../core/services/content.service';

const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 700;
const DEFAULT_PANEL_WIDTH = 300;
const STORAGE_KEY = 'subject-panel-width';

@Component({
  selector: 'app-subject-page',
  imports: [RouterLink, RouterLinkActive, BreadcrumbComponent, DocViewerComponent, NavNodeComponent],
  templateUrl: './subject-page.component.html',
  styleUrl: './subject-page.component.css',
})
export class SubjectPageComponent {
  private readonly content = inject(ContentService);

  // Bound from the route params (withComponentInputBinding).
  readonly subject = input.required<string>();
  readonly chapter = input<string>();
  readonly subchapter = input<string>();

  protected readonly chapters = rxResource({
    params: () => this.subject(),
    stream: ({ params }) => this.content.chapters(params),
  });

  // No chapter in the URL: show the subject's index.md. The chapter is kept loaded while one of
  // its sub-chapters is open, because its chips are the way to switch between them.
  protected readonly body = rxResource({
    params: () => ({ subject: this.subject(), chapter: this.chapter() ?? 'index' }),
    stream: ({ params }) => this.content.chapter(params.subject, params.chapter),
  });

  protected readonly sub = rxResource({
    params: () =>
      this.chapter() && this.subchapter()
        ? { subject: this.subject(), path: `${this.chapter()}/${this.subchapter()}` }
        : undefined,
    stream: ({ params }) => this.content.chapter(params.subject, params.path),
  });

  // A resource's value is empty while the next file loads. Keep showing the previous page until
  // then so the panel does not blink: any chapter for the chapter page, but only a sub-chapter
  // of the same chapter, so another chapter's text is never shown under the wrong chips.
  protected readonly chapterPage = linkedSignal<Chapter | undefined, Chapter | undefined>({
    source: () => this.body.value(),
    computation: (value, previous) => value ?? previous?.value,
  });

  protected readonly subPage = linkedSignal<
    { chapter: string | undefined; value: Chapter | undefined },
    Chapter | undefined
  >({
    source: () => ({ chapter: this.chapter(), value: this.sub.value() }),
    computation: (source, previous) =>
      source.value ?? (previous && previous.source.chapter === source.chapter ? previous.value : undefined),
  });

  protected readonly markdown = computed(() =>
    this.subchapter() ? this.subPage()?.markdown : this.chapterPage()?.markdown,
  );

  protected readonly panelWidth = signal(this.savedPanelWidth());

  /** Route path of the open page below the subject, which the panel tree opens its rows along. */
  protected readonly currentPath = computed(() =>
    [this.chapter(), this.subchapter()].filter(Boolean).join('/'),
  );

  protected readonly title = computed(() => this.subject().replace(/-/g, ' '));

  /** Subject / chapter / sub-chapter; every crumb but the last links back to its page. */
  protected readonly crumbs = computed<Crumb[]>(() => {
    const subject = this.subject();
    const chapter = this.chapter();
    const sub = this.subchapter();
    const name = this.title().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
    const trail: Crumb[] = [{ label: name, link: `/${subject}` }];
    if (!chapter) return [{ label: trail[0].label }];

    const chapterTitle = this.chapters.value()?.find((c) => c.slug === chapter)?.title ?? chapter;
    if (!sub) return [trail[0], { label: chapterTitle }];
    trail.push({ label: chapterTitle, link: `/${subject}/${chapter}` });

    // One crumb per level below the chapter. Titles come from the lists the panel has loaded.
    const titles = this.content.titles();
    const levels = sub.split('/');
    let path = chapter;
    levels.forEach((level, i) => {
      path += `/${level}`;
      const label = titles[`${subject}/${path}`] ?? level;
      trail.push(i === levels.length - 1 ? { label } : { label, link: `/${subject}/${path}` });
    });
    return trail;
  });

  /** Phones only: whether the chapter list drawer is open. */
  protected readonly drawerOpen = signal(false);

  /** Picking a chapter (or any link in the panel) closes the drawer so the content shows. */
  protected closeDrawerOnLink(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('a')) this.drawerOpen.set(false);
  }

  protected startResize(event: PointerEvent): void {
    const divider = event.currentTarget as HTMLElement;
    divider.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  protected resize(event: PointerEvent): void {
    if (!(event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) return;
    this.setPanelWidth(event.clientX);
  }

  protected endResize(event: PointerEvent): void {
    const divider = event.currentTarget as HTMLElement;
    if (divider.hasPointerCapture(event.pointerId)) {
      divider.releasePointerCapture(event.pointerId);
      this.savePanelWidth();
    }
  }

  protected resizeWithKeys(event: KeyboardEvent): void {
    const step = event.key === 'ArrowLeft' ? -20 : event.key === 'ArrowRight' ? 20 : 0;
    if (!step) return;
    event.preventDefault();
    this.setPanelWidth(this.panelWidth() + step);
    this.savePanelWidth();
  }

  private setPanelWidth(width: number): void {
    this.panelWidth.set(Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(width))));
  }

  private savedPanelWidth(): number {
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      return saved >= MIN_PANEL_WIDTH && saved <= MAX_PANEL_WIDTH ? saved : DEFAULT_PANEL_WIDTH;
    } catch {
      return DEFAULT_PANEL_WIDTH;
    }
  }

  private savePanelWidth(): void {
    try {
      localStorage.setItem(STORAGE_KEY, String(this.panelWidth()));
    } catch {
      // Storage unavailable (private mode, blocked): the width just won't persist.
    }
  }
}
