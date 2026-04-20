export type TransferStatus =
  | 'pending_receipt'
  | 'received'
  | 'cancelled'
  | 'completed';

export type TransferItemType = 'tool' | 'chemical' | 'expendable';

// Initiate only supports tool and chemical; expendables use a different flow.
export type InitiateTransferItemType = 'tool' | 'chemical';

export interface Transfer {
  id: number;
  from_warehouse_id?: number | null;
  to_warehouse_id?: number | null;
  from_warehouse?: string | null;
  to_warehouse?: string | null;
  from_kit_id?: number | null;
  to_kit_id?: number | null;
  from_kit?: string | null;
  to_kit?: string | null;
  item_type: TransferItemType;
  item_id: number;
  quantity: number;
  transfer_date?: string | null;
  transferred_by_id?: number | null;
  transferred_by?: string | null;
  received_by_id?: number | null;
  received_by?: string | null;
  received_date?: string | null;
  source_location?: string | null;
  destination_location?: string | null;
  cancelled_by_id?: number | null;
  cancelled_by?: string | null;
  cancelled_date?: string | null;
  cancel_reason?: string | null;
  notes?: string | null;
  status: TransferStatus;
  item_snapshot?: {
    id: number;
    description?: string | null;
    identifier?: string | null;
    serial_number?: string | null;
    lot_number?: string | null;
    current_warehouse_id?: number | null;
    current_location?: string | null;
  };
}

export interface TransfersListResponse {
  transfers: Transfer[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface TransfersQueryParams {
  page?: number;
  per_page?: number;
  status?: TransferStatus | 'all';
  direction?: 'inbound' | 'outbound' | 'all';
  item_type?: TransferItemType;
  /** Used as a cache-key discriminator so RTK Query re-fetches when the
   *  active warehouse changes. The backend reads warehouse from the JWT. */
  activeWarehouseId?: number | null;
}

export interface InitiateTransferPayload {
  to_warehouse_id: number;
  item_type: InitiateTransferItemType;
  item_id: number;
  quantity?: number;
  notes?: string;
}

export interface ItemLookupParams {
  item_type: InitiateTransferItemType;
  warehouse_id: number;
  tool_number?: string;
  serial_number?: string;
  part_number?: string;
  lot_number?: string;
}

export interface ToolLookupResult {
  id: number;
  description?: string | null;
  tool_number: string;
  serial_number: string;
  location?: string | null;
  status?: string | null;
  category?: string | null;
}

export interface ChemicalLookupResult {
  id: number;
  description?: string | null;
  part_number: string;
  lot_number: string;
  quantity: number;
  unit: string;
  location?: string | null;
  status?: string | null;
  category?: string | null;
}

export type ItemLookupResult = ToolLookupResult | ChemicalLookupResult;

export interface ReceiveTransferPayload {
  destination_location: string;
  received_notes?: string;
}

export interface CancelTransferPayload {
  cancel_reason: string;
}
