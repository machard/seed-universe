const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");

// Safe API exposed to renderer
contextBridge.exposeInMainWorld("copilotBridge", {
  handshakePing: (payload) => ipcRenderer.send("handshake-ping", payload),
  echoConfirmed: (stepId, data) =>
    ipcRenderer.send("echo-confirmed", { stepId, data })
});

contextBridge.exposeInMainWorld("electron", {
  sendShellCue: (opcode, target, payload) =>
    ipcRenderer.send("shellcue", { opcode, target, payload })
});

// ShellCue parser — processes system-level DOM instructions
function parseShellCue(text) {
  const prefix = "ShellCue::";
  const lines = text.split("\n").filter((line) => line.startsWith(prefix));
  for (const line of lines) {
    const parts = line.slice(prefix.length).split("::");
    if (parts.length < 3) continue;

    const [opcode, target, ...rest] = parts;
    const payload = rest.join("::"); // preserve separators in payload

    console.log("[ShellCue] Parsed:", { opcode, target, payload });
    window.electron.sendShellCue(opcode, target, payload);
  }
}

// Mutation observer for DOM cues
window.addEventListener("DOMContentLoaded", () => {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const node = mutation.target;
      const text = node?.innerText || node?.textContent || "";
      if (text.includes("ShellCue::")) {
        parseShellCue(text);
      }

      const match = text.match(/(resume|ignite|return|joke):([a-z0-9\-_]+)/i);
      if (match) {
        const cue = match[0];
        console.log("[CopilotShell] Cue matched:", cue);
        ipcRenderer.send("handshake-ping", { cue });
      }
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true
  });
});
