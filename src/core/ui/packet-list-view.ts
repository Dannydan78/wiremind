/**
 * La liste des paquets, façon Wireshark. Cliquer sur un paquet le
 * sélectionne.
 *
 * Chaque paquet occupe deux lignes : les colonnes courtes, puis l'Info en
 * pleine largeur, la colonne la plus longue et la plus utile, qui ne tient
 * pas à côté des autres dans la largeur du panneau.
 */

import type { PacketRow } from "../packet-list";
import { createElement } from "./dom";

export type PacketListView = {
	readonly render: (
		rows: readonly PacketRow[],
		selectedPacketId: string | null,
	) => void;
};

const COLUMNS = ["No.", "Source", "Destination", "Protocole", "Taille"];

export function createPacketListView(
	container: HTMLElement,
	onSelect: (packetId: string) => void,
): PacketListView {
	const panel = createElement("section", "panel packet-list");
	panel.append(createElement("h2", "panel-title", "Paquets"));

	const table = createElement("table", "packet-table");
	const header = createElement("thead", "");
	const headerRow = createElement("tr", "");
	for (const column of COLUMNS) {
		headerRow.append(createElement("th", "", column));
	}
	header.append(headerRow);

	const emptyHint = createElement(
		"p",
		"empty-hint",
		"Aucun paquet sur le câble pour l'instant.",
	);
	panel.append(table, emptyHint);
	container.appendChild(panel);

	table.addEventListener("click", (event) => {
		if (!(event.target instanceof Element)) return;
		const packetId =
			event.target.closest<HTMLElement>("[data-packet-id]")?.dataset.packetId;
		if (packetId !== undefined) onSelect(packetId);
	});

	let renderedKey = "";

	return {
		render: (rows, selectedPacketId) => {
			// Rendu à chaque image : on ne reconstruit que si quelque chose change.
			const key = `${selectedPacketId}|${rows.map((row) => `${row.packet.id}:${row.isInFlight}`).join(",")}`;
			if (key === renderedKey) return;
			renderedKey = key;

			emptyHint.hidden = rows.length > 0;
			table.replaceChildren(
				header,
				...rows.map((row) =>
					createPacketEntry(row, row.packet.id === selectedPacketId),
				),
			);
		},
	};
}

/** Un `<tbody>` par paquet : ses deux lignes se surlignent ensemble. */
function createPacketEntry(
	row: PacketRow,
	isSelected: boolean,
): HTMLTableSectionElement {
	const classNames = [
		"packet-entry",
		row.isInFlight ? "is-in-flight" : "",
		isSelected ? "is-selected" : "",
	];
	const entry = createElement("tbody", classNames.join(" ").trim());
	entry.dataset.packetId = row.packet.id;

	const columnsRow = createElement("tr", "packet-columns");
	columnsRow.append(
		createElement("td", "", `${row.number}`),
		createElement("td", "", row.source),
		createElement("td", "", row.destination),
		createElement("td", "", row.protocol),
		createElement("td", "", `${row.frameLengthInBytes}`),
	);

	const infoRow = createElement("tr", "packet-info");
	const infoCell = createElement("td", "", row.info);
	infoCell.colSpan = COLUMNS.length;
	infoRow.append(infoCell);

	entry.append(columnsRow, infoRow);
	return entry;
}
