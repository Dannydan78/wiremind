import * as THREE from "three";
import { SSH_HANDSHAKE } from "./concepts/tcp-handshake/scenarios";
import { layOutMachines } from "./core/layout";
import { toPacketRows } from "./core/packet-list";
import { createPacketView } from "./core/packet-view";
import {
	actionForKey,
	applyTimelineCommand,
	type TimelineCommand,
} from "./core/playback";
import { assertValidScenario, findPacket } from "./core/scenario";
import { createStage } from "./core/scene";
import { snapshotAt, stepDurationsOf } from "./core/snapshot";
import {
	advance,
	createTimeline,
	positionOf,
	type Timeline,
} from "./core/timeline";
import { createTopologyView } from "./core/topology-view";
import { createElement } from "./core/ui/dom";
import { createHelpOverlay } from "./core/ui/help-overlay";
import { createInspectorView } from "./core/ui/inspector-view";
import { createPacketListView } from "./core/ui/packet-list-view";
import { createPlaybackBar } from "./core/ui/playback-bar";
import { createStepPanel } from "./core/ui/step-panel";

// Point d'entrée provisoire : charge directement le scénario de validation.
// Le menu des concepts (étape 6) le remplacera.

const scenario = SSH_HANDSHAKE;
assertValidScenario(scenario);

const stage = createStage(document.body);
const positions = layOutMachines(scenario.topology);
stage.scene.add(createTopologyView(scenario.topology, positions));
const packetView = createPacketView(positions);
stage.scene.add(packetView.group);

const sidebar = createElement("aside", "sidebar");
document.body.appendChild(sidebar);
const stepPanel = createStepPanel(sidebar, scenario);
const packetListView = createPacketListView(sidebar, (packetId) =>
	selectPacket(packetId),
);
const inspectorView = createInspectorView(sidebar);
inspectorView.render(null);

let timeline: Timeline = createTimeline(stepDurationsOf(scenario));
let selectedPacketId: string | null = null;

function selectPacket(packetId: string | null): void {
	selectedPacketId = packetId;
	const packet = packetId === null ? undefined : findPacket(scenario, packetId);
	inspectorView.render(packet ?? null);
}

// Le seul endroit où la timeline change sur une action de l'utilisateur :
// boutons et clavier passent tous par ici.
function runCommand(command: TimelineCommand): void {
	timeline = applyTimelineCommand(timeline, command);
}

const helpOverlay = createHelpOverlay(document.body);
const playbackBar = createPlaybackBar(
	document.body,
	scenario.steps,
	runCommand,
	helpOverlay.toggle,
);

window.addEventListener("keydown", (event) => {
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
});

// Un glisser de la souris fait tourner la caméra : seul un clic presque
// immobile sélectionne un paquet.
const MAX_CLICK_DRIFT_IN_PX = 4;
let pointerDownAt: { x: number; y: number } | null = null;

stage.canvas.addEventListener("pointerdown", (event) => {
	pointerDownAt = { x: event.clientX, y: event.clientY };
});

stage.canvas.addEventListener("pointerup", (event) => {
	if (pointerDownAt === null) return;
	const drift = Math.hypot(
		event.clientX - pointerDownAt.x,
		event.clientY - pointerDownAt.y,
	);
	pointerDownAt = null;
	if (drift > MAX_CLICK_DRIFT_IN_PX) return;

	const pointer = new THREE.Vector2(
		(event.clientX / window.innerWidth) * 2 - 1,
		-(event.clientY / window.innerHeight) * 2 + 1,
	);
	selectPacket(packetView.findPacketAt(pointer, stage.camera)?.id ?? null);
});

stage.start((frameDurationInMs) => {
	timeline = advance(timeline, frameDurationInMs);
	const snapshot = snapshotAt(scenario, positionOf(timeline));
	packetView.render(snapshot, selectedPacketId);
	stepPanel.render(snapshot);
	packetListView.render(toPacketRows(snapshot), selectedPacketId);
	playbackBar.render(timeline);
});
