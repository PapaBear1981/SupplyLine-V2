import { Tag } from 'antd-mobile';
import { CloseOutline } from 'antd-mobile-icons';
import './MobilePrimitives.css';

export interface MobileFilterChip {
  /** Unique key used for the React list key and clear callback. */
  key: string;
  /** Label shown inside the chip. */
  label: string;
  /** Called when the user taps the chip's close button. */
  onClear: () => void;
}

interface MobileFilterChipRowProps {
  chips: MobileFilterChip[];
  /** Optional "Clear all" callback. Shown when two or more chips are present. */
  onClearAll?: () => void;
}

/**
 * Horizontal row of active-filter chips with close buttons.
 *
 * Extracts the repeating "active filters" pattern already duplicated in
 * MobileOrdersList, MobileRequestsList, etc., so future mobile list pages
 * get a consistent filter-summary UX.
 */
export const MobileFilterChipRow = ({ chips, onClearAll }: MobileFilterChipRowProps) => {
  if (chips.length === 0) return null;

  return (
    <div className="mobile-filter-chip-row">
      {chips.map((chip) => (
        <Tag
          key={chip.key}
          color="primary"
          fill="outline"
          style={{ '--border-radius': '12px' }}
        >
          {chip.label}
          <button
            type="button"
            className="mobile-filter-chip-row__clear"
            aria-label={`Clear ${chip.label} filter`}
            onClick={(event) => {
              event.stopPropagation();
              chip.onClear();
            }}
          >
            <CloseOutline />
          </button>
        </Tag>
      ))}
      {chips.length > 1 && onClearAll && (
        <Tag
          color="default"
          fill="outline"
          onClick={onClearAll}
          style={{ '--border-radius': '12px', cursor: 'pointer' }}
        >
          Clear all
        </Tag>
      )}
    </div>
  );
};
