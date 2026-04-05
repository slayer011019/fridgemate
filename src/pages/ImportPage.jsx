import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
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
    <div className="space-y-5">
      <PageHeader
        eyebrow={'\uAC00\uC838\uC624\uAE30'}
        title={'\uC7A5\uBCF4\uAE30 \uC2A4\uD06C\uB9B0\uC0F7\uC5D0\uC11C \uC7AC\uB8CC\uB97C \uBD88\uB7EC\uC640\uBCF4\uC138\uC694'}
        description={
          '\uC8FC\uBB38 \uB0B4\uC5ED\uC774\uB098 \uC601\uC218\uC99D \uC774\uBBF8\uC9C0\uB97C \uC5C5\uB85C\uB4DC\uD558\uACE0, OCR\uB85C \uCD94\uCD9C\uD55C \uD6C4\uBCF4\uB97C \uAC80\uD1A0\uD55C \uB4A4 \uC120\uD0DD\uD55C \uD56D\uBAA9\uB9CC \uD55C \uBC88\uC5D0 \uB4F1\uB85D\uD560 \uC218 \uC788\uC5B4\uC694.'
        }
        action={
          <Link to="/ingredients" className="btn-secondary">
            {'\uC7AC\uB8CC \uBAA9\uB85D\uC73C\uB85C \uB3CC\uC544\uAC00\uAE30'}
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
        <EmptyState
          title={'\uC544\uC9C1 \uC5C5\uB85C\uB4DC\uD55C \uC774\uBBF8\uC9C0\uAC00 \uC5C6\uC5B4\uC694'}
          description={'\uC8FC\uBB38 \uB0B4\uC5ED \uB610\uB294 \uC601\uC218\uC99D \uC2A4\uD06C\uB9B0\uC0F7\uC744 \uBA3C\uC800 \uC62C\uB824\uC8FC\uC138\uC694.'}
        />
      ) : null}

      {status === 'success' && !parseResult.candidates.length ? (
        <EmptyState
          title={'\uC4F8 \uB9CC\uD55C \uC0C1\uD488 \uD56D\uBAA9\uC744 \uCC3E\uC9C0 \uBABB\uD588\uC5B4\uC694'}
          description={
            '\u004F\u0043\u0052 \uACB0\uACFC\uAC00 \uBA54\uD0C0 \uC815\uBCF4\uC774\uAC70\uB098 \uC774\uBBF8\uC9C0 \uD488\uC9C8\uC774 \uB0AE\uC744 \uC218 \uC788\uC5B4\uC694. \uC0C1\uD488\uBA85\uC774 \uB354 \uC120\uBA85\uD55C \uC774\uBBF8\uC9C0\uB85C \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uBCF4\uC138\uC694.'
          }
        />
      ) : null}

      {status === 'success' ? (
        <section className="soft-panel flex flex-wrap gap-2 text-sm text-slate-700">
          <span className="badge bg-emerald-100 text-emerald-700">{`\uD6C4\uBCF4 \uD56D\uBAA9 ${parseResult.candidates.length}\uAC1C`}</span>
          <span className="badge bg-slate-100 text-slate-700">{`\uC720\uD6A8 \uBB38\uC7A5 ${parseResult.usefulLines.length}\uAC1C`}</span>
          <span className="badge bg-slate-100 text-slate-700">{`\uC81C\uC678 \uBB38\uC7A5 ${parseResult.ignoredLines.length}\uAC1C`}</span>
          <span className="badge bg-slate-100 text-slate-700">{`\uD15C\uD50C\uB9BF ${parseResult.template?.id || 'unknown'}`}</span>
          {importMessage ? <span className="badge bg-brand-50 text-brand-700">{importMessage}</span> : null}
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
