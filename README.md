# RecipeManagement

Image management and AI analysis project. The codebase is being modularized so the UI, styles, and AI logic are easier to maintain.

## Project Layout

```text
src/
  css/
    style.css
    layout.css
    analysis.css
    gallery.css
    modules.css
  js/
    ai/
      ai.js
      ai-state-config.js
      ai-api-vision.js
      ai-knowledge-data.js
      ai-knowledge-ui.js
      ai-analysis.js
      ai-specialist.js
    core/
      gallery.js
    features/
      image-management.js
```

## CSS

| File | Purpose |
| --- | --- |
| `src/css/style.css` | CSS entry point that imports the feature files below. |
| `src/css/layout.css` | Base layout, sidebar, toolbar, knowledge tabs, and shared dialog styles. |
| `src/css/analysis.css` | AI analysis page styles. |
| `src/css/gallery.css` | Image grid, cards, compare modal, zoom view, and detail modal styles. |
| `src/css/modules.css` | Toasts, drag-and-drop upload, category management, dialog, and model UI styles. |

## JavaScript

| File | Purpose |
| --- | --- |
| `src/js/ai/ai.js` | AI entry point that loads the split AI modules in order. |
| `src/js/ai/ai-state-config.js` | AI state, storage, API configuration, and model state. |
| `src/js/ai/ai-api-vision.js` | Vision-model analysis helpers and AI request flow. |
| `src/js/ai/ai-knowledge-data.js` | Knowledge-base data, good answers, and error-case data. |
| `src/js/ai/ai-knowledge-ui.js` | Knowledge-base, good-answer, and error-case UI behaviors. |
| `src/js/ai/ai-analysis.js` | Main AI analysis flow, conversation history, message rendering, PDF export, and feedback handling. |
| `src/js/ai/ai-specialist.js` | Specialist knowledge-base defaults and topic-analysis bootstrap logic. |
| `src/js/core/gallery.js` | Gallery core pipeline: filtering, batched rendering, search debounce, selection syncing, and lazy image activation. |
| `src/js/features/image-management.js` | Legacy feature bundle that still hosts IndexedDB access, import/export, category management, compare view, detail panel, and page bootstrap. |

## Notes

- The project is being modularized incrementally so the app can keep running while larger files are split into smaller modules.
- `index.html` now references `src/css/style.css`.
- The root-level `style.css` has been moved into `src/css/`.
