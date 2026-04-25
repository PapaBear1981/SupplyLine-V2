import { useEffect, useMemo, useState } from 'react';
import {
  List,
  Popup,
  SearchBar,
  Toast,
  Tag,
  DotLoading,
  Empty,
  SafeArea,
} from 'antd-mobile';
import { CheckOutline } from 'antd-mobile-icons';
import { HomeOutlined, WarningOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@app/hooks';
import { useActiveWarehouse } from '../../hooks/useActiveWarehouse';
import { useGetWarehousesQuery } from '../../services/warehousesApi';
import { setActiveWarehouse as setLocalActiveWarehouse } from '../../slices/activeWarehouseSlice';
import './MobileActiveWarehouseSelect.css';

interface MobileActiveWarehouseSelectProps {
  /** Visual style — `menu` matches the menu popup row, `card` is a standalone block. */
  variant?: 'menu' | 'card';
}

/**
 * Mobile-friendly version of the desktop ActiveWarehouseSelect. Shows the
 * current active warehouse and opens a bottom-sheet picker letting the user
 * switch to any active warehouse. Writes go through POST /api/me/active-warehouse
 * which re-issues the JWT, mirroring the desktop selector behavior.
 */
export const MobileActiveWarehouseSelect = ({
  variant = 'menu',
}: MobileActiveWarehouseSelectProps) => {
  const dispatch = useAppDispatch();
  const { activeWarehouseId, activeWarehouseName, setActiveWarehouse, isChanging } =
    useActiveWarehouse();
  const user = useAppSelector((s) => s.auth.user);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isFetching } = useGetWarehousesQuery({
    include_inactive: false,
    per_page: 200,
  });

  // Sync the slice with the server's source of truth, same as the desktop selector.
  useEffect(() => {
    if (!user) return;
    const serverId = user.active_warehouse_id ?? null;
    if (serverId && serverId !== activeWarehouseId) {
      dispatch(
        setLocalActiveWarehouse({
          id: serverId,
          name: user.active_warehouse_name ?? null,
        })
      );
    } else if (!serverId && activeWarehouseId) {
      dispatch(setLocalActiveWarehouse({ id: null, name: null }));
    }
  }, [user, user?.active_warehouse_id, user?.active_warehouse_name, activeWarehouseId, dispatch]);

  const warehouses = useMemo(() => data?.warehouses || [], [data]);

  const filteredWarehouses = useMemo(() => {
    if (!searchQuery.trim()) return warehouses;
    const q = searchQuery.trim().toLowerCase();
    return warehouses.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.city?.toLowerCase().includes(q) ||
        w.state?.toLowerCase().includes(q)
    );
  }, [warehouses, searchQuery]);

  const handleSelect = async (id: number, name: string) => {
    try {
      await setActiveWarehouse(id, name);
      Toast.show({ icon: 'success', content: `Active warehouse: ${name}` });
      setPickerVisible(false);
      setSearchQuery('');
    } catch (err: unknown) {
      const e = err as { data?: { error?: string } };
      Toast.show({
        icon: 'fail',
        content: e.data?.error || 'Failed to set active warehouse',
      });
    }
  };

  const openPicker = () => {
    setSearchQuery('');
    setPickerVisible(true);
  };

  const missingSelection = !activeWarehouseId;
  const displayName = activeWarehouseName || 'Not selected';

  const trigger =
    variant === 'card' ? (
      <div
        className={`mobile-active-warehouse-card ${
          missingSelection ? 'is-missing' : ''
        }`}
        onClick={openPicker}
        data-testid="mobile-active-warehouse-trigger"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
      >
        <div className="mobile-active-warehouse-card__icon">
          {missingSelection ? <WarningOutlined /> : <HomeOutlined />}
        </div>
        <div className="mobile-active-warehouse-card__body">
          <div className="mobile-active-warehouse-card__label">Active Warehouse</div>
          <div className="mobile-active-warehouse-card__value">
            {isChanging ? <DotLoading /> : displayName}
          </div>
        </div>
        <div className="mobile-active-warehouse-card__action">Change</div>
      </div>
    ) : (
      <List.Item
        prefix={
          <HomeOutlined
            style={{
              fontSize: 18,
              color: missingSelection
                ? '#faad14'
                : 'var(--adm-color-primary)',
            }}
          />
        }
        description={missingSelection ? 'Tap to choose a warehouse' : displayName}
        extra={
          missingSelection ? (
            <Tag color="warning" fill="outline">
              Pick one
            </Tag>
          ) : (
            <span className="mobile-active-warehouse-extra">Change</span>
          )
        }
        onClick={openPicker}
        clickable
        data-testid="mobile-active-warehouse-trigger"
      >
        <span className="mobile-active-warehouse-title">Active Warehouse</span>
      </List.Item>
    );

  return (
    <>
      {trigger}

      <Popup
        visible={pickerVisible}
        onMaskClick={() => setPickerVisible(false)}
        onClose={() => setPickerVisible(false)}
        position="bottom"
        bodyStyle={{
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="mobile-warehouse-picker" data-testid="mobile-warehouse-picker">
          <div className="mobile-warehouse-picker__header">
            <div className="mobile-warehouse-picker__title">Select Warehouse</div>
            <div className="mobile-warehouse-picker__subtitle">
              Choose any active warehouse to work out of.
            </div>
          </div>

          <div className="mobile-warehouse-picker__search">
            <SearchBar
              placeholder="Search warehouses..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>

          <div className="mobile-warehouse-picker__list">
            {isFetching && warehouses.length === 0 ? (
              <div className="mobile-warehouse-picker__loading">
                <DotLoading />
                <span>Loading warehouses...</span>
              </div>
            ) : filteredWarehouses.length === 0 ? (
              <Empty
                description={
                  searchQuery
                    ? 'No warehouses match your search'
                    : 'No active warehouses available'
                }
                style={{ padding: '32px 0' }}
              />
            ) : (
              <List>
                {filteredWarehouses.map((w) => {
                  const isActive = w.id === activeWarehouseId;
                  return (
                    <List.Item
                      key={w.id}
                      prefix={
                        <HomeOutlined
                          style={{
                            fontSize: 18,
                            color: isActive
                              ? 'var(--adm-color-primary)'
                              : 'var(--adm-color-text-secondary)',
                          }}
                        />
                      }
                      description={
                        [w.city, w.state].filter(Boolean).join(', ') || undefined
                      }
                      extra={
                        isActive ? (
                          <CheckOutline
                            fontSize={20}
                            style={{ color: 'var(--adm-color-primary)' }}
                          />
                        ) : null
                      }
                      onClick={() => {
                        if (isActive) {
                          setPickerVisible(false);
                          return;
                        }
                        handleSelect(w.id, w.name);
                      }}
                      clickable
                      data-testid={`mobile-warehouse-option-${w.id}`}
                      className={isActive ? 'mobile-warehouse-option-active' : ''}
                    >
                      {w.name}
                    </List.Item>
                  );
                })}
              </List>
            )}
          </div>

          <SafeArea position="bottom" />
        </div>
      </Popup>
    </>
  );
};
