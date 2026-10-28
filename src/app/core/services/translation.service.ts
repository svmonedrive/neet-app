import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';

const TRANSLATION_FILE = 'content/translation.json';

/** Lower-cases and collapses whitespace so "Cell  Wall" matches the key "cell wall". */
const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

/** Looks words up in the hand-written English to Bengali dictionary in content/translation.json. */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly http = inject(HttpClient);

  // Loaded once, on the first lookup. A missing or broken file just means "no translations".
  private readonly dictionary$ = this.http.get<Record<string, string>>(TRANSLATION_FILE).pipe(
    map((entries) => new Map(Object.entries(entries).map(([word, bengali]) => [normalize(word), bengali]))),
    catchError(() => of(new Map<string, string>())),
    shareReplay(1),
  );

  /** The Bengali meaning, or null when the word is not in the dictionary. */
  toBengali(text: string): Observable<string | null> {
    return this.dictionary$.pipe(map((dictionary) => this.find(dictionary, normalize(text))));
  }

  private find(dictionary: Map<string, string>, word: string): string | null {
    const exact = dictionary.get(word);
    if (exact) return exact;
    // Plurals: "chromosomes" finds "chromosome", "roots" finds "root", "bronchi" is not guessed.
    if (word.length > 3 && word.endsWith('s')) {
      return dictionary.get(word.slice(0, -1)) ?? dictionary.get(word.slice(0, -2)) ?? null;
    }
    return null;
  }
}
