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
          merchant_id: string | null
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
          merchant_id?: string | null
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
          merchant_id?: string | null
          name?: string
          prefix?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      cod_handovers: {
        Row: {
          code: string
          created_at: string
          expected_amount: number
          from_user: string
          id: string
          mismatch_note: string | null
          received_amount: number | null
          resolved_at: string | null
          settled_at: string | null
          shipment_count: number
          stage: string
          status: string
          to_user: string | null
        }
        Insert: {
          code?: string
          created_at?: string
          expected_amount?: number
          from_user: string
          id?: string
          mismatch_note?: string | null
          received_amount?: number | null
          resolved_at?: string | null
          settled_at?: string | null
          shipment_count?: number
          stage: string
          status?: string
          to_user?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expected_amount?: number
          from_user?: string
          id?: string
          mismatch_note?: string | null
          received_amount?: number | null
          resolved_at?: string | null
          settled_at?: string | null
          shipment_count?: number
          stage?: string
          status?: string
          to_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cod_handovers_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cod_handovers_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_partners: {
        Row: {
          account_reference: string
          adapter: string
          connection_status: string
          created_at: string
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          name?: string
        }
        Relationships: []
      }
      delivery_routes: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          code: string
          created_at: string
          created_by: string | null
          hub_id: string | null
          id: string
          planned_start: string | null
          rider_id: string | null
          route_date: string
          status: string
          vehicle_id: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          hub_id?: string | null
          id?: string
          planned_start?: string | null
          rider_id?: string | null
          route_date?: string
          status?: string
          vehicle_id?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          hub_id?: string | null
          id?: string
          planned_start?: string | null
          rider_id?: string | null
          route_date?: string
          status?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_routes_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_routes_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_routes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          id: string
          kind: string
          sent_at: string | null
          shipment_id: string | null
          status: string
          to_email: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          sent_at?: string | null
          shipment_id?: string | null
          status?: string
          to_email: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          sent_at?: string | null
          shipment_id?: string | null
          status?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_outbox_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_ledger: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          entry_type: string
          handover_id: string | null
          id: number
          note: string | null
          shipment_id: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          entry_type: string
          handover_id?: string | null
          id?: never
          note?: string | null
          shipment_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          entry_type?: string
          handover_id?: string | null
          id?: never
          note?: string | null
          shipment_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      hubs: {
        Row: {
          address: string
          capacity_per_day: number
          city: string
          closes_at: string | null
          code: string
          contact_phone: string | null
          created_at: string
          id: string
          kind: string
          lat: number | null
          lng: number | null
          manager_id: string | null
          name: string
          opens_at: string | null
          pincode: string | null
          serviceable_pincodes: string[]
          status: string
          updated_at: string
        }
        Insert: {
          address?: string
          capacity_per_day?: number
          city: string
          closes_at?: string | null
          code: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          manager_id?: string | null
          name: string
          opens_at?: string | null
          pincode?: string | null
          serviceable_pincodes?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string
          capacity_per_day?: number
          city?: string
          closes_at?: string | null
          code?: string
          contact_phone?: string | null
          created_at?: string
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          manager_id?: string | null
          name?: string
          opens_at?: string | null
          pincode?: string | null
          serviceable_pincodes?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hubs_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          hub_id: string | null
          id: string
          manager_id: string
          name: string
          status: string
        }
        Insert: {
          code?: string
          created_at?: string
          created_by?: string | null
          hub_id?: string | null
          id?: string
          manager_id: string
          name?: string
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          hub_id?: string | null
          id?: string
          manager_id?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lots_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          base_rate: number
          cod_fee_pct: number
          cod_limit: number
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          default_hub_id: string | null
          gstin: string | null
          id: string
          integration: string
          legal_name: string | null
          name: string
          pickup_address: string
          pickup_city: string | null
          pickup_pincode: string | null
          rate_per_kg: number
          status: string
        }
        Insert: {
          base_rate?: number
          cod_fee_pct?: number
          cod_limit?: number
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          default_hub_id?: string | null
          gstin?: string | null
          id?: string
          integration?: string
          legal_name?: string | null
          name: string
          pickup_address?: string
          pickup_city?: string | null
          pickup_pincode?: string | null
          rate_per_kg?: number
          status?: string
        }
        Update: {
          base_rate?: number
          cod_fee_pct?: number
          cod_limit?: number
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          default_hub_id?: string | null
          gstin?: string | null
          id?: string
          integration?: string
          legal_name?: string | null
          name?: string
          pickup_address?: string
          pickup_city?: string | null
          pickup_pincode?: string | null
          rate_per_kg?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchants_default_hub_id_fkey"
            columns: ["default_hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
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
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          error: string | null
          gateway: string
          gateway_order_id: string | null
          gateway_payment_id: string | null
          id: string
          paid_at: string | null
          shipment_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          error?: string | null
          gateway: string
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          paid_at?: string | null
          shipment_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          error?: string | null
          gateway?: string
          gateway_order_id?: string | null
          gateway_payment_id?: string | null
          id?: string
          paid_at?: string | null
          shipment_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_shipment_id_fkey"
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
          franchise_commission_pct: number
          id: number
          manager_commission_pct: number
          manager_delivery: number
          rider_cod_commission_pct: number
          rider_delivery: number
          rider_return: number
          updated_at: string
        }
        Insert: {
          distributor_delivery?: number
          franchise_commission_pct?: number
          id?: number
          manager_commission_pct?: number
          manager_delivery?: number
          rider_cod_commission_pct?: number
          rider_delivery?: number
          rider_return?: number
          updated_at?: string
        }
        Update: {
          distributor_delivery?: number
          franchise_commission_pct?: number
          id?: number
          manager_commission_pct?: number
          manager_delivery?: number
          rider_cod_commission_pct?: number
          rider_delivery?: number
          rider_return?: number
          updated_at?: string
        }
        Relationships: []
      }
      phone_otps: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          used: boolean
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          phone: string
          used?: boolean
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          used?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          age: number | null
          created_at: string
          district: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          parent_id: string | null
          phone: string | null
          pincode: string | null
          state: string | null
        }
        Insert: {
          address?: string | null
          age?: number | null
          created_at?: string
          district?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id: string
          parent_id?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
        }
        Update: {
          address?: string | null
          age?: number | null
          created_at?: string
          district?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          parent_id?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
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
            foreignKeyName: "return_requests_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          failure_reason: string | null
          from_status: Database["public"]["Enums"]["shipment_status"] | null
          hub_id: string | null
          id: string
          lat: number | null
          lng: number | null
          note: string | null
          proof_ref: string | null
          route_id: string | null
          scan_source: string
          shipment_id: string
          status: Database["public"]["Enums"]["shipment_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          failure_reason?: string | null
          from_status?: Database["public"]["Enums"]["shipment_status"] | null
          hub_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          proof_ref?: string | null
          route_id?: string | null
          scan_source?: string
          shipment_id: string
          status: Database["public"]["Enums"]["shipment_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          failure_reason?: string | null
          from_status?: Database["public"]["Enums"]["shipment_status"] | null
          hub_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          proof_ref?: string | null
          route_id?: string | null
          scan_source?: string
          shipment_id?: string
          status?: Database["public"]["Enums"]["shipment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "shipment_events_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
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
          attempt_count: number
          city: string
          cod_amount: number
          cod_collected: boolean
          cod_handover_id: string | null
          courier_partner_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_notes: string | null
          delivery_otp: string
          distributor_id: string | null
          external_order_id: string | null
          failure_reason: string | null
          fragile: boolean
          height_cm: number | null
          hub_id: string | null
          id: string
          is_demo: boolean
          length_cm: number | null
          lot_id: string | null
          manager_id: string | null
          merchant_id: string | null
          notes: string | null
          otp_attempts: number
          otp_sent_at: string | null
          otp_verified_at: string | null
          package_type: string
          partner_awb: string | null
          payment_mode: string
          pickup_slot: string | null
          pincode: string | null
          promised_by: string | null
          receiver_address: string
          receiver_email: string | null
          receiver_name: string
          receiver_phone: string
          rider_id: string | null
          route_id: string | null
          route_seq: number | null
          sender_name: string
          sender_phone: string | null
          service_level: string
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_code: string
          updated_at: string
          weight_kg: number
          width_cm: number | null
        }
        Insert: {
          attempt_count?: number
          city: string
          cod_amount?: number
          cod_collected?: boolean
          cod_handover_id?: string | null
          courier_partner_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          delivery_otp?: string
          distributor_id?: string | null
          external_order_id?: string | null
          failure_reason?: string | null
          fragile?: boolean
          height_cm?: number | null
          hub_id?: string | null
          id?: string
          is_demo?: boolean
          length_cm?: number | null
          lot_id?: string | null
          manager_id?: string | null
          merchant_id?: string | null
          notes?: string | null
          otp_attempts?: number
          otp_sent_at?: string | null
          otp_verified_at?: string | null
          package_type?: string
          partner_awb?: string | null
          payment_mode?: string
          pickup_slot?: string | null
          pincode?: string | null
          promised_by?: string | null
          receiver_address: string
          receiver_email?: string | null
          receiver_name: string
          receiver_phone: string
          rider_id?: string | null
          route_id?: string | null
          route_seq?: number | null
          sender_name: string
          sender_phone?: string | null
          service_level?: string
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_code?: string
          updated_at?: string
          weight_kg?: number
          width_cm?: number | null
        }
        Update: {
          attempt_count?: number
          city?: string
          cod_amount?: number
          cod_collected?: boolean
          cod_handover_id?: string | null
          courier_partner_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          delivery_notes?: string | null
          delivery_otp?: string
          distributor_id?: string | null
          external_order_id?: string | null
          failure_reason?: string | null
          fragile?: boolean
          height_cm?: number | null
          hub_id?: string | null
          id?: string
          is_demo?: boolean
          length_cm?: number | null
          lot_id?: string | null
          manager_id?: string | null
          merchant_id?: string | null
          notes?: string | null
          otp_attempts?: number
          otp_sent_at?: string | null
          otp_verified_at?: string | null
          package_type?: string
          partner_awb?: string | null
          payment_mode?: string
          pickup_slot?: string | null
          pincode?: string | null
          promised_by?: string | null
          receiver_address?: string
          receiver_email?: string | null
          receiver_name?: string
          receiver_phone?: string
          rider_id?: string | null
          route_id?: string | null
          route_seq?: number | null
          sender_name?: string
          sender_phone?: string | null
          service_level?: string
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_code?: string
          updated_at?: string
          weight_kg?: number
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_cod_handover_fk"
            columns: ["cod_handover_id"]
            isOneToOne: false
            referencedRelation: "cod_handovers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_courier_partner_id_fkey"
            columns: ["courier_partner_id"]
            isOneToOne: false
            referencedRelation: "courier_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_otps: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          shipment_id: string
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          shipment_id: string
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_otps_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
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
      vehicles: {
        Row: {
          capacity_kg: number
          created_at: string
          fitness_expiry: string | null
          hub_id: string | null
          id: string
          insurance_expiry: string | null
          kind: string
          notes: string | null
          ownership: string
          puc_expiry: string | null
          reg_number: string
          rider_id: string | null
          status: string
        }
        Insert: {
          capacity_kg?: number
          created_at?: string
          fitness_expiry?: string | null
          hub_id?: string | null
          id?: string
          insurance_expiry?: string | null
          kind?: string
          notes?: string | null
          ownership?: string
          puc_expiry?: string | null
          reg_number: string
          rider_id?: string | null
          status?: string
        }
        Update: {
          capacity_kg?: number
          created_at?: string
          fitness_expiry?: string | null
          hub_id?: string | null
          id?: string
          insurance_expiry?: string | null
          kind?: string
          notes?: string | null
          ownership?: string
          puc_expiry?: string | null
          reg_number?: string
          rider_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      wh_bag_items: {
        Row: {
          bag_id: string
          created_at: string
          id: string
          product_id: string | null
          qty: number
          shipment_id: string | null
        }
        Insert: {
          bag_id: string
          created_at?: string
          id?: string
          product_id?: string | null
          qty?: number
          shipment_id?: string | null
        }
        Update: {
          bag_id?: string
          created_at?: string
          id?: string
          product_id?: string | null
          qty?: number
          shipment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wh_bag_items_bag_id_fkey"
            columns: ["bag_id"]
            isOneToOne: false
            referencedRelation: "wh_bags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wh_bag_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "wh_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wh_bag_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      wh_bags: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          destination: string
          dispatched_at: string | null
          hub_id: string | null
          id: string
          kind: string
          pincode: string | null
          sealed_at: string | null
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          destination: string
          dispatched_at?: string | null
          hub_id?: string | null
          id?: string
          kind?: string
          pincode?: string | null
          sealed_at?: string | null
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          destination?: string
          dispatched_at?: string | null
          hub_id?: string | null
          id?: string
          kind?: string
          pincode?: string | null
          sealed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "wh_bags_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      wh_locations: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          pincode: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          pincode?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          pincode?: string | null
        }
        Relationships: []
      }
      wh_products: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_id: string | null
          name: string
          quantity: number
          sku: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          name: string
          quantity?: number
          sku: string
          weight_kg?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          name?: string
          quantity?: number
          sku?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "wh_products_location_fk"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "wh_locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_stop_order: { Args: { _ids: string[] }; Returns: number }
      can_see_return: { Args: { _return_id: string }; Returns: boolean }
      can_see_shipment: {
        Args: { _s: Database["public"]["Tables"]["shipments"]["Row"] }
        Returns: boolean
      }
      cancel_with_otp: {
        Args: { _id: string; _otp: string; _reason: string }
        Returns: {
          attempt_count: number
          city: string
          cod_amount: number
          cod_collected: boolean
          cod_handover_id: string | null
          courier_partner_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_notes: string | null
          delivery_otp: string
          distributor_id: string | null
          external_order_id: string | null
          failure_reason: string | null
          fragile: boolean
          height_cm: number | null
          hub_id: string | null
          id: string
          is_demo: boolean
          length_cm: number | null
          lot_id: string | null
          manager_id: string | null
          merchant_id: string | null
          notes: string | null
          otp_attempts: number
          otp_sent_at: string | null
          otp_verified_at: string | null
          package_type: string
          partner_awb: string | null
          payment_mode: string
          pickup_slot: string | null
          pincode: string | null
          promised_by: string | null
          receiver_address: string
          receiver_email: string | null
          receiver_name: string
          receiver_phone: string
          rider_id: string | null
          route_id: string | null
          route_seq: number | null
          sender_name: string
          sender_phone: string | null
          service_level: string
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_code: string
          updated_at: string
          weight_kg: number
          width_cm: number | null
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
          attempt_count: number
          city: string
          cod_amount: number
          cod_collected: boolean
          cod_handover_id: string | null
          courier_partner_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_notes: string | null
          delivery_otp: string
          distributor_id: string | null
          external_order_id: string | null
          failure_reason: string | null
          fragile: boolean
          height_cm: number | null
          hub_id: string | null
          id: string
          is_demo: boolean
          length_cm: number | null
          lot_id: string | null
          manager_id: string | null
          merchant_id: string | null
          notes: string | null
          otp_attempts: number
          otp_sent_at: string | null
          otp_verified_at: string | null
          package_type: string
          partner_awb: string | null
          payment_mode: string
          pickup_slot: string | null
          pincode: string | null
          promised_by: string | null
          receiver_address: string
          receiver_email: string | null
          receiver_name: string
          receiver_phone: string
          rider_id: string | null
          route_id: string | null
          route_seq: number | null
          sender_name: string
          sender_phone: string | null
          service_level: string
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_code: string
          updated_at: string
          weight_kg: number
          width_cm: number | null
        }
        SetofOptions: {
          from: "*"
          to: "shipments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      credit_wallet: {
        Args: {
          _amount: number
          _kind: string
          _note: string
          _ship: string
          _user: string
        }
        Returns: undefined
      }
      ctx: { Args: { _k: string }; Returns: string }
      deliver_with_otp: {
        Args: {
          _collected_cod?: boolean
          _id: string
          _lat?: number
          _lng?: number
          _otp: string
        }
        Returns: {
          attempt_count: number
          city: string
          cod_amount: number
          cod_collected: boolean
          cod_handover_id: string | null
          courier_partner_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          delivery_notes: string | null
          delivery_otp: string
          distributor_id: string | null
          external_order_id: string | null
          failure_reason: string | null
          fragile: boolean
          height_cm: number | null
          hub_id: string | null
          id: string
          is_demo: boolean
          length_cm: number | null
          lot_id: string | null
          manager_id: string | null
          merchant_id: string | null
          notes: string | null
          otp_attempts: number
          otp_sent_at: string | null
          otp_verified_at: string | null
          package_type: string
          partner_awb: string | null
          payment_mode: string
          pickup_slot: string | null
          pincode: string | null
          promised_by: string | null
          receiver_address: string
          receiver_email: string | null
          receiver_name: string
          receiver_phone: string
          rider_id: string | null
          route_id: string | null
          route_seq: number | null
          sender_name: string
          sender_phone: string | null
          service_level: string
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_code: string
          updated_at: string
          weight_kg: number
          width_cm: number | null
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
      request_tracking_otp: {
        Args: { _code: string; _phone_last4: string }
        Returns: Json
      }
      resolve_cod_handover: {
        Args: { _id: string; _note?: string; _received: number }
        Returns: {
          code: string
          created_at: string
          expected_amount: number
          from_user: string
          id: string
          mismatch_note: string | null
          received_amount: number | null
          resolved_at: string | null
          settled_at: string | null
          shipment_count: number
          stage: string
          status: string
          to_user: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cod_handovers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      scan_transition: {
        Args: {
          _code: string
          _failure?: string
          _hub?: string
          _lat?: number
          _lng?: number
          _note?: string
          _source?: string
          _to: Database["public"]["Enums"]["shipment_status"]
        }
        Returns: Json
      }
      seed_demo_orders: {
        Args: { _city?: string; _count: number; _lot?: string }
        Returns: number
      }
      send_delivery_otp: { Args: { _id: string }; Returns: Json }
      shipment_transition_ok: {
        Args: {
          _from: Database["public"]["Enums"]["shipment_status"]
          _to: Database["public"]["Enums"]["shipment_status"]
        }
        Returns: boolean
      }
      submit_cod_handover: {
        Args: never
        Returns: {
          code: string
          created_at: string
          expected_amount: number
          from_user: string
          id: string
          mismatch_note: string | null
          received_amount: number | null
          resolved_at: string | null
          settled_at: string | null
          shipment_count: number
          stage: string
          status: string
          to_user: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cod_handovers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      track_shipment: { Args: { _code: string }; Returns: Json }
      track_with_otp: { Args: { _code: string; _otp: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "distributor" | "manager" | "rider" | "warehouse"
      shipment_status:
        | "created"
        | "pickup_scheduled"
        | "assigned"
        | "picked_up"
        | "hub_received"
        | "sorted"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "failed"
        | "reattempt"
        | "return_initiated"
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
      app_role: ["admin", "distributor", "manager", "rider", "warehouse"],
      shipment_status: [
        "created",
        "pickup_scheduled",
        "assigned",
        "picked_up",
        "hub_received",
        "sorted",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "failed",
        "reattempt",
        "return_initiated",
        "returned",
        "cancelled",
      ],
    },
  },
} as const
