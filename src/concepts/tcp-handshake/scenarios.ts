/**
 * Handshake TCP entre Kali et Ubuntu, sur le même segment réseau.
 * Toutes les valeurs viennent du labo (capture du 2026-11-19).
 * Le SYN-ACK et l'ACK seront ajoutés à partir de la capture complète.
 */

import type { Packet } from "../../core/packet";
import type { Scenario } from "../../core/scenario";
import type { Topology } from "../../core/topology";

const KALI = {
	ipv4Address: "192.168.64.4",
	macAddress: "3a:4d:3d:23:32:f8",
};

const UBUNTU = {
	ipv4Address: "192.168.64.3",
	macAddress: "fe:75:bd:ba:e1:b6",
};

const LAB_SEGMENT: Topology = {
	machines: [
		{
			id: "kali",
			label: "Kali",
			role: "host",
			interfaces: [{ name: "eth0", prefixLength: 24, ...KALI }],
		},
		{
			id: "ubuntu",
			label: "Ubuntu",
			role: "host",
			interfaces: [{ name: "enp0s1", prefixLength: 24, ...UBUNTU }],
		},
	],
	links: [
		{
			id: "kali-ubuntu",
			ends: [
				{ machineId: "kali", interfaceName: "eth0" },
				{ machineId: "ubuntu", interfaceName: "enp0s1" },
			],
		},
	],
};

const KALI_SYN: Packet = {
	id: "kali-syn",
	ethernet: { sourceMac: KALI.macAddress, destinationMac: UBUNTU.macAddress },
	ipv4: {
		dscp: 46,
		ecn: 0,
		identification: 726,
		dontFragment: true,
		ttl: 64,
		sourceAddress: KALI.ipv4Address,
		destinationAddress: UBUNTU.ipv4Address,
	},
	transport: {
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
	},
	payloadSizeInBytes: 0,
};

export const SSH_HANDSHAKE: Scenario = {
	id: "ssh-handshake",
	title: "Handshake TCP vers SSH",
	overview:
		"Kali ouvre une connexion SSH vers Ubuntu. Avant tout échange SSH, " +
		"TCP établit la connexion en trois paquets : SYN, SYN-ACK, ACK.",
	topology: LAB_SEGMENT,
	steps: [
		{
			title: "SYN",
			explanation:
				"Kali demande l'ouverture d'une connexion vers le port 22 (SSH) " +
				"d'Ubuntu. Il choisit un port source éphémère (58228) et un numéro " +
				"de séquence initial aléatoire (628307994). Les deux machines sont " +
				"sur le même réseau /24 : la trame va directement à l'adresse MAC " +
				"d'Ubuntu, sans passer par un routeur.",
			events: [
				{
					kind: "transmission",
					fromMachineId: "kali",
					toMachineId: "ubuntu",
					packet: KALI_SYN,
				},
			],
		},
	],
};
