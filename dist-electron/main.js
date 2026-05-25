import { BrowserWindow as e, app as t, shell as n } from "electron";
import r from "path";
import { fileURLToPath as i } from "url";
//#region electron/main.ts
var a = i(import.meta.url), o = r.dirname(a), s = process.env.VITE_DEV_SERVER_URL, c = null;
function l() {
	c = new e({
		width: 1440,
		height: 900,
		minWidth: 1100,
		minHeight: 700,
		center: !0,
		title: "Reflow Profile Console",
		webPreferences: {
			nodeIntegration: !1,
			contextIsolation: !0
		},
		show: !1
	}), c.webContents.setWindowOpenHandler(({ url: e }) => (n.openExternal(e), { action: "deny" })), c.once("ready-to-show", () => {
		c?.show();
	}), s ? c.loadURL(s) : c.loadFile(r.join(o, "../dist/index.html"));
}
process.platform === "win32" && t.setAppUserModelId("com.reflowconsole.app"), t.on("window-all-closed", () => {
	process.platform !== "darwin" && t.quit(), c = null;
}), t.on("activate", () => {
	e.getAllWindows().length === 0 && l();
}), t.whenReady().then(l);
//#endregion
