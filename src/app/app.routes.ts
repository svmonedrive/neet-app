import { Routes, UrlMatcher } from '@angular/router';
import { HomePageComponent } from './pages/home-page/home-page.component';
import { SubjectPageComponent } from './pages/subject-page/subject-page.component';

/**
 * Matches /:subject, /:subject/:chapter and /:subject/:chapter/:subchapter as ONE route, so
 * moving between a subject's chapters and sub-chapters reuses the page instead of rebuilding it.
 */
const subjectMatcher: UrlMatcher = (segments) => {
  if (segments.length < 1 || segments.length > 3) return null;
  const [subject, chapter, subchapter] = segments;
  return {
    consumed: segments,
    posParams: {
      subject,
      ...(chapter && { chapter }),
      ...(subchapter && { subchapter }),
    },
  };
};

export const routes: Routes = [
  { path: '', component: HomePageComponent },
  { matcher: subjectMatcher, component: SubjectPageComponent },
  { path: '**', redirectTo: '' },
];
