import { describe, expect, test } from "bun:test";
import { encodeFrame } from "../../core/frame";
import type { Packet, TcpSegment } from "../../core/packet";
import { assertValidScenario, transmissionsOf } from "../../core/scenario";
import { snapshotAt } from "../../core/snapshot";
import { SSH_HANDSHAKE } from "./scenarios";

/**
 * Les trois trames de la connexion, capturées sur Kali le 2026-11-19 :
 *
 *   sudo tcpdump -i eth0 -c 3 -w handshake.pcap 'tcp port 22 and host 192.168.64.3'
 *   tcpdump -S -r handshake.pcap -XX
 */
const CAPTURED_FRAMES_HEX = [
	// SYN
	"fe75bdbae1b6 3a4d3d2332f8 0800" +
		"45b8 003c 7631 4000 4006 c27a c0a84004 c0a84003" +
		"82fe 0016 78084d76 00000000 a002 faf0 269f 0000" +
		"020405b4 0402 080a046fd81300000000 01 030309",
	// SYN-ACK
	"3a4d3d2332f8 fe75bdbae1b6 0800" +
		"4500 003c 0000 4000 4006 3964 c0a84003 c0a84004" +
		"0016 82fe 8ad6eded 78084d77 a012 fe88 9352 0000" +
		"020405b4 0402 080a9c607a7f046fd813 01 030308",
	// ACK
	"fe75bdbae1b6 3a4d3d2332f8 0800" +
		"45b8 0034 7632 4000 4006 c281 c0a84004 c0a84003" +
		"82fe 0016 78084d77 8ad6edee 8010 007e c029 0000" +
		"01 01 080a046fd8149c607a7f",
];

describe("SSH_HANDSHAKE", () => {
	test("est un scénario valide", () => {
		expect(() => assertValidScenario(SSH_HANDSHAKE)).not.toThrow();
	});

	test("chaque paquet se réencode exactement en sa trame capturée", () => {
		const encodedFramesHex = packetsOf().map((packet) =>
			toHex(encodeFrame(packet).bytes),
		);

		expect(encodedFramesHex).toEqual(
			CAPTURED_FRAMES_HEX.map((hex) => hex.replaceAll(" ", "")),
		);
	});

	test("chaque acquittement vaut le numéro de séquence de l'autre côté + 1", () => {
		const [syn, synAck, ack] = packetsOf().map(tcpOf);
		if (syn === undefined || synAck === undefined || ack === undefined) {
			throw new Error("The handshake needs three TCP packets");
		}

		expect(synAck.acknowledgmentNumber).toBe(syn.sequenceNumber + 1);
		expect(ack.sequenceNumber).toBe(syn.sequenceNumber + 1);
		expect(ack.acknowledgmentNumber).toBe(synAck.sequenceNumber + 1);
	});
});

function packetsOf(): Packet[] {
	return SSH_HANDSHAKE.steps
		.flatMap(transmissionsOf)
		.map((transmission) => transmission.packet);
}

function tcpOf(packet: Packet): TcpSegment {
	if (packet.transport.protocol !== "tcp") {
		throw new Error(`Packet ${packet.id} is not TCP`);
	}
	return packet.transport;
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

describe("SSH_HANDSHAKE · états TCP", () => {
	/** L'état de chaque côté pendant chaque étape, comme `ss -tan`. */
	function statesDuring(stepIndex: number): Record<string, string[]> {
		const { tables } = snapshotAt(SSH_HANDSHAKE, { stepIndex, progress: 0 });
		return Object.fromEntries(
			tables.map(({ definition, rows }) => [
				definition.machineId,
				rows.map(([state]) => state ?? ""),
			]),
		);
	}

	test("un état change quand le paquet part ou arrive, pas avant", () => {
		expect(statesDuring(0)).toEqual({ kali: ["SYN-SENT"], ubuntu: ["LISTEN"] });
		expect(statesDuring(1)).toEqual({
			kali: ["SYN-SENT"],
			ubuntu: ["LISTEN", "SYN-RECV"],
		});
		expect(statesDuring(2)).toEqual({
			kali: ["ESTAB"],
			ubuntu: ["LISTEN", "SYN-RECV"],
		});
		expect(statesDuring(3)).toEqual({
			kali: ["ESTAB"],
			ubuntu: ["LISTEN", "ESTAB"],
		});
	});
});

describe("SSH_HANDSHAKE · connexion", () => {
	function connectionStateDuring(stepIndex: number) {
		const { connections } = snapshotAt(SSH_HANDSHAKE, {
			stepIndex,
			progress: 0,
		});
		return connections.map(({ state }) => state);
	}

	test("la connexion n'est établie que quand les deux côtés sont en ESTAB", () => {
		expect(connectionStateDuring(0)).toEqual(["opening"]);
		expect(connectionStateDuring(1)).toEqual(["opening"]);
		// Kali est déjà en ESTAB, mais Ubuntu attend encore l'ACK.
		expect(connectionStateDuring(2)).toEqual(["opening"]);
		expect(connectionStateDuring(3)).toEqual(["established"]);
	});
});
