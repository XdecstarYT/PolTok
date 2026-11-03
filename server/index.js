// STUB — Server agent replaces.
import http from 'node:http';
http.createServer((req, res) => { res.writeHead(404); res.end(); }).listen(8787);
