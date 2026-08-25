import assert from 'node:assert/strict';
import test from 'node:test';

process.env.AFFINITY_API_KEY = 'test-key';

const {
  executeListCompanyNotes,
  extractCursorFromUrl
} = await import('../dist/tools/notes.js');
const { executeSearchCompanies } = await import('../dist/tools/companies-v1.js');
const { AffinityClientV1 } = await import('../dist/client-v1.js');
const { AffinityTimeoutError, formatError } = await import('../dist/utils/errors.js');
const { CHARACTER_LIMIT, SEARCH_REQUEST_TIMEOUT_MS } = await import('../dist/constants.js');

function createNote(id, contentSize = 7000) {
  return {
    id,
    content: { html: `<p>${'x'.repeat(contentSize)}</p>` },
    creator: {
      id: 10,
      firstName: 'Test',
      lastName: 'User',
      primaryEmailAddress: 'test@example.com',
      type: 'internal'
    },
    createdAt: '2026-08-06T12:00:00.000Z',
    updatedAt: null,
    type: 'entities',
    mentions: []
  };
}

test('extracts cursors from absolute and API-relative next URLs', () => {
  assert.equal(
    extractCursorFromUrl('https://api.affinity.co/v2/companies/123/notes?cursor=absolute'),
    'absolute'
  );
  assert.equal(
    extractCursorFromUrl('/v2/companies/123/notes?limit=2&cursor=relative'),
    'relative'
  );
});

