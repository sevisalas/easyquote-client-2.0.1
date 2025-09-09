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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      additionals: {
        Row: {
          assignment_type: string
          created_at: string
          default_value: number
          description: string | null
          id: string
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_type?: string
          created_at?: string
          default_value?: number
          description?: string | null
          id?: string
          name: string
          type: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          assignment_type?: string
          created_at?: string
          default_value?: number
          description?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          created_at: string | null
          id: string
          operation: string
          record_id: string | null
          table_name: string
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          operation: string
          record_id?: string | null
          table_name: string
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          operation?: string
          record_id?: string | null
          table_name?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          holded_id: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          holded_id?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          holded_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      excel_files: {
        Row: {
          created_at: string
          file_id: string
          file_name: string
          file_url: string | null
          id: string
          is_master: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_id: string
          file_name: string
          file_url?: string | null
          id?: string
          is_master?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_id?: string
          file_name?: string
          file_url?: string | null
          id?: string
          is_master?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          configuration: Json
          created_at: string
          id: string
          integration_type: string
          is_active: boolean
          organization_id: string
          updated_at: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          id?: string
          integration_type: string
          is_active?: boolean
          organization_id: string
          updated_at?: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          id?: string
          integration_type?: string
          is_active?: boolean
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_integration_access: {
        Row: {
          created_at: string
          granted_by: string
          id: string
          integration_type: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          granted_by: string
          id?: string
          integration_type: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          granted_by?: string
          id?: string
          integration_type?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          api_user_id: string
          client_user_extra: number
          client_user_limit: number
          created_at: string
          excel_extra: number
          excel_limit: number
          id: string
          name: string
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          updated_at: string
        }
        Insert: {
          api_user_id: string
          client_user_extra?: number
          client_user_limit?: number
          created_at?: string
          excel_extra?: number
          excel_limit?: number
          id?: string
          name: string
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
        }
        Update: {
          api_user_id?: string
          client_user_extra?: number
          client_user_limit?: number
          created_at?: string
          excel_extra?: number
          excel_limit?: number
          id?: string
          name?: string
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_category_mappings: {
        Row: {
          category_id: string | null
          created_at: string
          easyquote_product_id: string
          id: string
          product_name: string
          subcategory_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          easyquote_product_id: string
          id?: string
          product_name: string
          subcategory_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          easyquote_product_id?: string
          id?: string
          product_name?: string
          subcategory_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_category_mappings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_mappings_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "product_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_subcategories: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          id: string
          item_additionals: Json | null
          multi: Json | null
          name: string | null
          outputs: Json
          position: number | null
          product_id: string | null
          prompts: Json
          quantity: number | null
          quote_id: string
          total_price: number | null
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_additionals?: Json | null
          multi?: Json | null
          name?: string | null
          outputs?: Json
          position?: number | null
          product_id?: string | null
          prompts?: Json
          quantity?: number | null
          quote_id: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_additionals?: Json | null
          multi?: Json | null
          name?: string | null
          outputs?: Json
          position?: number | null
          product_id?: string | null
          prompts?: Json
          quantity?: number | null
          quote_id?: string
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          customer_id: string
          description: string | null
          final_price: number
          id: string
          product_id: string | null
          product_name: string | null
          quote_additionals: Json | null
          quote_number: string
          results: Json
          selections: Json
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          description?: string | null
          final_price: number
          id?: string
          product_id?: string | null
          product_name?: string | null
          quote_additionals?: Json | null
          quote_number: string
          results: Json
          selections: Json
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string | null
          final_price?: number
          id?: string
          product_id?: string | null
          product_name?: string | null
          quote_additionals?: Json | null
          quote_number?: string
          results?: Json
          selections?: Json
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_customer_public_info: {
        Args: { customer_id?: string }
        Returns: {
          created_at: string
          id: string
          name: string
          user_id: string
        }[]
      }
      get_integration_status: {
        Args: { integration_name: string; org_id: string }
        Returns: {
          created_at: string
          id: string
          integration_type: string
          is_active: boolean
          updated_at: string
        }[]
      }
      get_integration_status_safe: {
        Args: { org_id: string }
        Returns: {
          created_at: string
          has_configuration: boolean
          id: string
          integration_type: string
          is_active: boolean
          updated_at: string
        }[]
      }
      get_organization_users: {
        Args: { org_id: string }
        Returns: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["organization_role"]
          updated_at: string
          user_id: string
        }[]
      }
      get_plan_limits: {
        Args: { plan: Database["public"]["Enums"]["subscription_plan"] }
        Returns: {
          client_user_limit: number
          excel_limit: number
        }[]
      }
      is_superadmin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      organization_role: "superadmin" | "admin" | "user"
      subscription_plan:
        | "api_base"
        | "api_pro"
        | "client_base"
        | "client_pro"
        | "custom"
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
    Enums: {
      organization_role: ["superadmin", "admin", "user"],
      subscription_plan: [
        "api_base",
        "api_pro",
        "client_base",
        "client_pro",
        "custom",
      ],
    },
  },
} as const
