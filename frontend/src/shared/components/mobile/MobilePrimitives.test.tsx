import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobilePageScaffold } from './MobilePageScaffold';
import { MobileDetailHeader } from './MobileDetailHeader';
import { MobileSectionCard } from './MobileSectionCard';
import { MobileEmptyState } from './MobileEmptyState';
import { MobileFilterChipRow } from './MobileFilterChipRow';
import { MobileFormSheet } from './MobileFormSheet';
import { MobileConfirmSheet } from './MobileConfirmSheet';

describe('MobilePageScaffold', () => {
  it('renders children, header, and sticky content', () => {
    render(
      <MobilePageScaffold
        header={<div data-testid="scaffold-header">Header</div>}
        sticky={<div data-testid="scaffold-sticky">Sticky</div>}
      >
        <div data-testid="scaffold-body">Body</div>
      </MobilePageScaffold>
    );

    expect(screen.getByTestId('scaffold-header')).toBeInTheDocument();
    expect(screen.getByTestId('scaffold-sticky')).toBeInTheDocument();
    expect(screen.getByTestId('scaffold-body')).toBeInTheDocument();
  });

  it('adds bottom-safe class by default', () => {
    const { container } = render(
      <MobilePageScaffold>
        <div>Body</div>
      </MobilePageScaffold>
    );

    expect(container.querySelector('.mobile-page-scaffold--bottom-safe')).not.toBeNull();
  });

  it('omits bottom-safe class when disabled', () => {
    const { container } = render(
      <MobilePageScaffold bottomSafe={false}>
        <div>Body</div>
      </MobilePageScaffold>
    );

    expect(container.querySelector('.mobile-page-scaffold--bottom-safe')).toBeNull();
  });
});

describe('MobileDetailHeader', () => {
  it('renders title, subtitle, and actions', () => {
    render(
      <MobileDetailHeader
        title="ORD-00123"
        subtitle="Tool Bits for Kit #23"
        tags={<span data-testid="tag">Tag</span>}
        actions={<button type="button">Action</button>}
      />
    );

    expect(screen.getByText('ORD-00123')).toBeInTheDocument();
    expect(screen.getByText('Tool Bits for Kit #23')).toBeInTheDocument();
    expect(screen.getByTestId('tag')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
  });
});

describe('MobileSectionCard', () => {
  it('renders title, extra, body, and footer', () => {
    render(
      <MobileSectionCard
        title="Section"
        extra={<span data-testid="extra">5</span>}
        footer={<span data-testid="footer">Footer</span>}
      >
        <div data-testid="body">Body</div>
      </MobileSectionCard>
    );

    expect(screen.getByText('Section')).toBeInTheDocument();
    expect(screen.getByTestId('extra')).toBeInTheDocument();
    expect(screen.getByTestId('body')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('applies flush class when prop is set', () => {
    const { container } = render(
      <MobileSectionCard flush>
        <div>Body</div>
      </MobileSectionCard>
    );

    expect(container.querySelector('.mobile-section-card__body--flush')).not.toBeNull();
  });
});

describe('MobileEmptyState', () => {
  it('renders title and description', () => {
    render(
      <MobileEmptyState
        title="No orders yet"
        description="Create your first order to see it here."
      />
    );

    expect(screen.getByText('No orders yet')).toBeInTheDocument();
    expect(
      screen.getByText('Create your first order to see it here.')
    ).toBeInTheDocument();
  });

  it('fires action callback when button is pressed', () => {
    const handleAction = vi.fn();
    render(
      <MobileEmptyState
        title="Empty"
        actionLabel="Create"
        onAction={handleAction}
      />
    );

    fireEvent.click(screen.getByText('Create'));
    expect(handleAction).toHaveBeenCalledTimes(1);
  });
});

describe('MobileFilterChipRow', () => {
  it('renders nothing when chips are empty', () => {
    const { container } = render(<MobileFilterChipRow chips={[]} />);
    expect(container.querySelector('.mobile-filter-chip-row')).toBeNull();
  });

  it('fires onClear when a chip close icon is clicked', () => {
    const handleClear = vi.fn();
    render(
      <MobileFilterChipRow
        chips={[{ key: 'status', label: 'New', onClear: handleClear }]}
      />
    );

    const chipLabel = screen.getByText('New');
    // The CloseOutline icon is rendered inside the chip; clicking the
    // icon's parent <svg> is enough to trigger onClick.
    const icon = chipLabel.parentElement?.querySelector('svg');
    expect(icon).not.toBeNull();
    fireEvent.click(icon as Element);
    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it('renders clear-all chip when two or more filters are active', () => {
    const handleClearAll = vi.fn();
    render(
      <MobileFilterChipRow
        chips={[
          { key: 'status', label: 'New', onClear: vi.fn() },
          { key: 'priority', label: 'High', onClear: vi.fn() },
        ]}
        onClearAll={handleClearAll}
      />
    );

    const clearAll = screen.getByText('Clear all');
    fireEvent.click(clearAll);
    expect(handleClearAll).toHaveBeenCalledTimes(1);
  });
});

describe('MobileFormSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and children when visible', () => {
    render(
      <MobileFormSheet
        visible
        title="Create Order"
        subtitle="Fill in details"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      >
        <div data-testid="form-body">Form fields</div>
      </MobileFormSheet>
    );

    expect(screen.getByText('Create Order')).toBeInTheDocument();
    expect(screen.getByText('Fill in details')).toBeInTheDocument();
    expect(screen.getByTestId('form-body')).toBeInTheDocument();
  });

  it('fires onSubmit when the submit button is pressed', () => {
    const handleSubmit = vi.fn();
    render(
      <MobileFormSheet
        visible
        title="Create"
        onClose={vi.fn()}
        onSubmit={handleSubmit}
        submitLabel="Create Order"
      >
        <div>Body</div>
      </MobileFormSheet>
    );

    fireEvent.click(screen.getByText('Create Order'));
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('fires onClose when the cancel button is pressed', () => {
    const handleClose = vi.fn();
    render(
      <MobileFormSheet visible title="Create" onClose={handleClose} onSubmit={vi.fn()}>
        <div>Body</div>
      </MobileFormSheet>
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

describe('MobileConfirmSheet', () => {
  it('renders title and description when visible', () => {
    render(
      <MobileConfirmSheet
        visible
        title="Delete Kit"
        description="This action cannot be undone."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Delete Kit')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('fires onConfirm when the confirm button is pressed', () => {
    const handleConfirm = vi.fn();
    render(
      <MobileConfirmSheet
        visible
        title="Delete"
        onConfirm={handleConfirm}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Confirm'));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });
});
