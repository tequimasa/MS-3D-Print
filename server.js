const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
    // API Endpoints
    if (req.url === '/api/data' && req.method === 'GET') {
        fs.readFile(DB_PATH, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end(JSON.stringify({ error: 'Could not read database' }));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        });
        return;
    }

    if (req.url === '/api/save' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                fs.writeFile(DB_PATH, JSON.stringify(data, null, 4), 'utf8', (err) => {
                    if (err) {
                        res.writeHead(500);
                        return res.end(JSON.stringify({ error: 'Could not save database' }));
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                });
            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // Static File Serving
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';
    const absolutePath = path.join(__dirname, filePath);

    fs.readFile(absolutePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`\x1b[36m%s\x1b[0m`, `--- Antigravity 3D Server ---`);
    console.log(`Application disponible sur : http://localhost:${PORT}`);
    console.log(`Base de données locale : ${DB_PATH}`);
    console.log(`Appuyez sur Ctrl+C pour arrêter le serveur.`);
});
