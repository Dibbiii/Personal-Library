import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const directory = '.tempo/performance';
const before = JSON.parse(await readFile(`${directory}/baseline.json`, 'utf8'));
const after = JSON.parse(await readFile(`${directory}/optimized.json`, 'utf8'));
assert.equal(before.conditions, after.conditions, 'Benchmark conditions must match');
assert.equal(before.samples.length, 320, 'Baseline must contain every measurement');
assert.equal(after.samples.length, 320, 'Optimized build must contain every measurement');

const metrics = ['ttfb', 'lcp', 'htmlBytes', 'transferBytes', 'jsBytes', 'requests', 'nodes'];
const key = (sample) =>
	JSON.stringify([sample.route, sample.viewport, sample.serviceWorkers, sample.cache]);
function group(samples) {
	const groups = new Map();
	for (const sample of samples) {
		for (const metric of metrics) assert.ok(Number.isFinite(sample[metric]), `Invalid ${metric}`);
		const id = key(sample);
		if (!groups.has(id)) groups.set(id, []);
		groups.get(id).push(sample);
	}
	for (const rows of groups.values()) {
		assert.equal(rows.length, 5);
		assert.equal(new Set(rows.map((row) => row.iteration)).size, 5);
	}
	assert.equal(groups.size, 64);
	return groups;
}
const initial = group(before.samples);
const optimized = group(after.samples);
const median = (values) => values.sort((a, b) => a - b)[2];
const groups = [...initial].map(([id, rows]) => {
	const next = optimized.get(id);
	assert.ok(next, `Missing combination ${id}`);
	const { route, viewport, serviceWorkers, cache } = rows[0];
	return {
		route,
		viewport,
		serviceWorkers,
		cache,
		metrics: Object.fromEntries(
			metrics.map((metric) => {
				const oldValue = median(rows.map((row) => row[metric]));
				const newValue = median(next.map((row) => row[metric]));
				return [
					metric,
					{
						before: oldValue,
						after: newValue,
						changePercent: oldValue === 0 ? null : (newValue / oldValue - 1) * 100
					}
				];
			})
		)
	};
});
await writeFile(
	`${directory}/comparison.json`,
	JSON.stringify({ conditions: before.conditions, groups }, null, 2)
);
const pair = ({ before, after }, divisor = 1) =>
	`${(before / divisor).toFixed(1)} → ${(after / divisor).toFixed(1)}`;
const lines = [
	'# Confronto locale delle build',
	'',
	'Mediane di cinque campioni; prima → dopo. Cache fredda, service worker bloccato. Tempi locali senza throttling: non sono Core Web Vitals sul campo.',
	'',
	'| Route | Viewport | TTFB ms | LCP ms | HTML KiB | JS KiB | Trasferiti KiB | Richieste |',
	'| --- | --- | --- | --- | --- | --- | --- | --- |'
];
for (const result of groups.filter(
	(row) => row.cache === 'cold' && row.serviceWorkers === 'block'
)) {
	const m = result.metrics;
	lines.push(
		`| ${result.route} | ${result.viewport} | ${pair(m.ttfb)} | ${pair(m.lcp)} | ${pair(m.htmlBytes, 1024)} | ${pair(m.jsBytes, 1024)} | ${pair(m.transferBytes, 1024)} | ${pair(m.requests)} |`
	);
}
await writeFile(`${directory}/comparison.md`, lines.join('\n') + '\n');
console.log(lines.join('\n'));
