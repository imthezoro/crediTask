import { getUser } from '@/lib/supabaseServer';
import { listPromptSessions } from '@/lib/db';

export default async function DashboardPage() {
  const user = await getUser();
  const sessions = user ? await listPromptSessions(user.id) : [];

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Dashboard</h1>
      {!user && <p>Please login via the extension.</p>}
      {user && (
        <div>
          <p>Signed in as: {user.email}</p>
          <h2>Recent prompts</h2>
          <ul>
            {sessions.map((s) => (
              <li key={s.id}>
                <div>
                  <strong>Site:</strong> {s.site} | <strong>Created:</strong> {new Date(s.created_at).toLocaleString()}
                </div>
                <div>
                  <strong>Original:</strong> {s.original_prompt.slice(0, 80)}
                </div>
                <div>
                  <strong>Enhanced:</strong> {s.enhanced_prompt?.slice(0, 80) || '—'}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}


