import { sanitizeUrl } from '@braintree/sanitize-url';
import type { MermaidConfig } from '../config.type.js';
import { log } from '../logger.js';

const DEFAULT_BASE_URL = 'https://mermaid.local/';
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';
const FILTERED_LINK_URL_ATTR = 'data-mermaid-link-url';
const FILTERED_LINK_TARGET_ATTR = 'data-mermaid-link-target';
const FILTERED_LINK_BOUND_ATTR = 'data-mermaid-link-bound';

type UrlFilter = (url: string) => string | null | Promise<string | null>;
type LinkLikeElement = Element & {
  href?: {
    baseVal?: string;
  };
};

const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href;
  }
  return DEFAULT_BASE_URL;
};

const parseUrl = (url: string) => {
  try {
    return new URL(url, getBaseUrl());
  } catch {
    return null;
  }
};

export const isExternalRequestUrl = (url: string) => {
  if (!url) {
    return false;
  }

  const parsed = parseUrl(url);
  if (!parsed) {
    return false;
  }

  return (
    (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
    parsed.origin !== new URL(getBaseUrl()).origin
  );
};

export const isExternalLinkUrl = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return false;
  }

  const parsed = parseUrl(trimmed);
  if (!parsed) {
    return false;
  }

  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    return parsed.origin !== new URL(getBaseUrl()).origin;
  }

  return !['about:', 'blob:', 'data:'].includes(parsed.protocol);
};

const getUrlFilter = (config: MermaidConfig): UrlFilter | undefined => {
  const filterExternalRequests = config.filterExternalRequests;

  if (
    filterExternalRequests &&
    typeof filterExternalRequests === 'object' &&
    typeof filterExternalRequests.urls === 'function'
  ) {
    return filterExternalRequests.urls;
  }

  if (config.imageUrlPolicy) {
    return (url) => config.imageUrlPolicy!({ url });
  }

  return undefined;
};

const getLinkFilter = (config: MermaidConfig): UrlFilter | undefined => {
  const filterExternalRequests = config.filterExternalRequests;

  if (
    filterExternalRequests &&
    typeof filterExternalRequests === 'object' &&
    typeof filterExternalRequests.links === 'function'
  ) {
    return filterExternalRequests.links;
  }

  return undefined;
};

export const shouldDeferLinkHandling = (config: MermaidConfig) => {
  const filterExternalRequests = config.filterExternalRequests;
  return (
    filterExternalRequests === true ||
    (filterExternalRequests &&
      typeof filterExternalRequests === 'object' &&
      typeof filterExternalRequests.links === 'function')
  );
};

export const hasExternalUrlFilter = (config: MermaidConfig) =>
  config.filterExternalRequests === true || Boolean(getUrlFilter(config));

export const filterCustomCssText = (css: string, config: MermaidConfig) => {
  if (!css) {
    return css;
  }

  const filterExternalRequests = config.filterExternalRequests;

  if (filterExternalRequests === true) {
    return '';
  }

  if (
    filterExternalRequests &&
    typeof filterExternalRequests === 'object' &&
    filterExternalRequests.filterCustomCss
  ) {
    if (filterExternalRequests.filterCustomCss === true) {
      return '';
    }

    try {
      return filterExternalRequests.filterCustomCss(css) ?? '';
    } catch (error) {
      log.warn('filterExternalRequests.filterCustomCss threw, stripping custom CSS.', error);
      return '';
    }
  }

  return css;
};

export const filterCustomStyleDeclarations = (
  styles: string[] | undefined,
  config: MermaidConfig
) => {
  if (!styles?.length) {
    return [];
  }

  const filteredStyles = filterCustomCssText(styles.join(';'), config);
  if (!filteredStyles.trim()) {
    return [];
  }

  return filteredStyles
    .split(';')
    .map((style) => style.trim())
    .filter(Boolean);
};

const sanitizeResolvedUrl = (url: string | null | undefined) => {
  if (!url) {
    return null;
  }

  const sanitizedUrl = sanitizeUrl(url);
  return sanitizedUrl === 'about:blank' ? null : sanitizedUrl;
};

const runUrlFilter = async (
  url: string,
  filter: UrlFilter,
  warningMessage: string
): Promise<string | null> => {
  try {
    return (await filter(url)) ?? null;
  } catch (error) {
    log.warn(warningMessage, error);
    return null;
  }
};

export const resolveExternalRequestUrl = async (
  url: string,
  config: MermaidConfig
): Promise<string | null> => {
  if (!url) {
    return null;
  }

  if (config.filterExternalRequests === true) {
    return isExternalRequestUrl(url) ? null : url;
  }

  const filter = getUrlFilter(config);
  if (!filter) {
    return url;
  }

  return runUrlFilter(url, filter, 'filterExternalRequests.urls threw, blocking URL.');
};

export const resolveExternalLinkUrl = async (
  url: string,
  config: MermaidConfig
): Promise<string | null> => {
  if (!url) {
    return null;
  }

  if (config.filterExternalRequests === true) {
    return isExternalLinkUrl(url) ? null : url;
  }

  const filter = getLinkFilter(config);
  if (!filter) {
    return url;
  }

  return runUrlFilter(url, filter, 'filterExternalRequests.links threw, blocking link.');
};

const removeHrefAttributes = (element: Element) => {
  element.removeAttribute('href');
  element.removeAttributeNS(XLINK_NAMESPACE, 'href');
  element.removeAttribute('xlink:href');
};

