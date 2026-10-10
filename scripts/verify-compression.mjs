// Exercise the production middleware options with an isolated Traefik container.
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createServer, get, request } from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';
import { gunzipSync, gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import postgres from 'postgres';
import sharp from 'sharp';

const run = promisify(execFile);
const payload = 'Una risposta abbastanza lunga. '.repeat(1000);
const name = `segnalibro-compress-test-${randomUUID().slice(0, 8)}`;
const appOrigin = process.env.COMPRESS_APP_ORIGIN;
if (appOrigin) assert.ok(['localhost', '127.0.0.1'].includes(new URL(appOrigin).hostname));
const fixtureRoutes = new Set([
	'/html',
	'/json',
	'/small',
	'/events',
	'/image',
	'/encoded',
	'/stream'
]);
const server = createServer((req, res) => {
	if (appOrigin && !fixtureRoutes.has(req.url)) {
		const upstream = request(
			new URL(req.url, appOrigin),
			{
				method: req.method,
				headers: { ...req.headers, host: new URL(appOrigin).host }
			},
			(response) => {
				res.writeHead(response.statusCode, response.headers);
				response.pipe(res);
			}
		);
		upstream.on('error', () => {
			res.writeHead(502);
			res.end('Local application unavailable');
		});
		req.pipe(upstream);
		return;
	}
	res.setHeader('cache-control', 'private, no-store');
	res.setHeader(
		'content-type',
		req.url === '/json'
			? 'application/json'
			: req.url === '/events'
				? 'text/event-stream'
				: req.url === '/image'
					? 'image/webp'
					: 'text/html'
	);
	if (req.url === '/small') return res.end('piccola');
	if (req.url === '/encoded') {
		res.setHeader('content-encoding', 'gzip');
		return res.end(gzipSync(payload));
	}
	if (req.url === '/stream') {
		res.write('prima parte ' + payload);
		return setTimeout(() => res.end('ultima parte'), 800);
	}
	res.end(payload);
});
await new Promise((resolve) => server.listen(4218, '0.0.0.0', resolve));
let started = false;
try {
	await mkdir('.tempo/performance', { recursive: true });
	const config = path.resolve('.tempo/performance/compression.yml');
	await writeFile(
		config,
		`http:
  routers:
    test:
      rule: PathPrefix(\x60/\x60)
      service: app
      middlewares: [compress]
  services:
    app:
      loadBalancer:
        servers:
          - url: http://host.docker.internal:4218
  middlewares:
    compress:
      compress:
        minResponseBodyBytes: 1024
        excludedContentTypes: [text/event-stream, image/png, image/jpeg, image/webp, image/avif, font/woff, font/woff2]
`
	);
	await run(
		'docker',
		[
			'run',
			'--rm',
			'-d',
			'--name',
			name,
			'-p',
			'127.0.0.1:4219:80',
			'--mount',
			`type=bind,source=${config},target=/etc/traefik/dynamic.yml,readonly`,
			process.env.TRAEFIK_TEST_IMAGE ?? 'traefik:v2.11',
			'--providers.file.filename=/etc/traefik/dynamic.yml',
			'--entrypoints.web.address=:80'
		],
		{ windowsHide: true }
	);
	started = true;
	let ready = false;
	for (let i = 0; i < 50; i++) {
		try {
			if ((await fetch('http://localhost:4219/small')).ok) {
				ready = true;
				break;
			}
		} catch {
			/* startup */
		}
		await new Promise((resolve) => setTimeout(resolve, 200));
	}
	assert(ready, 'Traefik did not start');
	for (const route of ['/html', '/json', '/small', '/events', '/image', '/encoded']) {
		const result = await new Promise((resolve, reject) => {
			get(
				`http://localhost:4219${route}`,
				{ headers: { 'accept-encoding': 'gzip' } },
				(response) => {
					const chunks = [];
					response.on('data', (chunk) => chunks.push(chunk));
					response.on('end', () =>
						resolve({ headers: response.headers, body: Buffer.concat(chunks) })
					);
					response.on('error', reject);
				}
			).on('error', reject);
		});
		const compressed = ['/html', '/json', '/encoded'].includes(route);
		assert.equal(result.headers['content-encoding'], compressed ? 'gzip' : undefined);
		assert.equal(
			(compressed ? gunzipSync(result.body) : result.body).toString(),
			route === '/small' ? 'piccola' : payload
		);
		if (compressed) assert(result.body.length < Buffer.byteLength(payload) / 2);
		console.log(
			`${route}: ${result.headers['content-encoding'] ?? 'identity'} ${result.body.length} bytes`
		);
	}
	const start = performance.now();
	const stream = await fetch('http://localhost:4219/stream', {
		headers: { 'accept-encoding': 'gzip' }
	});
	const reader = stream.body.getReader();
	const first = await reader.read();
	const elapsed = performance.now() - start;
	assert(new TextDecoder().decode(first.value).includes('prima parte'));
	assert(!new TextDecoder().decode(first.value).includes('ultima parte'));
	assert(elapsed < 750, `Streaming buffered for ${elapsed}ms`);
	while (!(await reader.read()).done) {
		/* finish response */
	}
	console.log(`First streamed chunk: ${Math.round(elapsed)}ms (last chunk sent after 800ms)`);
	if (appOrigin) await verifyApplication();
} finally {
	if (started) await run('docker', ['rm', '-f', name], { windowsHide: true });
	await new Promise((resolve) => server.close(resolve));
}

async function verifyApplication() {
	const email = `compression-${randomUUID()}@test.local`;
	const sql = postgres(
		process.env.DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/segnalibro',
		{ max: 1 }
	);
	const browser = await chromium.launch();
	let userId;
	try {
		const context = await browser.newContext({ baseURL: appOrigin, serviceWorkers: 'block' });
		const page = await context.newPage();
		await page.goto('/auth/register');
		await page.locator('input[name=displayName]').fill('Prova compressione');
		await page.locator('input[name=email]').fill(email);
		await page.locator('input[name=password]').fill('Compressione-test-2026!');
		await page.getByRole('button', { name: 'Registrati' }).click();
		await page.waitForURL('**/library');
		const [user] = await sql`select id from app.users where email=${email}`;
		userId = user.id;
		const [book] =
			await sql`insert into public.user_books(user_id,genre_id,title,author_display,page_count,format,source)
			values(${userId}::uuid,1,'Libro compressione','Autore',200,'physical','manual') returning id`;
		const pixels = Buffer.alloc(640 * 960 * 3);
		for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 17 + (i >> 8) * 31) % 256;
		const imageBytes = process.env.COMPRESS_COVER
			? await readFile(process.env.COMPRESS_COVER)
			: await sharp(pixels, { raw: { width: 640, height: 960, channels: 3 } })
					.jpeg()
					.toBuffer();
		const upload = await page.request.post('/api/covers/upload', {
			headers: { Origin: new URL(appOrigin).origin },
			multipart: {
				bookId: book.id,
				file: {
					name: 'cover.jpg',
					mimeType: 'image/jpeg',
					buffer: imageBytes
				}
			}
		});
		assert.equal(upload.status(), 200, await upload.text());
		const cover = await upload.json();
		await sql`insert into public.user_books(user_id,genre_id,title,author_display,page_count,format,source)
			select ${userId}::uuid,1,'Libro proxy '||n,'Autore',200,'physical','manual' from generate_series(1,12)n`;
		const cookie = (await context.cookies())
			.map((value) => `${value.name}=${value.value}`)
			.join('; ');
		async function read(route, authenticated = true) {
			return new Promise((resolve, reject) => {
				get(
					`http://localhost:4219${route}`,
					{ headers: { 'accept-encoding': 'gzip', ...(authenticated ? { cookie } : {}) } },
					(response) => {
						const chunks = [];
						response.on('data', (chunk) => chunks.push(chunk));
						response.on('end', () =>
							resolve({
								status: response.statusCode,
								headers: response.headers,
								body: Buffer.concat(chunks)
							})
						);
						response.on('error', reject);
					}
				).on('error', reject);
			});
		}
		const document = await read('/library');
		assert.equal(document.status, 200);
		assert.equal(document.headers['content-encoding'], 'gzip');
		assert.match(document.headers.vary, /accept-encoding/i);
		const html = gunzipSync(document.body).toString();
		assert.ok(html.includes('Prova compressione'));
		assert.ok(document.body.length < Buffer.byteLength(html));
		console.log(
			`Application /library: ${Buffer.byteLength(html)} -> ${document.body.length} bytes (gzip)`
		);
		const scriptPaths = [...html.matchAll(/["']([^"' ]*\/_app\/[^"' ]+\.js)["']/g)].map(
			(match) => match[1]
		);
		let compressedScript = false;
		for (const scriptPath of scriptPaths) {
			const script = await read(new URL(scriptPath, new URL('/library', appOrigin)).pathname);
			assert.equal(script.status, 200);
			if (script.headers['content-encoding'] === 'gzip') {
				assert.ok(gunzipSync(script.body).length >= 1024);
				compressedScript = true;
				break;
			}
			assert.ok(script.body.length < 1024);
		}
		assert.ok(compressedScript, 'Application must serve a compressed JavaScript resource');
		const json = await read('/api/library/shelf?genre=classics&limit=24');
		assert.equal(json.status, 200);
		assert.equal(json.headers['content-encoding'], 'gzip');
		const decodedJson = gunzipSync(json.body);
		assert.equal(JSON.parse(decodedJson).data.books.length, 13);
		console.log(
			`Application shelf JSON: ${decodedJson.length} -> ${json.body.length} bytes (gzip)`
		);
		const coverRoute = `/api/covers/${cover.coverStoragePath}?w=320`;
		const image = await read(coverRoute);
		assert.equal(image.status, 200);
		assert.equal(image.headers['content-encoding'], undefined);
		assert.match(image.headers['content-type'], /image\/webp/);
		assert.match(image.headers['cache-control'], /private/);
		const denied = await read(coverRoute, false);
		assert.notEqual(denied.status, 200);
		console.log(
			`Application JavaScript gzip; private WebP identity ${image.body.length} bytes; anonymous cover access denied`
		);
	} finally {
		await browser.close();
		await sql`delete from app.users where email=${email}`;
		if (userId) {
			const root = path.resolve(process.env.STORAGE_DIR ?? './storage', 'covers');
			const target = path.resolve(root, userId);
			assert.ok(target.startsWith(`${root}${path.sep}`));
			await rm(target, { recursive: true, force: true });
		}
		await sql.end();
	}
}
