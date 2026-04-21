/**
 * Playwright global teardown.
 *
 * Currently a no-op. Kept as a dedicated hook so future work (artifact
 * upload, backend log capture, database snapshotting) has a single entry
 * point without another config change.
 */
export default async function globalTeardown(): Promise<void> {
  // intentional no-op
}
