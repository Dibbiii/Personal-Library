import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
// ISO 2709 directories store byte positions, not character positions (UTF-8).
export function parseMarc(buffer) {
	const records = [];
	for (let offset = 0; offset < buffer.length;) {
		const length = Number(buffer.subarray(offset, offset + 5).toString('ascii'));
		if (!Number.isInteger(length) || length < 25 || offset + length > buffer.length)
			throw new Error('Invalid MARC record');
		const record = buffer.subarray(offset, offset + length);
		const base = Number(record.subarray(12, 17).toString('ascii'));
		if (!Number.isInteger(base) || base < 25 || base >= length || (base - 25) % 12 !== 0)
			throw new Error('Invalid MARC directory');
		const fields = [];
		for (let pos = 24; pos < base - 1; pos += 12) {
			const tag = record.subarray(pos, pos + 3).toString('ascii');
			const size = Number(record.subarray(pos + 3, pos + 7).toString('ascii'));
			const start = Number(record.subarray(pos + 7, pos + 12).toString('ascii'));
			if (
				!Number.isInteger(size) ||
				size < 1 ||
				!Number.isInteger(start) ||
				start < 0 ||
				base + start + size > length
			)
				throw new Error('Invalid MARC field');
			fields.push({
				tag,
				value: record.subarray(base + start, base + start + size - 1).toString('utf8')
			});
		}
		records.push(fields);
		offset += length;
	}
	return records;
}

export function mapMarc(fields) {
	const control = (tag) => fields.find((f) => f.tag === tag)?.value ?? '';
	const subfields = (tag, code) =>
		fields
			.filter((f) => f.tag === tag)
			.flatMap((f) =>
				f.value
					.slice(2)
					.split('\x1f')
					.filter((s) => s.startsWith(code))
					.map((s) => s.slice(1))
			);
	const clean = (value) =>
		value
			// MARC non-sorting segments contain control characters.
			// eslint-disable-next-line no-control-regex
			?.replace(/[\x00-\x1f\x7f\x98\x9c]/g, '')
			.replace(/\s*[/,:;=]\s*$/, '')
			.trim() || null;
	const title = clean([...subfields('245', 'a'), ...subfields('245', 'b')].join(' '));
	if (!title) return null;
	const rawId = control('001').trim();
	// SBN BID may be prefixed as IT\\ICCU\\RAV\\1234567.
	const id = rawId.replace(/^IT\\ICCU\\/, '').replaceAll('\\', '');
	if (!/^[A-Z0-9]{10}$/.test(id)) return null;
	const authors = [...subfields('100', 'a'), ...subfields('110', 'a')].map(clean).filter(Boolean);
	const publication = [...subfields('264', 'c'), ...subfields('260', 'c')][0];
	const pageText = subfields('300', 'a')[0] ?? '';
	const pages = /(?:^|[,;]\s*)(\d{1,5})\s*(?:p\.|pages|pagine)/i.exec(pageText)?.[1];
	return {
		id,
		title,
		authors,
		isbns: subfields('020', 'a'),
		language: subfields('041', 'a')[0] ?? (control('008').slice(35, 38).trim() || null),
		publisher: clean([...subfields('264', 'b'), ...subfields('260', 'b')][0]),
		publishedDate: publication?.match(/\b[12][0-9]{3}\b/)?.[0] ?? null,
		pageCount: pages && Number(pages) > 0 && Number(pages) <= 20000 ? Number(pages) : null
	};
}

export function buildQuery(params) {
	const isbn = params.get('isbn');
	if (isbn) {
		if (!/^97[89][0-9]{10}$/.test(isbn)) throw new Error('Invalid ISBN');
		return `@attr 1=7 "${isbn}"`;
	}
	const sanitize = (value) =>
		(value ?? '')
			.normalize('NFD')
			.replace(/\p{M}/gu, '')
			.replace(/[^\p{L}\p{N}\s.,'-]/gu, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	const title = sanitize(params.get('title'));
	const author = sanitize(params.get('author'));
	if (title.length < 2 || title.length > 200 || author.length > 120)
		throw new Error('Invalid query');
	return author ? `@and @attr 1=4 "${title}" @attr 1=1003 "${author}"` : `@attr 1=4 "${title}"`;
}

let active = false;
let lastQueryAt = 0;
export async function lookup(query) {
	const directory = await mkdtemp(join(tmpdir(), 'sbn-'));
	try {
		const recordPath = join(directory, 'records.mrc');
		const commandPath = join(directory, 'commands');
		// SBN explicitly requires one record per Present request. Hard limit: 10.
		const commands = [
			'format usmarc',
			'charset UTF-8',
			'lslb 0',
			'ssub 0',
			'open opac.sbn.it:2100/nopac',
			`find ${query}`,
			...Array.from({ length: 10 }, (_, i) => `show ${i + 1}+1`),
			'quit'
		];
		await writeFile(commandPath, `${commands.join('\n')}\n`);
		const { stdout } = await execute(
			'yaz-client',
			['-k', '1024', '-m', recordPath, '-f', commandPath],
			{ timeout: 18000, maxBuffer: 2_000_000 }
		);
		if (!/Search was a success/.test(stdout)) throw new Error('SBN search failed');
		const count = Number(/Number of hits:\s*(\d+)/.exec(stdout)?.[1]);
		if (count === 0) return [];
		const raw = await readFile(recordPath);
		if (!raw.length) throw new Error('SBN returned no records');
		return parseMarc(raw).map(mapMarc).filter(Boolean);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

export function createBridge() {
	return createServer(async (req, res) => {
		const send = (status, body) => {
			res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
			res.end(JSON.stringify(body));
		};
		const url = new URL(req.url, 'http://sbn:8080');
		if (req.method !== 'GET') return send(405, { error: 'Method not allowed' });
		if (url.pathname === '/health') return send(200, { status: 'ok' });
		if (url.pathname !== '/search') return send(404, { error: 'Not found' });
		let query;
		try {
			query = buildQuery(url.searchParams);
		} catch {
			return send(400, { error: 'Invalid query' });
		}
		if (active || Date.now() - lastQueryAt < 1000) {
			res.setHeader('retry-after', '1');
			return send(429, { error: 'Busy' });
		}
		active = true;
		lastQueryAt = Date.now();
		try {
			send(200, { records: await lookup(query) });
		} catch {
			send(502, { error: 'SBN unavailable' });
		} finally {
			active = false;
		}
	});
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
	createBridge().listen(8080, '0.0.0.0');
