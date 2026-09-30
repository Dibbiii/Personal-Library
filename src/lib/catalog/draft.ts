import type { EditionCandidate } from '$lib/contracts/books';
import type { BookFormat, GenreSlug } from '$lib/contracts/enums';
import { languageLabel } from './language';
import type { AddBookRequest } from './schemas';

/** Libro da confermare nello sheet: proviene da un candidato dei provider o dal form manuale. */
export interface BookDraft {
	source: 'manual' | 'isbn' | 'search';
	title: string;
	author: string;
	pageCount: number | null;
	language: string | null;
	isbn: string | null;
	coverUrl: string | null;
	publisher: string | null;
	publishedDate: string | null;
	edition: AddBookRequest['edition'];
}

export interface DraftChoices {
	genre: GenreSlug;
	format: BookFormat;
	series: { name: string; number: number | null; total: number | null } | null;
}

export function draftFromCandidate(
	candidate: EditionCandidate,
	source: 'isbn' | 'search'
): BookDraft {
	return {
		source,
		title: candidate.editionTitle,
		author: candidate.authors.join(', '),
		pageCount: candidate.pageCount,
		language: candidate.language,
		isbn: candidate.isbn13 ?? candidate.isbn10,
		coverUrl: candidate.coverUrl,
		publisher: candidate.publisher,
		publishedDate: candidate.publishedDate,
		edition: {
			provider: candidate.provider,
			providerIds: candidate.providerIds,
			workTitle: candidate.workTitle,
			authors: candidate.authors,
			publisher: candidate.publisher,
			publishedDate: candidate.publishedDate
		}
	};
}

export function buildAddRequest(
	draft: BookDraft,
	choices: DraftChoices,
	force = false
): AddBookRequest {
	return {
		source: draft.source,
		title: draft.title,
		author: draft.author,
		pageCount: draft.pageCount,
		language: draft.language,
		isbn: draft.isbn,
		genre: choices.genre,
		format: choices.format,
		series: choices.series,
		coverUrl: draft.coverUrl,
		edition: draft.edition,
		force
	};
}

/** "Mondadori · 2019 · 544 pag. · Italiano" per le righe dei risultati. */
export function candidateMeta(candidate: {
	publisher: string | null;
	publishedDate: string | null;
	pageCount: number | null;
	language: string | null;
}): string {
	const year = /\d{4}/.exec(candidate.publishedDate ?? '')?.[0];
	return [
		candidate.publisher,
		year,
		candidate.pageCount ? `${candidate.pageCount} pag.` : null,
		languageLabel(candidate.language)
	]
		.filter(Boolean)
		.join(' · ');
}

export function seriesLabel(number: number | null, total: number | null): string | null {
	if (number === null) return null;
	return total === null ? `Vol. ${number}` : `Vol. ${number} di ${total}`;
}
