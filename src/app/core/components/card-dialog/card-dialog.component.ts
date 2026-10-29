import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, ViewEncapsulation, inject } from '@angular/core';

export interface CardDialogData {
  title: string;
  html: string;
}

/** A card opened in a floating dialog: drag the header to move it, drag the bottom-right corner to resize. */
@Component({
  selector: 'app-card-dialog',
  imports: [CdkDrag, CdkDragHandle],
  template: `
    <div class="card-dialog" cdkDrag cdkDragRootElement=".cdk-overlay-pane" [cdkDragDisabled]="phone">
      <div class="card-dialog-header" cdkDragHandle>
        <span>{{ data.title }}</span>
        <button type="button" aria-label="Close" (click)="ref.close()">✕</button>
      </div>
      <div class="card-dialog-body" [innerHTML]="data.html"></div>
    </div>
  `,
  styleUrl: './card-dialog.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class CardDialogComponent {
  protected readonly data = inject<CardDialogData>(DIALOG_DATA);
  protected readonly ref = inject(DialogRef);
  /** Same breakpoint as the stylesheet: the dialog is a fixed full-screen sheet there. */
  protected readonly phone = matchMedia('(max-width: 720px)').matches;
}
