---
'mermaid': minor
---

feat: add `imageUrlPolicy` to control external image loading

Adds a new secure site-level configuration option, `imageUrlPolicy`, that is called before Mermaid sets image URLs for rendered diagrams.

- Return a string to allow (and optionally rewrite) an image URL.
- Return `null` to block loading for that URL.
- Supports async callbacks for user confirmation workflows.

The policy is enforced across Mermaid image loading paths used by diagram rendering so untrusted diagrams can be safely gated by host applications.
