/**
 * Les commandes de lecture et les raccourcis clavier. Les boutons et le
 * clavier passent par les mêmes commandes : ils ne peuvent pas diverger.
 */

import {
	goToStep,
	pause,
	play,
	restart,
	setSpeed,
	stepBackward,
	stepForward,
	type Timeline,
} from "./timeline";

export type TimelineCommand =
	| { readonly kind: "toggle-playback" }
	| { readonly kind: "step-backward" }
	| { readonly kind: "step-forward" }
	| { readonly kind: "restart" }
	| { readonly kind: "go-to-step"; readonly stepIndex: number }
	| { readonly kind: "slower" }
	| { readonly kind: "faster" };

export type ShortcutAction =
	| TimelineCommand
	| { readonly kind: "toggle-help" }
	| { readonly kind: "close-help" };

/** Les vitesses proposées, de la plus lente à la plus rapide. */
export const SPEEDS: readonly number[] = [0.25, 0.5, 1, 2, 4];

/** Ce qu'affiche l'aide des raccourcis. */
export const SHORTCUT_HELP: readonly {
	readonly keys: string;
	readonly description: string;
}[] = [
	{ keys: "Espace", description: "Lecture ou pause" },
	{ keys: "← →", description: "Étape précédente ou suivante" },
	{ keys: "1 à 9", description: "Aller à une étape" },
	{ keys: "R", description: "Recommencer" },
	{ keys: "− +", description: "Plus lent, plus rapide" },
	{ keys: "?", description: "Afficher ou masquer ces raccourcis" },
	{ keys: "Échap", description: "Fermer cette aide" },
];

export function applyTimelineCommand(
	timeline: Timeline,
	command: TimelineCommand,
): Timeline {
	switch (command.kind) {
		case "toggle-playback":
			return timeline.playback === "playing" ? pause(timeline) : play(timeline);
		case "step-backward":
			return stepBackward(timeline);
		case "step-forward":
			return stepForward(timeline);
		case "restart":
			return restart(timeline);
		case "go-to-step":
			return goToStep(timeline, command.stepIndex);
		case "slower":
			return setSpeed(timeline, nextSpeed(timeline.speed, -1));
		case "faster":
			return setSpeed(timeline, nextSpeed(timeline.speed, 1));
		default: {
			const unhandled: never = command;
			throw new Error(`Unhandled command: ${JSON.stringify(unhandled)}`);
		}
	}
}

/** La vitesse voisine dans `SPEEDS`, bornée aux extrémités. */
export function nextSpeed(speed: number, direction: -1 | 1): number {
	const faster = SPEEDS.find((candidate) => candidate > speed);
	const slower = SPEEDS.findLast((candidate) => candidate < speed);
	const neighbor = direction === 1 ? faster : slower;
	return neighbor ?? speed;
}

/**
 * `code` est la position physique de la touche, `key` le caractère produit.
 * Les chiffres se lisent par position (en AZERTY, la rangée du haut donne
 * « & é " » sans Maj) ; les symboles par caractère, pour que « ? » reste
 * « ? » quelle que soit la disposition du clavier.
 */
export function actionForKey(
	{ code, key }: { readonly code: string; readonly key: string },
	stepCount: number,
): ShortcutAction | undefined {
	const digit = /^(?:Digit|Numpad)([1-9])$/.exec(code)?.[1];
	if (digit !== undefined) {
		const stepIndex = Number(digit) - 1;
		return stepIndex < stepCount
			? { kind: "go-to-step", stepIndex }
			: undefined;
	}
	return ACTIONS_BY_CODE[code] ?? ACTIONS_BY_KEY[key.toLowerCase()];
}

const ACTIONS_BY_CODE: Partial<Record<string, ShortcutAction>> = {
	Space: { kind: "toggle-playback" },
	ArrowLeft: { kind: "step-backward" },
	ArrowRight: { kind: "step-forward" },
	Escape: { kind: "close-help" },
};

const ACTIONS_BY_KEY: Partial<Record<string, ShortcutAction>> = {
	r: { kind: "restart" },
	"-": { kind: "slower" },
	"+": { kind: "faster" },
	"=": { kind: "faster" },
	"?": { kind: "toggle-help" },
};
