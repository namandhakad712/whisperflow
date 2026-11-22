const { app, BrowserWindow } = require("electron");
const path = process.argv[process.argv.length - 1];
app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 400, height: 300, show: true, backgroundColor: "#050505" });
  win.loadFile(path);
});