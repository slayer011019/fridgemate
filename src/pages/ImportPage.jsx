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
  uploadFirstError: 'OCR을 시작하기 전에 이미지를 먼저 업로드해주세요.',
  ocrFailed: 'OCR 처리에 실패했어요.',
  noSelectedItems: '가져올 항목이 선택되지 않았어요. 최소 1개 이상 선택해주세요.',
  importFailed: '가져오기에 실패했어요. 다시 시도해주세요.'
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
      setImportMessage(`${selectedItems.length}개 항목을 가져왔어요.`);
      navigate('/ingredients');
    } catch (importError) {
      setImportMessage(importError.message || IMPORT_PAGE_COPY.importFailed);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="가져오기"
        title="장보기 스크린샷에서 재료를 불러와보세요"
        description="주문 내역이나 영수증 이미지를 업로드하고, OCR로 추출한 후보를 검토한 뒤 선택한 항목만 한 번에 등록할 수 있어요."
        action={
          <Link to="/ingredients" className="btn-secondary">
            재료 목록으로 돌아가기
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
          title="아직 업로드한 이미지가 없어요"
          description="주문 내역 또는 영수증 스크린샷을 먼저 올려주세요."
        />
      ) : null}

      {status === 'success' && !parseResult.candidates.length ? (
        <EmptyState
          title="쓸 만한 상품 항목을 찾지 못했어요"
          description="OCR 결과가 메타 정보이거나 이미지 품질이 낮을 수 있어요. 상품명이 더 선명한 이미지로 다시 시도해보세요."
        />
      ) : null}

      {status === 'success' ? (
        <section className="soft-panel flex flex-wrap gap-2 text-sm text-slate-700">
          <span className="badge bg-emerald-100 text-emerald-700">{`후보 항목 ${parseResult.candidates.length}개`}</span>
          <span className="badge bg-slate-100 text-slate-700">{`유효 문장 ${parseResult.usefulLines.length}개`}</span>
          <span className="badge bg-slate-100 text-slate-700">{`제외 문장 ${parseResult.ignoredLines.length}개`}</span>
          <span className="badge bg-slate-100 text-slate-700">{`템플릿 ${parseResult.template?.id || 'unknown'}`}</span>
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
