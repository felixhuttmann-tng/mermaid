import { beforeEach, describe, expect, it, vi } from 'vitest';

const decodeMock = vi.fn().mockResolvedValue(undefined);

vi.mock('./util.js', () => {
  const chainable = () => {
    const proxy: any = new Proxy(() => proxy, {
      get: (_target, property) => (property === 'then' ? undefined : proxy),
      apply: () => proxy,
    });
    return proxy;
  };
  return {
    labelHelper: vi.fn().mockResolvedValue({
      shapeSvg: chainable(),
      bbox: { width: 100, height: 50, x: 0, left: 0 },
      halfPadding: 5,
      label: chainable(),
    }),
    updateNodeBounds: vi.fn(),
  };
});

vi.mock('./handDrawnShapeStyles.js', () => ({
  styles2String: vi.fn().mockReturnValue({ labelStyles: '' }),
  userNodeOverrides: vi.fn().mockReturnValue({}),
}));

vi.mock('../intersect/index.js', () => ({
  default: {
    rect: vi.fn(),
    polygon: vi.fn(),
  },
}));

vi.mock('roughjs', () => ({
  default: {
    svg: () => ({
      rectangle: () => document.createElementNS('http://www.w3.org/2000/svg', 'rect'),
    }),
  },
}));

describe('imageSquare', () => {
  beforeEach(() => {
    class MockImage {
      src = '';
      naturalWidth = 120;
      naturalHeight = 60;
      decode = decodeMock;
    }

    vi.stubGlobal('Image', MockImage);
    decodeMock.mockClear();
  });

  it('does not decode image when policy blocks URL', async () => {
    const { imageSquare } = await import('./imageSquare.js');

    const parent: any = {
      insert: () => parent,
      attr: () => parent,
      append: () => parent,
    };

    const node: any = {
      id: 'n1',
      img: 'https://example.com/image.png',
      label: 'test',
      constraint: 'off',
      pos: 'b',
      look: 'classic',
    };

    await imageSquare(parent, node, {
      config: {
        flowchart: { wrappingWidth: 200 },
        imageUrlPolicy: () => null,
      } as any,
    });

    expect(decodeMock).not.toHaveBeenCalled();
  }, 10_000);
});
