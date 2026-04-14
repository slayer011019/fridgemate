import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import OcrResultPanel from '../components/import/OcrResultPanel';
import ParsedItemEditor from '../components/import/ParsedItemEditor';
import UploadBox from '../components/import/UploadBox';
import {
  setImportItemsSelected,
  toImportableItems,
  toggleImportItemSelection,
  updateImportItem
} from '../features/import/importSelection';
import { useIngredients } from '../hooks/useIngredients';
import { applyImportCorrections, saveImportCorrections } from '../utils/import/importLearning';
import { parseImportText } from '../utils/importParser';
import { extractTextFromImage } from '../utils/ocr';

const IMPORT_PAGE_COPY = {
  uploadFirstError: '\u004F\u0043\u0052\uC744 \uC2DC\uC791\uD558\uAE30 \uC804\uC5D0 \uC774\uBBF8\uC9C0\uB97C \uBA3C\uC800 \uC5C5\uB85C\uB4DC\uD574\uC8FC\uC138\uC694.',
  ocrFailed: '\u004F\u0043\u0052 \uCC98\uB9AC\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694.',
  noSelectedItems:
    '\uAC00\uC838\uC62C \uD56D\uBAA9\uC774 \uC120\uD0DD\uB418\uC9C0 \uC54A\uC558\uC5B4\uC694. \uCD5C\uC18C 1\uAC1C \uC774\uC0C1 \uC120\uD0DD\uD574\uC8FC\uC138\uC694.',
  importFailed: '\uAC00\uC838\uC624\uAE30\uC5D0 \uC2E4\uD328\uD588\uC5B4\uC694. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.'
};

function ImportEmptyPanel({ title, description }) {
  return (
    <section className="rounded-[22px] border border-dashed border-brand-100/80 bg-white/60 px-5 py-8 text-center shadow-sm">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-lg text-brand-700">◎</div>
      <h3 className="mt-3 text-xl font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-2xl text-sm leading-6 muted">{description}</p>
    </section>
  );
}

