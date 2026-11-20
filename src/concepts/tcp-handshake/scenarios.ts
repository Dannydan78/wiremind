/**
 * Handshake TCP entre Kali et Ubuntu, sur le même segment réseau.
 * Toutes les valeurs viennent d'une même connexion capturée dans le labo
 * le 2026-11-19 ; `scenarios.test.ts` vérifie qu'elles se réencodent
 * exactement en les octets capturés.
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

const KALI_PORT = 33534;
const SSH_PORT = 22;
const KALI_INITIAL_SEQUENCE_NUMBER = 2013810038;
const UBUNTU_INITIAL_SEQUENCE_NUMBER = 2329341421;

const LAB_SEGMENT: Topology = {
	machines: [
		{
			id: "kali",
			label: "Kali",
			role: "host",
			os: "kali-linux",
			interfaces: [{ name: "eth0", prefixLength: 24, ...KALI }],
		},
		{
			id: "ubuntu",
			label: "Ubuntu",
			role: "host",
			os: "ubuntu",
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

const KALI_TO_UBUNTU_ETHERNET = {
	sourceMac: KALI.macAddress,
	destinationMac: UBUNTU.macAddress,
};

const SYN: Packet = {
	id: "syn",
	ethernet: KALI_TO_UBUNTU_ETHERNET,
	ipv4: {
		dscp: 46,
		ecn: 0,
		identification: 30257,
		dontFragment: true,
		ttl: 64,
		sourceAddress: KALI.ipv4Address,
		destinationAddress: UBUNTU.ipv4Address,
	},
	transport: {
		protocol: "tcp",
		sourcePort: KALI_PORT,
		destinationPort: SSH_PORT,
		sequenceNumber: KALI_INITIAL_SEQUENCE_NUMBER,
		acknowledgmentNumber: 0,
		flags: ["SYN"],
		windowSize: 64240,
		options: [
			{ kind: "mss", maxSegmentSizeInBytes: 1460 },
			{ kind: "sack-permitted" },
			{ kind: "timestamps", value: 74438675, echoReply: 0 },
			{ kind: "nop" },
			{ kind: "window-scale", shift: 9 },
		],
	},
	payloadSizeInBytes: 0,
};

const SYN_ACK: Packet = {
	id: "syn-ack",
	ethernet: { sourceMac: UBUNTU.macAddress, destinationMac: KALI.macAddress },
	ipv4: {
		dscp: 0,
		ecn: 0,
		identification: 0,
		dontFragment: true,
		ttl: 64,
		sourceAddress: UBUNTU.ipv4Address,
		destinationAddress: KALI.ipv4Address,
	},
	transport: {
		protocol: "tcp",
		sourcePort: SSH_PORT,
		destinationPort: KALI_PORT,
		sequenceNumber: UBUNTU_INITIAL_SEQUENCE_NUMBER,
		acknowledgmentNumber: KALI_INITIAL_SEQUENCE_NUMBER + 1,
		flags: ["SYN", "ACK"],
		windowSize: 65160,
		options: [
			{ kind: "mss", maxSegmentSizeInBytes: 1460 },
			{ kind: "sack-permitted" },
			{ kind: "timestamps", value: 2623568511, echoReply: 74438675 },
			{ kind: "nop" },
			{ kind: "window-scale", shift: 8 },
		],
	},
	payloadSizeInBytes: 0,
};

const ACK: Packet = {
	id: "ack",
	ethernet: KALI_TO_UBUNTU_ETHERNET,
	ipv4: {
		dscp: 46,
		ecn: 0,
		identification: 30258,
		dontFragment: true,
		ttl: 64,
		sourceAddress: KALI.ipv4Address,
		destinationAddress: UBUNTU.ipv4Address,
	},
	transport: {
		protocol: "tcp",
		sourcePort: KALI_PORT,
		destinationPort: SSH_PORT,
		sequenceNumber: KALI_INITIAL_SEQUENCE_NUMBER + 1,
		acknowledgmentNumber: UBUNTU_INITIAL_SEQUENCE_NUMBER + 1,
		flags: ["ACK"],
		windowSize: 126,
		options: [
			{ kind: "nop" },
			{ kind: "nop" },
			{ kind: "timestamps", value: 74438676, echoReply: 2623568511 },
		],
	},
	payloadSizeInBytes: 0,
};

const KALI_SOCKET = `${KALI.ipv4Address}:${KALI_PORT}`;
const UBUNTU_SOCKET = `${UBUNTU.ipv4Address}:${SSH_PORT}`;

/** Les colonnes de `ss -tan`, filtrées sur cette connexion et le port 22. */
const TCP_STATE_COLUMNS = ["État", "Adresse locale", "Adresse distante"];

/** La socket d'écoute de sshd : elle reste là pendant toute la connexion. */
const UBUNTU_LISTENING = ["LISTEN", "0.0.0.0:22", "0.0.0.0:*"];

