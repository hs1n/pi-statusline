# Status Line Extension for Pi

This extension provides a lightweight, real‑time status bar for the [Pi Coding Agent](https://github.com/earendil-works/pi-coding-agent). It shows the current model, the thinking level, the current working directory, and the progress of tool executions. The UI is minimal and non‑intrusive, making it suitable for terminal sessions.

---

## Features
- **Session start**: Displays the active model and thinking level.
- **Turn start**: Shows the cwd and a “Processing…​” indicator.
- **Turn end**: Shows elapsed time, number of tools run, and a ✔️ success mark.
- **Tool execution start**: Shows which tool is running and how many times it’s been invoked during the turn.

## Installation
Clone the repository but simply copy the file into your Pi extensions directory:

```bash
mkdir -p ~/.pi/extensions
cp .pi/extensions/statusline.ts ~/.pi/extensions/
```


No additional dependencies are required.

## Usage
- Install the extension:

```bash
pi install ./        # or pi install npm:@hs1n/pi-statusline
```

- Reload Pi or restart your session.

The status line will automatically appear as the default `statusline` UI element. You can change its name by editing the first argument to `setStatus` if you want to display it elsewhere.

## Customization
All rendering logic lives in `statusline.ts`. Feel free to adjust the formatting, add colors, or change the metrics you care about.

---

## Development
The source lives in the `statusline.ts` file. It simply hooks into Pi's event system. Run tests if you add changes.

---

## License
MIT

