import { describe, expect, it, vi } from 'vitest';
import type { MermaidConfig } from '../config.type.js';
import { resolveImageUrl } from './imageUrlPolicy.js';

describe('resolveImageUrl', () => {
  const config = {} as MermaidConfig;

  it('returns null for empty urls', async () => {
    await expect(resolveImageUrl('', config)).resolves.toBeNull();
  });

  it('uses original url when no policy is configured', async () => {
    await expect(resolveImageUrl('https://example.com/image.png', config)).resolves.toBe(
      'https://example.com/image.png'
    );
  });

  it('uses rewritten url from policy', async () => {
    const rewrittenUrl = 'https://trusted.example/rewritten-image.png';
    const policy = vi.fn().mockResolvedValue(rewrittenUrl);

    await expect(
      resolveImageUrl('https://example.com/image.png', {
        imageUrlPolicy: policy,
      } as MermaidConfig)
    ).resolves.toBe(rewrittenUrl);
    expect(policy).toHaveBeenCalledWith({ url: 'https://example.com/image.png' });
  });

  it('returns null when policy blocks the url', async () => {
    await expect(
      resolveImageUrl('https://example.com/image.png', {
        imageUrlPolicy: () => null,
      } as MermaidConfig)
    ).resolves.toBeNull();
  });

  it('returns null when policy throws', async () => {
    await expect(
      resolveImageUrl('https://example.com/image.png', {
        imageUrlPolicy: () => {
          throw new Error('policy failed');
        },
      } as MermaidConfig)
    ).resolves.toBeNull();
  });

  it('uses the nested filterExternalRequests.urls callback', async () => {
    const urls = vi.fn().mockResolvedValue('/safe/image.png');

    await expect(
      resolveImageUrl('https://example.com/image.png', {
        filterExternalRequests: {
          urls,
        },
      } as MermaidConfig)
    ).resolves.toBe('/safe/image.png');
    expect(urls).toHaveBeenCalledWith('https://example.com/image.png');
  });

  it('blocks external URLs in conservative mode', async () => {
    await expect(
      resolveImageUrl('https://example.com/image.png', {
        filterExternalRequests: true,
      } as MermaidConfig)
    ).resolves.toBeNull();
  });
});
