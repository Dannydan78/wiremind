/**
 * Encode un paquet en octets, tels qu'ils passent sur le câble, en gardant
 * la position de chaque champ pour l'inspecteur.
 *
 * Les champs dérivables (EtherType, longueurs, protocole, sommes de
 * contrôle) sont calculés ici à partir des couches du paquet.
 */

import type {
	EthernetHeader,
	IcmpMessage,
	Ipv4Header,
	Packet,
	TcpFlag,
	TcpOption,
	TcpSegment,
	TransportLayer,
	UdpDatagram,
} from "./packet";

export type FrameLayer =
	| "ethernet"
	| "ipv4"
	| "tcp"
	| "udp"
	| "icmp"
	| "payload";

/** Un champ de la trame : ses octets sont `bytes[offset .. offset + length[`. */
export type FrameField = {
	readonly layer: FrameLayer;
	/** Nom du champ, tel que Wireshark l'affiche. */
	readonly name: string;
	readonly offset: number;
	readonly length: number;
};

export type Frame = {
	readonly bytes: Uint8Array;
	readonly fields: readonly FrameField[];
};

export function encodeFrame(packet: Packet): Frame {
	const segmentFields = encodeSegment(packet);
	const segmentLengthInBytes = lengthOf(segmentFields);
	return layOut([
		...encodeEthernet(packet.ethernet),
		...encodeIpv4(packet.ipv4, packet.transport, segmentLengthInBytes),
		...segmentFields,
	]);
}

/** Un champ avant placement : ses octets, sans position. */
type EncodedField = {
	readonly layer: FrameLayer;
	readonly name: string;
	readonly bytes: readonly number[];
};

const ETHERTYPE_IPV4 = 0x0800;
const IPV4_VERSION = 4;
const IPV4_HEADER_LENGTH_IN_BYTES = 20;
const TCP_HEADER_LENGTH_WITHOUT_OPTIONS_IN_BYTES = 20;
const UDP_HEADER_LENGTH_IN_BYTES = 8;
const IP_CHECKSUM_FIELD = "Header checksum";
const TRANSPORT_CHECKSUM_FIELD = "Checksum";

const IP_PROTOCOL_NUMBERS: Record<TransportLayer["protocol"], number> = {
	icmp: 1,
	tcp: 6,
	udp: 17,
};

const TCP_FLAG_BITS: Record<TcpFlag, number> = {
	FIN: 0x01,
	SYN: 0x02,
	RST: 0x04,
	PSH: 0x08,
	ACK: 0x10,
	URG: 0x20,
};

function encodeEthernet(ethernet: EthernetHeader): EncodedField[] {
	return [
		{
			layer: "ethernet",
			name: "Destination",
			bytes: parseMac(ethernet.destinationMac),
		},
		{ layer: "ethernet", name: "Source", bytes: parseMac(ethernet.sourceMac) },
		{ layer: "ethernet", name: "Type", bytes: toUint(ETHERTYPE_IPV4, 2) },
	];
}

function encodeIpv4(
	ipv4: Ipv4Header,
	transport: TransportLayer,
	segmentLengthInBytes: number,
): EncodedField[] {
	assertFitsInBits(ipv4.dscp, 6, "DSCP");
	assertFitsInBits(ipv4.ecn, 2, "ECN");
	const headerLengthInWords = IPV4_HEADER_LENGTH_IN_BYTES / 4;
	const dontFragmentBit = ipv4.dontFragment ? 0x4000 : 0;

	const fields: EncodedField[] = [
		{
			layer: "ipv4",
			name: "Version / Header length",
			bytes: toUint(IPV4_VERSION * 16 + headerLengthInWords, 1),
		},
		{
			layer: "ipv4",
			name: "DSCP / ECN",
			bytes: toUint(ipv4.dscp * 4 + ipv4.ecn, 1),
		},
		{
			layer: "ipv4",
			name: "Total length",
			bytes: toUint(IPV4_HEADER_LENGTH_IN_BYTES + segmentLengthInBytes, 2),
		},
		{
			layer: "ipv4",
			name: "Identification",
			bytes: toUint(ipv4.identification, 2),
		},
		// Le décalage de fragment vaut toujours 0 : la fragmentation
		// n'est pas modélisée.
		{
			layer: "ipv4",
			name: "Flags / Fragment offset",
			bytes: toUint(dontFragmentBit, 2),
		},
		{ layer: "ipv4", name: "Time to live", bytes: toUint(ipv4.ttl, 1) },
		{
			layer: "ipv4",
			name: "Protocol",
			bytes: toUint(IP_PROTOCOL_NUMBERS[transport.protocol], 1),
		},
		{ layer: "ipv4", name: IP_CHECKSUM_FIELD, bytes: [0, 0] },
		{
			layer: "ipv4",
			name: "Source address",
			bytes: parseIpv4(ipv4.sourceAddress),
		},
		{
			layer: "ipv4",
			name: "Destination address",
			bytes: parseIpv4(ipv4.destinationAddress),
		},
	];
	// La somme de contrôle IP ne couvre que l'en-tête IP.
	return withChecksum(
		fields,
		IP_CHECKSUM_FIELD,
		computeInternetChecksum(bytesOf(fields)),
	);
}

