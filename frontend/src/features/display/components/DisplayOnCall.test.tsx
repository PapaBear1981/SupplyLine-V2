import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DisplayOnCall } from './DisplayOnCall';
import type { OnCallPersonnel } from '@features/admin/services/oncallApi';

const onCallSpy = vi.fn<() => { data: OnCallPersonnel | undefined }>();

vi.mock('@features/admin/services/oncallApi', () => ({
  useGetOnCallPersonnelQuery: () => onCallSpy(),
}));

describe('DisplayOnCall', () => {
  beforeEach(() => {
    onCallSpy.mockReset();
  });

  it('renders both Materials and Maintenance tiles with assigned users', () => {
    onCallSpy.mockReturnValue({
      data: {
        materials: {
          user: {
            id: 10,
            name: 'Pat Materials',
            employee_number: 'EMP010',
            department: 'Stockroom',
            email: 'pat@example.com',
            phone: '555-0100',
            avatar: null,
          },
          updated_at: null,
          updated_by: null,
        },
        maintenance: {
          user: {
            id: 11,
            name: 'Sam Maintenance',
            employee_number: 'EMP011',
            department: 'Hangar',
            email: null,
            phone: '555-0200',
            avatar: null,
          },
          updated_at: null,
          updated_by: null,
        },
      },
    });

    render(<DisplayOnCall />);

    expect(screen.getByText('Materials')).toBeInTheDocument();
    expect(screen.getByText('Maintenance')).toBeInTheDocument();
    expect(screen.getByText('Pat Materials')).toBeInTheDocument();
    expect(screen.getByText('555-0100')).toBeInTheDocument();
    expect(screen.getByText('Stockroom')).toBeInTheDocument();
    expect(screen.getByText('Sam Maintenance')).toBeInTheDocument();
    expect(screen.getByText('555-0200')).toBeInTheDocument();
  });

  it('falls back to initials when there is no avatar image', () => {
    onCallSpy.mockReturnValue({
      data: {
        materials: {
          user: {
            id: 10,
            name: 'Jordan Smith',
            employee_number: 'EMP010',
            department: null,
            email: null,
            phone: null,
            avatar: null,
          },
          updated_at: null,
          updated_by: null,
        },
        maintenance: {
          user: null,
          updated_at: null,
          updated_by: null,
        },
      },
    });

    render(<DisplayOnCall />);

    expect(screen.getByText('JS')).toBeInTheDocument();
  });

  it('shows "No one assigned" when a role is empty', () => {
    onCallSpy.mockReturnValue({
      data: {
        materials: { user: null, updated_at: null, updated_by: null },
        maintenance: { user: null, updated_at: null, updated_by: null },
      },
    });

    render(<DisplayOnCall />);

    expect(screen.getAllByText('No one assigned')).toHaveLength(2);
  });

  it('falls back to initials when the avatar image fails to load', () => {
    onCallSpy.mockReturnValue({
      data: {
        materials: {
          user: {
            id: 10,
            name: 'Avery Brown',
            employee_number: 'EMP010',
            department: null,
            email: null,
            phone: null,
            avatar: 'https://example.com/missing.png',
          },
          updated_at: null,
          updated_by: null,
        },
        maintenance: {
          user: null,
          updated_at: null,
          updated_by: null,
        },
      },
    });

    render(<DisplayOnCall />);

    const img = screen.getByAltText('Avery Brown') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(screen.queryByText('AB')).not.toBeInTheDocument();

    fireEvent.error(img);

    expect(screen.queryByAltText('Avery Brown')).not.toBeInTheDocument();
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('renders both labels even before any data is loaded', () => {
    onCallSpy.mockReturnValue({ data: undefined });

    render(<DisplayOnCall />);

    expect(screen.getByText('Materials')).toBeInTheDocument();
    expect(screen.getByText('Maintenance')).toBeInTheDocument();
    expect(screen.getAllByText('No one assigned')).toHaveLength(2);
  });
});
