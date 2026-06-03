import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('MessageActions layout', () => {
  function readChatCss(): string {
    return fs.readFileSync(
      path.join(process.cwd(), 'desktop/src/react/components/chat/Chat.module.css'),
      'utf8',
    );
  }

  it('anchors the select checkbox group to the lower right of the message block', () => {
    const css = readChatCss();
    const block = css.match(/\.msgActions\s*\{(?<body>[^}]*)\}/)?.groups?.body || '';

    expect(block).toMatch(/bottom:\s*4px/);
    expect(block).toMatch(/right:\s*4px/);
    expect(block).not.toMatch(/top:\s*4px/);
  });

  it('shows the full action card as an opaque card surface when the message is hovered', () => {
    const css = readChatCss();
    const actionsBlock = css.match(/\.msgActions\s*\{(?<body>[^}]*)\}/)?.groups?.body || '';
    const actionsHoverRule = css.match(/\.messageGroupAssistant:hover \.msgActions,\s*\.messageGroupUser:hover \.msgActions\s*\{(?<body>[^}]*)\}/)?.groups?.body || '';
    const popoverHoverRule = css.match(/\.messageGroupAssistant:hover \.msgActionsPopover,\s*\.messageGroupUser:hover \.msgActionsPopover,\s*\.msgActions:hover \.msgActionsPopover\s*\{(?<body>[^}]*)\}/)?.groups?.body || '';
    const popoverBlock = css.match(/\.msgActionsPopover\s*\{(?<body>[^}]*)\}/)?.groups?.body || '';

    expect(actionsBlock).toMatch(/--msg-actions-popover-width:\s*86px/);
    expect(actionsHoverRule).toMatch(/opacity:\s*1/);
    expect(popoverHoverRule).toMatch(/opacity:\s*1/);
    expect(popoverHoverRule).toMatch(/pointer-events:\s*auto/);
    expect(popoverBlock).toMatch(/min-width:\s*var\(--msg-actions-popover-width\)/);
    expect(popoverBlock).toMatch(/background:\s*var\(--bg-card,\s*#fff\)/);
  });

  it('keeps active message action styling when the button is hovered', () => {
    const css = readChatCss();
    const block = css.match(/\.msgActionBtnActive:hover\s*\{(?<body>[^}]*)\}/)?.groups?.body || '';

    expect(block).toMatch(/color:\s*var\(--accent\)\s*!important/);
    expect(block).toMatch(/background:\s*rgba\(var\(--accent-rgb\),\s*0\.16\)/);
  });

  it('renders file output cards as block-level rows instead of inline siblings', () => {
    const css = readChatCss();
    const block = css.match(/\.fileOutputCard\s*\{(?<body>[^}]*)\}/)?.groups?.body || '';

    expect(block).toMatch(/display:\s*flex/);
    expect(block).not.toMatch(/display:\s*inline-flex/);
  });
});
