import { describe, expect, it, vi } from 'vitest';
import type { MermaidConfig } from '../config.type.js';
import { jsdomIt } from '../tests/util.js';
import {
  bindDeferredLinks,
  filterCustomCssText,
  filterExternalRequestsInHtml,
  resolveExternalLinkUrl,
  resolveExternalRequestUrl,
  setLinkAttributes,
} from './filterExternalRequests.js';

describe('filterExternalRequests helpers', () => {
  jsdomIt('blocks external resource URLs in conservative mode', async () => {
    await expect(
      resolveExternalRequestUrl('https://example.com/image.png', {
        filterExternalRequests: true,
      } as MermaidConfig)
    ).resolves.toBeNull();
    await expect(
      resolveExternalRequestUrl('/images/local.png', {
        filterExternalRequests: true,
      } as MermaidConfig)
    ).resolves.toBe('/images/local.png');
  });

  jsdomIt('uses the nested resource callback when configured', async () => {
    const urls = vi.fn().mockResolvedValue('/safe/image.png');

    await expect(
      resolveExternalRequestUrl('https://example.com/image.png', {
        filterExternalRequests: { urls },
      } as MermaidConfig)
    ).resolves.toBe('/safe/image.png');
    expect(urls).toHaveBeenCalledWith('https://example.com/image.png');
  });

  jsdomIt('blocks external links in conservative mode', async () => {
    await expect(
      resolveExternalLinkUrl('https://example.com/path', {
        filterExternalRequests: true,
      } as MermaidConfig)
    ).resolves.toBeNull();
    await expect(
      resolveExternalLinkUrl('/local/path', {
        filterExternalRequests: true,
      } as MermaidConfig)
    ).resolves.toBe('/local/path');
  });

  it('filters Mermaid-generated custom CSS', () => {
    expect(
      filterCustomCssText('.node { fill: red; }', { filterExternalRequests: true } as MermaidConfig)
    ).toBe('');
    expect(
      filterCustomCssText('.node { fill: red; }', {
        filterExternalRequests: {
          filterCustomCss: (css) => css.replace('red', 'green'),
        },
      } as MermaidConfig)
    ).toContain('green');
  });

  jsdomIt('filters HTML resource URLs and defers anchor links', async () => {
    const filtered = await filterExternalRequestsInHtml(
      '<img src="https://example.com/x.png" /><a href="https://example.com" target="_blank">Open</a>',
      {
        filterExternalRequests: true,
      } as MermaidConfig
    );

    const container = document.createElement('div');
    container.innerHTML = filtered;

    const image = container.querySelector('img');
    expect(image?.getAttribute('src')).toBeNull();

    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBeNull();
    expect(link?.getAttribute('data-mermaid-link-url')).toBe('https://example.com');
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  jsdomIt('binds deferred links and opens sanitized allowed URLs', async () => {
    const popup = {
      location: {
        replace: vi.fn(),
      },
      close: vi.fn(),
      opener: null,
    };
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as never);

    const element = document.createElement('a');
    setLinkAttributes(element, 'https://example.com', '_blank');
    document.body.append(element);

    bindDeferredLinks(document.body, {
      filterExternalRequests: {
        links: (url) => Promise.resolve(url),
      },
    } as MermaidConfig);

    element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();

    expect(open).toHaveBeenCalledWith('', '_blank', 'noopener');
    expect(popup.location.replace).toHaveBeenCalledWith('https://example.com');
  });
});
