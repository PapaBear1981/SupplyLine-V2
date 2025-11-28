import { useState, useMemo, useEffect } from 'react';
import { Card, Select, Space, Typography, Spin, Empty, Tag, Descriptions, Badge, Button } from 'antd';
import { EnvironmentOutlined, ReloadOutlined, InboxOutlined } from '@ant-design/icons';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGetKitLocationsQuery, useGetAircraftTypesQuery } from '../services/kitsApi';
import type { KitLocation } from '../types';

const { Text, Title } = Typography;

// Fix for default marker icons in Leaflet with webpack/vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom colored markers
const createColoredIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
};

const STATUS_COLORS: Record<string, string> = {
  active: '#52c41a',
  deployed: '#1890ff',
  maintenance: '#faad14',
  inactive: '#d9d9d9',
  retired: '#ff4d4f',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  deployed: 'Deployed',
  maintenance: 'Maintenance',
  inactive: 'Inactive',
  retired: 'Retired',
};

interface MapControllerProps {
  selectedKit: KitLocation | null;
  kits: KitLocation[];
}

// Component to control map view when selection changes
function MapController({ selectedKit, kits }: MapControllerProps) {
  const map = useMap();

  useEffect(() => {
    if (selectedKit && selectedKit.latitude && selectedKit.longitude) {
      map.flyTo([selectedKit.latitude, selectedKit.longitude], 12, { duration: 1 });
    } else if (kits.length > 0) {
      // Fit bounds to show all markers
      const validKits = kits.filter(k => k.latitude && k.longitude);
      if (validKits.length > 0) {
        const bounds = L.latLngBounds(
          validKits.map(k => [k.latitude!, k.longitude!] as [number, number])
        );
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [selectedKit, kits, map]);

  return null;
}

interface KitLocationMapProps {
  height?: number | string;
}

export function KitLocationMap({ height = 400 }: KitLocationMapProps) {
  const [selectedKitId, setSelectedKitId] = useState<number | null>(null);
  const [aircraftTypeFilter, setAircraftTypeFilter] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const { data: locationsData, isLoading, refetch } = useGetKitLocationsQuery({
    aircraft_type_id: aircraftTypeFilter,
    status: statusFilter,
    with_location_only: false,
  });

  const { data: aircraftTypes } = useGetAircraftTypesQuery({});

  const kitsWithLocation = useMemo(() => {
    if (!locationsData?.kits) return [];
    return locationsData.kits.filter(kit => kit.has_location && kit.latitude && kit.longitude);
  }, [locationsData]);

  const selectedKit = useMemo(() => {
    if (!selectedKitId || !locationsData?.kits) return null;
    return locationsData.kits.find(kit => kit.id === selectedKitId) || null;
  }, [selectedKitId, locationsData]);

  // Default center (USA)
  const defaultCenter: [number, number] = [39.8283, -98.5795];
  const defaultZoom = 4;

  if (isLoading) {
    return (
      <Card
        title={
          <Space>
            <EnvironmentOutlined />
            <span>Kit Locations</span>
          </Space>
        }
      >
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={
        <Space>
          <EnvironmentOutlined />
          <span>Kit Locations</span>
          <Badge
            count={kitsWithLocation.length}
            style={{ backgroundColor: '#52c41a' }}
            title={`${kitsWithLocation.length} kits with location`}
          />
        </Space>
      }
      extra={
        <Button icon={<ReloadOutlined />} onClick={() => refetch()} size="small">
          Refresh
        </Button>
      }
      styles={{ body: { padding: 0 } }}
    >
      {/* Filters */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Space wrap>
          <Select
            placeholder="Select Kit"
            allowClear
            style={{ width: 200 }}
            value={selectedKitId}
            onChange={setSelectedKitId}
            options={[
              { label: 'All Kits', value: null },
              ...(locationsData?.kits || []).map(kit => ({
                label: (
                  <Space>
                    <span>{kit.name}</span>
                    {kit.has_location ? (
                      <Tag color="green" style={{ marginLeft: 4, marginRight: 0 }}>
                        <EnvironmentOutlined />
                      </Tag>
                    ) : (
                      <Tag color="default" style={{ marginLeft: 4, marginRight: 0 }}>
                        No Location
                      </Tag>
                    )}
                  </Space>
                ),
                value: kit.id,
              })),
            ]}
          />
          <Select
            placeholder="Aircraft Type"
            allowClear
            style={{ width: 150 }}
            value={aircraftTypeFilter}
            onChange={setAircraftTypeFilter}
            options={aircraftTypes?.map(type => ({
              label: type.name,
              value: type.id,
            }))}
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 120 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({
              label,
              value,
            }))}
          />
        </Space>
      </div>

      {/* Map Container */}
      <div style={{ height, position: 'relative' }}>
        {kitsWithLocation.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            backgroundColor: '#fafafa'
          }}>
            <Empty
              image={<InboxOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
              description={
                <Space direction="vertical" size={0}>
                  <Text type="secondary">No kits with location data</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Add location information to kits to see them on the map
                  </Text>
                </Space>
              }
            />
          </div>
        ) : (
          <MapContainer
            center={defaultCenter}
            zoom={defaultZoom}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController selectedKit={selectedKit} kits={kitsWithLocation} />

            {kitsWithLocation.map(kit => (
              <Marker
                key={kit.id}
                position={[kit.latitude!, kit.longitude!]}
                icon={createColoredIcon(STATUS_COLORS[kit.status] || '#1890ff')}
                eventHandlers={{
                  click: () => setSelectedKitId(kit.id),
                }}
              >
                <Popup>
                  <div style={{ minWidth: 200 }}>
                    <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                      {kit.name}
                    </Title>
                    <Tag color={STATUS_COLORS[kit.status]}>
                      {STATUS_LABELS[kit.status] || kit.status}
                    </Tag>
                    {kit.aircraft_type_name && (
                      <Tag color="blue">{kit.aircraft_type_name}</Tag>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {kit.full_address || kit.location_address || 'No address'}
                      </Text>
                    </div>
                    {kit.description && (
                      <div style={{ marginTop: 4 }}>
                        <Text style={{ fontSize: 12 }}>{kit.description}</Text>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Selected Kit Info Panel */}
      {selectedKit && (
        <div style={{ padding: 16, borderTop: '1px solid #f0f0f0', backgroundColor: '#fafafa' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={5} style={{ margin: 0 }}>
                <InboxOutlined style={{ marginRight: 8 }} />
                {selectedKit.name}
              </Title>
              <Space>
                <Tag color={STATUS_COLORS[selectedKit.status]}>
                  {STATUS_LABELS[selectedKit.status] || selectedKit.status}
                </Tag>
                {selectedKit.aircraft_type_name && (
                  <Tag color="blue">{selectedKit.aircraft_type_name}</Tag>
                )}
              </Space>
            </div>

            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="Address" span={2}>
                {selectedKit.full_address || selectedKit.location_address || 'Not specified'}
              </Descriptions.Item>
              {selectedKit.location_city && (
                <Descriptions.Item label="City">
                  {selectedKit.location_city}
                </Descriptions.Item>
              )}
              {selectedKit.location_state && (
                <Descriptions.Item label="State">
                  {selectedKit.location_state}
                </Descriptions.Item>
              )}
              {selectedKit.location_zip && (
                <Descriptions.Item label="ZIP">
                  {selectedKit.location_zip}
                </Descriptions.Item>
              )}
              {selectedKit.location_country && (
                <Descriptions.Item label="Country">
                  {selectedKit.location_country}
                </Descriptions.Item>
              )}
              {selectedKit.latitude && selectedKit.longitude && (
                <Descriptions.Item label="Coordinates" span={2}>
                  {selectedKit.latitude.toFixed(6)}, {selectedKit.longitude.toFixed(6)}
                </Descriptions.Item>
              )}
              {selectedKit.box_count !== undefined && (
                <Descriptions.Item label="Boxes">
                  {selectedKit.box_count}
                </Descriptions.Item>
              )}
              {selectedKit.item_count !== undefined && (
                <Descriptions.Item label="Items">
                  {selectedKit.item_count}
                </Descriptions.Item>
              )}
              {selectedKit.location_notes && (
                <Descriptions.Item label="Notes" span={2}>
                  {selectedKit.location_notes}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Space>
        </div>
      )}

      {/* Summary Footer */}
      {locationsData && (
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #f0f0f0',
          backgroundColor: '#fafafa',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {locationsData.with_location} of {locationsData.total} kits have location data
          </Text>
          {locationsData.without_location > 0 && (
            <Text type="warning" style={{ fontSize: 12 }}>
              {locationsData.without_location} kits need location info
            </Text>
          )}
        </div>
      )}
    </Card>
  );
}

export default KitLocationMap;
