const { contextBridge, ipcRenderer } = require("electron");

let bridgeObserver = null;
const recentCues = new Set();
let lastParsedMessageNode = null;

// 🔁 Cue parser — matches only fully formed cues ending with "::" followed by newline or end
function parseShellCueText(text) {
  const fullCuePattern = /^ShellCue::([^:\n]+)::([^:\n]+)::([\s\S]*?)::(?:\n|$)/gm;
  let match;

  const seenCues = [];

  while ((match = fullCuePattern.exec(text)) !== null) {
    const [raw, opcode, target, payloadRaw] = match;

    const cueKey = raw.trim();
    if (recentCues.has(cueKey)) continue;

    recentCues.add(cueKey);
    seenCues.push(cueKey);
    setTimeout(() => recentCues.delete(cueKey), 2000);

    const payload = (payloadRaw || "").trim();
    ipcRenderer.send("shellcue", { opcode, target, payload });
  }

  if (seenCues.length === 0 && text.includes("ShellCue::")) {
    console.warn("[ShellCue] ⚠️ Detected partial or malformed cue — holding off");
  }
}

// 🛰️ Observer — aggregates all visible text from last AI message
function startBridgeListener() {
  if (bridgeObserver) {
    console.log("[ShellCue] Listener already active.");
    return;
  }

  let mutationTimeout = null;
  let responseStableTimer = null;
  let lastMessageText = "";

  bridgeObserver = new MutationObserver(() => {
    if (mutationTimeout) clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(() => {
      const messages = Array.from(
        document.querySelectorAll('[class*="group/ai-message-item"]')
      );
      const lastMessage = messages.at(-1);
      if (!lastMessage || lastMessage === lastParsedMessageNode) return;

      const currentText = Array.from(lastMessage.querySelectorAll("p, pre, code, span"))
        .map(el => el.innerText || "")
        .join("\n")
        .trim();

      if (currentText === lastMessageText) {
        console.log("[ShellCue] 🧘 Message stable — parsing...");
        parseShellCueText(currentText);
        lastParsedMessageNode = lastMessage;
      } else {
        lastMessageText = currentText;
        clearTimeout(responseStableTimer);
        responseStableTimer = setTimeout(() => {
          mutationTimeout = setTimeout(() => { }, 0);
        }, 500);
      }
    }, 300);
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

// 🌉 Bridge API
contextBridge.exposeInMainWorld("copilotBridge", {
  sendShellCue: (opcode, target, payload) =>
    ipcRenderer.send("shellcue", { opcode, target, payload }),

  parseShellCueText,

  toggleBridge: {
    on: () => startBridgeListener(),
    off: () => stopBridgeListener()
  }
});

// 🚀 Cue injection
ipcRenderer.on("shellcue-inject", (_event, cueText) => {
  const input = document.querySelector("textarea");
  if (!input) {
    console.warn("[ShellCue] ❌ Input box not found.");
    return;
  }

  input.value = cueText;
  input.dispatchEvent(new Event("input", { bubbles: true }));

  setTimeout(() => {
    const sendBtn = document.querySelector('[data-testid="submit-button"]');
    if (!sendBtn) {
      console.warn("[ShellCue] ❌ Submit button not found.");
      return;
    }

    sendBtn.click();
    console.log("[ShellCue] 🚀 Cue injected and sent:", cueText);
  }, 100);
});

// 🧪 Toggle button
window.addEventListener("DOMContentLoaded", () => {
  console.log("🌐 preload.js loaded — bridge is off by default");

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
      startBridgeListener();
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
