/**
 * L'aide des raccourcis clavier, ouverte avec « ? ».
 */

import { SHORTCUT_HELP } from "../playback";
import { createElement } from "./dom";

export type HelpOverlay = {
	readonly toggle: () => void;
	readonly close: () => void;
};

export function createHelpOverlay(container: HTMLElement): HelpOverlay {
	const backdrop = createElement("div", "help-backdrop");
	backdrop.hidden = true;
	const dialog = createElement("div", "help-dialog");
	dialog.setAttribute("role", "dialog");
	dialog.setAttribute("aria-label", "Raccourcis clavier");
	dialog.append(createElement("h2", "panel-title", "Raccourcis clavier"));

	const list = createElement("dl", "shortcut-list");
	for (const { keys, description } of SHORTCUT_HELP) {
		list.append(
			createElement("dt", "", keys),
			createElement("dd", "", description),
		);
	}
	dialog.append(list);
	backdrop.append(dialog);
	container.appendChild(backdrop);

	const close = () => {
		backdrop.hidden = true;
	};
	// Un clic hors de la fenêtre la ferme.
	backdrop.addEventListener("click", (event) => {
		if (event.target === backdrop) close();
	});

	return {
		toggle: () => {
			backdrop.hidden = !backdrop.hidden;
		},
		close,
	};
}
