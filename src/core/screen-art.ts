/**
 * Ce qu'affiche l'écran d'une machine : un bureau aux couleurs de son
 * système, avec un terminal ouvert. Les logos ne sont pas reproduits
 * (ce sont des marques) : les couleurs et l'invite suffisent à reconnaître
 * le système.
 */

import type { OperatingSystem } from "./topology";

type ScreenSkin = {
	readonly name: string;
	/** Dégradé du fond d'écran, du haut vers le bas. */
	readonly wallpaper: readonly [string, string];
	readonly accent: string;
	/** Les lignes du terminal, telles que le système les affiche. */
	readonly terminalLines: readonly string[];
};

const SCREEN_SKINS: Record<OperatingSystem, ScreenSkin> = {
	"kali-linux": {
		name: "Kali Linux",
		wallpaper: ["#0a1028", "#1f4fa3"],
		accent: "#367bf0",
		terminalLines: ["┌──(kali㉿kali)-[~]", "└─$ ▌"],
	},
	ubuntu: {
		name: "Ubuntu",
		wallpaper: ["#2c001e", "#e95420"],
		accent: "#e95420",
		terminalLines: ["user@ubuntu:~$ ▌"],
	},
	opnsense: {
		name: "OPNsense",
		wallpaper: ["#1c1c1c", "#d94f00"],
		accent: "#d94f00",
		terminalLines: ["root@OPNsense:~ # ▌"],
	},
	other: {
		name: "",
		wallpaper: ["#1b2447", "#26315c"],
		accent: "#4cc9f0",
		terminalLines: ["$ ▌"],
	},
};

export const SCREEN_WIDTH_IN_PX = 512;
export const SCREEN_HEIGHT_IN_PX = 320;

/** Dessine l'écran sur un canvas, prêt à servir de texture. */
export function drawScreen(os: OperatingSystem): HTMLCanvasElement {
	const skin = SCREEN_SKINS[os];
	const canvas = document.createElement("canvas");
	canvas.width = SCREEN_WIDTH_IN_PX;
	canvas.height = SCREEN_HEIGHT_IN_PX;
	const context = canvas.getContext("2d");
	if (context === null) throw new Error("Canvas 2D is not available");

	drawWallpaper(context, skin);
	drawTopBar(context, skin);
	drawTerminal(context, skin);
	return canvas;
}

function drawWallpaper(
	context: CanvasRenderingContext2D,
	{ wallpaper: [top, bottom], name }: ScreenSkin,
): void {
	const gradient = context.createLinearGradient(0, 0, 0, SCREEN_HEIGHT_IN_PX);
	gradient.addColorStop(0, top);
	gradient.addColorStop(1, bottom);
	context.fillStyle = gradient;
	context.fillRect(0, 0, SCREEN_WIDTH_IN_PX, SCREEN_HEIGHT_IN_PX);

	// Le nom du système, en filigrane en bas à droite du bureau.
	context.fillStyle = "rgba(255, 255, 255, 0.85)";
	context.font = "700 40px system-ui, sans-serif";
	context.textAlign = "right";
	context.textBaseline = "alphabetic";
	context.fillText(name, SCREEN_WIDTH_IN_PX - 24, SCREEN_HEIGHT_IN_PX - 24);
}

function drawTopBar(
	context: CanvasRenderingContext2D,
	{ accent }: ScreenSkin,
): void {
	context.fillStyle = "rgba(0, 0, 0, 0.55)";
	context.fillRect(0, 0, SCREEN_WIDTH_IN_PX, 22);
	context.fillStyle = accent;
	context.fillRect(10, 6, 10, 10);
}

function drawTerminal(
	context: CanvasRenderingContext2D,
	{ accent, terminalLines }: ScreenSkin,
): void {
	const left = 28;
	const top = 44;
	const width = 300;
	const height = 150;

	context.fillStyle = "rgba(8, 10, 20, 0.92)";
	context.fillRect(left, top, width, height);
	context.fillStyle = "rgba(255, 255, 255, 0.12)";
	context.fillRect(left, top, width, 18);
	context.fillStyle = accent;
	context.fillRect(left + width - 14, top + 5, 8, 8);

	context.fillStyle = "#e6e9f5";
	context.font = "500 18px ui-monospace, Menlo, monospace";
	context.textAlign = "left";
	context.textBaseline = "top";
	terminalLines.forEach((line, lineIndex) => {
		context.fillText(line, left + 12, top + 30 + lineIndex * 24);
	});
}
