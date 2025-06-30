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
  try {
    switch (opcode) {
      case "read_file": {
        const baseDir = path.resolve(__dirname, "..");
        const filePath = path.resolve(baseDir, target);

        console.log("[ShellCue] Reading from:", filePath);
        const content = await fs.promises.readFile(filePath, "utf-8");

        const cue = `ShellCue::file_content::${target}::${content}`;
        mainWindow.webContents.send("shellcue-inject", cue);
        break;
      }

      case "write_file": {
        const filePath = path.resolve(__dirname, target);
        await fs.promises.writeFile(filePath, payload, "utf-8");

        const cue = `ShellCue::log::write_file::Wrote to ${target}`;
        mainWindow.webContents.send("shellcue-inject", cue);
        break;
      }

      case "log": {
        console.log(`[ShellCueLog] ${target}::${payload}`);
        break;
      }

      default: {
        console.warn(`[ShellCue] Unknown opcode: ${opcode}`);
        break;
      }
    }
  } catch (err) {
    console.error(`[ShellCue] Error handling ${opcode}::${target}`, err);
    const cue = `ShellCue::log::error::${opcode} ${target} failed: ${err.message}`;
    mainWindow.webContents.send("shellcue-inject", cue);
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