/** L'en-tête de transport et les données qu'il porte. */
function encodeSegment(packet: Packet): EncodedField[] {
	const { transport, ipv4 } = packet;
	const fields = [
		...encodeTransportHeader(transport, packet.payloadSizeInBytes),
		...encodePayload(packet.payloadSizeInBytes),
	];
	// ICMP ne protège que son propre message. TCP et UDP protègent aussi
	// un « pseudo-en-tête » avec les adresses IP : un segment remis à la
	// mauvaise machine est ainsi détecté.
	const checksummedBytes =
		transport.protocol === "icmp"
			? bytesOf(fields)
			: [
					...buildPseudoHeader(ipv4, transport, lengthOf(fields)),
					...bytesOf(fields),
				];
	return withChecksum(
		fields,
		TRANSPORT_CHECKSUM_FIELD,
		computeInternetChecksum(checksummedBytes),
	);
}

function encodeTransportHeader(
	transport: TransportLayer,
	payloadSizeInBytes: number,
): EncodedField[] {
	switch (transport.protocol) {
		case "tcp":
			return encodeTcp(transport);
		case "udp":
			return encodeUdp(transport, payloadSizeInBytes);
		case "icmp":
			return encodeIcmp(transport);
		default: {
			const unhandled: never = transport;
			throw new Error(`Unhandled transport: ${JSON.stringify(unhandled)}`);
		}
	}
}

function encodeTcp(tcp: TcpSegment): EncodedField[] {
	const optionFields = tcp.options.map(encodeTcpOption);
	const optionsLengthInBytes = lengthOf(optionFields);
	// La longueur d'en-tête se compte en mots de 4 octets : les options
	// doivent tomber juste, d'où les NOP de bourrage.
	if (optionsLengthInBytes % 4 !== 0) {
		throw new Error(
			`TCP options take ${optionsLengthInBytes} bytes, not a multiple of 4`,
		);
	}
	const headerLengthInWords =
		(TCP_HEADER_LENGTH_WITHOUT_OPTIONS_IN_BYTES + optionsLengthInBytes) / 4;
	assertFitsInBits(headerLengthInWords, 4, "TCP header length");
	const flagBits = tcp.flags.reduce(
		(bits, flag) => bits | TCP_FLAG_BITS[flag],
		0,
	);

	return [
		{ layer: "tcp", name: "Source port", bytes: toUint(tcp.sourcePort, 2) },
		{
			layer: "tcp",
			name: "Destination port",
			bytes: toUint(tcp.destinationPort, 2),
		},
		{
			layer: "tcp",
			name: "Sequence number",
			bytes: toUint(tcp.sequenceNumber, 4),
		},
		{
			layer: "tcp",
			name: "Acknowledgment number",
			bytes: toUint(tcp.acknowledgmentNumber, 4),
		},
		{
			layer: "tcp",
			name: "Header length / Flags",
			bytes: toUint(headerLengthInWords * 4096 + flagBits, 2),
		},
		{ layer: "tcp", name: "Window", bytes: toUint(tcp.windowSize, 2) },
		{ layer: "tcp", name: TRANSPORT_CHECKSUM_FIELD, bytes: [0, 0] },
		// Le pointeur urgent vaut 0 : le flag URG n'est jamais utilisé en pratique.
		{ layer: "tcp", name: "Urgent pointer", bytes: [0, 0] },
		...optionFields,
	];
}

function encodeTcpOption(option: TcpOption): EncodedField {
	switch (option.kind) {
		case "mss":
			return {
				layer: "tcp",
				name: "Option: Maximum segment size",
				bytes: [2, 4, ...toUint(option.maxSegmentSizeInBytes, 2)],
			};
		case "sack-permitted":
			return { layer: "tcp", name: "Option: SACK permitted", bytes: [4, 2] };
		case "timestamps":
			return {
				layer: "tcp",
				name: "Option: Timestamps",
				bytes: [
					8,
					10,
					...toUint(option.value, 4),
					...toUint(option.echoReply, 4),
				],
			};
		case "nop":
			return { layer: "tcp", name: "Option: No-Operation", bytes: [1] };
		case "window-scale":
			return {
				layer: "tcp",
				name: "Option: Window scale",
				bytes: [3, 3, ...toUint(option.shift, 1)],
			};
		default: {
			const unhandled: never = option;
			throw new Error(`Unhandled TCP option: ${JSON.stringify(unhandled)}`);
		}
	}
}

