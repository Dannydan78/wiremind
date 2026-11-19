/**
 * Horloge de lecture d'un scénario découpé en étapes.
 *
 * Ne connaît ni paquets, ni pare-feu, ni three.js : seulement des durées.
 * Le concept garde sa liste d'étapes (avec leurs explications) et lit
 * `positionOf(timeline).stepIndex` pour savoir laquelle afficher.
 *
 * Toutes les fonctions sont pures : elles renvoient une nouvelle timeline
 * au lieu de modifier celle reçue.
 */

export type Playback = "playing" | "paused";

export type Timeline = {
	readonly stepDurationsInMs: readonly number[];
	/** Temps écoulé depuis le début du scénario, déjà multiplié par la vitesse. */
	readonly elapsedInMs: number;
	readonly playback: Playback;
	/** Multiplicateur de vitesse : 1 = temps réel, 2 = deux fois plus vite. */
	readonly speed: number;
};

export type TimelinePosition = {
	readonly stepIndex: number;
	/** Avancement dans l'étape courante, de 0 (début) à 1 (fin). */
	readonly progress: number;
};

export function createTimeline(stepDurationsInMs: readonly number[]): Timeline {
	if (stepDurationsInMs.length === 0) {
		throw new Error("A timeline needs at least one step");
	}
	// `!(x > 0)` rejette aussi NaN, que `x <= 0` laisserait passer.
	const hasInvalidDuration = stepDurationsInMs.some(
		(durationInMs) => !(durationInMs > 0),
	);
	if (hasInvalidDuration) {
		throw new Error(
			`Step durations must be positive: [${stepDurationsInMs.join(", ")}]`,
		);
	}
	return { stepDurationsInMs, elapsedInMs: 0, playback: "paused", speed: 1 };
}

export function play(timeline: Timeline): Timeline {
	const elapsedInMs = isFinished(timeline) ? 0 : timeline.elapsedInMs;
	return { ...timeline, elapsedInMs, playback: "playing" };
}

export function pause(timeline: Timeline): Timeline {
	return { ...timeline, playback: "paused" };
}

export function setSpeed(timeline: Timeline, speed: number): Timeline {
	if (!(speed > 0)) throw new Error(`Speed must be positive: ${speed}`);
	return { ...timeline, speed };
}

/** Fait avancer l'horloge du temps réel écoulé depuis l'image précédente. */
export function advance(
	timeline: Timeline,
	frameDurationInMs: number,
): Timeline {
	if (timeline.playback === "paused") return timeline;

	const totalDurationInMs = totalDurationOf(timeline);
	const elapsedInMs = Math.min(
		timeline.elapsedInMs + frameDurationInMs * timeline.speed,
		totalDurationInMs,
	);
	if (elapsedInMs === totalDurationInMs) return pauseAt(timeline, elapsedInMs);
	return { ...timeline, elapsedInMs };
}

/** Va au début de l'étape suivante et met en pause. */
export function stepForward(timeline: Timeline): Timeline {
	const { stepIndex } = positionOf(timeline);
	return pauseAt(timeline, stepStartOf(timeline, stepIndex + 1));
}

/**
 * Revient au début de l'étape courante, ou de la précédente si on est
 * déjà au tout début de l'étape courante. Met en pause.
 */
export function stepBackward(timeline: Timeline): Timeline {
	const { stepIndex } = positionOf(timeline);
	const currentStepStartInMs = stepStartOf(timeline, stepIndex);
	if (timeline.elapsedInMs > currentStepStartInMs) {
		return pauseAt(timeline, currentStepStartInMs);
	}
	const previousStepIndex = Math.max(stepIndex - 1, 0);
	return pauseAt(timeline, stepStartOf(timeline, previousStepIndex));
}

/** Va au début de l'étape demandée et met en pause. */
export function goToStep(timeline: Timeline, stepIndex: number): Timeline {
	const isExistingStep =
		Number.isInteger(stepIndex) &&
		stepIndex >= 0 &&
		stepIndex < timeline.stepDurationsInMs.length;
	if (!isExistingStep) throw new Error(`No step at index ${stepIndex}`);
	return pauseAt(timeline, stepStartOf(timeline, stepIndex));
}

export function restart(timeline: Timeline): Timeline {
	return { ...timeline, elapsedInMs: 0 };
}

export function isFinished(timeline: Timeline): boolean {
	return timeline.elapsedInMs >= totalDurationOf(timeline);
}

export function positionOf(timeline: Timeline): TimelinePosition {
	const lastStepIndex = timeline.stepDurationsInMs.length - 1;
	if (isFinished(timeline)) return { stepIndex: lastStepIndex, progress: 1 };

	// La première étape dont la fin n'est pas encore atteinte.
	const stepIndex = timeline.stepDurationsInMs.findIndex(
		(_, index) => timeline.elapsedInMs < stepStartOf(timeline, index + 1),
	);
	const stepStartInMs = stepStartOf(timeline, stepIndex);
	const stepEndInMs = stepStartOf(timeline, stepIndex + 1);
	const progress =
		(timeline.elapsedInMs - stepStartInMs) / (stepEndInMs - stepStartInMs);
	return { stepIndex, progress };
}

/** Instant où commence l'étape. `stepStartOf(t, nombreDÉtapes)` = fin du scénario. */
function stepStartOf(timeline: Timeline, stepIndex: number): number {
	return timeline.stepDurationsInMs
		.slice(0, stepIndex)
		.reduce((sumInMs, durationInMs) => sumInMs + durationInMs, 0);
}

function totalDurationOf(timeline: Timeline): number {
	return stepStartOf(timeline, timeline.stepDurationsInMs.length);
}

function pauseAt(timeline: Timeline, elapsedInMs: number): Timeline {
	return { ...timeline, elapsedInMs, playback: "paused" };
}
