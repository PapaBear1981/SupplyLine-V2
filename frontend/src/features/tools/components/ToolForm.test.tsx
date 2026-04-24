import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Form } from 'antd';
import { ToolForm } from './ToolForm';
import type { ToolFormData } from '../types';

const mockGetWarehousesQuery = vi.fn();

vi.mock('@features/warehouses/services/warehousesApi', () => ({
  useGetWarehousesQuery: () => mockGetWarehousesQuery(),
}));

const warehouses = [
  {
    id: 1,
    name: 'Main Warehouse',
    warehouse_type: 'main',
    is_active: true,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
  },
  {
    id: 2,
    name: 'Satellite A',
    warehouse_type: 'satellite',
    is_active: true,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
  },
];

const Harness = (props: {
  onSubmit: (values: ToolFormData) => void;
  onCancel?: () => void;
}) => {
  const [form] = Form.useForm();
  return (
    <ToolForm
      form={form}
      onSubmit={props.onSubmit}
      onCancel={props.onCancel ?? (() => {})}
    />
  );
};

describe('ToolForm', () => {
  beforeEach(() => {
    mockGetWarehousesQuery.mockReturnValue({
      data: { warehouses, pagination: { page: 1, per_page: 200, total: 2, pages: 1, has_next: false, has_prev: false } },
      isLoading: false,
    });
  });

  it('renders warehouse as a required select populated from the API', async () => {
    render(<Harness onSubmit={vi.fn()} />);

    const label = await screen.findByText('Warehouse');
    const formItem = label.closest('.ant-form-item');
    expect(formItem).not.toBeNull();
    expect(formItem!.querySelector('.ant-form-item-required')).not.toBeNull();

    expect(screen.getByText(/Select a warehouse/i)).toBeInTheDocument();
  });

  it('blocks submit and shows a validation message when warehouse is missing', async () => {
    const handleSubmit = vi.fn();
    render(<Harness onSubmit={handleSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('e.g., TL-001'), {
      target: { value: 'TL-100' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g., SN123456'), {
      target: { value: 'SN-100' },
    });
    fireEvent.change(screen.getByPlaceholderText('Describe the tool...'), {
      target: { value: 'A tool' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g., Warehouse A, Shelf 3'), {
      target: { value: 'Shelf 3' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Create Tool/i }));

    await waitFor(() => {
      expect(screen.getByText('Please select a warehouse')).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
