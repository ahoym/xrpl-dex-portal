export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600 dark:border-zinc-700 dark:border-t-blue-400" />
        <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">Loading...</p>
      </div>
    </div>
  );
}