test('re-pages more than two notes so every hasMore response has a usable cursor', async () => {
  const originalFetch = globalThis.fetch;
  const notes = [createNote(1), createNote(2), createNote(3), createNote(4)];
  const requestedUrls = [];

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    requestedUrls.push(url);
    const cursor = url.searchParams.get('cursor');
    const limit = Number(url.searchParams.get('limit'));

    if (cursor === 'notes-page-2') {
      return Response.json({
        data: notes.slice(2),
        pagination: { prevUrl: null, nextUrl: null }
      });
    }

    const page = notes.slice(0, limit);
    return Response.json({
      data: page,
      pagination: {
        prevUrl: null,
        nextUrl: limit < notes.length
          ? `/v2/companies/123/notes?limit=${limit}&cursor=notes-page-2`
          : null
      }
    });
  };

  try {
    const firstPage = JSON.parse(await executeListCompanyNotes({
      companyId: '123',
      responseFormat: 'json'
    }));

    assert.equal(firstPage.count, 2);
    assert.equal(firstPage.hasMore, true);
    assert.equal(firstPage.nextCursor, 'notes-page-2');
    assert.ok(requestedUrls.some((url) => url.searchParams.get('limit') === '2'));

    const secondPage = JSON.parse(await executeListCompanyNotes({
      companyId: '123',
      cursor: firstPage.nextCursor,
      limit: 2,
      responseFormat: 'json'
    }));

    assert.deepEqual(secondPage.notes.map((note) => note.id), [3, 4]);
    assert.equal(secondPage.hasMore, false);
    assert.equal(secondPage.nextCursor, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('re-pages oversized company continuation responses while preserving a usable token', async () => {
  const originalFetch = globalThis.fetch;
  const companies = Array.from({ length: 4 }, (_, index) => ({
    id: index + 1,
    name: `Company ${index + 1}`,
    description: 'x'.repeat(7000)
  }));
  const requestedPageSizes = [];
  const requestedPageTokens = [];

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    const pageSize = Number(url.searchParams.get('page_size'));
    requestedPageSizes.push(pageSize);
    requestedPageTokens.push(url.searchParams.get('page_token'));

    return Response.json({
      organizations: companies.slice(0, pageSize),
      next_page_token: 'page-3'
    });
  };

  try {
    const rawResult = await executeSearchCompanies({
      pageToken: 'page-2',
      pageSize: 4,
      responseFormat: 'json'
    });
    const result = JSON.parse(rawResult);

    assert.deepEqual(requestedPageSizes, [4, 2]);
    assert.deepEqual(requestedPageTokens, ['page-2', 'page-2']);
    assert.ok(rawResult.length <= CHARACTER_LIMIT);
    assert.equal(result.count, 2);
    assert.equal(result.hasMore, true);
    assert.equal(result.nextPageToken, 'page-3');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('returns a typed retry contract before the outer MCP deadline', async () => {
  assert.equal(SEARCH_REQUEST_TIMEOUT_MS, 20_000);
  assert.ok(SEARCH_REQUEST_TIMEOUT_MS < 30_000);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      reject(new DOMException('The operation was aborted', 'AbortError'));
    });
  });

  try {
    const client = new AffinityClientV1('test-key');
    const error = await client.fetch(
      '/organizations?term=pageindex.ai',
      {},
      0,
      { operation: 'search_companies', timeoutMs: 5 }
    ).then(
      () => null,
      (caught) => caught
    );

    assert.ok(error instanceof AffinityTimeoutError);
    assert.equal(error.code, 'AFFINITY_TIMEOUT');
    assert.equal(error.retryable, true);
    assert.equal(error.timeoutMs, 5);

    const result = JSON.parse(formatError(error));
    assert.deepEqual(result.error, {
      code: 'AFFINITY_TIMEOUT',
      message: 'Affinity search_companies timed out after 5ms',
      retryable: true,
      retryAfterMs: 2000,
      guidance: 'Retry after the suggested delay. If the timeout repeats, narrow the search term.'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('keeps the timeout active while reading a successful response body', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: () => new Promise((_resolve, reject) => {
      const fallback = setTimeout(() => reject(new Error('body read did not abort')), 100);
      init.signal.addEventListener('abort', () => {
        clearTimeout(fallback);
        reject(new DOMException('The operation was aborted', 'AbortError'));
      }, { once: true });
    })
  });

  try {
    const client = new AffinityClientV1('test-key');
    const error = await client.fetch(
      '/organizations?term=pageindex.ai',
      {},
      0,
      { operation: 'search_companies', timeoutMs: 10 }
    ).then(
      () => null,
      (caught) => caught
    );

    assert.ok(error instanceof AffinityTimeoutError);
    assert.equal(error.code, 'AFFINITY_TIMEOUT');
    assert.equal(error.timeoutMs, 10);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('keeps the timeout active while reading an error response body', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => ({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    headers: new Headers(),
    text: () => new Promise((_resolve, reject) => {
      const fallback = setTimeout(() => reject(new Error('error body read did not abort')), 100);
      init.signal.addEventListener('abort', () => {
        clearTimeout(fallback);
        reject(new DOMException('The operation was aborted', 'AbortError'));
      }, { once: true });
    })
  });

  try {
    const client = new AffinityClientV1('test-key');
    const error = await client.fetch(
      '/organizations?term=pageindex.ai',
      {},
      0,
      { operation: 'search_companies', timeoutMs: 10 }
    ).then(
      () => null,
      (caught) => caught
    );

    assert.ok(error instanceof AffinityTimeoutError);
    assert.equal(error.code, 'AFFINITY_TIMEOUT');
    assert.equal(error.timeoutMs, 10);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('shares one search deadline across response-size retries', async () => {
  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  let now = 1_000;
  let requestCount = 0;
  Date.now = () => now;

  globalThis.fetch = async () => {
    requestCount += 1;
    now += 21_000;
    return Response.json({
      organizations: [
        { id: 1, name: 'One', description: 'x'.repeat(14_000) },
        { id: 2, name: 'Two', description: 'x'.repeat(14_000) }
      ],
      next_page_token: 'page-2'
    });
  };

  try {
    const result = JSON.parse(await executeSearchCompanies({
      pageSize: 2,
      responseFormat: 'json'
    }));

    assert.equal(requestCount, 1);
    assert.equal(result.error.code, 'AFFINITY_TIMEOUT');
    assert.equal(result.error.retryable, true);
  } finally {
    Date.now = originalDateNow;
    globalThis.fetch = originalFetch;
  }
});

test('keeps single oversized company and note responses valid and bounded', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.includes('/notes')) {
      return Response.json({
        data: [createNote(99, CHARACTER_LIMIT * 2)],
        pagination: { prevUrl: null, nextUrl: null }
      });
    }
    return Response.json({
      organizations: [{
        id: 99,
        name: 'Oversized Company',
        description: 'x'.repeat(CHARACTER_LIMIT * 2)
      }],
      next_page_token: null
    });
  };

  try {
    const companyRaw = await executeSearchCompanies({
      pageSize: 1,
      responseFormat: 'json'
    });
    const noteRaw = await executeListCompanyNotes({
      companyId: '123',
      limit: 1,
      responseFormat: 'json'
    });

    assert.ok(companyRaw.length <= CHARACTER_LIMIT);
    assert.ok(noteRaw.length <= CHARACTER_LIMIT);
    assert.equal(JSON.parse(companyRaw).truncated, true);
    assert.equal(JSON.parse(noteRaw).truncated, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
