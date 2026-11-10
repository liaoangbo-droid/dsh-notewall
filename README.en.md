# NoteWall

**English** · [中文](README.md)

A sticky-note wall for DeepSeek Harness. Jot something on the left rail, drag it into a session when you need it.

![Sticky wall](docs/screenshot.png)

## Scheduled delivery

**A note can be a letter to a session you haven't opened yet.**

Hit **Send to session** on a note, pick a target session, switch to **Schedule**, choose a time. When the moment arrives, the content is delivered to that session as a message — no need to sit and wait.

![Send to session](docs/deliver-to-session.png)

- **12:00 / 18:00 shortcut buttons** — those are the start of DeepSeek's off-peak billing windows. One click puts your note in the half-price window.
- **Past times are rejected** instead of failing silently.
- **Visible on the card** — a scheduled note shows ⏰ and its time, and can be cancelled at any point.
- The same entry point also supports **send now** (arrives in ~2s), for quick hand-offs.

Because delivery goes through the kernel scheduler, a note can wake a cold session. That's what separates this from copy-and-paste.

## Everything else

**Capture**
- Rich text (bold / italic / lists / headings), images inserted at the cursor, freehand ink pad — auto-saved with a 400ms debounce.
- New notes get their hue from the **golden angle (137.5°)** so adjacent cards stay distinguishable, the wall keeps an even lightness, and colors never repeat.

**Browse**
- Grid wall ordered by creation time, pinned notes first; cards show a folded preview that expands on click.
- Hover a card to zoom it — the font size and preview area grow with it.

**Organize**
- Drag to reorder: a blue insertion line appears between cards and the rest slide out of the way.
- Wall settings: solid/image (with dim overlay)/transparent background, column count, card width/height, gap, font size, hover scale, new-note color mode.
- Chinese/English UI — follows the browser language, or lock it in **Wall settings → Language**.

## Install

```bash
git clone https://github.com/liaoangbo-droid/dsh-notewall.git
cd dsh-notewall
dsh plugin --profile web add "$PWD"
# restart the DSH kernel (host plugins have no hot reload)
```

`lib/client.js` ships with the repo — **no build step needed**. Only rebuild with `node scripts/build-client.mjs` if you change anything under `client/`.

## Model tools

| Tool | Purpose |
|---|---|
| `sticky_note_create` | Create a note (**must ask the user first**) |
| `sticky_note_list` | List notes (read-only) |
| `sticky_note_update` | Edit body / color / pin / alarm time |
| `sticky_note_delete` | Delete a note (**must ask the user first**) |

Creating and deleting are user-visible side effects; the tool descriptions say "ask first", and there is no silent path around it in the implementation.

## Known limitations

- Alarms need the page open: nothing fires while it's closed, and missed ones pop up when you return.
- Hover zoom is mouse-only; on touch devices a tap opens the editor directly.
- "Send now" goes through the kernel scheduler (`at = now + 1500ms`), hence the ~2s delay — that margin is deliberate.
- Read endpoints (`GET /state`, `/media/*`) have no auth. The server listens on `127.0.0.1` only; if you put it behind a reverse proxy, add auth at the proxy.
- Note bodies are restricted HTML without tables or code blocks (`script` / `style` / `iframe` / `on*` are stripped host-side).

## License

MIT · see [Releases](https://github.com/liaoangbo-droid/dsh-notewall/releases)
