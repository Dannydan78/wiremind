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
	tables: [],
	connections: [],
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

	test("compte comme envoyée la transmission en vol", () => {
		const snapshot = snapshotAt(THROUGH_THE_FIREWALL, {
			stepIndex: 0,
			progress: 0.25,
		});

		expect(snapshot.sentTransmissions).toEqual([KALI_TO_FIREWALL]);
	});

	test("accumule les transmissions de l'étape, dans l'ordre", () => {
		const snapshot = snapshotAt(THROUGH_THE_FIREWALL, {
			stepIndex: 0,
			progress: 0.75,
		});

		expect(snapshot.sentTransmissions).toEqual([
			KALI_TO_FIREWALL,
			FIREWALL_TO_TARGET,
		]);
	});

	test("garde les transmissions des étapes précédentes", () => {
		const snapshot = snapshotAt(THROUGH_THE_FIREWALL, {
			stepIndex: 1,
			progress: 0,
		});

		expect(snapshot.sentTransmissions).toEqual([
			KALI_TO_FIREWALL,
			FIREWALL_TO_TARGET,
		]);
	});
});

describe("snapshotAt · tables", () => {
	const WITH_TABLE: Scenario = {
		...THROUGH_THE_FIREWALL,
		tables: [
			{
				id: "states",
				title: "Table d'état",
				machineId: "firewall",
				columns: ["Connexion", "État"],
				initialRows: [["a", "ouverte"]],
			},
		],
		steps: [
			{ title: "Rien", explanation: "", events: [] },
			{
				title: "Ajout",
				explanation: "",
				events: [
					{
						kind: "table-update",
						tableId: "states",
						rows: [
							["a", "ouverte"],
							["b", "ouverte"],
						],
					},
				],
			},
			{ title: "Après", explanation: "", events: [] },
		],
	};

	function tableAt(stepIndex: number) {
		const [table] = snapshotAt(WITH_TABLE, { stepIndex, progress: 0 }).tables;
		if (table === undefined) throw new Error("The scenario has one table");
		return table;
	}

	test("avant toute mise à jour, la table a ses lignes de départ", () => {
		expect(tableAt(0).rows).toEqual([["a", "ouverte"]]);
		expect(tableAt(0).changedRowIndexes).toEqual([]);
	});

	test("une mise à jour vaut dès le début de son étape et signale la ligne ajoutée", () => {
		expect(tableAt(1).rows).toEqual([
			["a", "ouverte"],
			["b", "ouverte"],
		]);
		expect(tableAt(1).changedRowIndexes).toEqual([1]);
	});

	test("le contenu persiste aux étapes suivantes, sans être signalé à nouveau", () => {
		expect(tableAt(2).rows).toHaveLength(2);
		expect(tableAt(2).changedRowIndexes).toEqual([]);
	});
});

describe("snapshotAt · connexions", () => {
	const WITH_CONNECTION: Scenario = {
		...THROUGH_THE_FIREWALL,
		connections: [
			{
				id: "ssh",
				endpointMachineIds: ["kali", "target"],
				label: "TCP",
			},
		],
		steps: [
			{ title: "Avant", explanation: "", events: [] },
			{
				title: "Ouverture",
				explanation: "",
				events: [
					{ kind: "connection-update", connectionId: "ssh", state: "opening" },
				],
			},
			{ title: "Pendant", explanation: "", events: [] },
			{
				title: "Établie",
				explanation: "",
				events: [
					{
						kind: "connection-update",
						connectionId: "ssh",
						state: "established",
					},
				],
			},
		],
	};

	function statesAt(stepIndex: number) {
		return snapshotAt(WITH_CONNECTION, {
			stepIndex,
			progress: 0,
		}).connections.map(({ state }) => state);
	}

	test("une connexion n'apparaît qu'à sa première mise à jour", () => {
		expect(statesAt(0)).toEqual([]);
		expect(statesAt(1)).toEqual(["opening"]);
	});

	test("son état persiste jusqu'à la mise à jour suivante", () => {
		expect(statesAt(2)).toEqual(["opening"]);
		expect(statesAt(3)).toEqual(["established"]);
	});
});
