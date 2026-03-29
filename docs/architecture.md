# Collaborative Docs Architecture

## Goals

- Folder-based organization for owned documents
- Real-time collaborative editing with visible cursors
- Rich text editing with headings, formatting, lists, tables, and code blocks
- Share invitations with `view` or `edit` permissions
- Server-backed version history and restore flow
- PDF export for saved documents

## Why CRDT is needed

Collaborative editing needs conflict resolution that works even when multiple users type at the same time. A CRDT lets each client apply local edits immediately and merge remote edits deterministically without central locking. That keeps the editor responsive and avoids overwriting one user's changes with another user's update.

## Yjs usage

- `Y.Doc` is the shared CRDT state for each document room.
- `y-websocket` distributes updates between connected clients.
- `awareness` carries ephemeral presence metadata such as:
  - display name
  - avatar/color
  - active status
  - cursor selection state

## Persistence strategy

- Primary metadata is stored in PostgreSQL through Prisma:
  - `User`
  - `Folder`
  - `Document`
  - `DocumentMember`
  - `DocumentInvite`
  - `DocumentVersion`
- Shared document title/content is persisted through backend update APIs.
- Version snapshots are saved server-side before meaningful document updates and before restore operations.

## Cursor presence architecture

- Each client publishes identity and presence through the Yjs awareness channel.
- `@tiptap/extension-collaboration-cursor` renders remote carets and labels from awareness state.
- Accepted members are loaded from PostgreSQL and shown in the topbar even if they are not currently active.
- Active users are highlighted with a green ring when their awareness state reports focus/visibility.

## Folder organization

- Folders are owner-scoped.
- Documents can be moved into a folder through a dedicated document-folder API.
- Shared documents still respect access control; folder organization is limited to users with edit access.

## Version history strategy

- Server versions are stored in `DocumentVersion`.
- A snapshot is created:
  - before content/title updates
  - when a document is first shared/saved server-side
  - before and after version restore
- Retention is capped per document to avoid unbounded growth.

## PDF export

- Saved documents can be exported through a backend endpoint.
- The server renders the current document HTML into a printable page and converts it to PDF with Puppeteer.
- This keeps export output consistent and independent of the browser print dialog.
