import { describe, expect, test } from "bun:test";
import {
	actionForKey,
	applyTimelineCommand,
	nextSpeed,
	SPEEDS,
} from "./playback";
import { advance, createTimeline, play, positionOf } from "./timeline";

const THREE_STEPS = [1000, 1000, 1000];

describe("applyTimelineCommand", () => {
	test("lecture / pause bascule entre les deux", () => {
		const timeline = createTimeline(THREE_STEPS);
		const playing = applyTimelineCommand(timeline, { kind: "toggle-playback" });

		expect(playing.playback).toBe("playing");
		expect(
			applyTimelineCommand(playing, { kind: "toggle-playback" }).playback,
		).toBe("paused");
	});

	test("aller à une étape", () => {
		const timeline = applyTimelineCommand(createTimeline(THREE_STEPS), {
			kind: "go-to-step",
			stepIndex: 2,
		});

		expect(positionOf(timeline)).toEqual({ stepIndex: 2, progress: 0 });
	});

	test("recommencer revient au début", () => {
		const timeline = advance(play(createTimeline(THREE_STEPS)), 1500);

		expect(
			positionOf(applyTimelineCommand(timeline, { kind: "restart" })),
		).toEqual({ stepIndex: 0, progress: 0 });
	});

	test("plus rapide et plus lent passent à la vitesse voisine", () => {
		const timeline = createTimeline(THREE_STEPS);

		expect(applyTimelineCommand(timeline, { kind: "faster" }).speed).toBe(2);
		expect(applyTimelineCommand(timeline, { kind: "slower" }).speed).toBe(0.5);
	});
});

describe("nextSpeed", () => {
	test("reste bornée aux vitesses extrêmes", () => {
		const slowest = SPEEDS[0];
		const fastest = SPEEDS.at(-1);
		if (slowest === undefined || fastest === undefined) {
			throw new Error("SPEEDS is empty");
		}

		expect(nextSpeed(slowest, -1)).toBe(slowest);
		expect(nextSpeed(fastest, 1)).toBe(fastest);
	});

	test("rejoint la liste depuis une vitesse qui n'y figure pas", () => {
		expect(nextSpeed(1.5, 1)).toBe(2);
		expect(nextSpeed(1.5, -1)).toBe(1);
	});
});

describe("actionForKey", () => {
	test("les touches de lecture se lisent par position", () => {
		expect(actionForKey({ code: "Space", key: " " }, 3)).toEqual({
			kind: "toggle-playback",
		});
		expect(actionForKey({ code: "ArrowRight", key: "ArrowRight" }, 3)).toEqual({
			kind: "step-forward",
		});
	});

	test("un chiffre va à l'étape, même en AZERTY sans Maj", () => {
		// En AZERTY, la touche « 2 » sans Maj produit « é ».
		expect(actionForKey({ code: "Digit2", key: "é" }, 3)).toEqual({
			kind: "go-to-step",
			stepIndex: 1,
		});
	});

	test("ignore un chiffre au-delà du nombre d'étapes", () => {
		expect(actionForKey({ code: "Digit4", key: "4" }, 3)).toBeUndefined();
	});

	test("les symboles se lisent par caractère", () => {
		// En AZERTY Mac, « ? » est sur la touche de la virgule.
		expect(actionForKey({ code: "Comma", key: "?" }, 3)).toEqual({
			kind: "toggle-help",
		});
		expect(actionForKey({ code: "KeyR", key: "R" }, 3)).toEqual({
			kind: "restart",
		});
	});

	test("ignore les autres touches", () => {
		expect(actionForKey({ code: "KeyX", key: "x" }, 3)).toBeUndefined();
	});
});
