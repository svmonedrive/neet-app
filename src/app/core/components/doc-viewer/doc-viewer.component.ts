import { Component, DestroyRef, ViewEncapsulation, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { TranslatePopupComponent } from '../translate-popup/translate-popup.component';

const MAX_LOOKUP_LENGTH = 100;

/** Renders a markdown string, including KaTeX math. Double-click a word for its Bengali meaning. */
@Component({
  selector: 'app-doc-viewer',
  imports: [MarkdownComponent, TranslatePopupComponent],
  templateUrl: './doc-viewer.component.html',
  styleUrl: './doc-viewer.component.css',
  // Rendered markdown is injected HTML, so scoped styles would not reach it.
  encapsulation: ViewEncapsulation.None,
})
export class DocViewerComponent {
  private readonly router = inject(Router);

  readonly content = input.required<string>();

  protected readonly lookup = signal<{ word: string; anchor: DOMRect } | null>(null);

  constructor() {
    // The popup is fixed to the screen, so close it when the user clicks elsewhere, presses Esc
    // or scrolls (scroll events do not bubble, hence the capture phase).
    const close = () => this.lookup.set(null);
    const onClick = (event: MouseEvent) => {
      if (!(event.target as Element).closest('app-translate-popup')) close();
    };
    const onKeydown = (event: KeyboardEvent) => event.key === 'Escape' && close();
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('scroll', close, true);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('scroll', close, true);
    });
  }

  /** Internal links (e.g. /biology/cell) navigate in-app instead of reloading the page. */
  protected onClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const link = (event.target as HTMLElement).closest('a');
    const href = link?.getAttribute('href');
    if (link && href?.startsWith('/') && !link.target) {
      event.preventDefault();
      this.router.navigateByUrl(href);
    }
  }

  /** Looks up the double-clicked word (or the dragged phrase) without surrounding punctuation. */
  protected onDoubleClick(): void {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const word = selection.toString().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!/\p{L}/u.test(word) || word.length > MAX_LOOKUP_LENGTH) return;
    this.lookup.set({ word, anchor: selection.getRangeAt(0).getBoundingClientRect() });
  }
}
