import { describe, expect, test } from "bun:test";
import {
	advance,
	createTimeline,
	goToStep,
	isFinished,
	pause,
	play,
	positionOf,
	restart,
	setSpeed,
	stepBackward,
	stepForward,
} from "./timeline";

// Trois étapes d'une seconde : la timeline dure 3000 ms au total.
const THREE_ONE_SECOND_STEPS = [1000, 1000, 1000];

function playingTimeline() {
	return play(createTimeline(THREE_ONE_SECOND_STEPS));
}

describe("createTimeline", () => {
	test("démarre en pause, au début de la première étape, à vitesse 1", () => {
		const timeline = createTimeline(THREE_ONE_SECOND_STEPS);

		expect(timeline.playback).toBe("paused");
		expect(timeline.speed).toBe(1);
		expect(positionOf(timeline)).toEqual({ stepIndex: 0, progress: 0 });
	});

	test("refuse un scénario sans étape", () => {
		expect(() => createTimeline([])).toThrow();
	});

	test("refuse une étape de durée nulle ou négative", () => {
		expect(() => createTimeline([1000, 0])).toThrow();
		expect(() => createTimeline([-5])).toThrow();
	});
});

describe("advance", () => {
	test("ne bouge pas quand la timeline est en pause", () => {
		const timeline = createTimeline(THREE_ONE_SECOND_STEPS);

		expect(advance(timeline, 500)).toEqual(timeline);
	});

	test("avance dans l'étape courante", () => {
		const timeline = advance(playingTimeline(), 400);

		expect(positionOf(timeline)).toEqual({ stepIndex: 0, progress: 0.4 });
	});

	test("passe à l'étape suivante quand la durée de l'étape est dépassée", () => {
		const timeline = advance(playingTimeline(), 1500);

		expect(positionOf(timeline)).toEqual({ stepIndex: 1, progress: 0.5 });
	});

	test("applique la vitesse", () => {
		const timeline = advance(setSpeed(playingTimeline(), 2), 250);

		expect(positionOf(timeline)).toEqual({ stepIndex: 0, progress: 0.5 });
	});

	test("s'arrête à la fin du scénario et se met en pause", () => {
		const timeline = advance(playingTimeline(), 10_000);

		expect(isFinished(timeline)).toBe(true);
		expect(timeline.playback).toBe("paused");
		expect(positionOf(timeline)).toEqual({ stepIndex: 2, progress: 1 });
	});

	test("ne modifie pas la timeline reçue", () => {
		const timeline = playingTimeline();
		advance(timeline, 500);

		expect(timeline.elapsedInMs).toBe(0);
	});
});

describe("play / pause", () => {
	test("pause fige la position", () => {
		const paused = pause(advance(playingTimeline(), 300));

		expect(advance(paused, 500)).toEqual(paused);
	});

	test("play à la fin du scénario rejoue depuis le début", () => {
		const finished = advance(playingTimeline(), 10_000);
		const replayed = play(finished);

		expect(replayed.playback).toBe("playing");
		expect(positionOf(replayed)).toEqual({ stepIndex: 0, progress: 0 });
	});
});

describe("setSpeed", () => {
	test("refuse une vitesse nulle ou négative", () => {
		const timeline = createTimeline(THREE_ONE_SECOND_STEPS);

		expect(() => setSpeed(timeline, 0)).toThrow();
		expect(() => setSpeed(timeline, -1)).toThrow();
	});
});

describe("stepForward", () => {
	test("va au début de l'étape suivante et met en pause", () => {
		const timeline = stepForward(advance(playingTimeline(), 400));

		expect(timeline.playback).toBe("paused");
		expect(positionOf(timeline)).toEqual({ stepIndex: 1, progress: 0 });
	});

	test("sur la dernière étape, va à la fin du scénario", () => {
		const timeline = stepForward(advance(playingTimeline(), 2500));

		expect(isFinished(timeline)).toBe(true);
	});
});

describe("stepBackward", () => {
	test("au milieu d'une étape, revient au début de cette étape", () => {
		const timeline = stepBackward(advance(playingTimeline(), 1500));

		expect(timeline.playback).toBe("paused");
		expect(positionOf(timeline)).toEqual({ stepIndex: 1, progress: 0 });
	});

	test("au début d'une étape, revient au début de l'étape précédente", () => {
		const atStepTwoStart = advance(playingTimeline(), 2000);

		expect(positionOf(stepBackward(atStepTwoStart))).toEqual({
			stepIndex: 1,
			progress: 0,
		});
	});

	test("au tout début du scénario, reste au début", () => {
		const timeline = stepBackward(createTimeline(THREE_ONE_SECOND_STEPS));

		expect(positionOf(timeline)).toEqual({ stepIndex: 0, progress: 0 });
	});
});

describe("goToStep", () => {
	test("va au début de l'étape demandée et met en pause", () => {
		const timeline = goToStep(playingTimeline(), 2);

		expect(timeline.playback).toBe("paused");
		expect(positionOf(timeline)).toEqual({ stepIndex: 2, progress: 0 });
	});

	test("peut revenir en arrière", () => {
		const timeline = goToStep(advance(playingTimeline(), 2500), 0);

		expect(positionOf(timeline)).toEqual({ stepIndex: 0, progress: 0 });
	});

	test("refuse une étape qui n'existe pas", () => {
		const timeline = createTimeline(THREE_ONE_SECOND_STEPS);

		expect(() => goToStep(timeline, 3)).toThrow();
		expect(() => goToStep(timeline, -1)).toThrow();
		expect(() => goToStep(timeline, 1.5)).toThrow();
	});
});

describe("restart", () => {
	test("revient au début en conservant la lecture et la vitesse", () => {
		const timeline = restart(setSpeed(advance(playingTimeline(), 1500), 2));

		expect(timeline.playback).toBe("playing");
		expect(timeline.speed).toBe(2);
		expect(positionOf(timeline)).toEqual({ stepIndex: 0, progress: 0 });
	});
});
