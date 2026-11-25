'use client';
import { useState } from 'react';
import type { Product, ProductActions } from '../types';
import { Modal, button, field, secondary } from './primitives';
export function QnA({ product, actions }: { product: Product; actions: ProductActions }) {
  const [query, setQuery] = useState('');
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [votes, setVotes] = useState<string[]>([]);
  const entries = (product.qna ?? []).filter((q) =>
    `${q.question} ${q.answer ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="mb-5 flex flex-wrap gap-3">
        <label className="min-w-48 flex-1">
          <span className="sr-only">Search questions</span>
          <input
            className={field}
            type="search"
            placeholder="Search product questions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button className={secondary} onClick={() => setAsking(true)}>
          Ask a question
        </button>
      </div>
      {!entries.length && (
        <p className="text-slate-500">
          {query ? 'No matching questions. Try a different search.' : 'Ask the first question'}
        </p>
      )}
      <div className="divide-y divide-slate-100">
        {entries.map((q) => (
          <article key={q.id} className="py-4">
            <h3 className="font-semibold">{q.question}</h3>
            {q.answer ? (
              <p className="mt-2 leading-7 text-slate-600">{q.answer}</p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Awaiting an answer</p>
            )}
            {q.answeredBy && (
              <p className="mt-2 text-xs text-teal-700">Answered by {q.answeredBy}</p>
            )}
            <button
              className="mt-2 min-h-11 text-sm text-teal-700 disabled:text-slate-500"
              disabled={!actions.vote || busy || votes.includes(q.id)}
              aria-pressed={votes.includes(q.id)}
              onClick={async () => {
                setBusy(true);
                try {
                  await actions.vote?.('question', q.id);
                  setVotes((v) => [...v, q.id]);
                } catch (e) {
                  setNotice(e instanceof Error ? e.message : 'Please try again.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Helpful ({q.upvotes + Number(votes.includes(q.id))})
            </button>
          </article>
        ))}
      </div>
      <p role="status" className="mt-3 text-sm text-teal-700">
        {notice}
      </p>
      {asking && (
        <Modal title="Ask a product question" onClose={() => setAsking(false)}>
          {actions.askQuestion ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!question.trim()) return;
                setBusy(true);
                try {
                  await actions.askQuestion!(product, question.trim());
                  setNotice('Your question has been submitted for review.');
                  setAsking(false);
                  setQuestion('');
                } catch (e) {
                  setNotice(e instanceof Error ? e.message : 'Please try again.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label className="block text-sm">
                Your question
                <textarea
                  className={`${field} mt-2`}
                  required
                  minLength={10}
                  maxLength={1000}
                  rows={4}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </label>
              <button className={`${button} mt-4`} disabled={busy}>
                Submit question
              </button>
              <p role="status">{notice}</p>
            </form>
          ) : (
            <div>
              <p className="leading-7 text-slate-600">
                Contact our support team with your question about {product.title}.
              </p>
              <a
                className={`${button} mt-4`}
                href={`/account/support/new?subject=${encodeURIComponent(product.title)}`}
              >
                Ask Trustlon support
              </a>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
