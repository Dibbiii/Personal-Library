import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const [beforeLabel, afterLabel] = process.argv.slice(2);
for (const label of [beforeLabel, afterLabel]) assert.match(label ?? '', /^[a-z0-9-]+$/);
const directory = '.tempo/performance';
const before = JSON.parse(await readFile(`${directory}/${beforeLabel}.json`, 'utf8'));
const after = JSON.parse(await readFile(`${directory}/${afterLabel}.json`, 'utf8'));
assert.deepEqual(before.conditions, after.conditions, 'Lab conditions must match');
assert.equal(before.samples.length, after.samples.length);
assert.equal(
	before.samples.length,
	before.conditions.routes.length * 4 * before.conditions.iterations
);
assert.equal(before.flows.length, after.flows.length);
const key = (row) => JSON.stringify([row.route, row.viewport, row.cache]);
const group = (rows) => {
	const groups = new Map();
	for (const row of rows) {
		const id = key(row);
		if (!groups.has(id)) groups.set(id, []);
		groups.get(id).push(row);
	}
	for (const rows of groups.values()) {
		assert.equal(rows.length, before.conditions.iterations);
		assert.equal(new Set(rows.map((row) => row.iteration)).size, rows.length);
	}
	return groups;
};
const median = (values) => {
	assert.ok(values.every(Number.isFinite));
	values.sort((a, b) => a - b);
	const middle = Math.floor(values.length / 2);
	return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
};
const results = [];
for (const [kind, metrics] of [
	['samples', ['lcp', 'cls', 'blockingMs']],
	['flows', ['inpCandidateMs', 'elapsedMs', 'cls']]
]) {
	const initial = group(before[kind]);
	const final = group(after[kind]);
	assert.deepEqual([...initial.keys()].sort(), [...final.keys()].sort());
	for (const [id, rows] of initial) {
		const next = final.get(id);
		results.push({
			kind,
			route: rows[0].route,
			viewport: rows[0].viewport,
			cache: rows[0].cache,
			metrics: Object.fromEntries(
				metrics.map((metric) => {
					const get = (row) => (metric === 'lcp' ? row.lcp.ms : row[metric]);
					// No observed event is not evidence for zero interaction latency.
					if ([...rows, ...next].some((row) => get(row) == null)) return [metric, null];
					const old = median(rows.map(get));
					const current = median(next.map(get));
					return [
						metric,
						{ before: old, after: current, changePercent: old ? (current / old - 1) * 100 : null }
					];
				})
			)
		});
	}
}
await writeFile(
	`${directory}/${beforeLabel}-comparison.json`,
	JSON.stringify({ beforeLabel, afterLabel, conditions: before.conditions, results }, null, 2)
);
console.table(
	results.map(({ kind, route, viewport, cache, metrics }) => ({
		kind,
		route,
		viewport,
		cache,
		...Object.fromEntries(
			Object.entries(metrics).map(([name, value]) => [
				name,
				value ? `${value.before.toFixed(3)} -> ${value.after.toFixed(3)}` : 'not observed'
			])
		)
	}))
);
