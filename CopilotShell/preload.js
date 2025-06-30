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

ipcRenderer.on("shellcue-inject", (_event, cueText) => {
  const input = document.querySelector("textarea");
  if (!input) {
    console.warn("[ShellCue] ❌ Input box not found.");
    return;
  }

  // Step 1: Set value and trigger input
  input.value = cueText;
  input.dispatchEvent(new Event("input", { bubbles: true }));

  // Step 2: Wait for button to appear, then click
  setTimeout(() => {
    const sendBtn = document.querySelector('[data-testid="submit-button"]');
    if (!sendBtn) {
      console.warn("[ShellCue] ❌ Submit button still not found after input.");
      return;
    }

    sendBtn.click();
    console.log("[ShellCue] 🚀 Cue injected and sent:", cueText);
  }, 100); // 100ms delay is usually enough — tweak if needed
});

// 🌐 Initialization
window.addEventListener("DOMContentLoaded", () => {
  console.log("🌐 preload.js loaded — bridge is off by default");

  // 🧩 Create toggle button
  const btn = document.createElement("button");
  btn.id = "shellcue-toggle";
  btn.textContent = "Bridge: OFF";
  btn.style.cssText = `
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 9999;
    padding: 8px 12px;
    font-size: 14px;
    background: #900;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  `;

  let bridgeOn = false;

  btn.onclick = () => {
    bridgeOn = !bridgeOn;
    if (bridgeOn) {
      startBridgeListener(); // 🔄 use local scope
      btn.textContent = "Bridge: ON";
      btn.style.background = "#090";
    } else {
      stopBridgeListener();
      btn.textContent = "Bridge: OFF";
      btn.style.background = "#900";
    }
  };

  document.body.appendChild(btn);
});
