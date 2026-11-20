/**
 * Ce qui se passe dans un scénario à un instant donné de la timeline.
 * Fonction pure : la scène 3D et l'interface dessinent ce résultat.
 */

import type { Scenario, Step, Transmission } from "./scenario";
import type { TimelinePosition } from "./timeline";

/** Temps de traversée d'un câble par un paquet, à vitesse 1. */
export const TRANSMISSION_DURATION_IN_MS = 1500;

export type PacketInFlight = {
	readonly transmission: Transmission;
	/** Avancement sur le câble : 0 au départ, 1 à l'arrivée. */
	readonly progress: number;
};

export type ScenarioSnapshot = {
	readonly stepIndex: number;
	readonly step: Step;
	readonly packetsInFlight: readonly PacketInFlight[];
	/**
	 * Toutes les transmissions déjà parties, dans l'ordre, y compris celle
	 * en vol : ce qu'une capture aurait enregistré jusqu'ici.
	 */
	readonly sentTransmissions: readonly Transmission[];
};

/**
 * Durée de chaque étape : une traversée de câble par transmission.
 * Une étape sans transmission dure le temps d'une traversée, le temps
 * de lire son explication.
 */
export function stepDurationsOf(scenario: Scenario): number[] {
	return scenario.steps.map(
		(step) => Math.max(step.events.length, 1) * TRANSMISSION_DURATION_IN_MS,
	);
}

/**
 * Les transmissions d'une étape se suivent : chacune occupe une part égale
 * de l'étape. Un paquet qui traverse le pare-feu fait ainsi Kali → OPNsense
 * puis OPNsense → cible, et non les deux à la fois.
 */
export function snapshotAt(
	scenario: Scenario,
	{ stepIndex, progress }: TimelinePosition,
): ScenarioSnapshot {
	const step = scenario.steps[stepIndex];
	if (step === undefined) {
		throw new Error(`Scenario ${scenario.id} has no step ${stepIndex}`);
	}
	const activeIndex = activeTransmissionIndexOf(step.events, progress);
	const transmission = step.events[activeIndex];
	const packetsInFlight =
		transmission === undefined
			? []
			: [
					{
						transmission,
						progress: progress * step.events.length - activeIndex,
					},
				];
	return {
		stepIndex,
		step,
		packetsInFlight,
		sentTransmissions: [
			...scenario.steps.slice(0, stepIndex).flatMap((done) => done.events),
			...step.events.slice(0, activeIndex + 1),
		],
	};
}

/** −1 si l'étape n'a aucune transmission. */
function activeTransmissionIndexOf(
	transmissions: readonly Transmission[],
	stepProgress: number,
): number {
	const transmissionCount = transmissions.length;
	// La fin d'étape (progress = 1) appartient à la dernière transmission.
	return Math.min(
		Math.floor(stepProgress * transmissionCount),
		transmissionCount - 1,
	);
}
