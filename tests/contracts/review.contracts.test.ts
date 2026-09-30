import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addQuoteInputSchema,
  bookDetailResponseSchema,
  genreChangeResponseSchema,
  quoteDeleteResponseSchema,
  quoteMutationResponseSchema,
  readingMutationResultSchema,
  reviewReferenceResponseSchema,
  reviewSaveResultSchema,
  updateQuoteInputSchema,
} from '../../src/lib/contracts';
import { runDb } from '../helpers/env'; // first: sets DATABASE_URL defaults
import { createContractFixture, type ContractFixture } from '../helpers/fixture';
import { expectRpcContract, expectRpcError } from '../helpers/rpc';
import { closeAdminSql } from '../helpers/users';

// Migration 103 (get_review_reference, add_quote, update_quote, delete_quote) + save_review.
// Usa solo un utente di prova creato dalla fixture e rimosso a fine test: non resetta il DB.

describe('review/quote contracts (senza DB)', () => {
  it('valida gli input di citazione', () => {
    const bookId = '11111111-1111-4111-8111-111111111111';
    expect(addQuoteInputSchema.parse({ bookId, body: '  Ciao  ' })).toEqual({
      bookId,
      body: 'Ciao',
      page: null,
    });
    expect(addQuoteInputSchema.safeParse({ bookId, body: '   ' }).success).toBe(false);
    expect(addQuoteInputSchema.safeParse({ bookId, body: 'x', page: 0 }).success).toBe(false);
    expect(updateQuoteInputSchema.safeParse({ quoteId: bookId, body: 'x', page: 12 }).success).toBe(
      true,
    );
  });

  it('valida le risposte di riferimento e citazione', () => {
    expect(
      reviewReferenceResponseSchema.safeParse({
        contractVersion: 1,
        tags: [{ id: 1, slug: 'friendship', label: 'Amicizia' }],
        dimensions: [
          {
            dimensionKey: 'fantasy.magic',
            genreSlug: 'fantasy-magical-gothic',
            label: 'Elemento fantastico / Sistema magico',
            sortOrder: 2,
            version: 1,
          },
        ],
      }).success,
    ).toBe(true);
    expect(quoteDeleteResponseSchema.safeParse({ contractVersion: 1, ok: true }).success).toBe(true);
  });
});

