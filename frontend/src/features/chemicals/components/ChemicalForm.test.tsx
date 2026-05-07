import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Form } from 'antd';
import { ChemicalForm } from './ChemicalForm';

const mockUseGetWarehousesQuery = vi.fn();

vi.mock('@features/warehouses/services/warehousesApi', () => ({
  useGetWarehousesQuery: (...args: unknown[]) => mockUseGetWarehousesQuery(...args),
}));

const warehouses = [
  { id: 1, name: 'Main Warehouse' },
  { id: 2, name: 'East Hangar' },
  { id: 3, name: 'Overflow Storage' },
];

const Harness = ({
  onSubmit,
  onCancel,
}: {
  onSubmit: (values: unknown) => void;
  onCancel: () => void;
}) => {
  const [form] = Form.useForm();
  return <ChemicalForm form={form} onSubmit={onSubmit} onCancel={onCancel} />;
};

const renderForm = () => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const utils = render(<Harness onSubmit={onSubmit} onCancel={onCancel} />);
  return { ...utils, onSubmit, onCancel };
};

describe('ChemicalForm warehouse field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetWarehousesQuery.mockReturnValue({
      data: { warehouses },
      isLoading: false,
    });
  });

  it('requests warehouses with a generous page size so all options load', () => {
    renderForm();
    expect(mockUseGetWarehousesQuery).toHaveBeenCalledWith({ per_page: 200 });
  });

  it('renders the warehouse field as a Select, not a numeric input', () => {
    renderForm();
    const field = screen.getByLabelText('Warehouse');
    // Antd Select is a combobox — a numeric InputNumber would be a spinbutton.
    expect(field).toHaveAttribute('role', 'combobox');
  });

  it('populates the dropdown with warehouse names from the API', async () => {
    renderForm();
    fireEvent.mouseDown(screen.getByLabelText('Warehouse'));

    await waitFor(() => {
      expect(screen.getByText('Main Warehouse')).toBeInTheDocument();
    });
    expect(screen.getByText('East Hangar')).toBeInTheDocument();
    expect(screen.getByText('Overflow Storage')).toBeInTheDocument();
  });

  it('submits the selected warehouse id, not its name', async () => {
    const { onSubmit } = renderForm();

    fireEvent.change(screen.getByLabelText('Part Number'), {
      target: { value: 'CH-100' },
    });
    fireEvent.change(screen.getByLabelText('Lot Number'), {
      target: { value: 'LOT-100' },
    });
    fireEvent.change(screen.getByLabelText('Quantity'), {
      target: { value: '5' },
    });

    fireEvent.mouseDown(screen.getByLabelText('Unit'));
    const unitOption = await screen.findByText('Each');
    fireEvent.click(unitOption);

    fireEvent.mouseDown(screen.getByLabelText('Warehouse'));
    const warehouseOption = await screen.findByText('East Hangar');
    fireEvent.click(warehouseOption);

    fireEvent.click(screen.getByRole('button', { name: /create chemical/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        part_number: 'CH-100',
        lot_number: 'LOT-100',
        warehouse_id: 2,
      })
    );
  });

  it('blocks submission with a validation error when no warehouse is selected', async () => {
    const { onSubmit } = renderForm();

    fireEvent.change(screen.getByLabelText('Part Number'), {
      target: { value: 'CH-101' },
    });
    fireEvent.change(screen.getByLabelText('Lot Number'), {
      target: { value: 'LOT-101' },
    });
    fireEvent.change(screen.getByLabelText('Quantity'), {
      target: { value: '5' },
    });
    fireEvent.mouseDown(screen.getByLabelText('Unit'));
    fireEvent.click(await screen.findByText('Each'));

    fireEvent.click(screen.getByRole('button', { name: /create chemical/i }));

    expect(await screen.findByText('Warehouse is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows a loading state while warehouses are being fetched', async () => {
    mockUseGetWarehousesQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    renderForm();
    fireEvent.mouseDown(screen.getByLabelText('Warehouse'));
    expect(await screen.findByText('Loading...')).toBeInTheDocument();
  });

  it('shows an empty-state message when the API returns no warehouses', async () => {
    mockUseGetWarehousesQuery.mockReturnValue({
      data: { warehouses: [] },
      isLoading: false,
    });
    renderForm();
    fireEvent.mouseDown(screen.getByLabelText('Warehouse'));

    const dropdown = await screen.findByText('No warehouses found');
    expect(dropdown).toBeInTheDocument();
  });

  it('preselects the warehouse id when editing an existing chemical', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const Edit = () => {
      const [form] = Form.useForm();
      return (
        <ChemicalForm
          form={form}
          onSubmit={onSubmit}
          onCancel={onCancel}
          initialValues={{
            id: 7,
            part_number: 'CH-7',
            lot_number: 'LOT-7',
            quantity: 1,
            unit: 'each',
            status: 'available',
            warehouse_id: 3,
            date_added: '2025-01-01',
          }}
        />
      );
    };
    render(<Edit />);

    const warehouseField = screen.getByLabelText('Warehouse');
    const selector = warehouseField.closest('.ant-select');
    expect(selector).not.toBeNull();
    await waitFor(() => {
      expect(within(selector as HTMLElement).getByText('Overflow Storage')).toBeInTheDocument();
    });
  });
});
