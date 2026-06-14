export type TransactionDirection = 'IN' | 'OUT';
export type TransactionType = 'C2B' | 'STK' | 'B2C' | 'REVERSAL' | 'B2B' | 'activation' | 'withdrawal' | 'wallet_withdrawal';
export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'TIMEOUT';

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
          metadata: any | null;
          created_at: string;
          updated_at: string;
          source_system: string;
          provider: string | null;
          origin: string | null;
          payment_type: string | null;
          product_stream: string | null;
          module: string | null;
          service_source: string | null;
          payer_phone: string | null;
          recipient_phone: string | null;
          counterparty_phone: string | null;
          receipt: string | null;
          external_reference_id: string | null;
          external_user_id: string | null;
          external_agent_id: string | null;
          agent_name: string | null;
          agent_business_name: string | null;
          agent_username: string | null;
          currency: string;
          occurred_at: string | null;
          initiated_at: string | null;
          completed_at: string | null;
          reconciliation_status: string;
          reconciliation_key: string | null;
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
          metadata?: any | null;
          created_at?: string;
          updated_at?: string;
          source_system?: string;
          provider?: string | null;
          origin?: string | null;
          payment_type?: string | null;
          product_stream?: string | null;
          module?: string | null;
          service_source?: string | null;
          payer_phone?: string | null;
          recipient_phone?: string | null;
          counterparty_phone?: string | null;
          receipt?: string | null;
          external_reference_id?: string | null;
          external_user_id?: string | null;
          external_agent_id?: string | null;
          agent_name?: string | null;
          agent_business_name?: string | null;
          agent_username?: string | null;
          currency?: string;
          occurred_at?: string | null;
          initiated_at?: string | null;
          completed_at?: string | null;
          reconciliation_status?: string;
          reconciliation_key?: string | null;
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
          metadata?: any | null;
          created_at?: string;
          updated_at?: string;
          source_system?: string;
          provider?: string | null;
          origin?: string | null;
          payment_type?: string | null;
          product_stream?: string | null;
          module?: string | null;
          service_source?: string | null;
          payer_phone?: string | null;
          recipient_phone?: string | null;
          counterparty_phone?: string | null;
          receipt?: string | null;
          external_reference_id?: string | null;
          external_user_id?: string | null;
          external_agent_id?: string | null;
          agent_name?: string | null;
          agent_business_name?: string | null;
          agent_username?: string | null;
          currency?: string;
          occurred_at?: string | null;
          initiated_at?: string | null;
          completed_at?: string | null;
          reconciliation_status?: string;
          reconciliation_key?: string | null;
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
      b2b_requests: {
        Row: {
          id: string;
          amount: number;
          destination_shortcode: string;
          destination_type: string;
          command_id: string;
          account_reference: string;
          remarks: string | null;
          conversation_id: string | null;
          originator_conversation_id: string | null;
          result_code: number | null;
          result_description: string | null;
          status: string;
          response_payload: any | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          amount: number;
          destination_shortcode: string;
          destination_type: string;
          command_id: string;
          account_reference: string;
          remarks?: string | null;
          conversation_id?: string | null;
          originator_conversation_id?: string | null;
          result_code?: number | null;
          result_description?: string | null;
          status?: string;
          response_payload?: any | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          amount?: number;
          destination_shortcode?: string;
          destination_type?: string;
          command_id?: string;
          account_reference?: string;
          remarks?: string | null;
          conversation_id?: string | null;
          originator_conversation_id?: string | null;
          result_code?: number | null;
          result_description?: string | null;
          status?: string;
          response_payload?: any | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      settlement_rules: {
        Row: {
          id: string;
          source_reference: string;
          rule_type: string;
          percentage: number | null;
          fixed_amount: number | null;
          destination_shortcode: string;
          destination_type: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_reference: string;
          rule_type: string;
          percentage?: number | null;
          fixed_amount?: number | null;
          destination_shortcode: string;
          destination_type: string;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_reference?: string;
          rule_type?: string;
          percentage?: number | null;
          fixed_amount?: number | null;
          destination_shortcode?: string;
          destination_type?: string;
          active?: boolean;
          created_at?: string;
        };
      };
      settlement_queue: {
        Row: {
          id: string;
          transaction_id: string | null;
          settlement_rule_id: string | null;
          amount: number;
          status: string;
          attempts: number;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          transaction_id?: string | null;
          settlement_rule_id?: string | null;
          amount: number;
          status?: string;
          attempts?: number;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          transaction_id?: string | null;
          settlement_rule_id?: string | null;
          amount?: number;
          status?: string;
          attempts?: number;
          created_at?: string;
          processed_at?: string | null;
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
      sms_notifications: {
        Row: {
          id: string;
          phone: string;
          message: string;
          message_id: string | null;
          status: string;
          provider_response: any | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          phone: string;
          message: string;
          message_id?: string | null;
          status?: string;
          provider_response?: any | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          phone?: string;
          message?: string;
          message_id?: string | null;
          status?: string;
          provider_response?: any | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      sms_settings: {
        Row: {
          id: string;
          admin_alert_phone: string;
          sender_id: string;
          incoming_alerts_enabled: boolean;
          outgoing_alerts_enabled: boolean;
          created_at: string;
          updated_at: string;
          pesafrix_till_number: string;
          notification_channel: string;
        };
        Insert: {
          id?: string;
          admin_alert_phone?: string;
          sender_id?: string;
          incoming_alerts_enabled?: boolean;
          outgoing_alerts_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
          pesafrix_till_number?: string;
          notification_channel?: string;
        };
        Update: {
          id?: string;
          admin_alert_phone?: string;
          sender_id?: string;
          incoming_alerts_enabled?: boolean;
          outgoing_alerts_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
          pesafrix_till_number?: string;
          notification_channel?: string;
        };
      };
      webhook_events: {
        Row: {
          id: string;
          source_system: string;
          event_key: string;
          event_type: string;
          schema_version: number | null;
          payload_hash: string;
          occurred_at: string | null;
          received_at: string;
          processing_status: string;
          processing_error: string | null;
          raw_payload: any;
          transaction_id: string | null;
          reconciliation_status: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_system: string;
          event_key: string;
          event_type: string;
          schema_version?: number | null;
          payload_hash: string;
          occurred_at?: string | null;
          received_at?: string;
          processing_status: string;
          processing_error?: string | null;
          raw_payload: any;
          transaction_id?: string | null;
          reconciliation_status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          source_system?: string;
          event_key?: string;
          event_type?: string;
          schema_version?: number | null;
          payload_hash?: string;
          occurred_at?: string | null;
          received_at?: string;
          processing_status?: string;
          processing_error?: string | null;
          raw_payload?: any;
          transaction_id?: string | null;
          reconciliation_status?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      notification_deliveries: {
        Row: {
          id: string;
          transaction_id: string | null;
          webhook_event_id: string | null;
          notification_type: string;
          channel: string;
          recipient: string;
          message: string;
          deduplication_key: string;
          status: string;
          provider_message_id: string | null;
          provider_response: any | null;
          error_message: string | null;
          attempt_count: number;
          next_attempt_at: string | null;
          created_at: string;
          updated_at: string;
          sent_at: string | null;
        };
        Insert: {
          id?: string;
          transaction_id?: string | null;
          webhook_event_id?: string | null;
          notification_type: string;
          channel: string;
          recipient: string;
          message: string;
          deduplication_key: string;
          status: string;
          provider_message_id?: string | null;
          provider_response?: any | null;
          error_message?: string | null;
          attempt_count?: number;
          next_attempt_at?: string | null;
          created_at?: string;
          updated_at?: string;
          sent_at?: string | null;
        };
        Update: {
          id?: string;
          transaction_id?: string | null;
          webhook_event_id?: string | null;
          notification_type?: string;
          channel?: string;
          recipient?: string;
          message?: string;
          deduplication_key?: string;
          status?: string;
          provider_message_id?: string | null;
          provider_response?: any | null;
          error_message?: string | null;
          attempt_count?: number;
          next_attempt_at?: string | null;
          created_at?: string;
          updated_at?: string;
          sent_at?: string | null;
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
export type B2bRequest = Database['public']['Tables']['b2b_requests']['Row'];
export type SettlementRule = Database['public']['Tables']['settlement_rules']['Row'];
export type SettlementQueue = Database['public']['Tables']['settlement_queue']['Row'];
export type SmsNotification = Database['public']['Tables']['sms_notifications']['Row'];
export type SmsSettings = Database['public']['Tables']['sms_settings']['Row'];
export type WebhookEvent = Database['public']['Tables']['webhook_events']['Row'];
export type NotificationDelivery = Database['public']['Tables']['notification_deliveries']['Row'];

