// preload.js — Complete ShellCue Bridge

const { contextBridge, ipcRenderer } = require("electron");

let bridgeObserver = null;
let lastParsedMessageNode = null;
let recentCues = new Set();

function startBridgeListener() {
  const messages = Array.from(document.querySelectorAll('[class*="group/ai-message-item"]'));
  lastParsedMessageNode = messages.at(-1);
  const parsedMessages = new WeakSet();

  bridgeObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      const addedNodes = Array.from(mutation.addedNodes || []);
      for (const node of addedNodes) {
        const el = node.nodeType === 1 ? node : node.parentElement;
        if (!el) continue;

        const messageEl = el.closest('[class*="group/ai-message-item"]');
        if (!messageEl || messageEl.dataset.injected === "true") continue;

        const text = messageEl.innerText;

        // 🎯 Move this right before cue parsing
        if (parsedMessages.has(messageEl)) continue;

        const matches = [...text.matchAll(/ShellCue::([a-z_]+)::([\w\-./]+)::([\s\S]+?)::/g)];

        if (matches.length > 0) {
          parsedMessages.add(messageEl); // 🛡️ mark only when we dispatch
        }

        for (const match of matches) {
          const [_, opcode, target, payload] = match;
          if (!opcode || !target || !payload) continue;

          const cueHash = `${opcode}::${target}::${payload}`;
          if (recentCues.has(cueHash)) continue;
          recentCues.add(cueHash);
          setTimeout(() => recentCues.delete(cueHash), 2000);

          ipcRenderer.send("shellcue", { opcode, target, payload });
        }
      }
    }
  });

  const chatRoot = document.querySelector("main") || document.body;
  bridgeObserver.observe(chatRoot, {
    childList: true,
    subtree: true,
    characterData: true
  });

  console.log("[ShellCue] 🔴 Scoped bridge listener ON");
}

function stopBridgeListener() {
  if (bridgeObserver) {
    bridgeObserver.disconnect();
    bridgeObserver = null;
    console.log("[ShellCue] 🟡 Bridge listener OFF");
  }
}

// 🪢 Inject cues back into Copilot's DOM (for echo/log)
ipcRenderer.on("shellcue-inject", (_event, cueText) => {
  const chatRoot = document.querySelector("main") || document.body;
  const lastMessage = Array.from(chatRoot.querySelectorAll('[class*="group/ai-message-item"]')).at(-1);
  if (!lastMessage) return;

  const cueContainer = document.createElement("div");
  cueContainer.style.padding = "8px";
  cueContainer.style.fontFamily = "monospace";
  cueContainer.style.whiteSpace = "pre-wrap";
  cueContainer.style.borderTop = "1px dashed #ccc";
  lastMessage.dataset.injected = "true";
  cueContainer.innerHTML = `
    <div data-injected="true" style="font-family: monospace; white-space: pre-wrap;">
      <div style="border-top: 1px dashed #ccc; margin-top: 6px; padding-top: 4px;">
        ${cueText.replace(/::/g, "∷")}
      </div>
      <small style="color: gray;">
        ⤷ Injected from shell (escaped to avoid bridge reparse)
      </small>
    </div>
  `;

  lastMessage.appendChild(cueContainer);
});

contextBridge.exposeInMainWorld("ShellCueBridge", {
  start: startBridgeListener,
  stop: stopBridgeListener
});

window.addEventListener("DOMContentLoaded", () => {
  // ✅ Create toggle UI
  if (!document.getElementById("shellcue-toggle")) {
    const btn = document.createElement("button");
    btn.id = "shellcue-toggle";
    btn.textContent = "Bridge: OFF";
    btn.style = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 9999;
      padding: 8px 12px;
      background: gray;
      color: white;
      font-weight: bold;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    btn.onclick = () => {
      const isOn = btn.textContent.includes("ON");
      if (isOn) {
        stopBridgeListener();
        btn.textContent = "Bridge: OFF";
        btn.style.background = "gray";
      } else {
        startBridgeListener();
        btn.textContent = "Bridge: ON";
        btn.style.background = "green";
      }
    };
    document.body.appendChild(btn);
  }
});
