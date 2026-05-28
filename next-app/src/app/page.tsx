import { format } from "date-fns";
import { Layers } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const stamp = format(new Date(), "PPpp");
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-8">
      <div className="max-w-lg text-center space-y-4">
        <p className="text-xs uppercase tracking-widest text-cyan-400/90 flex items-center justify-center gap-2">
          <Layers className="size-4" aria-hidden />
          Core stack (scaffold)
        </p>
        <h1 className="text-2xl font-semibold text-white">Circle Prospecting AI — Next.js 14</h1>
        <p className="text-sm text-zinc-500">Build stamp (date-fns): {stamp}</p>
        <p className="text-sm text-zinc-400 leading-relaxed">
          App Router + legacy <code className="text-zinc-300">pages/api</code>, Tailwind, ESLint, Node 20. Firebase
          Hosting for the live site is still the root <code className="text-zinc-300">firebase.json</code> (Vite{" "}
          <code className="text-zinc-300">dist</code> + API) until you cut over to{" "}
          <strong className="text-zinc-200">App Hosting</strong> with this folder.
        </p>
        <ul className="text-left text-sm text-zinc-300 space-y-2 pt-2 border-t border-zinc-800">
          <li>
            <span className="text-zinc-500">App Route Handler:</span>{" "}
            <Link href="/api/health" className="text-cyan-400 hover:underline">
              /api/health
            </Link>
          </li>
          <li>
            <span className="text-zinc-500">Pages API route:</span>{" "}
            <Link href="/api/stack" className="text-cyan-400 hover:underline">
              /api/stack
            </Link>
          </li>
        </ul>
        <ul className="text-left text-sm text-zinc-300 space-y-1.5">
          <li>
            <span className="text-zinc-500">Dev (turbo):</span> <code className="text-cyan-300/90">npm run dev</code> in{" "}
            <code className="text-zinc-300">next-app/</code>
          </li>
          <li>
            <span className="text-zinc-500">Repo:</span> <code className="text-cyan-300/90">npm run dev:next+api</code>{" "}
            (Express + Next)
          </li>
          <li>
            <span className="text-zinc-500">Firestore/Storage rules:</span>{" "}
            <code className="text-cyan-300/90">npm run deploy:firebase:rules</code> at repo root (Firebase CLI)
          </li>
        </ul>
      </div>
    </main>
  );
}
