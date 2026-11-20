import GUI from "lil-gui";
import * as THREE from "three";
import { SSH_HANDSHAKE } from "./concepts/tcp-handshake/scenarios";
import { layOutMachines } from "./core/layout";
import { toPacketRows } from "./core/packet-list";
import { createPacketView } from "./core/packet-view";
import { assertValidScenario, findPacket } from "./core/scenario";
import { createStage } from "./core/scene";
import { snapshotAt, stepDurationsOf } from "./core/snapshot";
import {
	advance,
	createTimeline,
	goToStep,
	pause,
	play,
	positionOf,
	restart,
	setSpeed,
	stepBackward,
	stepForward,
	type Timeline,
} from "./core/timeline";
import { createTopologyView } from "./core/topology-view";
import { createElement } from "./core/ui/dom";
import { createInspectorView } from "./core/ui/inspector-view";
import { createPacketListView } from "./core/ui/packet-list-view";
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

const playbackControls = {
	togglePlayback: () => {
		timeline =
			timeline.playback === "playing" ? pause(timeline) : play(timeline);
	},
	stepBackward: () => {
		timeline = stepBackward(timeline);
	},
	stepForward: () => {
		timeline = stepForward(timeline);
	},
	restart: () => {
		timeline = restart(timeline);
	},
	speed: timeline.speed,
};

const gui = new GUI({ title: "Lecture" });
gui.add(playbackControls, "togglePlayback").name("Lecture / pause (espace)");
gui.add(playbackControls, "stepBackward").name("Étape précédente (←)");
gui.add(playbackControls, "stepForward").name("Étape suivante (→)");
gui.add(playbackControls, "restart").name("Recommencer");
gui
	.add(playbackControls, "speed", 0.25, 4, 0.25)
	.name("Vitesse")
	.onChange((speed: number) => {
		timeline = setSpeed(timeline, speed);
	});

const KEY_TO_ACTION: Record<string, () => void> = {
	Space: playbackControls.togglePlayback,
	ArrowLeft: playbackControls.stepBackward,
	ArrowRight: playbackControls.stepForward,
};

window.addEventListener("keydown", (event) => {
	const action = KEY_TO_ACTION[event.code] ?? goToStepActionFor(event.code);
	if (action === undefined) return;
	event.preventDefault();
	action();
});

/** Touches 1 à 9 : aller directement à l'étape correspondante. */
function goToStepActionFor(code: string): (() => void) | undefined {
	const digit = /^Digit([1-9])$/.exec(code)?.[1];
	if (digit === undefined) return undefined;
	const stepIndex = Number(digit) - 1;
	if (stepIndex >= scenario.steps.length) return undefined;
	return () => {
		timeline = goToStep(timeline, stepIndex);
	};
}

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
});
