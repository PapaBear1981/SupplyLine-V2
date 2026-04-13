import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SpinLoading, Tag } from 'antd-mobile';
import { useGetKitLocationsQuery } from '../../services/kitsApi';
import { useTheme } from '../../../settings/contexts/ThemeContext';
import type { KitLocation } from '../../types';
import { MobileEmptyState } from '@shared/components/mobile';
import './MobileKitLocationMap.css';

// Fix Leaflet's default icon paths (Vite doesn't resolve them out of the box)
delete ((L.Icon.Default.prototype as unknown) as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const STATUS_COLOR: Record<string, string> = {
  active: '#52c41a',
  deployed: '#1890ff',
  maintenance: '#faad14',
  inactive: '#8c8c8c',
  retired: '#ff4d4f',
};

const makeStatusIcon = (status: string): L.DivIcon =>
  L.divIcon({
    className: 'mobile-kit-marker',
    html: `<span class="mobile-kit-marker__dot" style="background: ${STATUS_COLOR[status] ?? '#1890ff'};"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

interface MobileKitLocationMapProps {
  /** Height of the map container. Defaults to 260px so it fits above the fold. */
  height?: number;
}

/**
 * Compact leaflet map used inside the MobileDashboard to show kit
 * locations at a glance. Reuses the same /api/kits/locations endpoint
 * the desktop KitLocationMap hits, but ships without filter controls
 * (filters can be applied from the desktop view) and a light/dark
 * tile layer tuned for small screens.
 */
export const MobileKitLocationMap = ({ height = 260 }: MobileKitLocationMapProps) => {
  const { themeConfig } = useTheme();
  const isDarkMode = themeConfig.mode === 'dark';
  const { data, isLoading } = useGetKitLocationsQuery();

  const kitsWithLocation = useMemo<KitLocation[]>(() => {
    if (!data) return [];
    return data.kits.filter(
      (k): k is KitLocation & { latitude: number; longitude: number } =>
        k.latitude !== null && k.longitude !== null
    );
  }, [data]);

  const center = useMemo<[number, number]>(() => {
    if (kitsWithLocation.length === 0) return [39.8283, -98.5795]; // Center of USA
    const lat =
      kitsWithLocation.reduce((sum, k) => sum + (k.latitude ?? 0), 0) /
      kitsWithLocation.length;
    const lng =
      kitsWithLocation.reduce((sum, k) => sum + (k.longitude ?? 0), 0) /
      kitsWithLocation.length;
    return [lat, lng];
  }, [kitsWithLocation]);

  if (isLoading) {
    return (
      <div className="mobile-kit-map__loading" style={{ height }}>
        <SpinLoading />
      </div>
    );
  }

  if (!data || data.kits.length === 0) {
    return (
      <MobileEmptyState
        title="No kit locations"
        description="Kits without GPS locations won't appear on the map."
      />
    );
  }

  return (
    <div className="mobile-kit-map" style={{ height }}>
      <MapContainer
        center={center}
        zoom={kitsWithLocation.length > 1 ? 4 : 8}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url={
            isDarkMode
              ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
              : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
          }
        />
        {kitsWithLocation.map((kit) => (
          <Marker
            key={kit.id}
            position={[kit.latitude as number, kit.longitude as number]}
            icon={makeStatusIcon(kit.status)}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{kit.name}</div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                  {kit.aircraft_type_name ?? 'No aircraft type'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  <Tag color={STATUS_COLOR[kit.status]} fill="outline">
                    {kit.status}
                  </Tag>
                  {kit.box_count !== undefined && (
                    <Tag fill="outline">{kit.box_count} boxes</Tag>
                  )}
                  {kit.item_count !== undefined && (
                    <Tag fill="outline">{kit.item_count} items</Tag>
                  )}
                </div>
                {kit.full_address && (
                  <div style={{ fontSize: 11, color: '#999' }}>{kit.full_address}</div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="mobile-kit-map__footer">
        {kitsWithLocation.length} of {data.kits.length} kit
        {data.kits.length === 1 ? '' : 's'} on map
      </div>
    </div>
  );
};
