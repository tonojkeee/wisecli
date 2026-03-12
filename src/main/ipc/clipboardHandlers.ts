import { ipcMain, clipboard } from "electron";

export function registerClipboardHandlers(): void {
  // Read text from clipboard
  ipcMain.handle("clipboard:read-text", () => {
    return clipboard.readText();
  });

  // Write text to clipboard
  ipcMain.handle("clipboard:write-text", (_event, text: string) => {
    clipboard.writeText(text);
  });
}
