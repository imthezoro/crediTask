import Link from 'next/link';

export default function Page() {
  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>PromptOK</h1>
      <p>Minimal MVP: Chrome extension + API</p>
      <ul>
        <li>
          <Link href="/dashboard">Dashboard</Link>
        </li>
      </ul>
    </main>
  );
}


