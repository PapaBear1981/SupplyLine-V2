import { Grid } from 'antd';

export const useIsMobile = () => {
  const screens = Grid.useBreakpoint();
  return !screens.md;
};
