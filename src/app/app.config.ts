import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import markedKatex from 'marked-katex-extension';
import { MARKED_EXTENSIONS, provideMarkdown } from 'ngx-markdown';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideMarkdown({
      markedExtensions: [
        {
          provide: MARKED_EXTENSIONS,
          useFactory: () => markedKatex({ throwOnError: false }),
          multi: true,
        },
      ],
    }),
    provideRouter(routes, withComponentInputBinding()),
  ]
};