export const setLinkAttributes = (element: Element, url: string, target?: string) => {
  removeHrefAttributes(element);
  element.setAttribute(FILTERED_LINK_URL_ATTR, url);
  if (target) {
    element.setAttribute(FILTERED_LINK_TARGET_ATTR, target);
  } else {
    element.removeAttribute(FILTERED_LINK_TARGET_ATTR);
  }
  element.setAttribute('role', 'link');
  element.setAttribute('tabindex', '0');
};

interface D3LikeSelection {
  attr(name: string, value: string | null): D3LikeSelection;
}

export const setD3LinkAttributes = (element: D3LikeSelection, url: string, target?: string) => {
  element
    .attr('href', null)
    .attr('xlink:href', null)
    .attr(FILTERED_LINK_URL_ATTR, url)
    .attr(FILTERED_LINK_TARGET_ATTR, target ?? null)
    .attr('role', 'link')
    .attr('tabindex', '0');
};

const navigateToLink = (sanitizedUrl: string, target: string) => {
  if (!target || target === '_self') {
    window.location.assign(sanitizedUrl);
    return;
  }

  if (target === '_top' || target === '_parent') {
    window.open(sanitizedUrl, target);
    return;
  }

  window.open(sanitizedUrl, target, 'noopener');
};

const bindDeferredLink = (linkElement: LinkLikeElement, config: MermaidConfig) => {
  if (linkElement.getAttribute(FILTERED_LINK_BOUND_ATTR) === 'true') {
    return;
  }
  linkElement.setAttribute(FILTERED_LINK_BOUND_ATTR, 'true');

  const activateLink = async (event: Event) => {
    event.preventDefault();
    event.stopPropagation();

    const rawUrl = linkElement.getAttribute(FILTERED_LINK_URL_ATTR);
    if (!rawUrl) {
      return;
    }

    const target = linkElement.getAttribute(FILTERED_LINK_TARGET_ATTR) ?? '_self';
    const needsPopup = !['_self', '_top', '_parent'].includes(target);
    const popup = needsPopup ? window.open('', target, 'noopener') : null;

    const resolvedUrl = await resolveExternalLinkUrl(rawUrl, config);
    const sanitizedUrl = sanitizeResolvedUrl(resolvedUrl);
    if (!sanitizedUrl) {
      popup?.close();
      return;
    }

    if (popup) {
      popup.location.replace(sanitizedUrl);
      try {
        popup.opener = null;
      } catch {
        // Ignore cross-origin popup restrictions.
      }
      return;
    }

    navigateToLink(sanitizedUrl, target);
  };

  linkElement.addEventListener('click', (event) => {
    void activateLink(event);
  });
  linkElement.addEventListener('keydown', (event) => {
    if (event instanceof KeyboardEvent && (event.key === 'Enter' || event.key === ' ')) {
      void activateLink(event);
    }
  });
};

export const bindDeferredLinks = (element: Element, config: MermaidConfig) => {
  if (!shouldDeferLinkHandling(config)) {
    return;
  }

  const links = element.querySelectorAll<LinkLikeElement>(`[${FILTERED_LINK_URL_ATTR}]`);
  links.forEach((linkElement) => bindDeferredLink(linkElement, config));
};

const filterUrlAttribute = async (
  element: Element,
  attribute: 'src' | 'poster',
  config: MermaidConfig
) => {
  const currentValue = element.getAttribute(attribute);
  if (!currentValue || !hasExternalUrlFilter(config)) {
    return;
  }

  const resolvedUrl = await resolveExternalRequestUrl(currentValue, config);
  const sanitizedUrl = sanitizeResolvedUrl(resolvedUrl);
  if (sanitizedUrl) {
    element.setAttribute(attribute, sanitizedUrl);
  } else {
    element.removeAttribute(attribute);
  }
};

export const filterExternalRequestsInHtml = async (
  markup: string,
  config: MermaidConfig
): Promise<string> => {
  if (!markup || (!hasExternalUrlFilter(config) && !shouldDeferLinkHandling(config))) {
    return markup;
  }

  const template = document.createElement('template');
  template.innerHTML = markup;

  const elements = template.content.querySelectorAll('[src],[poster],[srcset],a[href]');

  for (const element of elements) {
    if (element.hasAttribute('src')) {
      await filterUrlAttribute(element, 'src', config);
    }

    if (element.hasAttribute('poster')) {
      await filterUrlAttribute(element, 'poster', config);
    }

    if (element.hasAttribute('srcset') && hasExternalUrlFilter(config)) {
      element.removeAttribute('srcset');
    }

    if (
      element.tagName === 'A' &&
      element.hasAttribute('href') &&
      shouldDeferLinkHandling(config)
    ) {
      const url = element.getAttribute('href');
      if (url) {
        setLinkAttributes(element, url, element.getAttribute('target') ?? undefined);
      }
    }
  }

  return template.innerHTML;
};

export const applyRenderedLink = (
  element: Element,
  url: string,
  target: string | undefined,
  config: MermaidConfig
) => {
  if (shouldDeferLinkHandling(config)) {
    setLinkAttributes(element, url, target);
    return;
  }

  const sanitizedUrl = sanitizeResolvedUrl(url);
  if (!sanitizedUrl) {
    removeHrefAttributes(element);
    return;
  }

  element.setAttributeNS(XLINK_NAMESPACE, 'xlink:href', sanitizedUrl);
  if ('href' in element) {
    element.setAttribute('href', sanitizedUrl);
  }
  if (target) {
    element.setAttribute('target', target);
  }
};
