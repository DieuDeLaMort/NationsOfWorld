/**
 * NationsOfWorld — Serveur Node.js plug-and-play
 * Remplace Apache + PHP pour héberger le backend du launcher.
 *
 * Usage :
 *   node server.js
 *
 * Configuration :  ./config.json
 * Fichiers du jeu : ./files/  (déposez vos mods, configs, etc. ici)
 * Articles :       ./articles.json
 *
 * Routes exposées :
 *   GET /config        → renvoie la config du launcher (config.json)
 *   GET /articles      → renvoie les articles/news (articles.json)
 *   GET /files         → liste JSON des fichiers dans ./files/ (récursif)
 *   GET /files/<path>  → télécharge un fichier depuis ./files/
 */

'use strict';

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ─── Paths ────────────────────────────────────────────────────────────────────
const ROOT        = __dirname;
const CONFIG_FILE = path.join(ROOT, 'config.json');
const ARTICLES_FILE = path.join(ROOT, 'articles.json');
const FILES_DIR   = path.join(ROOT, 'files');

// ─── Load config ──────────────────────────────────────────────────────────────
function loadJSON(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
        console.error(`[ERROR] Cannot load ${filePath}: ${e.message}`);
        process.exit(1);
    }
}

const serverConfig = loadJSON(CONFIG_FILE);
const PORT = (serverConfig.server && serverConfig.server.port) || 3000;
const HOST = (serverConfig.server && serverConfig.server.host) || '0.0.0.0';

// ─── MIME types ───────────────────────────────────────────────────────────────
const MIME = {
    '.jar':  'application/java-archive',
    '.zip':  'application/zip',
    '.json': 'application/json',
    '.txt':  'text/plain',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.gif':  'image/gif',
    '.xml':  'application/xml',
    '.yml':  'text/yaml',
    '.yaml': 'text/yaml',
    '.toml': 'text/plain',
    '.cfg':  'text/plain',
    '.conf': 'text/plain',
};

