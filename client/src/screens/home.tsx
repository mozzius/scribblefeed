import { Tldraw } from "tldraw"
import { AuthButton } from "../components/auth-button"

export function HomeScreen() {
  return (
    <div className="mx fixed flex h-full min-h-screen w-full flex-col items-center gap-4 bg-slate-50 py-4">
      <AuthButton />
      {Array.from({ length: 10 }).map((_, i) => (
        <div className="w-full max-w-96">
          <Tldraw
            key={i}
            hideUi
            className="pointer-events-none aspect-video w-full rounded-lg border"
          />
        </div>
      ))}
    </div>
  )
}
