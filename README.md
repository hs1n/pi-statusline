# Status Line Extension for Pi

This extension provides a lightweight, real‑time status bar for the [Pi Coding Agent](https://github.com/earendil-works/pi-coding-agent). It shows compact turn progress, Git status, and tool execution statistics while leaving model, context, and working-directory details to Pi’s built-in footer. The UI is minimal and non‑intrusive, making it suitable for terminal sessions.

---

## Features
- **Session start**: Displays a compact `Ready` state; Pi’s built-in footer supplies the active model and thinking level.
- **Git status**: Shows the current branch, working-tree change count, and upstream ahead/behind counts when the cwd is a Git repository.
- **Compact status line**: Omits cwd, model, and token usage because Pi’s built-in footer already displays them.
- **Turn start**: Shows Git status and a “Processing…​” indicator.
- **Turn end**: Shows elapsed time, tool count, tool errors, tool execution time, and a ✔️/✗ result mark.
- **Tool execution start**: Shows which tool is running and how many times it’s been invoked during the turn.

Git is queried asynchronously with a short timeout. Non-Git directories and Git command failures are ignored so they never prevent Pi from working.

## Installation

Install from GitHub (recommended, pinned to the `v1.0.0` tag):

```bash
pi install git:github.com/hs1n/pi-statusline@v1.0.0
```

To track the latest development state instead, install from `main`:

```bash
pi install git:github.com/hs1n/pi-statusline@main
```

To try a checkout of this repository without installing it:

```bash
pi -e ./            # from inside the repo
pi -e git:github.com/hs1n/pi-statusline@v1.0.0
```

After installing, reload Pi or restart your session to load the extension:

```bash
pi reload
```

The status line appears as the default `statusline` UI element. You can change its name by editing the first argument to `setStatus` if you want to display it elsewhere.

> **Single-file alternative**: if you prefer not to install the package, copy `extensions/statusline.ts` into `~/.pi/extensions/` and restart Pi. No additional dependencies are required.

## Package

This repository is a **Pi package**. It contains a `package.json` with a `pi` key that declares the extension location. Install it directly from GitHub as shown above.

## Development

The entrypoint lives in `extensions/statusline.ts`; turn statistics are handled by `extensions/turn-accounting.ts`, and Git snapshots by `extensions/git-snapshot.ts`.

Run the checks locally (also enforced by CI on push and pull requests):

```bash
bun install
bun run build   # type-check and emit dist/
bun test
```

## License
MIT