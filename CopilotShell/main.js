const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL("https://copilot.microsoft.com"); // or your local HTML
}

// 🧠 ShellCue handler
ipcMain.on("shellcue", async (_event, { opcode, target, payload }) => {
  if (!opcode || !target || !payload) {
    console.warn("[ShellCue] Ignoring malformed cue");
    return;
  }
  try {
    switch (opcode) {
      case "read_file": {
        const baseDir = path.resolve(__dirname, "..");
        const filePath = path.resolve(baseDir, target);

        console.log("[ShellCue] Reading from:", filePath);
        const content = await fs.promises.readFile(filePath, "utf-8");

        const cue = `ShellCue::file_content::${target}::${content}`;

        const escaped = cue.replace(/ShellCue::/g, "▸ShellCue::");
        mainWindow.webContents.send("shellcue-inject", escaped);
        break;
      }

      case "write_file": {
        const baseDir = path.resolve(__dirname, "..");
        const filePath = path.resolve(baseDir, target);

        // Ensure parent directory exists
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

        // Write the file with explicit mode
        await fs.promises.writeFile(filePath, payload, {
          encoding: "utf-8",
          flag: "w" // 'w' = write (create if not exists, overwrite if exists)
        });

        const cue = `ShellCue::log::write_file::Wrote to ${target}`;

        const escaped = cue.replace(/ShellCue::/g, "▸ShellCue::");
        mainWindow.webContents.send("shellcue-inject", escaped);
        break;
      }

      case "log": {
        console.log(`[ShellCueLog] ${target}::${payload}`);
        break;
      }

      default: {
        if (typeof opcode !== "string" || !opcode.match(/^[a-z_]+$/)) return;
        console.warn(`[ShellCue] Unknown opcode: ${opcode}`);
        break;
      }
    }
  } catch (err) {
    console.error(`[ShellCue] Error handling ${opcode}::${target}`, err);
    const cue = `ShellCue::log::error::${opcode} ${target} failed: ${err.message}`;
    const escaped = cue.replace(/ShellCue::/g, "▸ShellCue::");
    mainWindow.webContents.send("shellcue-inject", escaped);
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
