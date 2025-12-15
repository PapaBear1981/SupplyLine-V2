export const APP_VERSION = '2.4.0';

export interface VersionRelease {
  version: string;
  date: string;
  title: string;
  highlights: string[];
  type: 'major' | 'minor' | 'patch';
}

export const VERSION_HISTORY: VersionRelease[] = [
  {
    version: '2.4.0',
    date: '2024-12-14',
    title: 'Mobile Users & Profile Enhancements',
    highlights: [
      'Mobile-optimized users management page',
      'Improved mobile tools edit form UX',
      'Automatic JWT token refresh',
      'Dark mode support for announcements',
    ],
    type: 'minor',
  },
  {
    version: '2.3.0',
    date: '2024-12-10',
    title: 'Warehouse Vitals & Chemical History',
    highlights: [
      'Warehouse vitals dashboard widgets',
      'Chemical usage history tracking',
      'Enhanced mobile dashboard components',
      'Performance optimizations',
    ],
    type: 'minor',
  },
  {
    version: '2.2.0',
    date: '2024-12-01',
    title: 'Mobile Dashboard Redesign',
    highlights: [
      'Completely redesigned mobile dashboard',
      'New quick action buttons',
      'Improved navigation flow',
      'Better offline support',
    ],
    type: 'minor',
  },
  {
    version: '2.1.0',
    date: '2024-11-15',
    title: 'Kits & Tools Management',
    highlights: [
      'Enhanced kits management system',
      'Tool calibration tracking',
      'Barcode scanning improvements',
      'Bulk operations support',
    ],
    type: 'minor',
  },
  {
    version: '2.0.0',
    date: '2024-11-01',
    title: 'SupplyLine MRO Suite V2',
    highlights: [
      'Complete application redesign',
      'New mobile-first interface',
      'Real-time inventory updates',
      'Multi-warehouse support',
    ],
    type: 'major',
  },
];
