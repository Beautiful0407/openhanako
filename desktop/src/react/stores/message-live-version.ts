const _messageLiveVersionBySession: Record<string, number> = {};

let resolveSessionKey: ((sessionPath: string) => string | null | undefined) | null = null;

function keyForSession(sessionPath: string): string {
  return resolveSessionKey?.(sessionPath) || sessionPath;
}

export function configureMessageLiveVersionSessionKeyResolver(
  resolver: ((sessionPath: string) => string | null | undefined) | null,
): void {
  resolveSessionKey = resolver;
}

export function readMessageLiveVersion(sessionPath: string): number {
  return _messageLiveVersionBySession[keyForSession(sessionPath)] ?? _messageLiveVersionBySession[sessionPath] ?? 0;
}

export function bumpMessageLiveVersion(sessionPath: string): number {
  const key = keyForSession(sessionPath);
  const next = (_messageLiveVersionBySession[key] ?? _messageLiveVersionBySession[sessionPath] ?? 0) + 1;
  _messageLiveVersionBySession[key] = next;
  if (key !== sessionPath) delete _messageLiveVersionBySession[sessionPath];
  return next;
}

export function clearMessageLiveVersion(sessionPath?: string): void {
  if (sessionPath == null) {
    for (const key of Object.keys(_messageLiveVersionBySession)) {
      delete _messageLiveVersionBySession[key];
    }
    return;
  }
  const key = keyForSession(sessionPath);
  delete _messageLiveVersionBySession[key];
  delete _messageLiveVersionBySession[sessionPath];
}
