import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import UploadBox from '../UploadBox';

const defaultProps = {
  fileName: '',
  disabled: false,
  onChange: vi.fn(),
  onRunOcr: vi.fn()
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('UploadBox raster preview', () => {
  it('rasterizes uploaded bytes onto a bounded canvas without creating a DOM URL', async () => {
    const drawImage = vi.fn();
    const close = vi.fn();
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage });
    const createImageBitmap = vi.fn().mockResolvedValue({ width: 4000, height: 2000, close });
    vi.stubGlobal('createImageBitmap', createImageBitmap);
    const imageFile = new File(['untrusted image bytes'], 'receipt.webp', { type: 'image/webp' });

    render(<UploadBox {...defaultProps} imageFile={imageFile} />);

    await waitFor(() => expect(screen.getByRole('img')).toBeVisible());

    const canvas = screen.getByRole('img');
    expect(createImageBitmap).toHaveBeenCalledWith(imageFile);
    expect(getContext).toHaveBeenCalledWith('2d', { alpha: false });
    expect(canvas).toHaveAttribute('width', '1600');
    expect(canvas).toHaveAttribute('height', '800');
    expect(drawImage).toHaveBeenCalledWith(expect.any(Object), 0, 0, 1600, 800);
    expect(close).toHaveBeenCalledTimes(1);
    expect(document.querySelector('img')).toBeNull();
  });

  it('fails closed when the browser cannot decode the uploaded bytes', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('invalid image')));
    const imageFile = new File(['<svg onload="alert(1)">'], 'receipt.svg', { type: 'image/svg+xml' });

    render(<UploadBox {...defaultProps} imageFile={imageFile} />);

    await waitFor(() => expect(globalThis.createImageBitmap).toHaveBeenCalled());
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});
