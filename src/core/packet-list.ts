/**
 * Les lignes de la liste des paquets, comme le panneau du haut de
 * Wireshark : un paquet par ligne, dans l'ordre d'envoi.
 *
 * Pas de colonne « Temps » : le modèle ne contient pas les horodatages de
 * capture, et le temps de l'animation n'a rien à voir avec le temps réel
 * (1,5 s par câble à l'écran, 264 µs dans le labo).
 *
 * La liste montre les trames de tous les câbles. Une vraie capture ne voit
 * que celles du câble où elle est faite : la distinction viendra avec les
 * scénarios à plusieurs sauts.
 */

import { encodeFrame } from "./frame";
import { type Packet, summarizePacket } from "./packet";
import type { ScenarioSnapshot } from "./snapshot";

export type PacketRow = {
	/** Numéro de la ligne, à partir de 1, comme la colonne « No. ». */
	readonly number: number;
	readonly packet: Packet;
	readonly source: string;
	readonly destination: string;
	readonly protocol: string;
	readonly frameLengthInBytes: number;
	readonly info: string;
	/** Le paquet est encore sur le câble, pas encore arrivé. */
	readonly isInFlight: boolean;
};

export function toPacketRows(snapshot: ScenarioSnapshot): PacketRow[] {
	const packetIdsInFlight = new Set(
		snapshot.packetsInFlight
			.filter(({ progress }) => progress < 1)
			.map(({ transmission }) => transmission.packet.id),
	);
	return snapshot.sentTransmissions.map(({ packet }, index) => ({
		number: index + 1,
		packet,
		source: packet.ipv4.sourceAddress,
		destination: packet.ipv4.destinationAddress,
		protocol: packet.transport.protocol.toUpperCase(),
		frameLengthInBytes: encodeFrame(packet).bytes.length,
		info: summarizePacket(packet),
		isInFlight: packetIdsInFlight.has(packet.id),
	}));
}