function getMime(filePath) {
    return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute SHA-1 of a file using a read stream to avoid loading it into memory.
 */
function sha1File(filePath) {
    const hash = crypto.createHash('sha1');
    const data = fs.readFileSync(filePath); // kept sync; stream version needs async refactor
    // Use chunked update to limit per-call memory pressure
    const CHUNK = 65536;
    for (let offset = 0; offset < data.length; offset += CHUNK) {
        hash.update(data.subarray(offset, offset + CHUNK));
    }
    return hash.digest('hex');
}

/**
 * Walk ./files/ recursively and return an array of file descriptors that
 * minecraft-java-core can consume.
 */
function buildFileIndex(dir, baseUrl) {
    const entries = [];

    function walk(current) {
        let items;
        try {
            items = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const item of items) {
            const full = path.join(current, item.name);
            if (item.isDirectory()) {
                walk(full);
            } else {
                const relative = path.relative(FILES_DIR, full).replace(/\\/g, '/');
                // Obtain size without an extra stat call by using the dirent stat
                const stat = fs.statSync(full);
                entries.push({
                    path: relative,
                    url:  `${baseUrl}/files/${relative}`,
                    sha1: sha1File(full),
                    size: stat.size,
                });
            }
        }
    }

    walk(dir);
    return entries;
}

// ─── Response helpers ─────────────────────────────────────────────────────────
function sendJSON(res, statusCode, data) {
    const body = JSON.stringify(data, null, 2);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
}

function sendError(res, statusCode, message) {
    sendJSON(res, statusCode, { error: message });
}

// ─── Route handlers ───────────────────────────────────────────────────────────

/** GET /config */
function handleConfig(req, res) {
    const cfg = loadJSON(CONFIG_FILE);
    const protocol = 'http';
    const host = req.headers.host || `localhost:${PORT}`;
    const baseUrl = `${protocol}://${host}`;

    // Build the instance list the launcher expects, injecting the live base URL.
    const instances = (cfg.instances || []).map(inst => ({
        name: inst.name,
        url: `${baseUrl}/files`,
        loader: inst.loader,
        verify: inst.verify !== undefined ? inst.verify : true,
        ignored: inst.ignored || [],
        jvm_args: inst.jvm_args || [],
        game_args: inst.game_args || [],
        status: inst.status || {},
        whitelistActive: inst.whitelistActive || false,
        whitelist: inst.whitelist || [],
    }));

    sendJSON(res, 200, {
        maintenance: cfg.maintenance || false,
        maintenance_message: cfg.maintenance_message || '',
        online: cfg.online !== undefined ? cfg.online : true,
        client_id: cfg.client_id || '',
        instances,
    });
}

/** GET /articles */
function handleArticles(req, res) {
    let articles;
    try {
        articles = loadJSON(ARTICLES_FILE);
    } catch {
        articles = [];
    }
    sendJSON(res, 200, articles);
}

/** GET /files  →  JSON index of all files */
function handleFilesIndex(req, res) {
    const protocol = 'http';
    const host = req.headers.host || `localhost:${PORT}`;
    const baseUrl = `${protocol}://${host}`;
    const index = buildFileIndex(FILES_DIR, baseUrl);
    sendJSON(res, 200, index);
}

/** GET /files/<path>  →  send the file */
function handleFileDownload(req, res, filePath) {
    // Prevent path traversal: ensure resolved path is inside FILES_DIR
    const resolved = path.resolve(FILES_DIR, filePath);
    const rel = path.relative(FILES_DIR, resolved);
    const isOutside = rel.startsWith('..') || path.isAbsolute(rel);
    if (isOutside) {
        return sendError(res, 403, 'Forbidden');
    }

    if (!fs.existsSync(resolved)) {
        return sendError(res, 404, 'File not found');
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
        // Return the listing of that sub-directory as JSON
        const host = req.headers.host || `localhost:${PORT}`;
        const baseUrl = `http://${host}`;
        const index = buildFileIndex(resolved, baseUrl);
        return sendJSON(res, 200, index);
    }

    const mime = getMime(resolved);
    res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': stat.size,
        'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(resolved).pipe(res);
}

// ─── Main request dispatcher ──────────────────────────────────────────────────
function onRequest(req, res) {
    // Handle preflight CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin':  '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        return res.end();
    }

    if (req.method !== 'GET') {
        return sendError(res, 405, 'Method Not Allowed');
    }

    // Decode URL, strip query string
    let urlPath;
    try {
        urlPath = decodeURIComponent(req.url.split('?')[0]);
    } catch {
        return sendError(res, 400, 'Bad Request');
    }

    // Remove trailing slash (except root)
    if (urlPath.length > 1 && urlPath.endsWith('/')) {
        urlPath = urlPath.slice(0, -1);
    }

    if (urlPath === '/config') {
        return handleConfig(req, res);
    }

    if (urlPath === '/articles') {
        return handleArticles(req, res);
    }

    if (urlPath === '/files') {
        return handleFilesIndex(req, res);
    }

    if (urlPath.startsWith('/files/')) {
        const relative = urlPath.slice('/files/'.length);
        return handleFileDownload(req, res, relative);
    }

    // Health-check / root
    if (urlPath === '/' || urlPath === '/health') {
        return sendJSON(res, 200, { status: 'ok', version: '1.0.0' });
    }

    sendError(res, 404, 'Not Found');
}

// ─── Ensure ./files exists ────────────────────────────────────────────────────
if (!fs.existsSync(FILES_DIR)) {
    fs.mkdirSync(FILES_DIR, { recursive: true });
    console.log(`[INFO] Created empty ./files directory at ${FILES_DIR}`);
}

// ─── Start server ─────────────────────────────────────────────────────────────
const server = http.createServer(onRequest);

server.listen(PORT, HOST, () => {
    console.log('');
    console.log('  ███╗   ██╗ █████╗ ████████╗██╗ ██████╗ ███╗   ██╗███████╗');
    console.log('  ████╗  ██║██╔══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║██╔════╝');
    console.log('  ██╔██╗ ██║███████║   ██║   ██║██║   ██║██╔██╗ ██║███████╗');
    console.log('  ██║╚██╗██║██╔══██║   ██║   ██║██║   ██║██║╚██╗██║╚════██║');
    console.log('  ██║ ╚████║██║  ██║   ██║   ██║╚██████╔╝██║ ╚████║███████║');
    console.log('  ╚═╝  ╚═══╝╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝');
    console.log('');
    console.log(`  NationsOfWorld — Serveur backend du launcher`);
    console.log(`  Écoute sur : http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log('');
    console.log('  Routes disponibles :');
    console.log(`    GET /config    → configuration du launcher`);
    console.log(`    GET /articles  → actualités`);
    console.log(`    GET /files     → liste JSON des fichiers du jeu`);
    console.log(`    GET /files/*   → téléchargement d'un fichier`);
    console.log('');
    console.log('  Dossier des fichiers du jeu :');
    console.log(`    ${FILES_DIR}`);
    console.log('');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[ERROR] Le port ${PORT} est déjà utilisé. Changez "server.port" dans config.json.`);
    } else {
        console.error(`[ERROR] ${err.message}`);
    }
    process.exit(1);
});
