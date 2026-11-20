/**
 * Ce qui se passe dans un scénario à un instant donné de la timeline.
 * Fonction pure : la scène 3D et l'interface dessinent ce résultat.
 */

import {
	type Scenario,
	type Step,
	type TableDefinition,
	type TableRow,
	type Transmission,
	tableUpdatesOf,
	transmissionsOf,
} from "./scenario";
import type { TimelinePosition } from "./timeline";

/** Temps de traversée d'un câble par un paquet, à vitesse 1. */
export const TRANSMISSION_DURATION_IN_MS = 1500;

export type PacketInFlight = {
	readonly transmission: Transmission;
	/** Avancement sur le câble : 0 au départ, 1 à l'arrivée. */
	readonly progress: number;
};

export type TableState = {
	readonly definition: TableDefinition;
	readonly rows: readonly TableRow[];
	/** Lignes apparues ou modifiées par rapport à l'étape précédente. */
	readonly changedRowIndexes: readonly number[];
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
	readonly tables: readonly TableState[];
};

/**
 * Durée de chaque étape : une traversée de câble par transmission.
 * Une étape sans transmission dure le temps d'une traversée, le temps
 * de lire son explication.
 */
export function stepDurationsOf(scenario: Scenario): number[] {
	return scenario.steps.map(
		(step) =>
			Math.max(transmissionsOf(step).length, 1) * TRANSMISSION_DURATION_IN_MS,
	);
}

/**
 * Les transmissions d'une étape se suivent : chacune occupe une part égale
 * de l'étape. Un paquet qui traverse le pare-feu fait ainsi Kali → OPNsense
 * puis OPNsense → cible, et non les deux à la fois.
 *
 * Une mise à jour de table vaut dès le début de son étape.
 */
export function snapshotAt(
	scenario: Scenario,
	{ stepIndex, progress }: TimelinePosition,
): ScenarioSnapshot {
	const step = scenario.steps[stepIndex];
	if (step === undefined) {
		throw new Error(`Scenario ${scenario.id} has no step ${stepIndex}`);
	}
	const transmissions = transmissionsOf(step);
	const activeIndex = activeTransmissionIndexOf(transmissions, progress);
	const transmission = transmissions[activeIndex];
	const packetsInFlight =
		transmission === undefined
			? []
			: [
					{
						transmission,
						progress: progress * transmissions.length - activeIndex,
					},
				];
	return {
		stepIndex,
		step,
		packetsInFlight,
		sentTransmissions: [
			...scenario.steps.slice(0, stepIndex).flatMap(transmissionsOf),
			...transmissions.slice(0, activeIndex + 1),
		],
		tables: scenario.tables.map((definition) =>
			tableStateAt(scenario, definition, stepIndex),
		),
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

function tableStateAt(
	scenario: Scenario,
	definition: TableDefinition,
	stepIndex: number,
): TableState {
	const rows = rowsAt(scenario, definition, stepIndex);
	const previousRowKeys = new Set(
		rowsAt(scenario, definition, stepIndex - 1).map(toRowKey),
	);
	const changedRowIndexes = rows.flatMap((row, rowIndex) =>
		previousRowKeys.has(toRowKey(row)) ? [] : [rowIndex],
	);
	return { definition, rows, changedRowIndexes };
}

/** Le contenu de la table pendant l'étape ; avant la première : initial. */
function rowsAt(
	scenario: Scenario,
	definition: TableDefinition,
	stepIndex: number,
): readonly TableRow[] {
	const latestUpdate = scenario.steps
		.slice(0, stepIndex + 1)
		.flatMap(tableUpdatesOf)
		.findLast((update) => update.tableId === definition.id);
	return latestUpdate?.rows ?? definition.initialRows;
}

function toRowKey(row: TableRow): string {
	return JSON.stringify(row);
}
