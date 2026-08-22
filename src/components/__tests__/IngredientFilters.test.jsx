import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IngredientFilters from '../IngredientFilters';

const filters = {
  query: '',
  category: 'all',
  storageType: 'all',
  sortOrder: 'asc',
  status: 'all'
};

describe('IngredientFilters', () => {
  it('offers a compact category select for narrow screens', () => {
    const onChange = vi.fn();

    render(
      <IngredientFilters
        filters={filters}
        categories={['채소', '과일']}
        storageTypes={['냉장', '냉동']}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: '채소' } });

    expect(onChange).toHaveBeenCalledWith('category', '채소');
  });

  it('keeps category buttons available for wider layouts', () => {
    render(
      <IngredientFilters
        filters={{ ...filters, category: '과일' }}
        categories={['채소', '과일']}
        storageTypes={['냉장']}
        onChange={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: '과일' })).toHaveAttribute('aria-pressed', 'true');
  });
});
