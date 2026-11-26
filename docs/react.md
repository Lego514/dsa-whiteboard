# Use it in a React app

Every prop and export of the package. Back to the [README](../README.md).

Install it from [npm](https://www.npmjs.com/package/dsa-whiteboard):

```bash
npm install dsa-whiteboard
```

Each version is published from a GitHub release by GitHub Actions, with npm provenance showing the commit it was built from.

React 19.2 or later is a peer dependency. zod 4 is needed only if you import `dsa-whiteboard/schema`.

```tsx
import { Whiteboard, type BoardDoc } from 'dsa-whiteboard';
import 'dsa-whiteboard/base.css'; // design tokens, buttons, inputs, dialog; skip if your app has its own
import 'dsa-whiteboard/board.css';

export function MyBoard({ initial, save }: { initial?: BoardDoc; save: (doc: BoardDoc) => Promise<void> }) {
  return <Whiteboard title="Two Sum" initial={initial} onSave={save} locale="en" onClose={() => history.back()} />;
}
```

The board takes the whole screen. You own the storage: `onSave` is called about 0.6 s after the last change, and once more on close if something is unsaved.

| Prop | What it does |
| --- | --- |
| `initial` | The board to start from. Change the React `key` to load a different board. |
| `onSave(doc)` | Saves the board; may return a promise. |
| `title`, `caption`, `badge` | The header. `badge` sits next to the title, for example a difficulty tag. |
| `actions` | Extra buttons or links in the header, before Export. |
| `savedLabel` | What the header says once saved, such as "Synced". Defaults to "Saved on this device". |
| `locale` | `'en'` or `'zh-TW'`. |
| `onClose` | Shows a Close button. |
| `exportName` | File name for exported PNGs. |
| `onNotice(message)` | Shows messages (such as a failed export) with your app's toasts instead of the board's own. |
| `readOnlySteps`, `startAtStep`, `autoPlay` | For ready-made walkthroughs: `startAtStep` opens playing from that step, `readOnlySteps` makes captions read-only, and `autoPlay` plays through once and stops on the last step. Each step stays up long enough to read its caption. |
| `helpActions` | Extra buttons at the top of the help panel, as `{ label, onSelect }`. The panel closes before `onSelect` runs (the site uses it for “Show the tour again”). |
| `onChange(doc)` | Called right away on every change (and once when the board opens), without waiting for the save delay. |
| `collab` | Joins a live room: `{ url, name, seed?, viewOnly?, onStatus? }`. `url` is the room's WebSocket address on the collab server (`…/room/<room id>` to edit, `…/view/<view id>` to watch; set `viewOnly` with the second), `name` is shown next to your cursor, `seed` puts your board into the room if it's empty (for whoever creates it), and `onStatus` reports the connection and who's there. While in a room, the room's board is the one shown. |
| `explain` | Adds an Explain button that plays the recorded steps. You provide `Session` (shown under the playback bar while explaining) and `Review` (shown over the board when done). LeetCode Coach uses it for spoken explanations with a timer, recording, and transcript. |

Put `<ShareControls>` in `actions` for the share UI: a Share button outside a room, and inside one the people's avatars (click for who's here, change your name, save a copy, leave) plus Copy link. You decide where the room id lives: `onShare()` creates the room and returns its link (copied for you), `viewLink(viewId)` builds the view-only link shown under it, and `link`, `onRename(name)`, `onSaveCopy()`, `onLeave()` handle the rest. While in a room, the header shows the connection status instead of `savedLabel`.

`newRoomId()` makes a random room id, `ROOM_ID` checks one and `VIEW_ID` checks a view id; `PEER_COLORS` lists the colors people get, and `[data-peer="blue"]` (and so on) sets `--peer` to that color for your own avatars.

`dsa-whiteboard/schema` exports the zod schema for a board (`boardDocSchema`), its types, and the size limit, without React, so a server can validate boards before storing them.
