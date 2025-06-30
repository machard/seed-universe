console.log("🧠 CopilotShell main process booted.");

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const fileManager = require("./helpers/fileManager");

const shellcueLogPath = path.join(__dirname, "..", ".shellcue.log");

function appendShellCueLog(opcode, target, payload) {
  const line = `[${new Date().toISOString()}] ${opcode}::${target}::${payload}\n`;
  fs.appendFile(shellcueLogPath, line, (err) => {
    if (err) console.error("[ShellCueLog] Failed to write:", err);
  });
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false
    },
    title: "CopilotShell"
  });

  mainWindow.loadURL("https://copilot.microsoft.com");

  // Optional: mainWindow.webContents.openDevTools();

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// 🛰 Cue recognition (e.g. resume:, ignite:)
ipcMain.on("handshake-ping", (event, payload) => {
  console.log("[CopilotShell] Received handshake ping:", payload);
});

// ✅ Echo confirmation handler
ipcMain.on("echo-confirmed", (event, { stepId, data }) => {
  const { status = "complete", description = null, imageBase64 = null } = data || {};
  const updated = fileManager.updateEchoStatus(stepId, status, description);
  const imageSaved = imageBase64 ? fileManager.saveEchoImage(stepId, imageBase64) : true;

  const success = updated && imageSaved;
  console.log(`[CopilotShell] Echo update for ${stepId}: ${success ? "✅" : "❌"}`);

  event.reply("echo-result", {
    stepId,
    status: success ? "synced" : "error",
    image: imageSaved ? "written" : "skipped"
  });
});

// 🧱 ShellCue interpreter
ipcMain.on("shellcue", (event, { opcode, target, payload }) => {
  console.log("[ShellCue] Handling:", opcode, target);
  appendShellCueLog(opcode, target, payload);

  try {
    if (opcode === "update_registry") {
      const data = JSON.parse(payload);
      const success = fileManager.updateEchoStatus(target, data.status, data.description || null);
      console.log(`[ShellCue] Registry update for ${target}: ${success ? "✅" : "❌"}`);
    }

    if (opcode === "write_file") {
      const buffer = Buffer.from(payload, "base64");
      const fullPath = path.join(__dirname, "..", target);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, buffer);
      console.log(`[ShellCue] File written to ${fullPath}`);
    }

    if (opcode === "read_file") {
      const fullPath = path.join(__dirname, "..", target);
      const content = fs.readFileSync(fullPath, "utf8");
      console.log(`[ShellCue] Read ${target}:\n`, content.slice(0, 300));
      // Optional: emit content back to renderer
      event.reply("shellcue-read-result", { target, content });
    }

    if (opcode === "log") {
      console.log(`[ShellCueLog] ${opcode}::${target}::${payload}`);
      appendShellCueLog(opcode, target, payload);
    }

  } catch (err) {
    console.error("[ShellCue] Execution error:", err);
  }
});
