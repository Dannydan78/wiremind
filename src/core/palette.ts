/**
 * Les couleurs de la scène 3D. Les mêmes valeurs sont reprises en
 * variables CSS dans `styles.css`, pour que la scène et les panneaux
 * forment un tout : bleu nuit, cyan, ambre.
 */

export const SCENE_COLORS = {
	/** Le fond et le brouillard : bleu nuit, jamais noir. */
	background: 0x0f1733,
	/** Le plateau sur lequel sont posées les machines. */
	board: 0x162250,
	gridMajor: 0x24346b,
	gridMinor: 0x1c2a5a,
	cable: 0x3d5299,
	laptopBody: 0x2b3560,
	laptopKeyboard: 0x1b2347,
	applianceBody: 0x1f2a52,
	cyan: 0x4cc9f0,
	amber: 0xffb703,
	pink: 0xf472b6,
	violet: 0xb388ff,
	green: 0x5ee6a8,
} as const;

/**
 * Une couleur par couche, la même dans la scène (les enveloppes du paquet)
 * et dans l'inspecteur (les titres des couches).
 */
export const LAYER_COLORS = {
	ethernet: SCENE_COLORS.violet,
	ipv4: SCENE_COLORS.cyan,
	tcp: SCENE_COLORS.amber,
	udp: SCENE_COLORS.green,
	icmp: SCENE_COLORS.pink,
} as const;
