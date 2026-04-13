import { useMemo, useState } from 'react';
import { List, Tag, SpinLoading, SearchBar } from 'antd-mobile';
import { InboxOutlined, ToolOutlined, ExperimentOutlined } from '@ant-design/icons';
import {
  useGetKitBoxesQuery,
  useGetKitItemsQuery,
  useGetKitExpendablesQuery,
} from '../../services/kitsApi';
import type { KitBox, KitItem, KitExpendable, ItemType } from '../../types';
import { MobileSectionCard, MobileEmptyState } from '@shared/components/mobile';

interface MobileKitContentsTabProps {
  kitId: number;
}

type ItemRow =
  | ({ kind: 'item' } & KitItem)
  | ({ kind: 'expendable' } & KitExpendable);

/**
 * Expanded kit-contents view for mobile — replaces the "Coming soon"
 * placeholder that the old Items tab used to show. Lists boxes with
 * their contained items and expendables, grouped by box, searchable
 * by part number/description.
 */
export const MobileKitContentsTab = ({ kitId }: MobileKitContentsTabProps) => {
  const { data: boxes = [], isLoading: boxesLoading } = useGetKitBoxesQuery(kitId);
  const { data: itemsResponse, isLoading: itemsLoading } = useGetKitItemsQuery({ kitId });
  const { data: expendablesResponse, isLoading: expLoading } = useGetKitExpendablesQuery({
    kitId,
  });

  const items: KitItem[] = itemsResponse?.items ?? [];
  const expendables: KitExpendable[] = expendablesResponse?.expendables ?? [];

  const [search, setSearch] = useState('');

  // Merge items + expendables into a single typed list and filter by search
  const allRows: ItemRow[] = useMemo(() => {
    const merged: ItemRow[] = [
      ...items.map((i): ItemRow => ({ ...i, kind: 'item' as const })),
      ...expendables.map((e): ItemRow => ({ ...e, kind: 'expendable' as const })),
    ];
    if (!search.trim()) return merged;
    const q = search.trim().toLowerCase();
    return merged.filter((row) =>
      [row.description, row.part_number, row.serial_number, row.lot_number]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [items, expendables, search]);

  const rowsByBox = useMemo(() => {
    const map = new Map<number, ItemRow[]>();
    for (const row of allRows) {
      const bucket = map.get(row.box_id) ?? [];
      bucket.push(row);
      map.set(row.box_id, bucket);
    }
    return map;
  }, [allRows]);

  if (boxesLoading || itemsLoading || expLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <SpinLoading />
      </div>
    );
  }

  if (boxes.length === 0) {
    return (
      <MobileEmptyState
        title="No boxes"
        description="This kit has no boxes yet. Create one to start tracking items."
      />
    );
  }

  return (
    <div className="mobile-kit-contents-tab" style={{ padding: '8px 0' }}>
      <div style={{ padding: '4px 4px 12px' }}>
        <SearchBar
          placeholder="Search by part number or description"
          value={search}
          onChange={setSearch}
        />
      </div>

      {boxes.map((box: KitBox) => {
        const rows = rowsByBox.get(box.id) ?? [];
        return (
          <MobileSectionCard
            key={box.id}
            title={
              <span>
                <InboxOutlined style={{ marginRight: 6 }} />
                {box.box_number}
              </span>
            }
            extra={<span>{rows.length} items</span>}
            flush
          >
            {rows.length === 0 ? (
              <div
                style={{
                  padding: '16px',
                  color: 'var(--adm-color-weak)',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                {search ? 'No matches in this box' : 'No items in this box'}
              </div>
            ) : (
              <List>
                {rows.map((row) => {
                  const rowType: ItemType | undefined =
                    row.kind === 'item' ? row.item_type : 'expendable';
                  return (
                  <List.Item
                    key={`${row.kind}-${row.id}`}
                    prefix={
                      rowType === 'chemical' ? (
                        <ExperimentOutlined />
                      ) : (
                        <ToolOutlined />
                      )
                    }
                    description={
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {row.part_number && (
                          <Tag fill="outline">PN: {row.part_number}</Tag>
                        )}
                        {row.serial_number && (
                          <Tag fill="outline">SN: {row.serial_number}</Tag>
                        )}
                        {row.lot_number && (
                          <Tag fill="outline">Lot: {row.lot_number}</Tag>
                        )}
                        <Tag fill="outline">
                          Qty {row.quantity}
                          {row.kind === 'expendable' && row.unit ? ` ${row.unit}` : ''}
                        </Tag>
                        <Tag fill="outline">{row.status}</Tag>
                        {row.kind === 'expendable' && row.is_low_stock && (
                          <Tag color="warning" fill="outline">
                            Low
                          </Tag>
                        )}
                      </div>
                    }
                  >
                    {row.description}
                  </List.Item>
                  );
                })}
              </List>
            )}
          </MobileSectionCard>
        );
      })}
    </div>
  );
};
