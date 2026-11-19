import { describe, expect, test } from "bun:test";
import type { Packet } from "./packet";
import type { Scenario, Transmission } from "./scenario";
import {
	snapshotAt,
	stepDurationsOf,
	TRANSMISSION_DURATION_IN_MS,
} from "./snapshot";

function transmission(
	packetId: string,
	fromMachineId: string,
	toMachineId: string,
): Transmission {
	const packet: Packet = {
		id: packetId,
		ethernet: {
			sourceMac: "00:00:00:00:00:01",
			destinationMac: "00:00:00:00:00:02",
		},
		ipv4: {
			dscp: 0,
			ecn: 0,
			identification: 1,
			dontFragment: true,
			ttl: 64,
			sourceAddress: "10.0.0.5",
			destinationAddress: "10.0.1.10",
		},
		transport: { protocol: "udp", sourcePort: 40000, destinationPort: 53 },
		payloadSizeInBytes: 0,
	};
	return { kind: "transmission", fromMachineId, toMachineId, packet };
}

const KALI_TO_FIREWALL = transmission("hop-1", "kali", "firewall");
const FIREWALL_TO_TARGET = transmission("hop-2", "firewall", "target");

// La topologie n'est pas lue par snapshotAt : seules les étapes comptent.
const THROUGH_THE_FIREWALL: Scenario = {
	id: "through-the-firewall",
	title: "Traversée du pare-feu",
	overview: "Un paquet de Kali traverse OPNsense jusqu'à la cible.",
	topology: { machines: [], links: [] },
	steps: [
		{
			title: "Deux sauts",
			explanation: "Le paquet atteint le pare-feu, puis la cible.",
			events: [KALI_TO_FIREWALL, FIREWALL_TO_TARGET],
		},
		{
			title: "Arrivée",
			explanation: "Étape de lecture : aucun paquet ne circule.",
			events: [],
		},
	],
};

describe("stepDurationsOf", () => {
	test("une traversée de câble par transmission, une au minimum", () => {
		expect(stepDurationsOf(THROUGH_THE_FIREWALL)).toEqual([
			2 * TRANSMISSION_DURATION_IN_MS,
			TRANSMISSION_DURATION_IN_MS,
		]);
	});
});

describe("snapshotAt", () => {
	test("au début de l'étape, le premier saut démarre", () => {
		const snapshot = snapshotAt(THROUGH_THE_FIREWALL, {
			stepIndex: 0,
			progress: 0,
		});

		expect(snapshot.stepIndex).toBe(0);
		expect(snapshot.packetsInFlight).toEqual([
			{ transmission: KALI_TO_FIREWALL, progress: 0 },
		]);
	});

	test("les sauts se suivent : la première moitié de l'étape est le premier saut", () => {
		const snapshot = snapshotAt(THROUGH_THE_FIREWALL, {
			stepIndex: 0,
			progress: 0.25,
		});

		expect(snapshot.packetsInFlight).toEqual([
			{ transmission: KALI_TO_FIREWALL, progress: 0.5 },
		]);
	});

	test("la seconde moitié de l'étape est le second saut", () => {
		const snapshot = snapshotAt(THROUGH_THE_FIREWALL, {
			stepIndex: 0,
			progress: 0.75,
		});

		expect(snapshot.packetsInFlight).toEqual([
			{ transmission: FIREWALL_TO_TARGET, progress: 0.5 },
		]);
	});

	test("en fin d'étape, le dernier paquet est arrivé", () => {
		const snapshot = snapshotAt(THROUGH_THE_FIREWALL, {
			stepIndex: 0,
			progress: 1,
		});

		expect(snapshot.packetsInFlight).toEqual([
			{ transmission: FIREWALL_TO_TARGET, progress: 1 },
		]);
	});

	test("une étape de lecture n'a aucun paquet en vol", () => {
		const snapshot = snapshotAt(THROUGH_THE_FIREWALL, {
			stepIndex: 1,
			progress: 0.5,
		});

		expect(snapshot.step.title).toBe("Arrivée");
		expect(snapshot.packetsInFlight).toEqual([]);
	});

	test("refuse une étape qui n'existe pas", () => {
		expect(() =>
			snapshotAt(THROUGH_THE_FIREWALL, { stepIndex: 2, progress: 0 }),
		).toThrow("no step 2");
	});
});
