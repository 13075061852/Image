# JS Structure

- `ai/ai.js`
  AI analysis, knowledge base, API config, and chat-related behavior.

- `core/gallery.js`
  Gallery core pipeline: filtering, batched rendering, search debounce, selection state syncing, and lazy image activation.

- `features/image-management.js`
  Legacy feature bundle that still hosts IndexedDB access, import/export, category management, compare view, detail panel, and page bootstrap.

This is a first-step modularization so the project can keep running while we continue splitting `features/image-management.js` into smaller feature files.
