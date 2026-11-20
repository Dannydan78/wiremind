/**
 * L'inspecteur de paquet : les couches et leurs champs, puis les octets en
 * hexadécimal. Cliquer sur un champ met ses octets en évidence ; cliquer
 * sur un octet sélectionne le champ qui le contient.
 */

import {
	encodeFrame,
	type Frame,
	type FrameField,
	type FrameLayer,
	findFieldAt,
} from "../frame";
import { type Packet, summarizePacket } from "../packet";
import { createElement } from "./dom";

export type InspectorView = {
	readonly render: (packet: Packet | null) => void;
};

const LAYER_TITLES: Record<FrameLayer, string> = {
	ethernet: "Ethernet II",
	ipv4: "Internet Protocol Version 4",
	tcp: "Transmission Control Protocol",
	udp: "User Datagram Protocol",
	icmp: "Internet Control Message Protocol",
	payload: "Données",
};

const BYTES_PER_LINE = 16;

export function createInspectorView(container: HTMLElement): InspectorView {
	const panel = createElement("section", "panel inspector");
	container.appendChild(panel);

	return {
		render: (packet) => {
			panel.replaceChildren(createElement("h2", "panel-title", "Inspecteur"));
			if (packet === null) {
				panel.append(
					createElement(
						"p",
						"empty-hint",
						"Clique sur un paquet, dans la scène ou dans la liste.",
					),
				);
				return;
			}
			panel.append(
				createElement("p", "inspector-summary", summarizePacket(packet)),
			);
			const frame = encodeFrame(packet);
			const fieldTree = createFieldTree(frame);
			const hexDump = createHexDump(frame);
			panel.append(fieldTree, hexDump);

			const select = (field: FrameField | undefined) => {
				if (field === undefined) return;
				markSelectedField(fieldTree, frame.fields.indexOf(field));
				highlightBytes(hexDump, field);
			};
			fieldTree.addEventListener("click", (event) => {
				select(frame.fields[elementIndexOf(event, "fieldIndex")]);
			});
			hexDump.addEventListener("click", (event) => {
				select(findFieldAt(frame, elementIndexOf(event, "offset")));
			});
		},
	};
}

function createFieldTree(frame: Frame): HTMLElement {
	const tree = createElement("div", "field-tree");
	const layers = [...new Set(frame.fields.map((field) => field.layer))];
	for (const layer of layers) {
		const layerBlock = createElement("details", `layer layer-${layer}`);
		layerBlock.open = true;
		layerBlock.append(
			createElement("summary", "layer-title", LAYER_TITLES[layer]),
		);
		frame.fields.forEach((field, fieldIndex) => {
			if (field.layer !== layer) return;
			const row = createElement("div", "field-row");
			row.dataset.fieldIndex = `${fieldIndex}`;
			row.append(
				createElement("span", "field-name", field.name),
				createElement("span", "field-value", field.value),
			);
			layerBlock.append(row);
		});
		tree.append(layerBlock);
	}
	return tree;
}

/**
 * Position et octets, 16 par ligne comme `tcpdump -XX` : les positions
 * (0000, 0010…) se comparent ligne à ligne avec une capture du labo.
 *
 * Pas de colonne ASCII : les en-têtes sont des nombres binaires et le
 * contenu n'est pas modélisé, elle n'afficherait que du bruit. Elle
 * reviendra avec un contenu lisible (une requête HTTP, par exemple).
 */
function createHexDump(frame: Frame): HTMLElement {
	const dump = createElement("div", "hex-dump");
	for (
		let lineStart = 0;
		lineStart < frame.bytes.length;
		lineStart += BYTES_PER_LINE
	) {
		const line = createElement("div", "hex-line");
		line.append(
			createElement(
				"span",
				"hex-offset",
				lineStart.toString(16).padStart(4, "0"),
			),
		);
		const hexBytes = createElement("span", "hex-bytes");
		const lineBytes = frame.bytes.subarray(
			lineStart,
			lineStart + BYTES_PER_LINE,
		);
		lineBytes.forEach((byte, indexInLine) => {
			const hexByte = createElement(
				"span",
				"hex-byte",
				byte.toString(16).padStart(2, "0"),
			);
			hexByte.dataset.offset = `${lineStart + indexInLine}`;
			hexBytes.append(hexByte);
		});
		line.append(hexBytes);
		dump.append(line);
	}
	return dump;
}

function markSelectedField(fieldTree: HTMLElement, fieldIndex: number): void {
	for (const row of fieldTree.querySelectorAll<HTMLElement>(".field-row")) {
		row.classList.toggle(
			"is-selected",
			row.dataset.fieldIndex === `${fieldIndex}`,
		);
	}
}

function highlightBytes(hexDump: HTMLElement, field: FrameField): void {
	for (const byte of hexDump.querySelectorAll<HTMLElement>(".hex-byte")) {
		const offset = Number(byte.dataset.offset);
		const isInField =
			offset >= field.offset && offset < field.offset + field.length;
		byte.classList.toggle("is-highlighted", isInField);
	}
}

/** L'index porté par l'élément cliqué (`data-<key>`), ou −1. */
function elementIndexOf(event: Event, key: "fieldIndex" | "offset"): number {
	if (!(event.target instanceof HTMLElement)) return -1;
	const holder = event.target.closest<HTMLElement>(
		key === "fieldIndex" ? "[data-field-index]" : "[data-offset]",
	);
	const index = holder?.dataset[key];
	return index === undefined ? -1 : Number(index);
}
