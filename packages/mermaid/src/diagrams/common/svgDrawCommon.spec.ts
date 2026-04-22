import { beforeEach, describe, expect } from 'vitest';
import type { MermaidConfig } from '../../config.type.js';
import * as configApi from '../../config.js';
import { jsdomIt } from '../../tests/util.js';
import { drawImage } from './svgDrawCommon.js';
import type { SVGGroup } from '../../diagram-api/types.js';

describe('svgDrawCommon.drawImage', () => {
  beforeEach(() => {
    configApi.setSiteConfig({});
  });

  jsdomIt('sets image href when policy allows URL', async ({ svg }) => {
    configApi.setSiteConfig({
      imageUrlPolicy: ({ url }) => url,
    } as MermaidConfig);

    const group = svg.append('g') as unknown as SVGGroup;
    drawImage(group, 10, 20, 'https://example.com/allowed.png');

    await Promise.resolve();
    await Promise.resolve();

    const svgNode = svg.node()!;
    const imageElement = svgNode.querySelector('image');
    expect(imageElement).not.toBeNull();
    const href = imageElement?.getAttribute('xlink:href') ?? imageElement?.getAttribute('href');
    expect(href).toBe('https://example.com/allowed.png');
  });

  jsdomIt('removes image element when policy blocks URL', async ({ svg }) => {
    configApi.setSiteConfig({
      imageUrlPolicy: () => null,
    } as MermaidConfig);

    const group = svg.append('g') as unknown as SVGGroup;
    drawImage(group, 10, 20, 'https://example.com/blocked.png');

    await Promise.resolve();
    await Promise.resolve();

    expect(svg.node()!.querySelector('image')).toBeNull();
  });

  jsdomIt('sanitizes allowed URL before assigning href', async ({ svg }) => {
    configApi.setSiteConfig({
      imageUrlPolicy: () => 'javascript:alert(1)',
    } as MermaidConfig);

    const group = svg.append('g') as unknown as SVGGroup;
    drawImage(group, 10, 20, 'https://example.com/blocked-by-sanitizer.png');

    await Promise.resolve();
    await Promise.resolve();

    expect(svg.node()!.querySelector('image')).toBeNull();
  });
});
