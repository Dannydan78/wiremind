# Pare-feu (OPNsense / pf)

Le vocabulaire du concept pare-feu : ce qu'un paquet traverse, de la carte réseau de Kali jusqu'à la décision d'OPNsense. Les exemples viennent du labo.

## Le réseau local

**Carte réseau** :
Le composant, physique ou virtuel, qui relie une machine à un réseau : elle émet et reçoit les trames sur le câble. Chaque carte possède une adresse MAC.
_Dans le labo_ : les cartes des VM sont virtuelles, simulées par l'hyperviseur.
_Avoid_ : NIC, carte Ethernet

**Interface** :
Le nom que le système donne à une carte réseau, et à laquelle il attribue une adresse IP. Une carte peut porter plusieurs interfaces (VLAN), mais dans le labo c'est une pour une.
_Dans le labo_ : `eth0` sur Kali, `enp0s1` sur Ubuntu, `WAN` et `LAN` sur OPNsense.
_Avoid_ : port réseau, carte (quand on parle de l'IP)

**Adresse MAC** :
L'identifiant d'une carte réseau sur le réseau local, sur 6 octets. Elle ne sert qu'à atteindre une machine **voisine** : elle ne traverse jamais un routeur ou un pare-feu.
_Dans le labo_ : `3a:4d:3d:23:32:f8` (Kali), `fe:75:bd:ba:e1:b6` (Ubuntu).
_Avoid_ : adresse physique, adresse matérielle

**Trame** :
L'unité qui circule sur un câble : un en-tête Ethernet (MAC destination, MAC source, type) suivi d'un paquet IP. Un routeur ou un pare-feu reçoit une trame, puis en émet une **nouvelle** avec d'autres adresses MAC.
_Avoid_ : paquet (quand on parle des MAC)

**Segment réseau** :
L'ensemble des machines qui s'atteignent directement par leurs adresses MAC, sans routeur ni pare-feu entre elles.
_Dans le labo_ : Kali et Ubuntu sur `192.168.64.0/24` partagent un segment ; quand OPNsense sera en place, le WAN et le LAN seront deux segments distincts.
_Avoid_ : sous-réseau (qui désigne la plage d'adresses IP, pas le lien physique)

**Commutateur** :
L'équipement qui relie les machines d'un segment et n'envoie chaque trame que vers le port de la MAC destinataire. Une machine ne voit donc que son propre trafic.
_Avoid_ : switch, hub (un hub, lui, répète tout à tout le monde)

**ARP** :
Le protocole qui trouve l'adresse MAC correspondant à une adresse IP du même segment : « qui a 192.168.64.3 ? Répondez à 192.168.64.4. »

## IP et routage

**Adresse IP** :
L'adresse d'une interface à l'échelle du réseau entier, sur 4 octets en IPv4. Contrairement à la MAC, elle reste la même de bout en bout, sauf si un NAT la réécrit.
_Dans le labo_ : `192.168.64.4` (Kali), `192.168.64.3` (Ubuntu).

**Préfixe** :
Le nombre de bits de l'adresse IP qui désignent le réseau ; le reste désigne la machine. `/24` signifie que les 3 premiers octets identifient le réseau : `192.168.64.0/24` va de `.0` à `.255`.
_Avoid_ : masque (`255.255.255.0`, la même information écrite autrement)

**Passerelle** :
Le routeur à qui une machine confie tout paquet destiné à une adresse hors de son segment.
_Dans le labo_ : derrière le pare-feu, la passerelle de la cible sera l'interface LAN d'OPNsense.
_Avoid_ : gateway, route par défaut (qui est la règle qui pointe vers la passerelle)

**Routeur** :
Une machine qui relie plusieurs segments et fait passer les paquets de l'un à l'autre. Un pare-feu est un routeur qui décide, en plus, quels paquets ont le droit de passer.

**Paquet** :
L'unité d'IP : un en-tête IP (adresses source et destination, TTL, protocole) suivi du contenu de transport (TCP, UDP ou ICMP). Il voyage de trame en trame jusqu'à sa destination.
_Avoid_ : datagramme (sauf pour UDP), trame

**TTL** :
Un compteur de l'en-tête IP, décrémenté par chaque routeur traversé ; à 0, le paquet est détruit. Il empêche un paquet de tourner en boucle à l'infini.
_Dans le labo_ : Linux part de 64.

## Transport

**Port** :
Un numéro de 0 à 65535 qui désigne un service sur une machine : l'adresse IP désigne la machine, le port désigne le programme.
_Dans le labo_ : 22 pour SSH, 80 pour le web.

**Port éphémère** :
Le port source choisi au hasard par le système pour une connexion sortante, dans une plage élevée (32768–60999 sous Linux).
_Dans le labo_ : 58228 pour le `ssh` de Kali.

**TCP** :
Le protocole de transport qui établit une connexion, numérote chaque octet et retransmet ce qui est perdu. Utilisé par SSH et le web.

**UDP** :
Le protocole de transport sans connexion : chaque datagramme part seul, sans accusé de réception ni retransmission. Utilisé par le DNS.

**ICMP** :
Le protocole de messages de contrôle d'IP, sans port : `ping` (echo request / reply), « destination injoignable », « TTL expiré ».

**Flags TCP** :
Les bits de l'en-tête TCP qui indiquent le rôle d'un segment : **SYN** ouvre une connexion, **ACK** acquitte, **FIN** la ferme proprement, **RST** la coupe net ou refuse.

**Numéro de séquence** :
Le numéro du premier octet porté par un segment TCP. Le premier, choisi au hasard pour chaque connexion, rend difficile l'injection de faux segments.
_Avoid_ : ISN (qui ne désigne que le numéro initial)

**Handshake TCP** :
L'échange de trois segments qui ouvre une connexion TCP : SYN, SYN-ACK, ACK. Chaque côté y annonce son numéro de séquence initial et confirme celui de l'autre.
_Avoid_ : poignée de main, three-way handshake

**Connexion** :
Un échange TCP identifié par quatre valeurs : IP source, port source, IP destination, port destination.
_Avoid_ : session (qui désigne un niveau au-dessus, comme une session SSH)

## Le pare-feu

**Pare-feu** :
Un routeur qui examine chaque paquet entrant sur ses interfaces et décide, selon des règles, de le laisser passer ou non.
_Avoid_ : firewall

**OPNsense** :
La distribution de pare-feu du labo, basée sur FreeBSD. Son moteur de filtrage est pf ; son interface web génère les règles pf.

**pf** :
Le moteur de filtrage de paquets de FreeBSD qu'utilise OPNsense. C'est lui qui applique la table d'état, le NAT et les règles.
_Avoid_ : packet filter

**WAN** :
L'interface du pare-feu tournée vers l'extérieur, d'où viennent les menaces.
_Dans le labo_ : le côté de Kali.

**LAN** :
L'interface du pare-feu tournée vers le réseau interne à protéger.
_Dans le labo_ : le côté de la cible.

**Règle** :
Une ligne de la table de filtrage : des critères (interface, protocole, source, destination, port) et une action (`pass`, `block` ou `reject`). Les règles d'une interface s'appliquent aux paquets qui **entrent** par cette interface.

**Première correspondance** :
Le principe d'évaluation d'OPNsense : les règles sont lues de haut en bas et la première qui correspond décide, les suivantes sont ignorées. Dans pf brut, c'est la dernière qui l'emporte, sauf avec le mot-clé `quick` qu'OPNsense active par défaut.
_Avoid_ : first match

**Blocage par défaut** :
La décision implicite quand aucune règle ne correspond : le paquet est bloqué. Elle n'apparaît pas dans la liste des règles. À l'installation, OPNsense ajoute une règle qui autorise tout le trafic sortant du LAN ; le WAN, lui, n'a aucune règle `pass`.
_Avoid_ : default deny

**pass** :
L'action qui laisse passer le paquet et crée une entrée dans la table d'état.

**block** :
L'action qui jette le paquet en silence. L'émetteur ne reçoit rien et ne peut pas distinguer un paquet bloqué d'un paquet perdu.
_Avoid_ : drop

**reject** :
L'action qui jette le paquet et prévient l'émetteur : un RST pour TCP, un message ICMP « port injoignable » pour UDP.

**Table d'état** :
La liste des connexions autorisées en cours, consultée **avant** les règles. Un paquet qui appartient à une connexion connue passe directement, y compris les réponses.

**Entrée d'état** :
Une ligne de la table d'état : une connexion (adresses, ports, protocole), son état et sa durée de vie. Elle est créée par une règle `pass` et supprimée à la fermeture ou à l'expiration.

**Pare-feu à états** :
Un pare-feu qui se souvient des connexions autorisées pour laisser passer leurs réponses sans règle dédiée. pf en est un.
_Avoid_ : stateful

**NAT** :
La réécriture des adresses IP (et souvent des ports) d'un paquet qui traverse le pare-feu. Le NAT sortant remplace l'IP source interne par celle du WAN.
_Avoid_ : translation d'adresse, masquerading

**Redirection de port** :
Un NAT qui réécrit la **destination** d'un paquet entrant : `WAN:80` devient `serveur-web-du-LAN:80`. pf l'applique avant les règles, qui doivent donc autoriser l'adresse interne.
_Avoid_ : port forwarding, rdr

## Côté attaquant

**Scan de ports** :
L'envoi de paquets vers une série de ports pour savoir lesquels ont un service à l'écoute.

**nmap** :
L'outil de scan de ports utilisé depuis Kali.

**Scan SYN** :
Le scan de nmap (`nmap -sS`) qui envoie un SYN et analyse la réponse sans jamais terminer le handshake.
_Avoid_ : scan semi-ouvert, half-open scan, stealth scan

**open** :
Le résultat nmap quand la cible répond SYN-ACK : un service écoute sur le port.

**closed** :
Le résultat nmap quand la réponse est un RST : la machine est joignable mais rien n'écoute. Un pare-feu en `reject` produit le même résultat.

**filtered** :
Le résultat nmap quand aucune réponse n'arrive, ou un message ICMP « injoignable » : un pare-feu filtre probablement le port. C'est l'effet d'un `block`.
