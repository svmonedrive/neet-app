import { Dialog } from '@angular/cdk/dialog';
import { Component, DestroyRef, ElementRef, ViewEncapsulation, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';
import { CardDialogComponent, CardDialogData } from '../card-dialog/card-dialog.component';
import { TranslatePopupComponent } from '../translate-popup/translate-popup.component';

const MAX_LOOKUP_LENGTH = 100;
const MIN_COLUMN_WIDTH = 60;

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
  private readonly dialog = inject(Dialog);
  private readonly host =inject<ElementRef<HTMLElement>>(ElementRef);

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

  /**
   * Adds a drag handle to each header-cell border. Dragging moves the border between two columns,
   * so the table keeps its width; the last column's handle resizes the table's right edge.
   */
  protected makeColumnsResizable(): void {
    this.host.nativeElement.querySelectorAll('table').forEach((table) => {
      const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>('thead th'));
      if (headers.length < 2 || table.querySelector('colgroup')) return;

      const colgroup = document.createElement('colgroup');
      const cols = headers.map((th) => {
        const col = document.createElement('col');
        col.style.width = `${th.offsetWidth}px`;
        colgroup.append(col);
        return col;
      });
      table.prepend(colgroup);
      table.style.width = `${table.offsetWidth}px`;
      table.style.tableLayout = 'fixed';
      this.addExpandButton(table, cols);

      headers.forEach((th, i) => {
        const isLast = i === headers.length - 1;
        const handle = document.createElement('span');
        handle.className = 'col-resizer';
        handle.addEventListener('pointerdown', (down) => {
          down.preventDefault();
          handle.setPointerCapture(down.pointerId);
          const left = cols[i].offsetWidth;
          const right = isLast ? Infinity : cols[i + 1].offsetWidth;
          const tableWidth = table.offsetWidth;
          const delta = (move: PointerEvent) =>
            Math.min(Math.max(move.clientX - down.clientX, MIN_COLUMN_WIDTH - left), right - MIN_COLUMN_WIDTH);
          const onMove = (move: PointerEvent) => {
            cols[i].style.width = `${left + delta(move)}px`;
            if (isLast) {
              // No neighbour to trade width with: the table itself grows or shrinks.
              table.style.width = `${tableWidth + delta(move)}px`;
            } else {
              cols[i + 1].style.width = `${right - delta(move)}px`;
            }
          };
          const onUp = () => {
            handle.removeEventListener('pointermove', onMove);
            handle.removeEventListener('pointerup', onUp);
          };
          handle.addEventListener('pointermove', onMove);
          handle.addEventListener('pointerup', onUp);
        });
        th.append(handle);
      });
    });
  }

  /**
   * Puts a button above the table's top-right corner. It stretches the table (columns scaled in
   * proportion) to the right edge of the scrolling page area; clicking again restores the widths.
   */
  private addExpandButton(table: HTMLTableElement, cols: HTMLTableColElement[]): void {
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'table-expand';
    button.title = 'Expand table to the full width';
    button.textContent = '⇔';
    table.replaceWith(wrap);
    wrap.append(button, table);

    let restore: { table: string; cols: string[] } | null = null;
    button.addEventListener('click', () => {
      if (restore) {
        table.style.width = restore.table;
        cols.forEach((col, i) => (col.style.width = restore!.cols[i]));
        restore = null;
        button.title = 'Expand table to the full width';
        return;
      }
      const area = this.scrollArea(table);
      const available =
        area.getBoundingClientRect().left + area.clientLeft + area.clientWidth -
        parseFloat(getComputedStyle(area).paddingRight) - table.getBoundingClientRect().left;
      const current = table.offsetWidth;
      if (available <= current) return;
      restore = { table: table.style.width, cols: cols.map((col) => col.style.width) };
      const widths = cols.map((col) => col.offsetWidth);
      table.style.width = `${available}px`;
      cols.forEach((col, i) => (col.style.width = `${(widths[i] * available) / current}px`));
      button.title = 'Restore table width';
    });
  }

  /** The nearest scrolling ancestor, whose right edge limits how wide a table can get. */
  private scrollArea(el: HTMLElement): HTMLElement {
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
    }
    return document.documentElement;
  }

  /** Internal links (e.g. /biology/cell) navigate in-app instead of reloading the page. */
  protected onClick(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const card = (event.target as HTMLElement).closest<HTMLElement>('.card');
    if (card) {
      this.dialog.open(CardDialogComponent, {
        data: {
          title: card.querySelector('.card-header')?.textContent ?? '',
          html: card.querySelector('.card-body')?.innerHTML ?? '',
        } satisfies CardDialogData,
      });
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
