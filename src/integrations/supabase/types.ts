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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          created_by: string
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          prefix: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          prefix: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: []
      }
      courier_partners: {
        Row: {
          account_reference: string
          adapter: string
          connection_status: string
          created_at: string
          created_by: string
          enabled: boolean
          id: string
          last_error: string | null
          last_sync_at: string | null
          name: string
        }
        Insert: {
          account_reference?: string
          adapter: string
          connection_status?: string
          created_at?: string
          created_by?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          name: string
        }
        Update: {
          account_reference?: string
          adapter?: string
          connection_status?: string
          created_at?: string
          created_by?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          name?: string
        }
        Relationships: []
      }
      integration_events: {
        Row: {
          created_at: string
          event_key: string
          event_type: string
          id: string
          message: string
          outcome: string
          partner_id: string
        }
        Insert: {
          created_at?: string
          event_key: string
          event_type: string
          id?: string
          message?: string
          outcome: string
          partner_id: string
        }
        Update: {
          created_at?: string
          event_key?: string
          event_type?: string
          id?: string
          message?: string
          outcome?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_events_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "courier_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          manager_id: string
          name: string
          status: string
        }
        Insert: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          manager_id: string
          name?: string
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          manager_id?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lots_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_orders: {
        Row: {
          external_order_id: string
          id: string
          order_data: Json
          partner_id: string
          received_at: string
          shipment_id: string | null
          source: string
        }
        Insert: {
          external_order_id: string
          id?: string
          order_data?: Json
          partner_id: string
          received_at?: string
          shipment_id?: string | null
          source?: string
        }
        Update: {
          external_order_id?: string
          id?: string
          order_data?: Json
          partner_id?: string
          received_at?: string
          shipment_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "courier_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_orders_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_bonuses: {
        Row: {
          active: boolean
          created_at: string
          distributor_bonus: number
          ends_on: string
          id: string
          kind: string
          manager_bonus: number
          name: string
          rider_bonus: number
          starts_on: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          distributor_bonus?: number
          ends_on: string
          id?: string
          kind?: string
          manager_bonus?: number
          name: string
          rider_bonus?: number
          starts_on: string
        }
        Update: {
          active?: boolean
          created_at?: string
          distributor_bonus?: number
          ends_on?: string
          id?: string
          kind?: string
          manager_bonus?: number
          name?: string
          rider_bonus?: number
          starts_on?: string
        }
        Relationships: []
      }
      payout_settings: {
        Row: {
          distributor_delivery: number
          id: number
          manager_delivery: number
          rider_delivery: number
          rider_return: number
          updated_at: string
        }
        Insert: {
          distributor_delivery?: number
          id?: number
          manager_delivery?: number
          rider_delivery?: number
          rider_return?: number
          updated_at?: string
        }
        Update: {
          distributor_delivery?: number
          id?: number
          manager_delivery?: number
          rider_delivery?: number
          rider_return?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          parent_id: string | null
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          parent_id?: string | null
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          parent_id?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          category: string
          config: Json
          created_at: string
          description: string
          enabled: boolean
          id: string
          mode: string
          name: string
        }
        Insert: {
          category: string
          config?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          mode?: string
          name: string
        }
        Update: {
          category?: string
          config?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          mode?: string
          name?: string
        }
        Relationships: []
      }
      return_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          note: string | null
          return_id: string
          status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          return_id: string
          status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          return_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_events_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      return_photos: {
        Row: {
          accuracy_m: number | null
          captured_by: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          path: string
          return_id: string
        }
        Insert: {
          accuracy_m?: number | null
          captured_by?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          path: string
          return_id: string
        }
        Update: {
          accuracy_m?: number | null
          captured_by?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          path?: string
          return_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_photos_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      return_requests: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_lat: number | null
          last_lng: number | null
          last_location_at: string | null
          pickup_address: string | null
          reason: string
          rider_id: string | null
          shipment_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          last_lat?: number | null
          last_lng?: number | null
          last_location_at?: string | null
          pickup_address?: string | null
          reason: string
          rider_id?: string | null
          shipment_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_lat?: number | null
          last_lng?: number | null
          last_location_at?: string | null
          pickup_address?: string | null
          reason?: string
          rider_id?: string | null
          shipment_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rated_by: string | null
          rating: number
          rider_id: string
          shipment_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rated_by?: string | null
          rating: number
          rider_id: string
          shipment_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rated_by?: string | null
          rating?: number
          rider_id?: string
          shipment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rider_ratings_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_ratings_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: true
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_wallet_txns: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          note: string | null
          rider_id: string
          shipment_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          rider_id: string
          shipment_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          rider_id?: string
          shipment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rider_wallet_txns_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rider_wallet_txns_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          note: string | null
          shipment_id: string
          status: Database["public"]["Enums"]["shipment_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          shipment_id: string
          status: Database["public"]["Enums"]["shipment_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          shipment_id?: string
          status?: Database["public"]["Enums"]["shipment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "shipment_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          city: string
          cod_amount: number
          cod_collected: boolean
          courier_partner_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_otp: string
          distributor_id: string | null
          external_order_id: string | null
          id: string
          is_demo: boolean
          lot_id: string | null
          manager_id: string | null
          notes: string | null
          otp_sent_at: string | null
          otp_verified_at: string | null
          partner_awb: string | null
          pincode: string | null
          receiver_address: string
          receiver_name: string
          receiver_phone: string
          rider_id: string | null
          sender_name: string
          sender_phone: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_code: string
          updated_at: string
          weight_kg: number
        }
        Insert: {
          city: string
          cod_amount?: number
          cod_collected?: boolean
          courier_partner_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_otp?: string
          distributor_id?: string | null
          external_order_id?: string | null
          id?: string
          is_demo?: boolean
          lot_id?: string | null
          manager_id?: string | null
          notes?: string | null
          otp_sent_at?: string | null
          otp_verified_at?: string | null
          partner_awb?: string | null
          pincode?: string | null
          receiver_address: string
          receiver_name: string
          receiver_phone: string
          rider_id?: string | null
          sender_name: string
          sender_phone?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_code?: string
          updated_at?: string
          weight_kg?: number
        }
        Update: {
          city?: string
          cod_amount?: number
          cod_collected?: boolean
          courier_partner_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_otp?: string
          distributor_id?: string | null
          external_order_id?: string | null
          id?: string
          is_demo?: boolean
          lot_id?: string | null
          manager_id?: string | null
          notes?: string | null
          otp_sent_at?: string | null
          otp_verified_at?: string | null
          partner_awb?: string | null
          pincode?: string | null
          receiver_address?: string
          receiver_name?: string
          receiver_phone?: string
          rider_id?: string | null
          sender_name?: string
          sender_phone?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_code?: string
          updated_at?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "shipments_courier_partner_id_fkey"
            columns: ["courier_partner_id"]
            isOneToOne: false
            referencedRelation: "courier_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempt: number
          created_at: string
          duration_ms: number | null
          endpoint_id: string
          error: string | null
          event: string
          id: string
          ok: boolean
          outbox_id: string | null
          request_body: Json | null
          response_body: string | null
          status_code: number | null
        }
        Insert: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          endpoint_id: string
          error?: string | null
          event: string
          id?: string
          ok?: boolean
          outbox_id?: string | null
          request_body?: Json | null
          response_body?: string | null
          status_code?: number | null
        }
        Update: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          endpoint_id?: string
          error?: string | null
          event?: string
          id?: string
          ok?: boolean
          outbox_id?: string | null
          request_body?: Json | null
          response_body?: string | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "webhook_outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          events: string[]
          id: string
          last_delivery_at: string | null
          last_status: number | null
          name: string
          secret: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          events?: string[]
          id?: string
          last_delivery_at?: string | null
          last_status?: number | null
          name: string
          secret: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          events?: string[]
          id?: string
          last_delivery_at?: string | null
          last_status?: number | null
          name?: string
          secret?: string
          url?: string
        }
        Relationships: []
      }
      webhook_outbox: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          endpoint_id: string
          event: string
          id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id: string
          event: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload: Json
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          endpoint_id?: string
          event?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_outbox_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_see_return: { Args: { _return_id: string }; Returns: boolean }
      can_see_shipment: {
        Args: { _s: Database["public"]["Tables"]["shipments"]["Row"] }
        Returns: boolean
      }
      cancel_with_otp: {
        Args: { _id: string; _otp: string; _reason: string }
        Returns: {
          city: string
          cod_amount: number
          cod_collected: boolean
          courier_partner_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_otp: string
          distributor_id: string | null
          external_order_id: string | null
          id: string
          is_demo: boolean
          lot_id: string | null
          manager_id: string | null
          notes: string | null
          otp_sent_at: string | null
          otp_verified_at: string | null
          partner_awb: string | null
          pincode: string | null
          receiver_address: string
          receiver_name: string
          receiver_phone: string
          rider_id: string | null
          sender_name: string
          sender_phone: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_code: string
          updated_at: string
          weight_kg: number
        }
        SetofOptions: {
          from: "*"
          to: "shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      chain_role_id: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user: string }
        Returns: string
      }
      claim_shipment: {
        Args: { _code: string }
        Returns: {
          city: string
          cod_amount: number
          cod_collected: boolean
          courier_partner_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_otp: string
          distributor_id: string | null
          external_order_id: string | null
          id: string
          is_demo: boolean
          lot_id: string | null
          manager_id: string | null
          notes: string | null
          otp_sent_at: string | null
          otp_verified_at: string | null
          partner_awb: string | null
          pincode: string | null
          receiver_address: string
          receiver_name: string
          receiver_phone: string
          rider_id: string | null
          sender_name: string
          sender_phone: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_code: string
          updated_at: string
          weight_kg: number
        }
        SetofOptions: {
          from: "*"
          to: "shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      deliver_with_otp: {
        Args: { _id: string; _otp: string }
        Returns: {
          city: string
          cod_amount: number
          cod_collected: boolean
          courier_partner_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_otp: string
          distributor_id: string | null
          external_order_id: string | null
          id: string
          is_demo: boolean
          lot_id: string | null
          manager_id: string | null
          notes: string | null
          otp_sent_at: string | null
          otp_verified_at: string | null
          partner_awb: string | null
          pincode: string | null
          receiver_address: string
          receiver_name: string
          receiver_phone: string
          rider_id: string | null
          sender_name: string
          sender_phone: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_code: string
          updated_at: string
          weight_kg: number
        }
        SetofOptions: {
          from: "*"
          to: "shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      duplicate_shipment: {
        Args: { _copies: number; _id: string }
        Returns: number
      }
      enqueue_webhook: {
        Args: { _data: Json; _event: string }
        Returns: undefined
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_partner_order: { Args: { _id: string }; Returns: string }
      is_ancestor: { Args: { _anc: string; _desc: string }; Returns: boolean }
      seed_demo_orders: {
        Args: { _city?: string; _count: number; _lot?: string }
        Returns: number
      }
      send_delivery_otp: { Args: { _id: string }; Returns: Json }
      track_shipment: { Args: { _code: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "distributor" | "manager" | "rider"
      shipment_status:
        | "created"
        | "assigned"
        | "picked_up"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "failed"
        | "returned"
        | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "distributor", "manager", "rider"],
      shipment_status: [
        "created",
        "assigned",
        "picked_up",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "failed",
        "returned",
        "cancelled",
      ],
    },
  },
} as const