export const SSH_HANDSHAKE: Scenario = {
	id: "ssh-handshake",
	title: "Handshake TCP vers SSH",
	overview:
		"Kali ouvre une connexion SSH vers Ubuntu. Avant tout échange SSH, " +
		"les noyaux des deux machines établissent la connexion TCP en trois " +
		"paquets : SYN, SYN-ACK, ACK. Les tables montrent l'état de la " +
		"connexion de chaque côté, comme `ss -tan`.",
	topology: LAB_SEGMENT,
	tables: [
		{
			id: "kali-tcp",
			title: "Kali · connexions TCP",
			machineId: "kali",
			columns: TCP_STATE_COLUMNS,
			initialRows: [],
		},
		{
			id: "ubuntu-tcp",
			title: "Ubuntu · connexions TCP",
			machineId: "ubuntu",
			columns: TCP_STATE_COLUMNS,
			initialRows: [UBUNTU_LISTENING],
		},
	],
	connections: [
		{
			id: "ssh",
			endpointMachineIds: ["kali", "ubuntu"],
			label: `TCP ${KALI_SOCKET} ⇄ ${UBUNTU_SOCKET}`,
		},
	],
	steps: [
		{
			title: "SYN",
			explanation:
				"Kali demande l'ouverture d'une connexion vers le port 22 (SSH) " +
				"d'Ubuntu. Il choisit un port source éphémère (33534) et un numéro " +
				"de séquence initial aléatoire (2013810038). Ses options annoncent " +
				"ce qu'il sait faire : MSS 1460, SACK, horodatage, facteur " +
				"d'échelle 9. Côté Kali, la connexion passe à SYN-SENT ; Ubuntu, " +
				"qui n'a encore rien reçu, reste en LISTEN. Les deux machines sont " +
				"sur le même réseau /24 : la trame va directement à l'adresse MAC " +
				"d'Ubuntu.",
			events: [
				{
					kind: "transmission",
					fromMachineId: "kali",
					toMachineId: "ubuntu",
					packet: SYN,
				},
				{
					kind: "table-update",
					tableId: "kali-tcp",
					rows: [["SYN-SENT", KALI_SOCKET, UBUNTU_SOCKET]],
				},
				{ kind: "connection-update", connectionId: "ssh", state: "opening" },
			],
		},
		{
			title: "SYN-ACK",
			explanation:
				"sshd écoute sur le port 22 : le noyau d'Ubuntu accepte. Il crée " +
				"une nouvelle entrée pour cette connexion, en SYN-RECV, à côté de " +
				"la socket d'écoute qui reste en LISTEN pour les autres clients. " +
				"En un seul paquet, il acquitte le SYN (ack 2013810039, soit le " +
				"numéro de Kali + 1) et annonce son propre numéro initial, lui " +
				"aussi aléatoire (2329341421). C'est ce paquet qui fait afficher " +
				"« open » à nmap.",
			events: [
				{
					kind: "transmission",
					fromMachineId: "ubuntu",
					toMachineId: "kali",
					packet: SYN_ACK,
				},
				{
					kind: "table-update",
					tableId: "ubuntu-tcp",
					rows: [UBUNTU_LISTENING, ["SYN-RECV", UBUNTU_SOCKET, KALI_SOCKET]],
				},
			],
		},
		{
			title: "ACK",
			explanation:
				"Kali acquitte le numéro d'Ubuntu (ack 2329341422, soit son " +
				"numéro + 1). Pour Kali, la connexion est établie dès l'envoi : " +
				"elle passe à ESTAB. Ubuntu, qui n'a pas encore reçu cet ACK, " +
				"reste en SYN-RECV. La fenêtre vaut 126, mais avec le facteur " +
				"d'échelle 9 négocié, elle représente 126 × 512 = 64 512 octets.",
			events: [
				{
					kind: "transmission",
					fromMachineId: "kali",
					toMachineId: "ubuntu",
					packet: ACK,
				},
				{
					kind: "table-update",
					tableId: "kali-tcp",
					rows: [["ESTAB", KALI_SOCKET, UBUNTU_SOCKET]],
				},
			],
		},
		{
			title: "Connexion établie",
			explanation:
				"L'ACK est arrivé : la connexion passe à ESTAB chez Ubuntu aussi. " +
				"Chaque côté connaît et a confirmé le numéro de départ de l'autre, " +
				"et SSH peut commencer. La socket d'écoute est toujours en LISTEN : " +
				"chaque connexion a sa propre entrée, exactement comme dans la " +
				"table d'état d'un pare-feu.",
			events: [
				{
					kind: "table-update",
					tableId: "ubuntu-tcp",
					rows: [UBUNTU_LISTENING, ["ESTAB", UBUNTU_SOCKET, KALI_SOCKET]],
				},
				{
					kind: "connection-update",
					connectionId: "ssh",
					state: "established",
				},
			],
		},
	],
};
