/**
 * Un paquet tel qu'il passe sur un câble : une trame Ethernet qui contient
 * un datagramme IPv4, qui contient un segment TCP, un datagramme UDP ou un
 * message ICMP.
 *
 * Les champs dérivables (EtherType, numéro de protocole IP, longueurs,
 * sommes de contrôle) ne sont pas stockés : l'encodeur en octets les
 * calculera à partir des couches.
 */

export type EthernetHeader = {
	readonly sourceMac: string;
	readonly destinationMac: string;
};

export type Ipv4Header = {
	/** Priorité demandée au réseau (46 = EF, trafic interactif). 6 bits. */
	readonly dscp: number;
	/** Signalement de congestion. 2 bits, 0 = non utilisé. */
	readonly ecn: number;
	/** Numéro qui permet de recoller les fragments d'un même datagramme. */
	readonly identification: number;
	/** « Don't Fragment » : interdit aux routeurs de découper le paquet. */
	readonly dontFragment: boolean;
	/** Décrémenté par chaque routeur ; à 0, le paquet est détruit. */
	readonly ttl: number;
	readonly sourceAddress: string;
	readonly destinationAddress: string;
};

export type TcpFlag = "SYN" | "ACK" | "FIN" | "RST" | "PSH" | "URG";

/**
 * Options négociées surtout pendant le handshake. L'ordre et les NOP
 * (octets de bourrage) sont conservés : ils font partie des octets réels.
 */
export type TcpOption =
	/** Taille maximale de segment acceptée (1460 = 1500 − 20 IP − 20 TCP). */
	| { readonly kind: "mss"; readonly maxSegmentSizeInBytes: number }
	/** Accepte les acquittements sélectifs (SACK). */
	| { readonly kind: "sack-permitted" }
	/** Horodatage, utilisé pour mesurer le temps d'aller-retour. */
	| {
			readonly kind: "timestamps";
			readonly value: number;
			readonly echoReply: number;
	  }
	/** Octet de bourrage, pour aligner l'option suivante. */
	| { readonly kind: "nop" }
	/** La fenêtre réelle vaut la fenêtre annoncée × 2^shift. */
	| { readonly kind: "window-scale"; readonly shift: number };

export type TcpSegment = {
	readonly protocol: "tcp";
	readonly sourcePort: number;
	readonly destinationPort: number;
	readonly sequenceNumber: number;
	readonly acknowledgmentNumber: number;
	readonly flags: readonly TcpFlag[];
	/** Nombre d'octets que l'émetteur accepte de recevoir avant un ACK. */
	readonly windowSize: number;
	readonly options: readonly TcpOption[];
};

export type UdpDatagram = {
	readonly protocol: "udp";
	readonly sourcePort: number;
	readonly destinationPort: number;
};

/**
 * Les 4 octets qui suivent la somme de contrôle (identifiant et numéro de
 * séquence d'un echo, par exemple) ne sont pas encore modélisés : ils seront
 * ajoutés avec le premier scénario de ping, testés contre une vraie capture.
 */
export type IcmpMessage = {
	readonly protocol: "icmp";
	/** 8 = echo request, 0 = echo reply, 3 = destination unreachable… */
	readonly type: number;
	readonly code: number;
};

export type TransportLayer = TcpSegment | UdpDatagram | IcmpMessage;

export type Packet = {
	readonly id: string;
	readonly ethernet: EthernetHeader;
	readonly ipv4: Ipv4Header;
	readonly transport: TransportLayer;
	/** Le contenu n'est pas modélisé : l'encodeur écrit des octets nuls. */
	readonly payloadSizeInBytes: number;
};

/** Résumé d'une ligne, comme la colonne « Info » de Wireshark. */
export function summarizePacket(packet: Packet): string {
	const { transport, payloadSizeInBytes } = packet;
	switch (transport.protocol) {
		case "tcp":
			return summarizeTcp(transport, payloadSizeInBytes);
		case "udp":
			return `${transport.sourcePort} → ${transport.destinationPort} Len=${payloadSizeInBytes}`;
		case "icmp":
			return (
				ICMP_TYPE_NAMES[transport.type] ??
				`Type=${transport.type} Code=${transport.code}`
			);
		default: {
			const unhandled: never = transport;
			throw new Error(`Unhandled transport: ${JSON.stringify(unhandled)}`);
		}
	}
}

/** L'ordre dans lequel Wireshark affiche les flags : [SYN, ACK], [FIN, ACK]… */
const WIRESHARK_FLAG_ORDER: readonly TcpFlag[] = [
	"FIN",
	"SYN",
	"RST",
	"PSH",
	"ACK",
	"URG",
];

const ICMP_TYPE_NAMES: Partial<Record<number, string>> = {
	0: "Echo (ping) reply",
	3: "Destination unreachable",
	8: "Echo (ping) request",
	11: "Time-to-live exceeded",
};

function summarizeTcp(tcp: TcpSegment, payloadSizeInBytes: number): string {
	const flags = WIRESHARK_FLAG_ORDER.filter((flag) => tcp.flags.includes(flag));
	// Le numéro d'acquittement n'a de sens que si le flag ACK est levé.
	const acknowledgment = tcp.flags.includes("ACK")
		? ` Ack=${tcp.acknowledgmentNumber}`
		: "";
	return (
		`${tcp.sourcePort} → ${tcp.destinationPort} [${flags.join(", ")}]` +
		` Seq=${tcp.sequenceNumber}${acknowledgment}` +
		` Win=${tcp.windowSize} Len=${payloadSizeInBytes}`
	);
}
