import type { MermaidConfig } from '../config.type.js';
import { resolveExternalRequestUrl } from './filterExternalRequests.js';

export const resolveImageUrl = async (
  url: string,
  config: MermaidConfig
): Promise<string | null> => {
  return resolveExternalRequestUrl(url, config);
};