(runDb ? describe : describe.skip)('review/quote RPC contract (migration 103)', () => {
  let fx: ContractFixture;

  beforeAll(async () => {
    fx = await createContractFixture();
  });

  afterAll(async () => {
    if (fx) await fx.cleanup();
    await closeAdminSql();
  });

  it('get_review_reference restituisce 27 tag e 35 dimensioni', async () => {
    const ref = await expectRpcContract(fx.client, 'get_review_reference', {}, reviewReferenceResponseSchema);
    expect(ref.tags).toHaveLength(27);
    expect(ref.tags[0]).toMatchObject({ slug: 'friendship', label: 'Amicizia' });
    expect(ref.dimensions).toHaveLength(35);
    expect(
      ref.dimensions.filter((d) => d.genreSlug === 'fantasy-magical-gothic').map((d) => d.dimensionKey),
    ).toEqual([
      'fantasy.worldbuilding',
      'fantasy.magic',
      'fantasy.characters',
      'fantasy.pacing',
      'fantasy.atmosphere',
    ]);
  });

  it('citazioni e recensione restano bloccate finché non c è una lettura completata', async () => {
    const add = await expectRpcError(fx.client, 'add_quote', {
      p_book_id: fx.books.fantasy,
      p_body: 'Non ancora',
      p_page: 1,
    });
    expect(add.dataCode).toBe('CONFLICT');

    const save = await expectRpcError(fx.client, 'save_review', {
      p_book_id: fx.books.fantasy,
      p_rating: 4,
      p_adjectives: ['Epico', 'Malinconico', 'Immersivo'],
    });
    expect(save.dataCode).toBe('CONFLICT');
  });

  it('flusso completo: lettura completata, recensione, citazioni CRUD, cambio genere', async () => {
    await expectRpcContract(
      fx.client,
      'add_completed_reading',
      {
        p_book_id: fx.books.fantasy,
        p_started_at: '2026-01-03T20:00:00+00:00',
        p_finished_at: '2026-01-18T20:00:00+00:00',
        p_final_page: 662,
        p_start_page: 0,
      },
      readingMutationResultSchema,
    );

    const ref = await expectRpcContract(fx.client, 'get_review_reference', {}, reviewReferenceResponseSchema);
    const magic = ref.tags.find((t) => t.slug === 'magic')!;

    const saved = await expectRpcContract(
      fx.client,
      'save_review',
      {
        p_book_id: fx.books.fantasy,
        p_rating: 4,
        p_adjectives: ['Epico', 'Malinconico', 'Immersivo'],
        p_scores: [
          { dimension_key: 'fantasy.worldbuilding', score: 5 },
          { dimension_key: 'fantasy.pacing', score: 3 },
        ],
        p_tag_ids: [magic.id],
      },
      reviewSaveResultSchema,
    );
    expect(saved.review.scores.map((s) => s.dimensionKey)).toEqual([
      'fantasy.worldbuilding',
      'fantasy.pacing',
    ]);
    expect(saved.review.tags.map((t) => t.slug)).toEqual(['magic']);

    // aggettivi duplicati (case-insensitive) rifiutati dal DB
    const dup = await expectRpcError(fx.client, 'save_review', {
      p_book_id: fx.books.fantasy,
      p_rating: 4,
      p_adjectives: ['Epico', 'epico', 'Immersivo'],
    });
    expect(dup.dataCode).toBe('VALIDATION');

    const added = await expectRpcContract(
      fx.client,
      'add_quote',
      { p_book_id: fx.books.fantasy, p_body: '  Certe storie si leggono due volte.  ', p_page: 48 },
      quoteMutationResponseSchema,
    );
    expect(added.quote).toMatchObject({ body: 'Certe storie si leggono due volte.', page: 48 });

    const updated = await expectRpcContract(
      fx.client,
      'update_quote',
      { p_quote_id: added.quote.id, p_body: 'Testo corretto', p_page: null },
      quoteMutationResponseSchema,
    );
    expect(updated.quote).toMatchObject({ id: added.quote.id, body: 'Testo corretto', page: null });

    for (const bad of [
      { p_book_id: fx.books.fantasy, p_body: '   ', p_page: null },
      { p_book_id: fx.books.fantasy, p_body: 'x', p_page: 0 },
    ]) {
      expect((await expectRpcError(fx.client, 'add_quote', bad)).dataCode).toBe('VALIDATION');
    }

    const detail = await expectRpcContract(
      fx.client,
      'get_book_detail',
      { p_book_id: fx.books.fantasy },
      bookDetailResponseSchema,
    );
    expect(detail.quotes).toHaveLength(1);

    // cambio genere: voto, aggettivi, tag e citazioni restano; i rating specifici si azzerano
    const changed = await expectRpcContract(
      fx.client,
      'change_book_genre',
      { p_book_id: fx.books.fantasy, p_genre_slug: 'thriller-mystery' },
      genreChangeResponseSchema,
    );
    expect(changed.reviewScoresReset).toBe(true);

    const after = await expectRpcContract(
      fx.client,
      'get_book_detail',
      { p_book_id: fx.books.fantasy },
      bookDetailResponseSchema,
    );
    expect(after.review).toMatchObject({ rating: 4, adjectives: ['Epico', 'Malinconico', 'Immersivo'] });
    expect(after.review?.scores).toEqual([]);
    expect(after.review?.tags.map((t) => t.slug)).toEqual(['magic']);
    expect(after.quotes).toHaveLength(1);

    await expectRpcContract(
      fx.client,
      'delete_quote',
      { p_quote_id: added.quote.id },
      quoteDeleteResponseSchema,
    );
    expect((await expectRpcError(fx.client, 'delete_quote', { p_quote_id: added.quote.id })).dataCode).toBe(
      'NOT_FOUND',
    );
  });

  it('un altro utente non vede né modifica le citazioni', async () => {
    const { createTestUser } = await import('../helpers/users');
    const other = await createTestUser('review-other');
    try {
      const mine = await expectRpcContract(
        fx.client,
        'add_quote',
        { p_book_id: fx.books.fantasy, p_body: 'Solo mia', p_page: null },
        quoteMutationResponseSchema,
      );
      const update = await expectRpcError(other.rpc, 'update_quote', {
        p_quote_id: mine.quote.id,
        p_body: 'rubata',
        p_page: null,
      });
      expect(update.dataCode).toBe('NOT_FOUND');
      expect((await expectRpcError(other.rpc, 'delete_quote', { p_quote_id: mine.quote.id })).dataCode).toBe(
        'NOT_FOUND',
      );
      expect(
        (
          await expectRpcError(other.rpc, 'add_quote', {
            p_book_id: fx.books.fantasy,
            p_body: 'intrusa',
            p_page: null,
          })
        ).dataCode,
      ).toBe('NOT_FOUND');
    } finally {
      await other.cleanup();
    }
  });
});
