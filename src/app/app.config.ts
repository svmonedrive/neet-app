import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, SecurityContext, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import markedKatex from 'marked-katex-extension';
import { MARKED_EXTENSIONS, SANITIZE, provideMarkdown } from 'ngx-markdown';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideMarkdown({
      // The markdown is our own bundled content; sanitizing would strip the inline styles KaTeX positions with.
      sanitize: { provide: SANITIZE, useValue: SecurityContext.NONE },
      markedExtensions: [
        {
          provide: MARKED_EXTENSIONS,
          useFactory: () => markedKatex({ throwOnError: false, nonStandard: true }),
          multi: true,
        },
      ],
    }),
    provideRouter(routes, withComponentInputBinding()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
