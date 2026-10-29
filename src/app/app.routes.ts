import { Routes, UrlMatcher, UrlSegment } from '@angular/router';
import { HomePageComponent } from './pages/home-page/home-page.component';
import { SubjectPageComponent } from './pages/subject-page/subject-page.component';

/**
 * Matches /:subject, /:subject/:chapter and /:subject/:chapter/<any depth of sub-chapters> as ONE
 * route, so moving between a subject's pages reuses the page instead of rebuilding it. The
 * `subchapter` param holds the rest of the path, e.g. `3-1-x/3-1-1-y`.
 */
const subjectMatcher: UrlMatcher = (segments) => {
  if (segments.length < 1) return null;
  const [subject, chapter, ...rest] = segments;
  return {
    consumed: segments,
    posParams: {
      subject,
      ...(chapter && { chapter }),
      ...(rest.length && { subchapter: new UrlSegment(rest.map((s) => s.path).join('/'), {}) }),
    },
  };
};

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  { matcher: subjectMatcher, component: SubjectPageComponent },
  { path: '**', redirectTo: '' },
];
