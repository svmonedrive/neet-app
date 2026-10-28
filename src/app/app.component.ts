import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeToggleComponent } from './core/components/theme-toggle/theme-toggle.component';

@Component({
  imports: [RouterOutlet, ThemeToggleComponent],
  selector: 'app-root',
  styleUrl: './app.component.css',
  templateUrl: './app.component.html',
})
export class AppComponent {
  protected readonly title = signal('neet-app');
}
