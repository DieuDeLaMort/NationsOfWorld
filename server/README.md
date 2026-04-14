# NationsOfWorld — Serveur backend Node.js (plug-and-play)

> **Remplace Apache + PHP** par un simple fichier Node.js. Aucune dépendance externe requise.

---

## 🇫🇷 Guide rapide (Français)

### Prérequis

- [Node.js](https://nodejs.org/) ≥ 14 installé sur le serveur.

### Installation

1. Copiez le dossier `server/` sur votre serveur.
2. Déposez les fichiers du jeu (mods, configs, ressources…) dans le dossier **`server/files/`**.
3. Éditez **`server/config.json`** selon votre configuration (voir section ci-dessous).
4. Lancez le serveur :

```bash
node server.js
```

C'est tout ! ✅

### Garder le serveur actif (Linux)

Avec [PM2](https://pm2.keymetrics.io/) (gestionnaire de processus Node.js) :

```bash
npm install -g pm2
pm2 start server.js --name nationsofworld
pm2 save
pm2 startup
```

### Configuration (`config.json`)

| Clé | Type | Description |
|-----|------|-------------|
| `maintenance` | `boolean` | Active le mode maintenance (désactive le launcher). |
| `maintenance_message` | `string` | Message affiché aux joueurs pendant la maintenance. |
| `online` | `boolean` | `true` = comptes Microsoft uniquement. `false` = comptes cracké autorisés. |
| `client_id` | `string` | Client ID de l'application Microsoft Azure (OAuth). |
| `instances` | `array` | Liste des instances Minecraft (voir ci-dessous). |
| `server.port` | `number` | Port d'écoute du serveur HTTP (défaut : `3000`). |
| `server.host` | `string` | Interface réseau (défaut : `0.0.0.0` = toutes les interfaces). |

#### Configuration d'une instance

```json
{
  "name": "Nom de l'instance",
  "loader": {
    "minecraft_version": "1.20.1",
    "loader_type": "forge",
    "loader_version": "47.4.0"
  },
  "verify": true,
  "ignored": ["logs", "screenshots", "saves"],
  "jvm_args": [],
  "game_args": [],
  "status": {
    "nameserver": "Nom du serveur",
    "ip": "163.5.59.154",
    "port": 27015
  },
  "whitelistActive": false,
  "whitelist": []
}
```

### Configurer le launcher

Dans le fichier `package.json` du launcher, remplacez l'URL par celle de votre serveur :

```json
"url": "http://163.5.59.154:3000"
```

### Routes API

| Route | Description |
|-------|-------------|
| `GET /config` | Renvoie la configuration du launcher. |
| `GET /articles` | Renvoie les actualités (`articles.json`). |
| `GET /files` | Liste JSON de tous les fichiers du jeu. |
| `GET /files/<chemin>` | Télécharge un fichier du jeu. |
| `GET /health` | Vérification de l'état du serveur. |

---

## 🇬🇧 Quick Guide (English)

### Requirements

- [Node.js](https://nodejs.org/) ≥ 14 installed on the server.

### Setup

1. Copy the `server/` folder to your server.
2. Place your game files (mods, configs, resources…) inside **`server/files/`**.
3. Edit **`server/config.json`** to match your setup (see table above).
4. Start the server:

```bash
node server.js
```

Done! ✅

### Keep the server running (Linux)

With [PM2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start server.js --name nationsofworld
pm2 save
pm2 startup
```

### Configure the launcher

In the launcher's `package.json`, change the URL to point at your server:

```json
"url": "http://163.5.59.154:3000"
```
