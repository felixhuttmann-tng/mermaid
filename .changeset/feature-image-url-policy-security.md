---
'mermaid': minor
---

feat: add `filterExternalRequests` to restrict external requests

Adds a new secure site-level configuration option, `filterExternalRequests`, that can:

- block external resource requests and external links with `filterExternalRequests: true`
- provide async `urls(url)` and `links(url)` callbacks for host-controlled filtering
- strip or sanitize Mermaid-generated custom CSS with `filterCustomCss`

`imageUrlPolicy` remains available as a deprecated alias for `filterExternalRequests.urls`.
