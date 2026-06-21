import path from "path";
import { describe, expect, it, vi } from "vitest";
import { ResourceWatchRegistry } from "../lib/resource-io/resource-watch-registry.ts";

describe("ResourceWatchRegistry", () => {
  it("shares backend watches across subscriptions and reports diagnostics", () => {
    const filePath = path.join("/workspace", "notes", "a.md");
    const close = vi.fn();
    const watchPath = vi.fn(() => ({ close }));
    const registry = new ResourceWatchRegistry({
      emitEvent: vi.fn(),
      watchPath,
    });

    const first = registry.subscribe({
      purpose: "preview",
      sessionPath: "/sessions/a.jsonl",
      resources: [{ kind: "local-file", path: filePath }],
    });
    const second = registry.subscribe({
      purpose: "workspace-tree",
      resources: [{ kind: "local-file", path: filePath }],
    });

    expect(first.subscriptionId).toEqual(expect.any(String));
    expect(first.resourceKeys).toEqual([`local_fs:${filePath.replace(/\\/g, "/")}`]);
    expect(watchPath).toHaveBeenCalledTimes(1);
    expect(registry.diagnostics()).toMatchObject({
      subscriptions: 2,
      watches: [{
        resourceKey: `local_fs:${filePath.replace(/\\/g, "/")}`,
        refCount: 2,
      }],
    });

    expect(registry.unsubscribe(first.subscriptionId)).toBe(true);
    expect(close).not.toHaveBeenCalled();

    expect(registry.unsubscribe(second.subscriptionId)).toBe(true);
    expect(close).toHaveBeenCalledTimes(1);
    expect(registry.diagnostics()).toMatchObject({ subscriptions: 0, watches: [] });
  });

  it("emits a versioned resource.changed event after a watched local file changes", async () => {
    vi.useFakeTimers();
    const filePath = path.join("/workspace", "notes", "a.md");
    const close = vi.fn();
    const emitEvent = vi.fn();
    let onChange: (() => void) | null = null;

    const registry = new ResourceWatchRegistry({
      emitEvent,
      debounceMs: 5,
      watchPath: vi.fn((_targetPath, handler) => {
        onChange = handler;
        return { close };
      }),
      statPath: vi.fn(() => ({
        exists: true,
        isDirectory: false,
        mtimeMs: 123,
        size: 7,
      })),
    });

    const release = registry.retain({ kind: "local-file", path: filePath });
    onChange?.();
    await vi.runAllTimersAsync();

    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "resource.changed",
      source: "provider_watch",
      resourceKey: `local_fs:${filePath.replace(/\\/g, "/")}`,
      resource: expect.objectContaining({
        kind: "local-file",
        provider: "local_fs",
        path: filePath,
      }),
      version: { mtimeMs: 123, size: 7 },
    }), null);

    release();
    expect(close).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("treats basename changes from a watched file as the file itself", async () => {
    vi.useFakeTimers();
    const filePath = path.join("/workspace", "notes", "a.md");
    const close = vi.fn();
    const emitEvent = vi.fn();
    let onChange: ((changedPath?: string | null) => void) | null = null;
    const statPath = vi.fn(() => ({
      exists: true,
      isDirectory: false,
      mtimeMs: 321,
      size: 5,
    }));

    const registry = new ResourceWatchRegistry({
      emitEvent,
      debounceMs: 5,
      resolveWatchTarget: vi.fn((resource) => ({
        ref: resource,
        filePath,
        isDirectory: false,
        resourceKey: `local_fs:${filePath.replace(/\\/g, "/")}`,
        resource: {
          kind: "local-file",
          provider: "local_fs",
          path: filePath,
          filePath,
        },
        toResource: (eventPath) => ({
          resourceKey: `local_fs:${eventPath.replace(/\\/g, "/")}`,
          resource: {
            kind: "local-file",
            provider: "local_fs",
            path: eventPath,
            filePath: eventPath,
          },
        }),
      })),
      watchPath: vi.fn((_targetPath, handler) => {
        onChange = handler;
        return { close };
      }),
      statPath,
    });

    const release = registry.retain({ kind: "local-file", path: filePath });
    onChange?.("a.md");
    await vi.runAllTimersAsync();

    expect(statPath).toHaveBeenCalledWith(filePath);
    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "resource.changed",
      resourceKey: `local_fs:${filePath.replace(/\\/g, "/")}`,
      resource: expect.objectContaining({
        kind: "local-file",
        provider: "local_fs",
        path: filePath,
        filePath,
      }),
      version: { mtimeMs: 321, size: 5 },
    }), null);

    release();
    expect(close).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("uses provider watch targets and emits canonical provider resources", async () => {
    vi.useFakeTimers();
    const mountRoot = path.join("/mnt", "docs");
    const changedPath = path.join(mountRoot, "notes", "a.md");
    const close = vi.fn();
    const emitEvent = vi.fn();
    let onChange: ((changedPath?: string | null) => void) | null = null;

    const registry = new ResourceWatchRegistry({
      emitEvent,
      debounceMs: 5,
      resolveWatchTarget: vi.fn((resource) => ({
        ref: resource,
        filePath: mountRoot,
        resourceKey: "mount:mount_local:",
        resource: {
          kind: "mount",
          mountId: "mount_local",
          path: "",
          provider: "mount",
          filePath: mountRoot,
        },
        toResource: (eventPath) => ({
          resourceKey: "mount:mount_local:notes/a.md",
          resource: {
            kind: "mount",
            mountId: "mount_local",
            path: "notes/a.md",
            provider: "mount",
            filePath: eventPath,
          },
        }),
      })),
      watchPath: vi.fn((_targetPath, handler) => {
        onChange = handler;
        return { close };
      }),
      statPath: vi.fn(() => ({
        exists: true,
        isDirectory: false,
        mtimeMs: 456,
        size: 11,
      })),
    });

    const subscription = registry.subscribe({
      purpose: "workspace-tree",
      resources: [{ kind: "mount", mountId: "mount_local", path: "" }],
    });

    expect(subscription.resourceKeys).toEqual(["mount:mount_local:"]);
    expect(registry.diagnostics().watches[0]).toMatchObject({
      resourceKey: "mount:mount_local:",
      filePath: mountRoot,
    });

    onChange?.(changedPath);
    await vi.runAllTimersAsync();

    expect(emitEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: "resource.changed",
      source: "provider_watch",
      resourceKey: "mount:mount_local:notes/a.md",
      resource: expect.objectContaining({
        kind: "mount",
        mountId: "mount_local",
        path: "notes/a.md",
        provider: "mount",
        filePath: changedPath,
      }),
      version: { mtimeMs: 456, size: 11 },
    }), null);

    registry.unsubscribe(subscription.subscriptionId);
    expect(close).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
