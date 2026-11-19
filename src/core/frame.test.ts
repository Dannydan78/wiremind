import { describe, expect, test } from "bun:test";
import { encodeFrame, type Frame, type FrameLayer } from "./frame";
import type { Packet, TcpSegment } from "./packet";

/**
 * Trame réelle capturée dans le labo le 2026-11-19 : premier SYN d'un
 * `ssh` de Kali (192.168.64.4) vers Ubuntu (192.168.64.3).
 *
 *   sudo tcpdump -i eth0 -c 1 -w syn.pcap 'tcp[tcpflags] == tcp-syn'
 *   tcpdump -r syn.pcap -XX
 */
const CAPTURED_SSH_SYN_HEX =
	"fe75bdbae1b6 3a4d3d2332f8 0800" + // Ethernet
	"45b8 003c 02d6 4000 4006 35d6 c0a84004 c0a84003" + // IPv4
	"e374 0016 2573381a 00000000 a002 faf0 9278 0000" + // TCP
	"020405b4 0402 080abd36baed00000000 01 030309"; // options TCP

const SSH_SYN_SEGMENT: TcpSegment = {
	protocol: "tcp",
	sourcePort: 58228,
	destinationPort: 22,
	sequenceNumber: 628307994,
	acknowledgmentNumber: 0,
	flags: ["SYN"],
	windowSize: 64240,
	options: [
		{ kind: "mss", maxSegmentSizeInBytes: 1460 },
		{ kind: "sack-permitted" },
		{ kind: "timestamps", value: 3174480621, echoReply: 0 },
		{ kind: "nop" },
		{ kind: "window-scale", shift: 9 },
	],
};

const KALI_SSH_SYN: Packet = {
	id: "kali-ssh-syn",
	ethernet: {
		sourceMac: "3a:4d:3d:23:32:f8",
		destinationMac: "fe:75:bd:ba:e1:b6",
	},
	ipv4: {
		dscp: 46,
		ecn: 0,
		identification: 726,
		dontFragment: true,
		ttl: 64,
		sourceAddress: "192.168.64.4",
		destinationAddress: "192.168.64.3",
	},
	transport: SSH_SYN_SEGMENT,
	payloadSizeInBytes: 0,
};

const DNS_QUERY: Packet = {
	id: "dns-query",
	ethernet: KALI_SSH_SYN.ethernet,
	ipv4: KALI_SSH_SYN.ipv4,
	transport: { protocol: "udp", sourcePort: 40000, destinationPort: 53 },
	payloadSizeInBytes: 30,
};

describe("encodeFrame", () => {
	test("reproduit octet par octet le SYN capturé dans le labo", () => {
		const frame = encodeFrame(KALI_SSH_SYN);

		expect(toHex(frame.bytes)).toBe(CAPTURED_SSH_SYN_HEX.replaceAll(" ", ""));
	});

	test("les champs couvrent toute la trame, sans trou ni chevauchement", () => {
		const frame = encodeFrame(KALI_SSH_SYN);

		const contiguousEnd = frame.fields.reduce((expectedOffset, field) => {
			expect(field.offset).toBe(expectedOffset);
			return field.offset + field.length;
		}, 0);
		expect(contiguousEnd).toBe(frame.bytes.length);
	});

	test("situe chaque champ dans la trame", () => {
		const frame = encodeFrame(KALI_SSH_SYN);

		expect(fieldBytes(frame, "tcp", "Destination port")).toBe("0016");
		expect(fieldBytes(frame, "tcp", "Sequence number")).toBe("2573381a");
		expect(fieldBytes(frame, "ipv4", "Time to live")).toBe("40");
		expect(fieldBytes(frame, "ethernet", "Source")).toBe("3a4d3d2332f8");
	});

	test("un routeur qui décrémente le TTL doit recalculer la somme de contrôle IP", () => {
		const forwarded: Packet = {
			...KALI_SSH_SYN,
			ipv4: { ...KALI_SSH_SYN.ipv4, ttl: 63 },
		};

		// TTL − 1 sur l'octet de poids fort du mot → somme de contrôle + 0x0100.
		expect(fieldBytes(encodeFrame(forwarded), "ipv4", "Header checksum")).toBe(
			"36d6",
		);
	});

	test("calcule les longueurs IP et UDP à partir des données portées", () => {
		const frame = encodeFrame(DNS_QUERY);

		expect(fieldBytes(frame, "udp", "Length")).toBe("0026"); // 8 + 30
		expect(fieldBytes(frame, "ipv4", "Total length")).toBe("003a"); // 20 + 38
		expect(fieldBytes(frame, "ipv4", "Protocol")).toBe("11"); // 17 = UDP
		expect(frame.bytes.length).toBe(14 + 20 + 8 + 30);
	});

	test("refuse une adresse MAC invalide", () => {
		const packet: Packet = {
			...KALI_SSH_SYN,
			ethernet: { ...KALI_SSH_SYN.ethernet, sourceMac: "3a:4d:3d" },
		};

		expect(() => encodeFrame(packet)).toThrow("Invalid MAC address");
	});

	test("refuse une adresse IPv4 invalide", () => {
		const packet: Packet = {
			...KALI_SSH_SYN,
			ipv4: { ...KALI_SSH_SYN.ipv4, destinationAddress: "192.168.64.300" },
		};

		expect(() => encodeFrame(packet)).toThrow("Invalid IPv4 address");
	});

	test("refuse un port hors de 0–65535", () => {
		const packet: Packet = {
			...KALI_SSH_SYN,
			transport: { ...SSH_SYN_SEGMENT, sourcePort: 70000 },
		};

		expect(() => encodeFrame(packet)).toThrow("does not fit in 16 bits");
	});

	test("refuse des options TCP qui ne tombent pas sur un multiple de 4 octets", () => {
		const packet: Packet = {
			...KALI_SSH_SYN,
			transport: {
				...SSH_SYN_SEGMENT,
				options: [{ kind: "window-scale", shift: 9 }],
			},
		};

		expect(() => encodeFrame(packet)).toThrow("not a multiple of 4");
	});
});

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

function fieldBytes(frame: Frame, layer: FrameLayer, name: string): string {
	const field = frame.fields.find(
		(candidate) => candidate.layer === layer && candidate.name === name,
	);
	if (field === undefined) throw new Error(`No ${layer} field named ${name}`);
	return toHex(frame.bytes.subarray(field.offset, field.offset + field.length));
}
