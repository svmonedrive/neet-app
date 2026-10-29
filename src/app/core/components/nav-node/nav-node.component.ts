import { Component, ViewEncapsulation, computed, inject, input, linkedSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ContentService } from '../../services/content.service';

/**
 * One row of the subject panel's tree. A page's children are read from its markdown, so the tree
 * can be as deep as the content. Every row fetches its own, so the arrow only shows on rows that
 * really have children; deeper rows are only created once their parent is open.
 */
@Component({
  selector: 'app-nav-node',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav-node.component.html',
  styleUrl: './nav-node.component.css',
  // Rows nest themselves, so the styles are global to reach the rows rendered inside each other.
  encapsulation: ViewEncapsulation.None,
})
export class NavNodeComponent {
  private readonly content = inject(ContentService);

  readonly subject = input.required<string>();
  /** Route path under the subject, e.g. `03-cell/3-1-cell-the-unit-of-life`. */
  readonly path = input.required<string>();
  readonly title = input.required<string>();
  /** Route path of the open page; rows on the way to it are open. */
  readonly current = input.required<string>();
  readonly depth = input(0);
  readonly column = input<number>();

  protected readonly link = computed(() => ['/', this.subject(), ...this.path().split('/')]);

  private readonly onTrail = computed(
    () => this.current() === this.path() || this.current().startsWith(`${this.path()}/`),
  );

  /** Follows the open page, but the user can still fold a row by hand. */
  protected readonly open = linkedSignal(() => this.onTrail());

  private readonly childList = rxResource({
    params: () => ({ subject: this.subject(), path: this.path() }),
    stream: ({ params }) =>
      this.content.children(params.subject, params.path).pipe(catchError(() => of([]))),
  });

  protected readonly children = computed(() => this.childList.value() ?? []);
}
