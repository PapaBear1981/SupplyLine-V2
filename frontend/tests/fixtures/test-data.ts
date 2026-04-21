/**
 * Deterministic seeded test data the Playwright suite can rely on.
 * Values must stay in sync with `backend/seed_e2e_test_data.py`.
 */

export const TEST_USERS = {
  admin: {
    username: 'ADMIN001',
    password: 'admin123',
    name: 'John Engineer',
    isAdmin: true,
  },
  user: {
    username: 'USER001',
    password: 'user123',
    name: 'Regular User',
    isAdmin: false,
  },
  materials: {
    username: 'MAT001',
    password: 'materials123',
    name: 'Materials Manager',
    isAdmin: false,
  },
  maintenance: {
    username: 'MAINT001',
    password: 'password123',
    name: 'John Smith',
    isAdmin: false,
  },
  engineering: {
    username: 'ENG001',
    password: 'password123',
    name: 'Engineering Tech',
    isAdmin: false,
  },
  totp: {
    username: 'TOTP001',
    password: 'totp123',
    name: 'TOTP Test User',
    isAdmin: false,
    // Must match `E2E_TOTP_SECRET` in backend/seed_e2e_test_data.py.
    // 32 base32 chars = 20 bytes; otplib v13 rejects anything under 16.
    totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  },
  invalid: {
    username: 'INVALID',
    password: 'wrongpassword',
  },
} as const;

export const TEST_TOOLS = {
  multimeter: { number: 'T001', description: 'Digital Multimeter' },
  torqueWrench: { number: 'T002', description: 'Torque Wrench' },
  oscilloscope: { number: 'T003', description: 'Oscilloscope', checkedOut: true },
  impactWrench: { number: 'T004', description: 'Impact Wrench' },
  micrometer: { number: 'T005', description: 'Micrometer' },
} as const;

export const TEST_CHEMICALS = {
  solvent: { partNumber: 'CHEM001', description: 'Cleaning Solvent' },
  lubricant: { partNumber: 'CHEM002', description: 'Lubricant' },
} as const;

export const TEST_WAREHOUSES = {
  main: { name: 'Main Warehouse' },
  satelliteA: { name: 'Satellite Warehouse A' },
  satelliteB: { name: 'Satellite Warehouse B' },
} as const;
