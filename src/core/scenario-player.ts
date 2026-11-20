/**
 * Le lecteur de scénario : scène 3D, panneaux, barre de lecture, clavier.
 * Il joue n'importe quel scénario et sait se démonter sans rien laisser
 * derrière lui (DOM, écouteurs, mémoire GPU).
 */

import * as THREE from "three";
import type { Unmount } from "./concept";
import { layOutMachines } from "./layout";
import { toPacketRows } from "./packet-list";
import { createPacketView } from "./packet-view";
import {
	actionForKey,
	applyTimelineCommand,
	type TimelineCommand,
} from "./playback";
import { assertValidScenario, findPacket, type Scenario } from "./scenario";
import { createStage } from "./scene";
import { snapshotAt, stepDurationsOf } from "./snapshot";
import { advance, createTimeline, positionOf, type Timeline } from "./timeline";
import { createTopologyView } from "./topology-view";
import { createElement } from "./ui/dom";
import { createHelpOverlay } from "./ui/help-overlay";
import { createInspectorView } from "./ui/inspector-view";
import { createPacketListView } from "./ui/packet-list-view";
import { createPlaybackBar } from "./ui/playback-bar";
import { createStepPanel } from "./ui/step-panel";
import { createTablesView } from "./ui/tables-view";
import { toNormalizedPointer } from "./viewport";

/** Un glisser fait tourner la caméra : seul un clic presque immobile sélectionne. */
const MAX_CLICK_DRIFT_IN_PX = 4;

export function mountScenarioPlayer(
	container: HTMLElement,
	scenario: Scenario,
): Unmount {
	assertValidScenario(scenario);
	// Tous les écouteurs sont rattachés à ce signal : un seul abort() les retire.
	const listeners = new AbortController();
	const { signal } = listeners;

	// La scène a sa propre zone, à gauche de la colonne latérale : elle est
	// centrée dans ce qu'on voit au lieu de passer sous les panneaux.
	const viewport = createElement("div", "viewport");
	container.appendChild(viewport);
	const stage = createStage(viewport);
	const positions = layOutMachines(scenario.topology);
	stage.scene.add(createTopologyView(scenario.topology, positions));
	const packetView = createPacketView(positions);
	stage.scene.add(packetView.group);

	const sidebar = createElement("aside", "sidebar");
	container.appendChild(sidebar);
	const stepPanel = createStepPanel(sidebar, scenario);
	const tablesView = createTablesView(sidebar);
	const packetListView = createPacketListView(sidebar, (packetId) =>
		selectPacket(packetId),
	);
	const inspectorView = createInspectorView(sidebar);
	inspectorView.render(null);

	let timeline: Timeline = createTimeline(stepDurationsOf(scenario));
	let selectedPacketId: string | null = null;

	function selectPacket(packetId: string | null): void {
		selectedPacketId = packetId;
		const packet =
			packetId === null ? undefined : findPacket(scenario, packetId);
		inspectorView.render(packet ?? null);
	}

	// Le seul endroit où la timeline change sur une action de l'utilisateur :
	// boutons et clavier passent tous par ici.
	function runCommand(command: TimelineCommand): void {
		timeline = applyTimelineCommand(timeline, command);
	}

	const helpOverlay = createHelpOverlay(container);
	const playbackBar = createPlaybackBar(
		container,
		scenario.steps,
		runCommand,
		helpOverlay.toggle,
	);

	window.addEventListener(
		"keydown",
		(event) => {
			// Laisse passer Cmd+R, Ctrl+C… : ce sont des raccourcis du navigateur.
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			const action = actionForKey(event, scenario.steps.length);
			if (action === undefined) return;
			event.preventDefault();
			switch (action.kind) {
				case "toggle-help":
					helpOverlay.toggle();
					return;
				case "close-help":
					helpOverlay.close();
					return;
				default:
					runCommand(action);
			}
		},
		{ signal },
	);

	let pointerDownAt: { x: number; y: number } | null = null;
	stage.canvas.addEventListener(
		"pointerdown",
		(event) => {
			pointerDownAt = { x: event.clientX, y: event.clientY };
		},
		{ signal },
	);
	stage.canvas.addEventListener(
		"pointerup",
		(event) => {
			if (pointerDownAt === null) return;
			const drift = Math.hypot(
				event.clientX - pointerDownAt.x,
				event.clientY - pointerDownAt.y,
			);
			pointerDownAt = null;
			if (drift > MAX_CLICK_DRIFT_IN_PX) return;

			const { x, y } = toNormalizedPointer(
				event,
				stage.canvas.getBoundingClientRect(),
			);
			const pointer = new THREE.Vector2(x, y);
			selectPacket(packetView.findPacketAt(pointer, stage.camera)?.id ?? null);
		},
		{ signal },
	);

	stage.start((frameDurationInMs) => {
		timeline = advance(timeline, frameDurationInMs);
		const snapshot = snapshotAt(scenario, positionOf(timeline));
		packetView.render(snapshot, selectedPacketId);
		stepPanel.render(snapshot);
		tablesView.render(snapshot.stepIndex, snapshot.tables);
		packetListView.render(toPacketRows(snapshot), selectedPacketId);
		playbackBar.render(timeline);
	});

	return () => {
		listeners.abort();
		stage.dispose();
		container.replaceChildren();
	};
}