function ImportPage() {
  const navigate = useNavigate();
  const { addIngredients } = useIngredients();
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [ocrResult, setOcrResult] = useState(null);
  const [showRawText, setShowRawText] = useState(false);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [importMessage, setImportMessage] = useState('');

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl('');
      return undefined;
    }

    const nextUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [imageFile]);

  const rawText = ocrResult?.text || '';
  const parseResult = useMemo(() => parseImportText(ocrResult), [ocrResult]);

  useEffect(() => {
    setItems(applyImportCorrections(parseResult.candidates));
  }, [parseResult]);

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0];
    setImageFile(nextFile || null);
    setOcrResult(null);
    setItems([]);
    setError('');
    setStatus('idle');
    setImportMessage('');
  };

  const runOcr = async () => {
    if (!imageFile) {
      setError(IMPORT_PAGE_COPY.uploadFirstError);
      setStatus('error');
      return;
    }

    setError('');
    setImportMessage('');
    setStatus('processing');
    setProgress(0);

    try {
      const result = await extractTextFromImage(imageFile, {
        onProgress: (value) => setProgress(value)
      });

      setOcrResult(result);
      setStatus('success');
    } catch (ocrError) {
      setError(ocrError.message || IMPORT_PAGE_COPY.ocrFailed);
      setStatus('error');
    }
  };

  const handleItemChange = (id, field, value) => {
    setItems((current) => updateImportItem(current, id, { [field]: value }));
  };

  const handleToggleItem = (id) => {
    setItems((current) => toggleImportItemSelection(current, id));
  };

  const handleImport = async () => {
    const selectedRawItems = items.filter((item) => item.selected && item.name.trim());
    const selectedItems = toImportableItems(items);

    if (!selectedItems.length) {
      setImportMessage(IMPORT_PAGE_COPY.noSelectedItems);
      return;
    }

    try {
      saveImportCorrections(selectedRawItems);
      await addIngredients(selectedItems);
      setImportMessage(`${selectedItems.length}\uAC1C \uD56D\uBAA9\uC744 \uAC00\uC838\uC654\uC5B4\uC694.`);
      navigate('/ingredients');
    } catch (importError) {
      setImportMessage(importError.message || IMPORT_PAGE_COPY.importFailed);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={'\uC0AC\uC9C4 \uB4F1\uB85D'}
        title={'\uC7A5\uBCF4\uAE30 \uC0AC\uC9C4\uC5D0\uC11C \uC7AC\uB8CC\uB97C \uC790\uB3D9\uC73C\uB85C \uCC3E\uC544\uBCF4\uC138\uC694'}
        description={
          '\uC8FC\uBB38 \uB0B4\uC5ED\uC774\uB098 \uC601\uC218\uC99D \uC0AC\uC9C4\uC744 \uC62C\uB9AC\uBA74 \uC571\uC774 \uC7AC\uB8CC \uD6C4\uBCF4\uB97C \uBA3C\uC800 \uCC3E\uC544\uC918\uC694. \uB0B4\uC6A9\uC744 \uD655\uC778\uD558\uACE0 \uD544\uC694\uD55C \uD56D\uBAA9\uB9CC \uACE0\uB974\uBA74 \uB3FC\uC694.'
        }
        action={
          <Link to="/ingredients" className="btn-secondary">
            {'\uB0C9\uC7A5\uACE0 \uBCF4\uAE30'}
          </Link>
        }
      />

      <UploadBox
        imagePreviewUrl={imagePreviewUrl}
        fileName={imageFile?.name}
        disabled={!imageFile || status === 'processing'}
        onChange={handleFileChange}
        onRunOcr={runOcr}
      />

      <OcrResultPanel
        status={status}
        progress={progress}
        error={error}
        rawText={rawText}
        showRawText={showRawText}
        onToggleRawText={() => setShowRawText((current) => !current)}
      />

      {status === 'idle' && !imageFile ? (
        <ImportEmptyPanel
          title={'\uC544\uC9C1 \uC5C5\uB85C\uB4DC\uD55C \uC774\uBBF8\uC9C0\uAC00 \uC5C6\uC5B4\uC694'}
          description={'\uC8FC\uBB38 \uB0B4\uC5ED \uB610\uB294 \uC601\uC218\uC99D \uC2A4\uD06C\uB9B0\uC0F7\uC744 \uBA3C\uC800 \uC62C\uB824\uC8FC\uC138\uC694.'}
        />
      ) : null}

      {status === 'success' && !parseResult.candidates.length ? (
        <ImportEmptyPanel
          title={'\uC4F8 \uB9CC\uD55C \uC0C1\uD488 \uD56D\uBAA9\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC5B4\uC694'}
          description={
            '\u004F\u0043\u0052 \uACB0\uACFC\uAC00 \uBA54\uD0C0 \uC815\uBCF4\uC774\uAC70\uB098 \uC774\uBBF8\uC9C0 \uD488\uC9C8\uC774 \uB0AE\uC744 \uC218 \uC788\uC5B4\uC694. \uC0C1\uD488\uBA85\uC774 \uB354 \uC120\uBA85\uD55C \uC774\uBBF8\uC9C0\uB85C \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uBCF4\uC138\uC694.'
          }
        />
      ) : null}

      {status === 'success' ? (
        <section className="soft-panel grid gap-2 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,auto))_minmax(0,1fr)] xl:items-center">
          <span className="badge bg-emerald-100 text-emerald-700">{`\uD6C4\uBCF4 \uD56D\uBAA9 ${parseResult.candidates.length}\uAC1C`}</span>
          <span className="badge bg-slate-100 text-slate-700">{`\uC720\uD6A8 \uBB38\uC7A5 ${parseResult.usefulLines.length}\uAC1C`}</span>
          <span className="badge bg-slate-100 text-slate-700">{`\uC81C\uC678 \uBB38\uC7A5 ${parseResult.ignoredLines.length}\uAC1C`}</span>
          <span className="badge bg-slate-100 text-slate-700">{`\uD15C\uD50C\uB9BF ${parseResult.template?.id || 'unknown'}`}</span>
          {importMessage ? (
            <span className="rounded-2xl border border-brand-100/80 bg-brand-50/70 px-3 py-2 text-sm font-medium text-brand-700 xl:justify-self-end">
              {importMessage}
            </span>
          ) : null}
        </section>
      ) : null}

      {parseResult.candidates.length ? (
        <ParsedItemEditor
          items={items}
          onItemChange={handleItemChange}
          onToggleItem={handleToggleItem}
          onSelectAll={() => setItems((current) => setImportItemsSelected(current, true))}
          onDeselectAll={() => setItems((current) => setImportItemsSelected(current, false))}
          onImport={handleImport}
        />
      ) : null}
    </div>
  );
}

export default ImportPage;
