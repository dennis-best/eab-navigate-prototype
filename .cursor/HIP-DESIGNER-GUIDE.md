# HI/P Designer — Cursor quick reference

## Install extensions in Cursor

1. Press **⌘⇧P** (Cmd+Shift+P).
2. Type **Install Exten** and choose **Install Extension**.
3. Select the extension you want (e.g. **Live Preview** — a public extension).

Cursor may also prompt you to install recommended extensions from `.vscode/extensions.json` after running `/hip-designer-init`.

## Slash commands

These commands are defined in `.cursor/commands/` and drive the HI/P static designer workflow.

| Command | When to use |
|---------|-------------|
| `/hip-designer-init` | Run **once per workspace** to set up Live Preview (creates `demos/`, VS Code settings, and extension recommendations). Also install the **Live Preview** extension from Extensions if you have not already. |
| `/hip-designer-image` | Attach a screenshot or mockup to create a **new** static HI/P demo in `demos/<project-name>.html`. |
| `/hip-designer-demo` | Name an existing demo (e.g. `/hip-designer-demo billing-summary`) to make it the **active demo**; follow-up change requests update that file until you switch demos or create a new one with `/hip-designer-image`. |

## Preview a demo

After `/hip-designer-init` and Live Preview are set up:

- Right-click a file in `demos/` and choose **Show Preview**, or
- Open the demo file and click the Live Preview icon in the editor toolbar.

Demos are single self-contained HTML files under `demos/`. See `.cursor/hip/hip-index.md` for agent workflow details.
