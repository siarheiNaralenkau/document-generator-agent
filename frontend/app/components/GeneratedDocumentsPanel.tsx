'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface Props {
  featurePath: string;
  featureFilename: string;
  finalPath: string;
  finalFilename: string;
}

type PreviewPayload = { preview: string; truncated: boolean; filename: string };

async function fetchPreview(filePath: string): Promise<PreviewPayload> {
  const res = await fetch('/api/generated-document/preview', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to load preview');
  }
  return res.json();
}

async function downloadDocument(filePath: string, filename: string) {
  const res = await fetch('/api/generated-document/download', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Download failed');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DocBlock({
  title,
  payload,
  filePath,
  filename,
  loading,
}: {
  title: string;
  payload: PreviewPayload | null;
  filePath: string;
  filename: string;
  loading: boolean;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      {loading ? (
        <p className="text-sm text-gray-500">Loading preview…</p>
      ) : payload ? (
        <>
          <div className="prose prose-sm max-w-none text-gray-800 border border-gray-100 rounded-md p-3 bg-gray-50/80 max-h-[min(28rem,50vh)] overflow-y-auto">
            <ReactMarkdown>{payload.preview}</ReactMarkdown>
          </div>
          {payload.truncated ? (
            <p className="text-xs text-gray-500 mt-2">Showing first ~220 words.</p>
          ) : null}
          <button
            type="button"
            onClick={() => downloadDocument(filePath, filename)}
            className="mt-3 px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Download full document
          </button>
        </>
      ) : null}
    </section>
  );
}

export function GeneratedDocumentsPanel({
  featurePath,
  featureFilename,
  finalPath,
  finalFilename,
}: Props) {
  const [feature, setFeature] = useState<PreviewPayload | null>(null);
  const [finalDoc, setFinalDoc] = useState<PreviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFeature(null);
    setFinalDoc(null);

    Promise.all([fetchPreview(featurePath), fetchPreview(finalPath)])
      .then(([f, fin]) => {
        if (!cancelled) {
          setFeature(f);
          setFinalDoc(fin);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load previews');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [featurePath, finalPath]);

  return (
    <div className="mt-6 space-y-4 border-t border-gray-200 pt-6">
      <h2 className="text-base font-semibold text-gray-900">Generated documents</h2>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
          <DocBlock
            title={`Feature-level (${featureFilename})`}
            payload={feature}
            filePath={featurePath}
            filename={featureFilename}
            loading={loading}
          />
          <DocBlock
            title={`Final BRD (${finalFilename})`}
            payload={finalDoc}
            filePath={finalPath}
            filename={finalFilename}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}
