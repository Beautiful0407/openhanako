import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHAT_LAYOUT,
  applyChatLayout,
  normalizeChatLayout,
} from '../../chat/layout';

describe('chat layout settings', () => {
  it('normalizes chat width independently from editor typography', () => {
    expect(DEFAULT_CHAT_LAYOUT.contentWidth).toBe(720);
    expect(normalizeChatLayout({ contentWidth: 800 }).contentWidth).toBe(800);
    expect(normalizeChatLayout({ contentWidth: 'unlimited' }).contentWidth).toBe('unlimited');
    expect(normalizeChatLayout({ contentWidth: 960 }).contentWidth).toBe(720);
  });

  it('applies chat width to the message column and input column only', () => {
    const values = new Map<string, string>();
    const root = {
      style: {
        setProperty: (name: string, value: string) => values.set(name, value),
        getPropertyValue: (name: string) => values.get(name) || '',
      },
    } as unknown as HTMLElement;

    applyChatLayout({ contentWidth: 640 }, root);

    const style = root.style;
    expect(style.getPropertyValue('--chat-column-width')).toBe('640px');
    expect(style.getPropertyValue('--chat-input-column-width')).toBe('calc(var(--chat-column-width) + var(--chat-input-column-extra))');
    expect(style.getPropertyValue('--editor-markdown-content-width')).toBe('');
  });

  it('maps unlimited chat width to unrestricted chat columns', () => {
    const values = new Map<string, string>();
    const root = {
      style: {
        setProperty: (name: string, value: string) => values.set(name, value),
        getPropertyValue: (name: string) => values.get(name) || '',
      },
    } as unknown as HTMLElement;

    applyChatLayout({ contentWidth: 'unlimited' }, root);

    const style = root.style;
    expect(style.getPropertyValue('--chat-column-width')).toBe('none');
    expect(style.getPropertyValue('--chat-input-column-width')).toBe('none');
  });
});
