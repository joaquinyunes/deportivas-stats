export function DemoNotice() {
  return (
    <div className="rounded-lg border border-push/25 bg-push/10 px-4 py-2.5 text-xs text-push">
      Modo demo — datos sinteticos. Pone <code className="font-mono">DEMO_MODE=false</code> en{" "}
      <code className="font-mono">.env.local</code> para usar datos reales de ESPN.
    </div>
  );
}

export function InfoNotice({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-accent/25 bg-accent/10 px-4 py-2.5 text-xs text-accent">
      {message}
    </div>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-under/30 bg-under/10 px-4 py-3 text-sm text-under">
      <div className="font-medium">No se pudieron traer los datos</div>
      <div className="mt-1 font-mono text-xs opacity-80">{message}</div>
    </div>
  );
}

export function EmptyNotice({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-10 text-center text-sm text-ink-faint">
      {message}
    </div>
  );
}
