function createRow() {
  return {
    brandLine: null,
    titleLines: [],
    priceLine: null,
    actionLine: null,
    rawLines: [],
    entries: [],
    bbox: null
  };
}

function hasProductTitle(row) {
  return row.titleLines.length > 0;
}

function getLineHeight(entry) {
  if (!entry?.bbox) {
    return 0;
  }

  return Math.max(0, entry.bbox.y1 - entry.bbox.y0);
}

function getVerticalGap(previousEntry, nextEntry) {
  if (!previousEntry?.bbox || !nextEntry?.bbox) {
    return 0;
  }

  return nextEntry.bbox.y0 - previousEntry.bbox.y1;
}

function median(values) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
  }

  return sorted[middleIndex];
}

function calculateMetrics(classifiedLines) {
  const linesWithBoxes = classifiedLines.filter((entry) => entry.bbox);
  const heights = linesWithBoxes.map(getLineHeight).filter((value) => value > 0);
  const gaps = [];

  for (let index = 1; index < linesWithBoxes.length; index += 1) {
    const gap = getVerticalGap(linesWithBoxes[index - 1], linesWithBoxes[index]);

    if (gap >= 0) {
      gaps.push(gap);
    }
  }

  const medianHeight = median(heights) || 24;
  const medianGap = median(gaps) || Math.round(medianHeight * 0.55);

  return {
    medianHeight,
    rowGapThreshold: Math.max(18, medianGap + medianHeight * 0.6),
    titleGapThreshold: Math.max(12, medianGap + medianHeight * 0.25)
  };
}

function mergeBoundingBox(row, entry) {
  if (!entry?.bbox) {
    return row.bbox;
  }

  if (!row.bbox) {
    return { ...entry.bbox };
  }

  return {
    x0: Math.min(row.bbox.x0, entry.bbox.x0),
    y0: Math.min(row.bbox.y0, entry.bbox.y0),
    x1: Math.max(row.bbox.x1, entry.bbox.x1),
    y1: Math.max(row.bbox.y1, entry.bbox.y1)
  };
}

function appendEntry(row, entry, targetField) {
  row.rawLines.push(entry);
  row.entries.push(entry);
  row.bbox = mergeBoundingBox(row, entry);

  if (targetField === 'brandLine') {
    row.brandLine = entry;
    return;
  }

  if (targetField === 'priceLine') {
    row.priceLine = entry;
    return;
  }

  if (targetField === 'actionLine') {
    row.actionLine = entry;
    return;
  }

  row.titleLines.push(entry);
}

function finalizeRow(rows, currentRow) {
  if (currentRow && hasProductTitle(currentRow)) {
    rows.push(currentRow);
  }
}

function shouldStartNewRow(currentRow, entry, metrics) {
  if (!currentRow || !currentRow.entries.length) {
    return false;
  }

  const previousEntry = currentRow.entries[currentRow.entries.length - 1];
  const verticalGap = getVerticalGap(previousEntry, entry);

  if ((entry.type === 'brandOnly' || entry.type === 'productTitle') && currentRow.actionLine) {
    return true;
  }

  if ((entry.type === 'brandOnly' || entry.type === 'productTitle') && currentRow.priceLine && verticalGap > metrics.titleGapThreshold) {
    return true;
  }

  if ((entry.type === 'brandOnly' || entry.type === 'productTitle') && verticalGap > metrics.rowGapThreshold) {
    return true;
  }

  return false;
}

export function buildCoupangRows(classifiedLines) {
  const rows = [];
  const metrics = calculateMetrics(classifiedLines);
  let currentRow = null;

  classifiedLines.forEach((entry) => {
    const { type } = entry;

    if (type === 'orderHeader' || type === 'deliveryHeader') {
      finalizeRow(rows, currentRow);
      currentRow = null;
      return;
    }

    if (type === 'noise') {
      if (currentRow && currentRow.priceLine) {
        finalizeRow(rows, currentRow);
        currentRow = null;
      }
      return;
    }

    if (type === 'brandOnly') {
      if (shouldStartNewRow(currentRow, entry, metrics)) {
        finalizeRow(rows, currentRow);
        currentRow = null;
      }

      if (!currentRow) {
        currentRow = createRow();
      }

      appendEntry(currentRow, entry, 'brandLine');
      return;
    }

    if (type === 'productTitle') {
      if (shouldStartNewRow(currentRow, entry, metrics)) {
        finalizeRow(rows, currentRow);
        currentRow = null;
      }

      if (!currentRow) {
        currentRow = createRow();
      }

      appendEntry(currentRow, entry, 'titleLines');
      return;
    }

    if (type === 'priceLine') {
      if (!currentRow || !hasProductTitle(currentRow)) {
        return;
      }

      appendEntry(currentRow, entry, 'priceLine');
      return;
    }

    if (type === 'actionLine') {
      if (!currentRow || !hasProductTitle(currentRow)) {
        return;
      }

      appendEntry(currentRow, entry, 'actionLine');
      finalizeRow(rows, currentRow);
      currentRow = null;
    }
  });

  finalizeRow(rows, currentRow);
  return rows;
}
