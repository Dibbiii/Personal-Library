import { z } from 'zod';
import type { ReviewDraft } from './draft';

/**
 * Bozza locale (localStorage): serve finché la recensione non è salvabile (mancano voto o
 * aggettivi) o mentre si è offline. Mai bloccante: se lo storage non è disponibile si ignora.
 */
const KEY_PREFIX = 'sb-review-draft:';

const localDraftSchema = z.object({
	savedAt: z.number(),
	genre: z.string(),
	draft: z.object({
		rating: z.number().int().min(1).max(5).nullable(),
		adjectives: z.array(z.string()).max(3),
		scores: z.record(z.string(), z.number().int().min(1).max(5)),
		tags: z.array(z.string())
	})
});

export interface LocalDraft {
	savedAt: number;
	genre: string;
	draft: ReviewDraft;
}

function storage(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

export function readLocalDraft(bookId: string): LocalDraft | null {
	try {
		const raw = storage()?.getItem(KEY_PREFIX + bookId);
		if (!raw) return null;
		const parsed = localDraftSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export function writeLocalDraft(bookId: string, genre: string, draft: ReviewDraft): void {
	try {
		storage()?.setItem(
			KEY_PREFIX + bookId,
			JSON.stringify({ savedAt: Date.now(), genre, draft } satisfies LocalDraft)
		);
	} catch {
		// quota piena o storage bloccato: la bozza resta solo in memoria
	}
}

export function clearLocalDraft(bookId: string): void {
	try {
		storage()?.removeItem(KEY_PREFIX + bookId);
	} catch {
		// niente da fare
	}
}
