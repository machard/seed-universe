const fs = require("fs");
const path = require("path");

const basePath = path.resolve(__dirname, "..", ".."); // seed-universe root
const registryPath = path.join(basePath, "registry", "tasklet_registry.json");

function readRegistry() {
  try {
    const raw = fs.readFileSync(registryPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[fileManager] Failed to read registry:", err);
    return [];
  }
}

function writeRegistry(data) {
  try {
    const formatted = JSON.stringify(data, null, 2);
    fs.writeFileSync(registryPath, formatted, "utf8");
    return true;
  } catch (err) {
    console.error("[fileManager] Failed to write registry:", err);
    return false;
  }
}

function updateEchoStatus(stepId, newStatus, description = null) {
  const registry = readRegistry();
  const index = registry.findIndex((t) => t.step_id === stepId);
  if (index === -1) return false;

  registry[index].echo.status = newStatus;
  if (description) registry[index].echo.description = description;

  return writeRegistry(registry);
}

function saveEchoImage(stepId, base64) {
  try {
    const buffer = Buffer.from(base64, "base64");
    const echoesPath = path.join(basePath, "echoes", "btc_unwrapping");
    if (!fs.existsSync(echoesPath)) fs.mkdirSync(echoesPath, { recursive: true });

    const fileName = `${stepId.split("-").pop()}.png`;
    const filePath = path.join(echoesPath, fileName);

    fs.writeFileSync(filePath, buffer);
    return true;
  } catch (err) {
    console.error("[fileManager] Failed to save echo image:", err);
    return false;
  }
}

module.exports = {
  readRegistry,
  writeRegistry,
  updateEchoStatus,
  saveEchoImage
};
