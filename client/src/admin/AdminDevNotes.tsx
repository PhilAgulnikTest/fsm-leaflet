/* Admin-only dev notes tab. Same content as the old NotesForPhil panel, just
 * relocated from the public landing page to behind the /admin nav. */

import { NotesForPhil } from '../components/NotesForPhil';

export function AdminDevNotes() {
  return (
    <section>
      <p className="muted">
        Punch-list of what's working, what needs your decision, and what's still pending.
        This used to sit on the public landing — moved here so the front page stays clean for demos.
      </p>
      <NotesForPhil hideOuterChrome />
    </section>
  );
}
