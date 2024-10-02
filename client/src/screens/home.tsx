import { Tldraw } from "tldraw";
import { AuthButton } from "../components/auth-button";
import { Composer } from "../components/composer";

export function HomeScreen() {
  return (
    <div className="mx fixed flex h-full min-h-screen w-full flex-col items-center gap-4 bg-slate-50 py-4">
      <AuthButton />
      <Composer />
      {Array.from({ length: 10 }).map((_, i) => (
        <div className="w-full max-w-96">
          <Tldraw
            key={i}
            hideUi
            className="aspect-video w-full rounded-lg border pointer-events-none"
            onMount={(editor) => {
              editor.setCurrentTool("draw");
            }}
          />
        </div>
      ))}
    </div>
  );
}
