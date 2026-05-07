import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Form } from 'antd';
import { ChemicalForm } from './ChemicalForm';

const mockUseGetWarehousesQuery = vi.fn();
const mockUseGetChemicalPartsQuery = vi.fn();

vi.mock('@features/warehouses/services/warehousesApi', () => ({
  useGetWarehousesQuery: (...args: unknown[]) => mockUseGetWarehousesQuery(...args),
}));

vi.mock('../services/chemicalsApi', () => ({
  useGetChemicalPartsQuery: (...args: unknown[]) =>
    mockUseGetChemicalPartsQuery(...args),
}));

const warehouses = [
  { id: 1, name: 'Main Warehouse' },
  { id: 2, name: 'East Hangar' },
  { id: 3, name: 'Overflow Storage' },
];

const parts = [
  {
    id: 11,
    part_number: 'CH-EXISTING',
    description: 'Already in stock',
    manufacturer: 'ACME',
    category: 'General',
    default_unit: 'oz',
    minimum_stock_level: 5,
    total_active_quantity: 10,
    lot_count: 2,
    status: 'available' as const,
    earliest_expiration_date: null,
    has_open_reorder_request: false,
    lots: [],
  },
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
  // Default mode is "Add Lot to Existing Part". Most legacy tests below
  // exercise the new-part create flow, so flip into "Create New Part
  // Number" mode unless the test explicitly stays in existing mode.
  fireEvent.click(screen.getByRole('radio', { name: /create new part number/i }));
  return { ...utils, onSubmit, onCancel };
};

describe('ChemicalForm warehouse field', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetWarehousesQuery.mockReturnValue({
      data: { warehouses },
      isLoading: false,
    });
    mockUseGetChemicalPartsQuery.mockReturnValue({
      data: { parts },
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

    fireEvent.click(screen.getByRole('button', { name: /create part & lot/i }));

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

    fireEvent.click(screen.getByRole('button', { name: /create part & lot/i }));

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

  it('defaults to "Add Lot to Existing Part" mode when creating', () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(<Harness onSubmit={onSubmit} onCancel={onCancel} />);

    const existingRadio = screen.getByRole('radio', {
      name: /add lot to existing part/i,
    }) as HTMLInputElement;
    expect(existingRadio.checked).toBe(true);

    // Part-master fields are hidden in this mode
    expect(screen.queryByLabelText('Manufacturer')).not.toBeInTheDocument();
    // Submit button reflects the mode
    expect(screen.getByRole('button', { name: /add lot$/i })).toBeInTheDocument();
  });

  it('submits chemical_part_id when adding a lot to an existing part', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(<Harness onSubmit={onSubmit} onCancel={onCancel} />);

    // Pick the seeded existing part
    fireEvent.mouseDown(screen.getByLabelText('Existing Part Number'));
    const partOption = await screen.findByText(/CH-EXISTING/);
    fireEvent.click(partOption);

    fireEvent.change(screen.getByLabelText('Lot Number'), {
      target: { value: 'LOT-NEW-9' },
    });
    fireEvent.change(screen.getByLabelText('Quantity'), {
      target: { value: '7' },
    });

    fireEvent.mouseDown(screen.getByLabelText('Warehouse'));
    fireEvent.click(await screen.findByText('East Hangar'));

    fireEvent.click(screen.getByRole('button', { name: /add lot$/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        chemical_part_id: 11,
        part_number: 'CH-EXISTING',
        lot_number: 'LOT-NEW-9',
        warehouse_id: 2,
        unit: 'oz',
      }),
    );
  });

  it('does NOT send chemical_part_id when creating a new part', async () => {
    const { onSubmit } = renderForm();

    fireEvent.change(screen.getByLabelText('Part Number'), {
      target: { value: 'CH-BRAND-NEW' },
    });
    fireEvent.change(screen.getByLabelText('Lot Number'), {
      target: { value: 'LOT-1' },
    });
    fireEvent.change(screen.getByLabelText('Quantity'), {
      target: { value: '1' },
    });
    fireEvent.mouseDown(screen.getByLabelText('Unit'));
    fireEvent.click(await screen.findByText('Each'));
    fireEvent.mouseDown(screen.getByLabelText('Warehouse'));
    fireEvent.click(await screen.findByText('Main Warehouse'));

    fireEvent.click(screen.getByRole('button', { name: /create part & lot/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    const submitted = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    expect(submitted.chemical_part_id).toBeUndefined();
    expect(submitted.part_number).toBe('CH-BRAND-NEW');
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
