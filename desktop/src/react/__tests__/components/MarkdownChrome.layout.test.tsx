// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChapterRail } from '../../components/preview/MarkdownChrome';

function readMarkdownChromeSource(): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'desktop/src/react/components/preview/MarkdownChrome.tsx'),
    'utf8',
  );
}

function readMarkdownChromeCss(): string {
  return fs.readFileSync(
    path.join(process.cwd(), 'desktop/src/react/components/preview/MarkdownChrome.module.css'),
    'utf8',
  );
}

describe('MarkdownChrome chapter rail layout', () => {
  afterEach(() => cleanup());

  it('uses the shared timeline rail component instead of a private chapter popover', () => {
    const source = readMarkdownChromeSource();
    const css = readMarkdownChromeCss();

    expect(source).toContain('TimelineRailNavigator');
    expect(source).toContain('measureTimelineMarkerWidthEm');
    expect(source).not.toContain('chapterTrigger');
    expect(source).not.toContain('chapterPopover');
    expect(css).not.toContain('.chapterTrigger');
    expect(css).not.toContain('.chapterPopover');
  });

  it('renders timeline rail markers with the same line/label structure as chat', () => {
    render(
      <ChapterRail
        headings={[
          { id: 'short', level: 1, text: 'Short', line: 0, offset: 0 },
          { id: 'long', level: 2, text: 'A much longer heading for marker width', line: 8, offset: 120 },
        ]}
        activeHeadingId="long"
        railVisible
        onJump={vi.fn()}
      />,
    );

    const nav = screen.getByRole('navigation', { name: 'Markdown sections' });
    expect(nav.className).toContain('timelineNav');
    expect(nav.className).toContain('timelineNavLeft');
    expect(nav.className).toContain('timelineNavVisible');
    expect(screen.getByRole('button', { name: 'Jump to Short' }).querySelector('[class*="timelineLine"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Jump to A much longer heading for marker width' }).className).toContain('timelineMarkerActive');
    expect(screen.getAllByText(/Short|A much longer heading/)).toHaveLength(2);
  });

  it('keeps the rail hidden until the preview hover zone marks it visible', () => {
    render(
      <ChapterRail
        headings={[{ id: 'intro', level: 1, text: 'Intro', line: 0, offset: 0 }]}
        activeHeadingId={null}
        onJump={vi.fn()}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Markdown sections' }).className).not.toContain('timelineNavVisible');
  });
});
