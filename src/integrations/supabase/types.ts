export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      danger_transfers: {
        Row: {
          amount: string
          detected_at: string | null
          from_wallet: string
          id: number
          sell_status: string | null
          sell_triggered: boolean | null
          sell_tx_hash: string | null
          source: string | null
          to_wallet: string
          token_address: string
          token_name: string | null
          token_symbol: string | null
          transfer_count: number | null
          tx_hash: string | null
          wallet_position: number | null
        }
        Insert: {
          amount: string
          detected_at?: string | null
          from_wallet: string
          id?: never
          sell_status?: string | null
          sell_triggered?: boolean | null
          sell_tx_hash?: string | null
          source?: string | null
          to_wallet: string
          token_address: string
          token_name?: string | null
          token_symbol?: string | null
          transfer_count?: number | null
          tx_hash?: string | null
          wallet_position?: number | null
        }
        Update: {
          amount?: string
          detected_at?: string | null
          from_wallet?: string
          id?: never
          sell_status?: string | null
          sell_triggered?: boolean | null
          sell_tx_hash?: string | null
          source?: string | null
          to_wallet?: string
          token_address?: string
          token_name?: string | null
          token_symbol?: string | null
          transfer_count?: number | null
          tx_hash?: string | null
          wallet_position?: number | null
        }
        Relationships: []
      }
      history_searches: {
        Row: {
          id: number
          results_count: number | null
          searched_at: string | null
          token_address: string
          wallet_address: string | null
        }
        Insert: {
          id?: never
          results_count?: number | null
          searched_at?: string | null
          token_address: string
          wallet_address?: string | null
        }
        Update: {
          id?: never
          results_count?: number | null
          searched_at?: string | null
          token_address?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      monitor_state: {
        Row: {
          id: number
          is_monitoring: boolean
          started_at: string | null
          token_address: string | null
          token_decimals: number | null
          token_name: string | null
          token_symbol: string | null
          total_supply: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          is_monitoring?: boolean
          started_at?: string | null
          token_address?: string | null
          token_decimals?: number | null
          token_name?: string | null
          token_symbol?: string | null
          total_supply?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          is_monitoring?: boolean
          started_at?: string | null
          token_address?: string | null
          token_decimals?: number | null
          token_name?: string | null
          token_symbol?: string | null
          total_supply?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sell_log: {
        Row: {
          amount_sold: string | null
          danger_transfer_id: number | null
          error_message: string | null
          executed_at: string | null
          id: number
          sell_tx_hash: string | null
          status: string
          token_address: string
          token_name: string | null
        }
        Insert: {
          amount_sold?: string | null
          danger_transfer_id?: number | null
          error_message?: string | null
          executed_at?: string | null
          id?: never
          sell_tx_hash?: string | null
          status?: string
          token_address: string
          token_name?: string | null
        }
        Update: {
          amount_sold?: string | null
          danger_transfer_id?: number | null
          error_message?: string | null
          executed_at?: string | null
          id?: never
          sell_tx_hash?: string | null
          status?: string
          token_address?: string
          token_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sell_log_danger_transfer_id_fkey"
            columns: ["danger_transfer_id"]
            isOneToOne: false
            referencedRelation: "danger_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          alchemy_api_key: string | null
          alchemy_api_keys: string[] | null
          auto_sell_enabled: boolean | null
          id: number
          updated_at: string | null
          wallet_private_key: string | null
        }
        Insert: {
          alchemy_api_key?: string | null
          alchemy_api_keys?: string[] | null
          auto_sell_enabled?: boolean | null
          id?: number
          updated_at?: string | null
          wallet_private_key?: string | null
        }
        Update: {
          alchemy_api_key?: string | null
          alchemy_api_keys?: string[] | null
          auto_sell_enabled?: boolean | null
          id?: number
          updated_at?: string | null
          wallet_private_key?: string | null
        }
        Relationships: []
      }
      snipe_activity_log: {
        Row: {
          created_at: string | null
          description: string | null
          event_type: string
          id: number
          tx_hash: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_type: string
          id?: never
          tx_hash?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_type?: string
          id?: never
          tx_hash?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      snipe_buys: {
        Row: {
          auto_monitor_started: boolean | null
          buy_amount_eth: string | null
          buy_price_eth: string | null
          buy_tx_hash: string | null
          created_at: string | null
          current_price_eth: string | null
          funded_wallet: string
          id: number
          pnl_percent: number | null
          profit_taken: boolean | null
          source_wallet: string
          status: string
          stop_loss_triggered: boolean | null
          token_address: string
          token_name: string | null
          token_symbol: string | null
        }
        Insert: {
          auto_monitor_started?: boolean | null
          buy_amount_eth?: string | null
          buy_price_eth?: string | null
          buy_tx_hash?: string | null
          created_at?: string | null
          current_price_eth?: string | null
          funded_wallet: string
          id?: never
          pnl_percent?: number | null
          profit_taken?: boolean | null
          source_wallet: string
          status?: string
          stop_loss_triggered?: boolean | null
          token_address: string
          token_name?: string | null
          token_symbol?: string | null
        }
        Update: {
          auto_monitor_started?: boolean | null
          buy_amount_eth?: string | null
          buy_price_eth?: string | null
          buy_tx_hash?: string | null
          created_at?: string | null
          current_price_eth?: string | null
          funded_wallet?: string
          id?: never
          pnl_percent?: number | null
          profit_taken?: boolean | null
          source_wallet?: string
          status?: string
          stop_loss_triggered?: boolean | null
          token_address?: string
          token_name?: string | null
          token_symbol?: string | null
        }
        Relationships: []
      }
      snipe_config: {
        Row: {
          buy_amount_eth: string
          id: number
          is_enabled: boolean
          profit_sell_percent: number
          profit_take_percent: number
          stop_loss_percent: number
          updated_at: string | null
          watch_timeout_hours: number
        }
        Insert: {
          buy_amount_eth?: string
          id?: number
          is_enabled?: boolean
          profit_sell_percent?: number
          profit_take_percent?: number
          stop_loss_percent?: number
          updated_at?: string | null
          watch_timeout_hours?: number
        }
        Update: {
          buy_amount_eth?: string
          id?: number
          is_enabled?: boolean
          profit_sell_percent?: number
          profit_take_percent?: number
          stop_loss_percent?: number
          updated_at?: string | null
          watch_timeout_hours?: number
        }
        Relationships: []
      }
      snipe_wallets: {
        Row: {
          added_at: string | null
          id: number
          is_active: boolean
          label: string | null
          wallet_address: string
        }
        Insert: {
          added_at?: string | null
          id?: never
          is_active?: boolean
          label?: string | null
          wallet_address: string
        }
        Update: {
          added_at?: string | null
          id?: never
          is_active?: boolean
          label?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      snipe_watched_wallets: {
        Row: {
          detected_at: string | null
          eth_amount: string | null
          expires_at: string | null
          funded_wallet: string
          funding_tx_hash: string | null
          id: number
          is_active: boolean
          source_wallet: string
          token_created: string | null
        }
        Insert: {
          detected_at?: string | null
          eth_amount?: string | null
          expires_at?: string | null
          funded_wallet: string
          funding_tx_hash?: string | null
          id?: never
          is_active?: boolean
          source_wallet: string
          token_created?: string | null
        }
        Update: {
          detected_at?: string | null
          eth_amount?: string | null
          expires_at?: string | null
          funded_wallet?: string
          funding_tx_hash?: string | null
          id?: never
          is_active?: boolean
          source_wallet?: string
          token_created?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
