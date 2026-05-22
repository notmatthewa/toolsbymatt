export interface KeyBinds {
  // Deck A
  playA: string;
  cueA1: string;
  cueA2: string;
  cueA3: string;
  cueA4: string;
  loopA: string;
  // Deck B
  playB: string;
  cueB1: string;
  cueB2: string;
  cueB3: string;
  cueB4: string;
  loopB: string;
  // Crossfader
  crossLeft: string;
  crossCenter: string;
  crossRight: string;
}

export const DEFAULT_KEYBINDS: KeyBinds = {
  playA: "q",
  cueA1: "1",
  cueA2: "2",
  cueA3: "3",
  cueA4: "4",
  loopA: "5",
  playB: "p",
  cueB1: "7",
  cueB2: "8",
  cueB3: "9",
  cueB4: "0",
  loopB: "6",
  crossLeft: "z",
  crossCenter: "x",
  crossRight: "c",
};

const STORAGE_KEY = "yt-dj-keybinds";

export function loadKeybinds(): KeyBinds {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_KEYBINDS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_KEYBINDS };
}

export function saveKeybinds(binds: KeyBinds) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(binds));
}

export const BIND_LABELS: Record<keyof KeyBinds, string> = {
  playA: "Play/Pause A",
  cueA1: "Cue A-1",
  cueA2: "Cue A-2",
  cueA3: "Cue A-3",
  cueA4: "Cue A-4",
  loopA: "Loop A",
  playB: "Play/Pause B",
  cueB1: "Cue B-1",
  cueB2: "Cue B-2",
  cueB3: "Cue B-3",
  cueB4: "Cue B-4",
  loopB: "Loop B",
  crossLeft: "Crossfade → A",
  crossCenter: "Crossfade center",
  crossRight: "Crossfade → B",
};
