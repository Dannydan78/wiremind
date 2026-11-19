/**
 * Placement des machines dans la scène. Coordonnées pures, sans three.js.
 */

import type { Topology } from "./topology";

/** Position au sol : x de gauche à droite, z de l'arrière vers l'avant. */
export type GroundPosition = { readonly x: number; readonly z: number };

/** Écart entre deux machines voisines, en unités de la scène. */
export const MACHINE_SPACING = 4;

/**
 * Aligne les machines de gauche à droite, dans l'ordre de la topologie,
 * centrées sur l'origine. Suffit pour les chaînes du labo
 * (Kali → OPNsense → cible). Une DMZ demandera un placement en arbre.
 */
export function layOutMachines(
	topology: Topology,
): ReadonlyMap<string, GroundPosition> {
	const centerIndex = (topology.machines.length - 1) / 2;
	return new Map(
		topology.machines.map((machine, index) => [
			machine.id,
			{ x: (index - centerIndex) * MACHINE_SPACING, z: 0 },
		]),
	);
}