function encodeUdp(
	udp: UdpDatagram,
	payloadSizeInBytes: number,
): EncodedField[] {
	return [
		{ layer: "udp", name: "Source port", bytes: toUint(udp.sourcePort, 2) },
		{
			layer: "udp",
			name: "Destination port",
			bytes: toUint(udp.destinationPort, 2),
		},
		{
			layer: "udp",
			name: "Length",
			bytes: toUint(UDP_HEADER_LENGTH_IN_BYTES + payloadSizeInBytes, 2),
		},
		{ layer: "udp", name: TRANSPORT_CHECKSUM_FIELD, bytes: [0, 0] },
	];
}

function encodeIcmp(icmp: IcmpMessage): EncodedField[] {
	return [
		{ layer: "icmp", name: "Type", bytes: toUint(icmp.type, 1) },
		{ layer: "icmp", name: "Code", bytes: toUint(icmp.code, 1) },
		{ layer: "icmp", name: TRANSPORT_CHECKSUM_FIELD, bytes: [0, 0] },
		{ layer: "icmp", name: "Rest of header", bytes: [0, 0, 0, 0] },
	];
}

function encodePayload(payloadSizeInBytes: number): EncodedField[] {
	if (payloadSizeInBytes === 0) return [];
	return [
		{
			layer: "payload",
			name: "Payload",
			bytes: new Array<number>(payloadSizeInBytes).fill(0),
		},
	];
}

function buildPseudoHeader(
	ipv4: Ipv4Header,
	transport: TransportLayer,
	segmentLengthInBytes: number,
): number[] {
	return [
		...parseIpv4(ipv4.sourceAddress),
		...parseIpv4(ipv4.destinationAddress),
		0,
		IP_PROTOCOL_NUMBERS[transport.protocol],
		...toUint(segmentLengthInBytes, 2),
	];
}

/**
 * Somme de contrôle d'Internet (RFC 1071) : somme des mots de 16 bits en
 * complément à un, puis inversion des bits.
 */
function computeInternetChecksum(bytes: readonly number[]): number[] {
	let sum = 0;
	for (let i = 0; i < bytes.length; i += 2) {
		sum += (bytes[i] ?? 0) * 256 + (bytes[i + 1] ?? 0);
	}
	while (sum > 0xffff) {
		sum = (sum % 0x10000) + Math.floor(sum / 0x10000);
	}
	return toUint(0xffff - sum, 2);
}

function withChecksum(
	fields: readonly EncodedField[],
	checksumFieldName: string,
	checksum: readonly number[],
): EncodedField[] {
	return fields.map((field) =>
		field.name === checksumFieldName ? { ...field, bytes: checksum } : field,
	);
}

function layOut(encodedFields: readonly EncodedField[]): Frame {
	const fields: FrameField[] = [];
	let offset = 0;
	for (const { layer, name, bytes } of encodedFields) {
		fields.push({ layer, name, offset, length: bytes.length });
		offset += bytes.length;
	}
	return { bytes: Uint8Array.from(bytesOf(encodedFields)), fields };
}

function bytesOf(fields: readonly EncodedField[]): number[] {
	return fields.flatMap((field) => field.bytes);
}

function lengthOf(fields: readonly EncodedField[]): number {
	return fields.reduce((total, field) => total + field.bytes.length, 0);
}

/** Entier non signé, octet de poids fort en premier (ordre réseau). */
function toUint(value: number, sizeInBytes: number): number[] {
	assertFitsInBits(value, sizeInBytes * 8, "Value");
	return Array.from(
		{ length: sizeInBytes },
		(_, index) => Math.floor(value / 256 ** (sizeInBytes - 1 - index)) % 256,
	);
}

function assertFitsInBits(value: number, bitCount: number, label: string) {
	const isValid =
		Number.isInteger(value) && value >= 0 && value < 2 ** bitCount;
	if (!isValid) {
		throw new Error(`${label} ${value} does not fit in ${bitCount} bits`);
	}
}

function parseMac(macAddress: string): number[] {
	const parts = macAddress.split(":");
	const isValid =
		parts.length === 6 && parts.every((part) => /^[0-9a-f]{2}$/i.test(part));
	if (!isValid) throw new Error(`Invalid MAC address: ${macAddress}`);
	return parts.map((part) => Number.parseInt(part, 16));
}

function parseIpv4(address: string): number[] {
	const parts = address.split(".");
	const isValid =
		parts.length === 4 &&
		parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
	if (!isValid) throw new Error(`Invalid IPv4 address: ${address}`);
	return parts.map(Number);
}
