const { contextBridge, ipcRenderer } = require("electron");

let bridgeObserver = null;
const recentCues = new Set();
let lastParsedMessageNode = null;

// 🔁 Cue parser with deduplication
function parseShellCueText(text) {
  const prefix = "ShellCue::";
  const lines = text.includes("\n") ? text.split("\n") : [text];

  for (const line of lines) {
    if (!line.startsWith(prefix)) continue;

    const cueKey = line.trim();
    if (recentCues.has(cueKey)) continue;
    recentCues.add(cueKey);
    setTimeout(() => recentCues.delete(cueKey), 2000);

    const parts = cueKey.slice(prefix.length).split("::").filter(Boolean);
    if (parts.length < 2) continue;

    const [opcode, target, ...rest] = parts;
    const payload = rest.join("::") || "";

    ipcRenderer.send("shellcue", { opcode, target, payload });
  }
}

// 🛰️ DOM observer (scoped to last message)
function startBridgeListener() {
  if (bridgeObserver) {
    console.log("[ShellCue] Listener already active.");
    return;
  }

  let mutationTimeout = null;

  bridgeObserver = new MutationObserver(() => {
    if (mutationTimeout) clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(() => {
      const messages = Array.from(
        document.querySelectorAll('[class*="group/ai-message-item"]')
      );
      const lastMessage = messages.at(-1);

      if (
        lastMessage &&
        lastMessage !== lastParsedMessageNode &&
        lastMessage.innerText?.includes("ShellCue::")
      ) {
        const matches = lastMessage.innerText.match(/ShellCue::[^\n]+/g);
        if (matches) {
          matches.forEach((cue) => {
            console.log("[ShellCue] Scoped cue detected:", cue);
            parseShellCueText(cue);
          });
          lastParsedMessageNode = lastMessage;
        }
      }
    }, 150);
  });

  bridgeObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log("[ShellCue] 🔴 Scoped bridge listener ON");
}

function stopBridgeListener() {
  if (bridgeObserver) {
    bridgeObserver.disconnect();
    bridgeObserver = null;
    console.log("[ShellCue] 🟢 Bridge listener OFF");
  }
}

// ✅ Expose bridge API to renderer
contextBridge.exposeInMainWorld("copilotBridge", {
  sendShellCue: (opcode, target, payload) =>
    ipcRenderer.send("shellcue", { opcode, target, payload }),

  parseShellCueText,

  toggleBridge: {
    on: () => startBridgeListener(),
    off: () => stopBridgeListener()
  }
});

// 🌐 Initialization
window.addEventListener("DOMContentLoaded", () => {
  console.log("🌐 preload.js loaded — scoped bridge is off by default");
});
