/**
 * La barre de lecture : boutons, une case par étape (cliquable, avec sa
 * progression) et la vitesse. Elle ne modifie rien : elle émet des
 * commandes, comme le clavier.
 */

import type { TimelineCommand } from "../playback";
import type { Step } from "../scenario";
import { positionOf, type Timeline } from "../timeline";
import { createElement } from "./dom";

export type PlaybackBar = {
	readonly render: (timeline: Timeline) => void;
};

export function createPlaybackBar(
	container: HTMLElement,
	steps: readonly Step[],
	onCommand: (command: TimelineCommand) => void,
	onHelp: () => void,
): PlaybackBar {
	const bar = createElement("nav", "playback-bar");
	bar.setAttribute("aria-label", "Lecture");

	const commandButton = (
		label: string,
		title: string,
		command: TimelineCommand,
	) => {
		const button = createButton(label, title);
		button.addEventListener("click", () => onCommand(command));
		return button;
	};

	const playButton = commandButton("▶", "Lecture / pause (Espace)", {
		kind: "toggle-playback",
	});
	const controls = createElement("div", "playback-controls");
	controls.append(
		commandButton("↺", "Recommencer (R)", { kind: "restart" }),
		commandButton("⏮", "Étape précédente (←)", { kind: "step-backward" }),
		playButton,
		commandButton("⏭", "Étape suivante (→)", { kind: "step-forward" }),
	);

	const stepMarkers = steps.map((step, stepIndex) => {
		const marker = commandButton(
			`${stepIndex + 1} · ${step.title}`,
			`Aller à l'étape ${stepIndex + 1}`,
			{ kind: "go-to-step", stepIndex },
		);
		marker.classList.add("step-marker");
		const fill = createElement("span", "step-marker-fill");
		marker.prepend(fill);
		return { marker, fill };
	});
	const stepTrack = createElement("div", "step-track");
	stepTrack.append(...stepMarkers.map(({ marker }) => marker));

	const speedLabel = createElement("span", "speed-label");
	const speedControls = createElement("div", "speed-controls");
	speedControls.append(
		commandButton("−", "Plus lent (−)", { kind: "slower" }),
		speedLabel,
		commandButton("+", "Plus rapide (+)", { kind: "faster" }),
	);

	const helpButton = createButton("?", "Raccourcis clavier (?)");
	helpButton.addEventListener("click", onHelp);

	bar.append(controls, stepTrack, speedControls, helpButton);
	container.appendChild(bar);

	return {
		render: (timeline) => {
			const { stepIndex, progress } = positionOf(timeline);
			const isPlaying = timeline.playback === "playing";
			setText(playButton, isPlaying ? "⏸" : "▶");
			setText(speedLabel, `× ${timeline.speed}`);
			stepMarkers.forEach(({ marker, fill }, markerIndex) => {
				const fillRatio =
					markerIndex < stepIndex
						? 1
						: markerIndex === stepIndex
							? progress
							: 0;
				marker.classList.toggle("is-current", markerIndex === stepIndex);
				fill.style.transform = `scaleX(${fillRatio})`;
			});
		},
	};
}

function createButton(label: string, title: string): HTMLButtonElement {
	const button = createElement("button", "playback-button", label);
	button.type = "button";
	button.title = title;
	button.setAttribute("aria-label", title);
	return button;
}

/** Rendu à chaque image : on n'écrit dans le DOM que si le texte change. */
function setText(element: HTMLElement, text: string): void {
	if (element.textContent !== text) element.textContent = text;
}
