# Technical Research Notes

## Yjs update binary encoding vs JSON

Yjs uses compact binary updates rather than shipping the whole document as JSON each time. This is better for collaborative editing because:

- updates are incremental
- payload size is smaller
- merges are deterministic
- network traffic stays lower under concurrent edits

JSON snapshots are still useful for:

- debugging
- export
- server-side version previews

But JSON is not the ideal transport for high-frequency collaborative operations.

## PostgreSQL persistence

There are two layers of persistence in this project:

1. Metadata persistence
- users
- folders
- access roles
- invites
- saved document title/content

2. Snapshot persistence
- server-side `DocumentVersion` entries for restore/history

This is a practical hybrid approach even though full Yjs binary update persistence could be added later for stronger offline replay and lower-latency rehydration.

## Cursor sync

Cursor location should not be stored as durable document state. It is presence state, so it travels through awareness only.

That means:

- cursor movement is real time
- disconnects do not pollute document history
- active indicators disappear naturally when awareness is lost

## Version snapshot cadence

Snapshots should not be created on every keystroke because that would grow storage too quickly. A better approach is:

- create snapshot on meaningful save/update
- create snapshot before destructive restore
- cap retained snapshots per document

Current implementation keeps a bounded server-side list per document.

## PDF export with Puppeteer

Server-side PDF export is useful because:

- output is consistent across clients
- users do not need to rely on browser print styling
- branded export templates can be added later

Tradeoffs:

- Chromium dependency increases backend footprint
- container environments may need extra install time/resources
- export throughput should be queued/throttled if usage becomes high

## Performance notes

- Awareness should remain ephemeral and lightweight.
- Server version retention should stay bounded.
- Rich text export and PDF generation should stay on demand instead of running during editing.
- If collaboration scale grows, the next optimization would be persisting Yjs binary updates directly instead of only storing serialized HTML/content snapshots.
