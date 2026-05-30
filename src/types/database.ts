export type TransactionDirection = 'IN' | 'OUT';
export type TransactionType = 'C2B' | 'STK' | 'B2C' | 'REVERSAL';
export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface Database {
  public: {
    Tables: {
      me: {
        Row: {
          id: string;
          auth_user_id: string;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string;
          email?: string | null;
          created_at?: string;
        };
      };
      dashboard_pin: {
        Row: {
          id: string;
          auth_user_id: string;
          pin_hash: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          pin_hash: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string;
          pin_hash?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      product_sources: {
        Row: {
          id: string;
          name: string;
          reference: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          reference: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          reference?: string;
          active?: boolean;
          created_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          direction: TransactionDirection;
          transaction_type: TransactionType;
          source_id: string | null;
          account_reference: string | null;
          phone_number: string | null;
          amount: number;
          mpesa_receipt: string | null;
          merchant_request_id: string | null;
          checkout_request_id: string | null;
          status: TransactionStatus;
          description: string | null;
          raw_payload: any | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          direction: TransactionDirection;
          transaction_type: TransactionType;
          source_id?: string | null;
          account_reference?: string | null;
          phone_number?: string | null;
          amount: number;
          mpesa_receipt?: string | null;
          merchant_request_id?: string | null;
          checkout_request_id?: string | null;
          status?: TransactionStatus;
          description?: string | null;
          raw_payload?: any | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          direction?: TransactionDirection;
          transaction_type?: TransactionType;
          source_id?: string | null;
          account_reference?: string | null;
          phone_number?: string | null;
          amount?: number;
          mpesa_receipt?: string | null;
          merchant_request_id?: string | null;
          checkout_request_id?: string | null;
          status?: TransactionStatus;
          description?: string | null;
          raw_payload?: any | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      balance_snapshots: {
        Row: {
          id: string;
          balance: number;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          balance: number;
          fetched_at?: string;
        };
        Update: {
          id?: string;
          balance?: number;
          fetched_at?: string;
        };
      };
      stk_requests: {
        Row: {
          id: string;
          phone_number: string;
          amount: number;
          account_reference: string | null;
          merchant_request_id: string | null;
          checkout_request_id: string | null;
          status: TransactionStatus;
          response_payload: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          phone_number: string;
          amount: number;
          account_reference?: string | null;
          merchant_request_id?: string | null;
          checkout_request_id?: string | null;
          status?: TransactionStatus;
          response_payload?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          phone_number?: string;
          amount?: number;
          account_reference?: string | null;
          merchant_request_id?: string | null;
          checkout_request_id?: string | null;
          status?: TransactionStatus;
          response_payload?: any | null;
          created_at?: string;
        };
      };
      b2c_requests: {
        Row: {
          id: string;
          phone_number: string;
          amount: number;
          remarks: string | null;
          conversation_id: string | null;
          originator_conversation_id: string | null;
          status: TransactionStatus;
          response_payload: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          phone_number: string;
          amount: number;
          remarks?: string | null;
          conversation_id?: string | null;
          originator_conversation_id?: string | null;
          status?: TransactionStatus;
          response_payload?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          phone_number?: string;
          amount?: number;
          remarks?: string | null;
          conversation_id?: string | null;
          originator_conversation_id?: string | null;
          status?: TransactionStatus;
          response_payload?: any | null;
          created_at?: string;
        };
      };
      reversal_requests: {
        Row: {
          id: string;
          receipt_number: string;
          amount: number | null;
          reason: string | null;
          conversation_id: string | null;
          status: TransactionStatus;
          response_payload: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          receipt_number: string;
          amount?: number | null;
          reason?: string | null;
          conversation_id?: string | null;
          status?: TransactionStatus;
          response_payload?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          receipt_number?: string;
          amount?: number | null;
          reason?: string | null;
          conversation_id?: string | null;
          status?: TransactionStatus;
          response_payload?: any | null;
          created_at?: string;
        };
      };
      reconciliation_records: {
        Row: {
          id: string;
          external_reference: string | null;
          transaction_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          external_reference?: string | null;
          transaction_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          external_reference?: string | null;
          transaction_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          auth_user_id: string | null;
          action: string;
          metadata: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          action: string;
          metadata?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          action?: string;
          metadata?: any | null;
          created_at?: string;
        };
      };
    };
  };
}

export type Me = Database['public']['Tables']['me']['Row'];
export type DashboardPin = Database['public']['Tables']['dashboard_pin']['Row'];
export type ProductSource = Database['public']['Tables']['product_sources']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type BalanceSnapshot = Database['public']['Tables']['balance_snapshots']['Row'];
export type StkRequest = Database['public']['Tables']['stk_requests']['Row'];
export type B2cRequest = Database['public']['Tables']['b2c_requests']['Row'];
export type ReversalRequest = Database['public']['Tables']['reversal_requests']['Row'];
export type ReconciliationRecord = Database['public']['Tables']['reconciliation_records']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];

