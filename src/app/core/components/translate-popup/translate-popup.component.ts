import { Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TranslationService } from '../../services/translation.service';

const POPUP_WIDTH = 280;
const EDGE_GAP = 8;
const FLIP_BELOW_SPACE = 140;

/** Shows the Bengali meaning of a word, anchored to where the word is on screen. */
@Component({
  selector: 'app-translate-popup',
  templateUrl: './translate-popup.component.html',
  styleUrl: './translate-popup.component.css',
})
export class TranslatePopupComponent {
  private readonly translation = inject(TranslationService);

  readonly word = input.required<string>();
  /** Viewport rectangle of the selected word. */
  readonly anchor = input.required<DOMRect>();

  protected readonly meaning = rxResource({
    params: () => this.word(),
    stream: ({ params }) => this.translation.toBengali(params),
  });

  protected readonly width = POPUP_WIDTH;

  protected readonly left = computed(() =>
    Math.max(EDGE_GAP, Math.min(this.anchor().left, window.innerWidth - POPUP_WIDTH - EDGE_GAP)),
  );

  // Open above the word when there is little room below it.
  protected readonly above = computed(() => this.anchor().bottom > window.innerHeight - FLIP_BELOW_SPACE);

  protected readonly top = computed(() =>
    this.above() ? this.anchor().top - EDGE_GAP : this.anchor().bottom + EDGE_GAP,
  );
}
