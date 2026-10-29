import { afterRenderEffect, Component, computed, effect, ElementRef, inject, input, signal } from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ContentService } from '../../services/content.service';

export interface Crumb {
  label: string;
  /** App route. Leave it out for the current page (the last crumb). */
  link?: string;
  /** Route path including the subject (`biology/03-cell`): what the arrow after the crumb lists. */
  path?: string;
}

interface Choice {
  title: string;
  link: string;
  path: string;
}

/**
 * A one-line trail such as Biology > Chapter > Sub-chapter. Scrolls sideways when it is too long.
 * The arrow after a crumb opens a CDK menu of the pages below it; entries with pages of their own
 * open a submenu, so the trail can be walked down from the menus alone.
 */
@Component({
  selector: 'app-breadcrumb',
  imports: [RouterLink, CdkMenu, CdkMenuItem, CdkMenuTrigger],
  templateUrl: './breadcrumb.component.html',
  styleUrl: './breadcrumb.component.css',
})
export class BreadcrumbComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly content = inject(ContentService);

  readonly items = input.required<Crumb[]>();

  /** Pages below each route path, loaded when a menu opens (an entry's own list shows its arrow). */
  protected readonly tree = signal<Record<string, Choice[]>>({});

  private readonly trailEnd = computed(() => this.items().at(-1)?.path ?? '');
  protected readonly lastHasChoices = computed(() => !!this.tree()[this.trailEnd()]?.length);

  constructor() {
    // The current page gets an arrow too, when there is something below it to list.
    effect(() => this.fetch(this.trailEnd()));

    // The current page is the last crumb: keep it in view when the trail is wider than the bar.
    afterRenderEffect(() => {
      this.items();
      this.lastHasChoices();
      const nav = this.host.nativeElement.querySelector('nav');
      nav?.scrollTo({ left: nav.scrollWidth });
    });
  }

  /** A menu entry on the way to the open page is highlighted. */
  protected onTrail(path: string): boolean {
    return this.trailEnd() === path || this.trailEnd().startsWith(`${path}/`);
  }

  /** Loads the pages below `path` and below each of them, so an entry knows to show an arrow. */
  protected load(path: string): void {
    this.fetch(path, (entries) => entries.forEach((e) => this.fetch(e.path)));
  }

  private fetch(path: string, done?: (entries: Choice[]) => void): void {
    if (!path) return;
    const known = this.tree()[path];
    if (known) return done?.(known);

    // A subject lists its chapters; any other page lists the pages in its folder.
    const [subject, ...rest] = path.split('/');
    const sub = rest.join('/');
    (sub ? this.content.children(subject, sub) : this.content.chapters(subject))
      .pipe(
        map((list) => list.map((e) => ({ title: e.title, link: `/${subject}/${e.slug}`, path: `${subject}/${e.slug}` }))),
        catchError(() => of([])),
      )
      .subscribe((entries) => {
        this.tree.update((all) => ({ ...all, [path]: entries }));
        done?.(entries);
      });
  }
}
