// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileApp } from '../../mobile/MobileApp';

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.(), 0);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.onclose?.();
  }
}

describe('MobileApp', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', MockWebSocket);
    MockWebSocket.instances = [];
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the access-key login when no browser session exists', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ authenticated: false, principal: null }));

    render(<MobileApp />);

    expect(await screen.findByText('手机访问 Hana')).toBeInTheDocument();
    expect(screen.getByLabelText('访问密钥')).toBeInTheDocument();
  });

  it('can submit a username and password login without sending a device credential', async () => {
    let sessionCalls = 0;
    fetchMock.mockImplementation((input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/web-auth/session')) {
        sessionCalls += 1;
        return Promise.resolve(jsonResponse(sessionCalls === 1
          ? { authenticated: false, principal: null }
          : { authenticated: true, principal: { scopes: ['chat', 'files.read', 'files.write'] } }));
      }
      if (url.includes('/api/web-auth/login')) {
        return Promise.resolve(jsonResponse({ ok: true }));
      }
      if (url.includes('/api/server/identity')) {
        return Promise.resolve(jsonResponse({
          serverId: 'server_1',
          userId: 'user_1',
          studioId: 'studio_1',
          label: 'Hana Studio',
          connectionKind: 'lan',
          trustState: 'lan',
          credentialKind: 'password',
          capabilities: ['chat', 'resources', 'files'],
        }));
      }
      if (url.includes('/api/mobile/workbench/files')) {
        return Promise.resolve(jsonResponse({ rootId: 'default', subdir: '', files: [] }));
      }
      if (url.includes('/api/sessions')) {
        return Promise.resolve(jsonResponse([]));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<MobileApp />);

    fireEvent.click(await screen.findByRole('tab', { name: '用户名密码' }));
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'hana-owner' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret-password' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      const loginCall = fetchMock.mock.calls.find(([input]) => String(input).includes('/api/web-auth/login'));
      expect(loginCall).toBeTruthy();
      const body = JSON.parse(String(loginCall?.[1]?.body));
      expect(body).toEqual({ username: 'hana-owner', password: 'secret-password' });
      expect(body).not.toHaveProperty('credential');
    });
  });

  it('loads chat sessions and workbench files for an authenticated phone', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/web-auth/session')) {
        return Promise.resolve(jsonResponse({ authenticated: true, principal: { scopes: ['chat', 'files.read'] } }));
      }
      if (url.includes('/api/server/identity')) {
        return Promise.resolve(jsonResponse({
          serverId: 'server_1',
          userId: 'user_1',
          studioId: 'studio_1',
          label: 'Hana Studio',
          connectionKind: 'lan',
          trustState: 'lan',
          credentialKind: 'device_credential',
          capabilities: ['chat', 'resources', 'files'],
        }));
      }
      if (url.includes('/api/mobile/workbench/files')) {
        return Promise.resolve(jsonResponse({
          rootId: 'default',
          subdir: '',
          files: [{ name: 'note.md', isDir: false, size: 12, mtime: '2026-05-16T00:00:00.000Z' }],
        }));
      }
      if (url.includes('/api/sessions/messages')) {
        return Promise.resolve(jsonResponse({ messages: [], blocks: [], todos: [], hasMore: false, sessionFiles: [] }));
      }
      if (url.includes('/api/sessions')) {
        return Promise.resolve(jsonResponse([
          { path: '/hana/sessions/one.jsonl', title: '日常记录', modified: '2026-05-16T00:00:00.000Z', messageCount: 2 },
        ]));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<MobileApp />);

    expect(await screen.findByText('日常记录')).toBeInTheDocument();
    fireEvent.click(screen.getByText('工作台'));
    expect(await screen.findByText('note.md')).toBeInTheDocument();
  });

  it('renders sent user messages from the server broadcast instead of local optimistic state', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/web-auth/session')) {
        return Promise.resolve(jsonResponse({ authenticated: true, principal: { scopes: ['chat', 'files.read'] } }));
      }
      if (url.includes('/api/server/identity')) {
        return Promise.resolve(jsonResponse({
          serverId: 'server_1',
          userId: 'user_1',
          studioId: 'studio_1',
          label: 'Hana Studio',
          connectionKind: 'lan',
          trustState: 'lan',
          credentialKind: 'device_credential',
          capabilities: ['chat', 'resources', 'files'],
        }));
      }
      if (url.includes('/api/mobile/workbench/files')) {
        return Promise.resolve(jsonResponse({ rootId: 'default', subdir: '', files: [] }));
      }
      if (url.includes('/api/sessions/messages')) {
        return Promise.resolve(jsonResponse({ messages: [], blocks: [], todos: [], hasMore: false, sessionFiles: [] }));
      }
      if (url.includes('/api/sessions')) {
        return Promise.resolve(jsonResponse([
          { path: '/hana/sessions/one.jsonl', title: '日常记录', modified: '2026-05-16T00:00:00.000Z', messageCount: 0 },
        ]));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<MobileApp />);

    await screen.findByText('日常记录');
    fireEvent.change(screen.getByPlaceholderText('发消息给 Hana'), {
      target: { value: '手机端发来的消息' },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: '发送' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: '发送' }));

    await waitFor(() => {
      expect(MockWebSocket.instances[0]?.sent).toContain(JSON.stringify({
        type: 'prompt',
        sessionPath: '/hana/sessions/one.jsonl',
        text: '手机端发来的消息',
      }));
    });
    expect(screen.queryByText('手机端发来的消息')).not.toBeInTheDocument();

    act(() => {
      MockWebSocket.instances[0]?.onmessage?.({
        data: JSON.stringify({
          type: 'session_user_message',
          sessionPath: '/hana/sessions/one.jsonl',
          message: { id: 'u-mobile-1', text: '手机端发来的消息' },
        }),
      } as MessageEvent);
    });

    expect(await screen.findByText('手机端发来的消息')).toBeInTheDocument();
  });
});

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => data,
    text: async () => typeof data === 'string' ? data : JSON.stringify(data),
    headers: new Headers(),
  } as Response;
}
