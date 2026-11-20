import { describe, expect, test } from "bun:test";
import {
	type Packet,
	packetBadgeOf,
	summarizePacket,
	type TransportLayer,
} from "./packet";

function packetCarrying(
	transport: TransportLayer,
	payloadSizeInBytes = 0,
): Packet {
	return {
		id: "packet",
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
		transport,
		payloadSizeInBytes,
	};
}

describe("summarizePacket", () => {
	test("résume un SYN comme la colonne Info de Wireshark", () => {
		const syn = packetCarrying({
			protocol: "tcp",
			sourcePort: 58228,
			destinationPort: 22,
			sequenceNumber: 628307994,
			acknowledgmentNumber: 0,
			flags: ["SYN"],
			windowSize: 64240,
			options: [],
		});

		expect(summarizePacket(syn)).toBe(
			"58228 → 22 [SYN] Seq=628307994 Win=64240 Len=0",
		);
	});

	test("affiche Ack seulement si le flag ACK est levé, flags dans l'ordre de Wireshark", () => {
		const synAck = packetCarrying({
			protocol: "tcp",
			sourcePort: 22,
			destinationPort: 58228,
			sequenceNumber: 1000,
			acknowledgmentNumber: 628307995,
			flags: ["ACK", "SYN"],
			windowSize: 65160,
			options: [],
		});

		expect(summarizePacket(synAck)).toBe(
			"22 → 58228 [SYN, ACK] Seq=1000 Ack=628307995 Win=65160 Len=0",
		);
	});

	test("résume un datagramme UDP", () => {
		const query = packetCarrying(
			{ protocol: "udp", sourcePort: 40000, destinationPort: 53 },
			30,
		);

		expect(summarizePacket(query)).toBe("40000 → 53 Len=30");
	});

	test("nomme les messages ICMP courants", () => {
		const ping = packetCarrying({ protocol: "icmp", type: 8, code: 0 });
		const unknown = packetCarrying({ protocol: "icmp", type: 42, code: 1 });

		expect(summarizePacket(ping)).toBe("Echo (ping) request");
		expect(summarizePacket(unknown)).toBe("Type=42 Code=1");
	});
});

describe("packetBadgeOf", () => {
	test("un segment TCP se résume à ses flags", () => {
		const synAck = packetCarrying({
			protocol: "tcp",
			sourcePort: 22,
			destinationPort: 33534,
			sequenceNumber: 1,
			acknowledgmentNumber: 2,
			flags: ["ACK", "SYN"],
			windowSize: 65160,
			options: [],
		});

		expect(packetBadgeOf(synAck)).toBe("[SYN, ACK]");
	});

	test("un datagramme UDP se résume à son port de destination", () => {
		const query = packetCarrying({
			protocol: "udp",
			sourcePort: 40000,
			destinationPort: 53,
		});

		expect(packetBadgeOf(query)).toBe("UDP → 53");
	});

	test("un message ICMP se résume à son nom", () => {
		const ping = packetCarrying({ protocol: "icmp", type: 8, code: 0 });

		expect(packetBadgeOf(ping)).toBe("Echo (ping) request");
	});
});
