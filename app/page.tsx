import { SqliteViewer } from "@/components/sqlite-viewer/viewer";

// Pre-render the shell HTML at build time — the browser gets full HTML instantly
// with zero server round-trips. The client components hydrate after paint.
export const dynamic = "force-static";

export default function Page() {
  return <SqliteViewer />;
}
