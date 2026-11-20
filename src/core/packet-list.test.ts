import { describe, expect, test } from "bun:test";
import type { Packet } from "./packet";
import { toPacketRows } from "./packet-list";
import type { Transmission } from "./scenario";
import type { ScenarioSnapshot } from "./snapshot";

function synTransmission(id: string, sourcePort: number): Transmission {
	const packet: Packet = {
		id,
		ethernet: {
			sourceMac: "3a:4d:3d:23:32:f8",
			destinationMac: "fe:75:bd:ba:e1:b6",
		},
		ipv4: {
			dscp: 0,
			ecn: 0,
			identification: 1,
			dontFragment: true,
			ttl: 64,
			sourceAddress: "192.168.64.4",
			destinationAddress: "192.168.64.3",
		},
		transport: {
			protocol: "tcp",
			sourcePort,
			destinationPort: 22,
			sequenceNumber: 0,
			acknowledgmentNumber: 0,
			flags: ["SYN"],
			windowSize: 64240,
			options: [],
		},
		payloadSizeInBytes: 0,
	};
	return {
		kind: "transmission",
		fromMachineId: "kali",
		toMachineId: "ubuntu",
		packet,
	};
}

const FIRST = synTransmission("first", 40001);
const SECOND = synTransmission("second", 40002);

function snapshotWith(
	sentTransmissions: Transmission[],
	inFlight: { transmission: Transmission; progress: number }[],
): ScenarioSnapshot {
	return {
		stepIndex: 0,
		step: { title: "Étape", explanation: "", events: sentTransmissions },
		packetsInFlight: inFlight,
		sentTransmissions,
		tables: [],
	};
}

describe("toPacketRows", () => {
	test("une ligne par paquet envoyé, numérotée à partir de 1", () => {
		const rows = toPacketRows(snapshotWith([FIRST, SECOND], []));

		expect(rows.map((row) => row.number)).toEqual([1, 2]);
		expect(rows.map((row) => row.packet.id)).toEqual(["first", "second"]);
	});

	test("reprend les colonnes de Wireshark", () => {
		const [row] = toPacketRows(snapshotWith([FIRST], []));

		expect(row).toMatchObject({
			source: "192.168.64.4",
			destination: "192.168.64.3",
			protocol: "TCP",
			frameLengthInBytes: 54, // 14 Ethernet + 20 IP + 20 TCP sans option
			info: "40001 → 22 [SYN] Seq=0 Win=64240 Len=0",
		});
	});

	test("signale le paquet encore sur le câble", () => {
		const rows = toPacketRows(
			snapshotWith([FIRST, SECOND], [{ transmission: SECOND, progress: 0.4 }]),
		);

		expect(rows.map((row) => row.isInFlight)).toEqual([false, true]);
	});

	test("un paquet arrivé au bout du câble n'est plus en vol", () => {
		const rows = toPacketRows(
			snapshotWith([FIRST], [{ transmission: FIRST, progress: 1 }]),
		);

		expect(rows.map((row) => row.isInFlight)).toEqual([false]);
	});
});
