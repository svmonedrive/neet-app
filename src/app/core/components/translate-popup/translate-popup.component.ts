import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TokenMissingError, TokenRejectedError, TranslationService } from '../../services/translation.service';

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

  /** What the user has typed for the current word; starts empty again for the next word. */
  protected readonly draft = linkedSignal<string, string>({ source: this.word, computation: () => '' });

  /** Set once the meaning was committed, so the popup shows it without looking the word up again. */
  protected readonly added = linkedSignal<string, string | null>({ source: this.word, computation: () => null });
  /** Set once the meaning was deleted; the lookup result is then out of date. */
  protected readonly removed = linkedSignal<string, boolean>({ source: this.word, computation: () => false });

  /** The meaning to show: what was just added, else what the dictionary had, unless it was deleted. */
  protected readonly shown = computed(() => (this.removed() ? null : (this.added() ?? this.meaning.value() ?? null)));

  /** The GitHub token is asked for on the first change, and again when GitHub rejects the stored one. */
  protected readonly askToken = linkedSignal<string, boolean>({ source: this.word, computation: () => false });
  protected readonly tokenDraft = signal('');
  protected readonly saving = signal(false);
  protected readonly error = linkedSignal<string, string | null>({ source: this.word, computation: () => null });
  /** The change waiting for a token, so Save can carry it out. */
  private pending: 'add' | 'remove' = 'add';

  protected add(): void {
    this.run('add');
  }

  protected remove(): void {
    this.run('remove');
  }

  protected submitToken(): void {
    this.translation.saveToken(this.tokenDraft());
    this.tokenDraft.set('');
    this.save(this.pending);
  }

  private run(change: 'add' | 'remove'): void {
    this.pending = change;
    if (!this.translation.hasToken()) {
      this.askToken.set(true);
      return;
    }
    this.save(change);
  }

  private save(change: 'add' | 'remove'): void {
    this.saving.set(true);
    this.error.set(null);
    const word = this.word();
    const request =
      change === 'add'
        ? this.translation.add(word, this.draft()).pipe(map((meaning) => meaning as string | null))
        : this.translation.remove(word).pipe(map(() => null));
    request.subscribe({
      next: (meaning) => {
        this.saving.set(false);
        this.askToken.set(false);
        this.added.set(meaning);
        this.removed.set(meaning === null);
        this.draft.set('');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        if (error instanceof TokenRejectedError || error instanceof TokenMissingError) {
          this.translation.clearToken();
          this.askToken.set(true);
          this.error.set('GitHub did not accept the token. It may have expired or cannot write to the repo. Paste a new one.');
        } else {
          this.error.set('Could not save the change. Check your connection and try again.');
        }
      },
    });
  }

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
