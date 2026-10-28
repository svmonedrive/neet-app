import { Component, computed, inject } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

/** Round button that switches between the light and dark theme. */
@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.component.html',
  styleUrl: './theme-toggle.component.css',
})
export class ThemeToggleComponent {
  private readonly themeService = inject(ThemeService);

  protected readonly dark = computed(() => this.themeService.theme() === 'dark');

  protected toggle(): void {
    this.themeService.toggle();
  }
}
