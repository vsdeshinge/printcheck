const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
  });

  mainWindow.loadFile("index.html");
  mainWindow.webContents.openDevTools({ mode: "detach" });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("print-receipt-pdf", async (_evt, html) => {
  let printWindow;
  try {
    console.log("===== PRINT HANDLER START =====");
    if (typeof html !== "string" || !html.trim()) {
      return { ok: false, error: "Empty HTML received" };
    }

    const desktopPdf = path.join(app.getPath("desktop"), "last_receipt.pdf");
    console.log("Saving PDF to:", desktopPdf);

    // Hidden render window (DO NOT enable sandbox; it can break PDF render in some setups)
    printWindow = new BrowserWindow({
      show: false,
      webPreferences: { contextIsolation: true },
    });

    const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(html);
    await printWindow.loadURL(dataUrl);
    console.log("Loaded HTML into hidden window");

    // 80mm = 80,000 microns
    const pdfData = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: { width: 80000, height: 600000 }, // 600mm height
      marginsType: 1,
    });

    fs.writeFileSync(desktopPdf, pdfData);
    console.log("PDF saved OK. Bytes:", pdfData.length);

    // Close the render window
    try { printWindow.close(); } catch {}
    printWindow = null;

    const PRINTER_QUEUE = "EPSON_TM_T82X_S_A";
    const LP_BIN = "/usr/bin/lp";

    console.log("Sending to printer via lp (no options):", PRINTER_QUEUE);

    return await new Promise((resolve) => {
      execFile(LP_BIN, ["-d", PRINTER_QUEUE, desktopPdf], (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || err.message || "").trim();
          console.log("LP ERROR:", msg);
          resolve({ ok: false, error: msg || "lp failed" });
          return;
        }
        console.log("LP OK:", (stdout || "").trim());
        resolve({ ok: true, job: (stdout || "").trim(), savedPdf: desktopPdf });
      });
    });
  } catch (e) {
    console.log("PRINT ERROR:", e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  } finally {
    try { if (printWindow) printWindow.close(); } catch {}
    console.log("===== PRINT HANDLER END =====");
  }
});