/**
 * La liste des concepts affichée par le menu. Un concept disponible est
 * chargé à la demande : son code n'est importé qu'à l'ouverture.
 */

import type { ConceptEntry } from "./core/concept";

export const CONCEPTS: readonly ConceptEntry[] = [
	{
		status: "available",
		id: "tcp-handshake",
		title: "Handshake TCP",
		summary:
			"Comment deux machines ouvrent une connexion TCP : SYN, SYN-ACK, ACK, rejoués octet par octet depuis une capture du labo.",
		load: () => import("./concepts/tcp-handshake"),
	},
	{
		status: "planned",
		id: "firewall",
		title: "Pare-feu (OPNsense / pf)",
		summary:
			"Table d'état, NAT, règles lues de haut en bas, block ou reject : ce que pf décide pour chaque paquet, et ce qu'en voit nmap.",
	},
	{
		status: "planned",
		id: "nat",
		title: "NAT en détail",
		summary:
			"Comment un pare-feu réécrit adresses et ports, et retrouve à qui renvoyer chaque réponse.",
	},
	{
		status: "planned",
		id: "arp-spoofing",
		title: "ARP et ARP spoofing",
		summary:
			"Comment une machine trouve l'adresse MAC de sa voisine, et comment un attaquant s'intercale.",
	},
	{
		status: "planned",
		id: "dns",
		title: "DNS",
		summary: "Du nom de domaine à l'adresse IP : requêtes, réponses et cache.",
	},
	{
		status: "planned",
		id: "vlan-dmz",
		title: "Segmentation VLAN / DMZ",
		summary:
			"Séparer les réseaux pour limiter ce qu'un attaquant atteint après une première intrusion.",
	},
	{
		status: "planned",
		id: "ids-ips",
		title: "IDS / IPS",
		summary: "Repérer, puis bloquer, le trafic qui ressemble à une attaque.",
	},
];
