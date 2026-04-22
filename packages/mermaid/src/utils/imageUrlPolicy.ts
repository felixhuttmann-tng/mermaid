import { log } from '../logger.js';
import type { MermaidConfig } from '../config.type.js';

export const resolveImageUrl = async (
  url: string,
  config: MermaidConfig
): Promise<string | null> => {
  if (!url) {
    return null;
  }

  const policy = config.imageUrlPolicy;
  let policyResult: string | null = url;

  if (policy) {
    try {
      policyResult = await policy({ url });
    } catch (error) {
      log.warn('imageUrlPolicy threw, blocking image URL.', error);
      return null;
    }
  }

  if (!policyResult) {
    return null;
  }

  return policyResult;
};
