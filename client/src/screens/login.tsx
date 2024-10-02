export function LoginScreen() {
  return (
    <div className="flex h-full min-h-screen w-full items-center justify-center">
      <form
        className="w-full max-w-lg flex-col space-y-4 rounded-lg bg-white p-4 shadow-lg"
        action="/api/login"
        method="post"
      >
        <h1 className="text-2xl font-bold">Log in</h1>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            name="handle"
            placeholder="Enter your handle (e.g. alice.bsky.social)"
            required
            className="flex-1 rounded border p-2"
          />
          <button
            type="submit"
            className="w-content shrink-0 rounded bg-blue-500 p-2 text-white"
          >
            Log in
          </button>
        </div>
      </form>
    </div>
  );
}
