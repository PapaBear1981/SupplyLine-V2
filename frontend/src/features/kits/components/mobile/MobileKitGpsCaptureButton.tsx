import { Button, Toast } from 'antd-mobile';
import { EnvironmentOutlined } from '@ant-design/icons';
import { useUpdateKitLocationMutation } from '../../services/kitsApi';
import { useGeolocation } from '@shared/hooks/useGeolocation';
import { useHaptics } from '@shared/hooks/useHaptics';

interface MobileKitGpsCaptureButtonProps {
  kitId: number;
  /** Existing street-address fields; geolocation sets lat/lng without touching them. */
  existingAddress?: {
    location_address?: string | null;
    location_city?: string | null;
    location_state?: string | null;
    location_zip?: string | null;
    location_country?: string | null;
    location_notes?: string | null;
  };
  onSuccess?: () => void;
}

/**
 * One-tap GPS capture for the mobile kit detail Location tab.
 *
 * Uses the browser Geolocation API (wrapped in useGeolocation) to
 * pick up the operator's current position, then PATCHes the kit
 * location via useUpdateKitLocationMutation so the kit immediately
 * shows up on the MobileKitLocationMap.
 */
export const MobileKitGpsCaptureButton = ({
  kitId,
  existingAddress,
  onSuccess,
}: MobileKitGpsCaptureButtonProps) => {
  const { capture, capturing, isAvailable } = useGeolocation();
  const [updateLocation, { isLoading: updating }] = useUpdateKitLocationMutation();
  const haptics = useHaptics();

  if (!isAvailable) return null;

  const handleCapture = async () => {
    haptics.trigger('selection');
    const position = await capture();
    if (!position) {
      haptics.trigger('error');
      Toast.show({
        icon: 'fail',
        content: 'Could not access your location. Check app permissions.',
        duration: 3000,
      });
      return;
    }

    try {
      await updateLocation({
        id: kitId,
        data: {
          ...existingAddress,
          location_address: existingAddress?.location_address ?? undefined,
          location_city: existingAddress?.location_city ?? undefined,
          location_state: existingAddress?.location_state ?? undefined,
          location_zip: existingAddress?.location_zip ?? undefined,
          location_country: existingAddress?.location_country ?? undefined,
          location_notes: existingAddress?.location_notes ?? undefined,
          latitude: position.latitude,
          longitude: position.longitude,
        },
      }).unwrap();
      haptics.trigger('success');
      Toast.show({
        icon: 'success',
        content: `Location saved (±${Math.round(position.accuracy)}m)`,
        duration: 2500,
      });
      onSuccess?.();
    } catch {
      haptics.trigger('error');
      Toast.show({ icon: 'fail', content: 'Failed to save location' });
    }
  };

  return (
    <Button
      block
      color="primary"
      fill="outline"
      loading={capturing || updating}
      onClick={handleCapture}
    >
      <EnvironmentOutlined /> Capture GPS location
    </Button>
  );
};
