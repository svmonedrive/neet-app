import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';

const REPO = 'svmonedrive/my-utility-app-data';
const BRANCH = 'main';
const FILE = 'neet-app-data/translation.json';
const RAW_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${FILE}`;
const API_URL = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
const TOKEN_KEY = 'neet.githubToken';

/** Lower-cases and collapses whitespace so "Cell  Wall" matches the key "cell wall". */
const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

/** GitHub refused the token: it is wrong, expired, or has no write access to the repo. */
export class TokenRejectedError extends Error {}
/** Adding a word needs a token and none is stored yet. */
export class TokenMissingError extends Error {}

interface ContentsResponse {
  /** Base64 of the file, with line breaks. */
  content: string;
  sha: string;
}

/**
 * Looks words up in the English to Bengali dictionary kept in a GitHub repo, and adds new words
 * to it by committing to that file with a personal access token stored in this browser.
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly http = inject(HttpClient);

  private dictionary = new Map<string, string>();

  // Loaded once, on the first lookup. A missing or broken file just means "no translations".
  private readonly loaded$ = this.http.get<Record<string, string>>(RAW_URL).pipe(
    tap((entries) => (this.dictionary = this.toMap(entries))),
    catchError(() => of(null)),
    shareReplay(1),
  );

  /** The Bengali meaning, or null when the word is not in the dictionary. */
  toBengali(text: string): Observable<string | null> {
    return this.loaded$.pipe(map(() => this.find(normalize(text))));
  }

  hasToken(): boolean {
    return !!this.readToken();
  }

  saveToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token.trim());
    } catch {
      // Storage blocked: the token only lives for this add, and is asked for again next time.
      this.memoryToken = token.trim();
    }
  }

  clearToken(): void {
    this.memoryToken = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing stored that could be removed.
    }
  }

  /**
   * Commits `word` with its meaning to the repo file. The file is read fresh first, so words added
   * elsewhere are kept, and the dictionary is replaced by what was committed.
   */
  add(word: string, bengali: string): Observable<string> {
    const key = normalize(word);
    const meaning = bengali.trim();
    return this.commit(`Add "${key}" to translation.json`, (entries) => ({ ...entries, [key]: meaning })).pipe(
      map(() => meaning),
    );
  }

  /** Deletes the entry a lookup of `word` finds (so "roots" removes "root"), and commits that. */
  remove(word: string): Observable<void> {
    const wanted = normalize(word);
    return this.commit(`Remove "${wanted}" from translation.json`, (entries) => {
      const found = this.findKey(this.toMap(entries), wanted);
      return Object.fromEntries(Object.entries(entries).filter(([key]) => normalize(key) !== found));
    });
  }

  /** Reads the file fresh, applies `change` to its entries and commits the result. */
  private commit(
    message: string,
    change: (entries: Record<string, string>) => Record<string, string>,
  ): Observable<void> {
    const token = this.readToken();
    if (!token) return throwError(() => new TokenMissingError());
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };

    return this.http.get<ContentsResponse>(API_URL, { headers, params: { ref: BRANCH } }).pipe(
      switchMap((file) => {
        const entries = change(JSON.parse(this.decode(file.content)));
        return this.http
          .put(
            API_URL,
            {
              message,
              content: this.encode(`${JSON.stringify(entries, null, 2)}
`),
              sha: file.sha,
              branch: BRANCH,
            },
            { headers },
          )
          .pipe(tap(() => (this.dictionary = this.toMap(entries))));
      }),
      map(() => undefined),
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof HttpErrorResponse && [401, 403, 404].includes(error.status)
            ? new TokenRejectedError()
            : error,
        ),
      ),
    );
  }

  private memoryToken: string | null = null;

  private readToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY) || this.memoryToken;
    } catch {
      return this.memoryToken;
    }
  }

  private toMap(entries: Record<string, string>): Map<string, string> {
    return new Map(Object.entries(entries).map(([word, bengali]) => [normalize(word), bengali]));
  }

  private find(word: string): string | null {
    const key = this.findKey(this.dictionary, word);
    return key === null ? null : (this.dictionary.get(key) ?? null);
  }

  /** The dictionary key a lookup of `word` ends up at, or null. */
  private findKey(dictionary: Map<string, string>, word: string): string | null {
    if (dictionary.get(word)) return word;
    // Plurals: "chromosomes" finds "chromosome", "roots" finds "root", "bronchi" is not guessed.
    if (word.length > 3 && word.endsWith('s')) {
      return [word.slice(0, -1), word.slice(0, -2)].find((singular) => dictionary.get(singular)) ?? null;
    }
    return null;
  }

  /** The API sends the file as base64 of its UTF-8 bytes, which `atob` alone would garble for Bengali. */
  private decode(base64: string): string {
    const bytes = Uint8Array.from(atob(base64.replace(/\s/g, '')), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  private encode(text: string): string {
    let binary = '';
    new TextEncoder().encode(text).forEach((byte) => (binary += String.fromCharCode(byte)));
    return btoa(binary);
  }
}
