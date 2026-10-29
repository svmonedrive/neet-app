import { afterRenderEffect, Component, ElementRef, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface Crumb {
  label: string;
  /** App route. Leave it out for the current page (the last crumb). */
  link?: string;
}

/** A one-line trail such as Biology / Chapter / Sub-chapter. Scrolls sideways when it is too long. */
@Component({
  selector: 'app-breadcrumb',
  imports: [RouterLink],
  template: `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <ol>
        @for (crumb of items(); track $index) {
          <li>
            @if (crumb.link) {
              <a [routerLink]="crumb.link">{{ crumb.label }}</a>
            } @else {
              <span aria-current="page">{{ crumb.label }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styleUrl: './breadcrumb.component.css',
})
export class BreadcrumbComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly items = input.required<Crumb[]>();

  constructor() {
    // The current page is the last crumb: keep it in view when the trail is wider than the bar.
    afterRenderEffect(() => {
      this.items();
      const nav = this.host.nativeElement.querySelector('nav');
      nav?.scrollTo({ left: nav.scrollWidth });
    });
  }
}
