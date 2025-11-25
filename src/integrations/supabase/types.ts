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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      additionals: {
        Row: {
          assignment_type: string | null
          created_at: string
          default_value: number | null
          description: string | null
          id: string
          is_active: boolean
          is_discount: boolean
          name: string
          price: number
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_type?: string | null
          created_at?: string
          default_value?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_discount?: boolean
          name: string
          price?: number
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_type?: string | null
          created_at?: string
          default_value?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_discount?: boolean
          name?: string
          price?: number
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_access_logs: {
        Row: {
          accessed_at: string
          customer_id: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          operation: string
          record_count: number | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accessed_at?: string
          customer_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          operation: string
          record_count?: number | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accessed_at?: string
          customer_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          operation?: string
          record_count?: number | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_access_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          holded_id: string | null
          id: string
          integration_id: string | null
          name: string
          notes: string | null
          organization_id: string | null
          phone: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          holded_id?: string | null
          id?: string
          integration_id?: string | null
          name: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          holded_id?: string | null
          id?: string
          integration_id?: string | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      easyquote_credentials: {
        Row: {
          api_password_encrypted: string
          api_username_encrypted: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_password_encrypted: string
          api_username_encrypted: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_password_encrypted?: string
          api_username_encrypted?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      excel_files: {
        Row: {
          created_at: string
          error_message: string | null
          file_id: string
          file_size: number
          filename: string
          id: string
          is_master: boolean | null
          mime_type: string | null
          original_filename: string
          processed: boolean
          updated_at: string
          upload_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          file_id: string
          file_size?: number
          filename: string
          id?: string
          is_master?: boolean | null
          mime_type?: string | null
          original_filename: string
          processed?: boolean
          updated_at?: string
          upload_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          file_id?: string
          file_size?: number
          filename?: string
          id?: string
          is_master?: boolean | null
          mime_type?: string | null
          original_filename?: string
          processed?: boolean
          updated_at?: string
          upload_date?: string
          user_id?: string
        }
        Relationships: []
      }
      holded_sales_accounts: {
        Row: {
          account_num: number | null
          color: string | null
          created_at: string
          holded_account_id: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          account_num?: number | null
          color?: string | null
          created_at?: string
          holded_account_id: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          account_num?: number | null
          color?: string | null
          created_at?: string
          holded_account_id?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holded_sales_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      images: {
        Row: {
          created_at: string
          description: string | null
          file_size: number
          filename: string
          height: number | null
          id: string
          is_active: boolean
          mime_type: string
          original_filename: string
          storage_path: string
          tags: string[] | null
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_size?: number
          filename: string
          height?: number | null
          id?: string
          is_active?: boolean
          mime_type: string
          original_filename: string
          storage_path: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_size?: number
          filename?: string
          height?: number | null
          id?: string
          is_active?: boolean
          mime_type?: string
          original_filename?: string
          storage_path?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          configuration: Json | null
          created_at: string
          description: string | null
          id: string
          integration_type: string | null
          is_active: boolean
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          configuration?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          integration_type?: string | null
          is_active?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          configuration?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          integration_type?: string | null
          is_active?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      numbering_formats: {
        Row: {
          created_at: string
          document_type: string
          id: string
          last_sequential_number: number
          organization_id: string | null
          prefix: string
          sequential_digits: number
          suffix: string | null
          updated_at: string
          use_year: boolean
          user_id: string
          year_format: string
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          last_sequential_number?: number
          organization_id?: string | null
          prefix?: string
          sequential_digits?: number
          suffix?: string | null
          updated_at?: string
          use_year?: boolean
          user_id: string
          year_format?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          last_sequential_number?: number
          organization_id?: string | null
          prefix?: string
          sequential_digits?: number
          suffix?: string | null
          updated_at?: string
          use_year?: boolean
          user_id?: string
          year_format?: string
        }
        Relationships: [
          {
            foreignKeyName: "numbering_formats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_api_credentials: {
        Row: {
          api_key: string | null
          api_key_encrypted: string | null
          api_secret: string | null
          api_secret_encrypted: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          last_used_at: string | null
          organization_id: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          api_key?: string | null
          api_key_encrypted?: string | null
          api_secret?: string | null
          api_secret_encrypted?: string | null
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          organization_id: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          api_key?: string | null
          api_key_encrypted?: string | null
          api_secret?: string | null
          api_secret_encrypted?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          organization_id?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_api_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_integration_access: {
        Row: {
          access_token_encrypted: string | null
          configuration: Json | null
          created_at: string
          expires_at: string | null
          generate_pdfs: boolean
          id: string
          integration_id: string
          is_active: boolean
          organization_id: string
          refresh_token_encrypted: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          configuration?: Json | null
          created_at?: string
          expires_at?: string | null
          generate_pdfs?: boolean
          id?: string
          integration_id: string
          is_active?: boolean
          organization_id: string
          refresh_token_encrypted?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          configuration?: Json | null
          created_at?: string
          expires_at?: string | null
          generate_pdfs?: boolean
          id?: string
          integration_id?: string
          is_active?: boolean
          organization_id?: string
          refresh_token_encrypted?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_integration_access_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_integration_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          cuenta_holded: string | null
          display_name: string | null
          id: string
          organization_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cuenta_holded?: string | null
          display_name?: string | null
          id?: string
          organization_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cuenta_holded?: string | null
          display_name?: string | null
          id?: string
          organization_id?: string
          role?: string
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
          holded_external_customers: boolean
          id: string
          name: string
          subscription_plan: string
          updated_at: string
        }
        Insert: {
          api_user_id: string
          client_user_extra?: number
          client_user_limit?: number
          created_at?: string
          excel_extra?: number
          excel_limit?: number
          holded_external_customers?: boolean
          id?: string
          name: string
          subscription_plan?: string
          updated_at?: string
        }
        Update: {
          api_user_id?: string
          client_user_extra?: number
          client_user_limit?: number
          created_at?: string
          excel_extra?: number
          excel_limit?: number
          holded_external_customers?: boolean
          id?: string
          name?: string
          subscription_plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      pdf_configurations: {
        Row: {
          brand_color: string | null
          company_name: string | null
          created_at: string
          footer_text: string | null
          id: string
          logo_url: string | null
          organization_id: string | null
          selected_template: number
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_color?: string | null
          company_name?: string | null
          created_at?: string
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          organization_id?: string | null
          selected_template?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_color?: string | null
          company_name?: string | null
          created_at?: string
          footer_text?: string | null
          id?: string
          logo_url?: string | null
          organization_id?: string | null
          selected_template?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pdf_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_custom: boolean
          is_global: boolean
          name: string
          organization_id: string | null
          price: number | null
          template_number: number
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_custom?: boolean
          is_global?: boolean
          name: string
          organization_id?: string | null
          price?: number | null
          template_number: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_custom?: boolean
          is_global?: boolean
          name?: string
          organization_id?: string | null
          price?: number | null
          template_number?: number
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_configurations: {
        Row: {
          available_modules: string[] | null
          client_user_limit: number
          created_at: string
          description: string | null
          excel_limit: number
          id: string
          is_active: boolean
          name: string
          plan_id: string
          price: number | null
          updated_at: string
        }
        Insert: {
          available_modules?: string[] | null
          client_user_limit?: number
          created_at?: string
          description?: string | null
          excel_limit?: number
          id?: string
          is_active?: boolean
          name: string
          plan_id: string
          price?: number | null
          updated_at?: string
        }
        Update: {
          available_modules?: string[] | null
          client_user_limit?: number
          created_at?: string
          description?: string | null
          excel_limit?: number
          id?: string
          is_active?: boolean
          name?: string
          plan_id?: string
          price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
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
      production_phases: {
        Row: {
          color: string | null
          created_at: string | null
          display_name: string
          display_order: number
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_name: string
          display_order: number
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_name?: string
          display_order?: number
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      production_tasks: {
        Row: {
          comments: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          operator_id: string
          paused_at: string | null
          phase_id: string
          sales_order_item_id: string
          started_at: string | null
          status: string | null
          task_name: string
          total_time_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          comments?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          operator_id: string
          paused_at?: string | null
          phase_id: string
          sales_order_item_id: string
          started_at?: string | null
          status?: string | null
          task_name: string
          total_time_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          comments?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          operator_id?: string
          paused_at?: string | null
          phase_id?: string
          sales_order_item_id?: string
          started_at?: string | null
          status?: string | null
          task_name?: string
          total_time_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "production_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_tasks_sales_order_item_id_fkey"
            columns: ["sales_order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          custom_colors: Json | null
          first_name: string | null
          id: string
          last_name: string | null
          selected_theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          custom_colors?: Json | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          selected_theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          custom_colors?: Json | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          selected_theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_additionals: {
        Row: {
          additional_id: string | null
          created_at: string
          id: string
          is_discount: boolean
          name: string
          quote_id: string
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          additional_id?: string | null
          created_at?: string
          id?: string
          is_discount?: boolean
          name: string
          quote_id: string
          type?: string
          updated_at?: string
          value?: number
        }
        Update: {
          additional_id?: string | null
          created_at?: string
          id?: string
          is_discount?: boolean
          name?: string
          quote_id?: string
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_additionals_additional_id_fkey"
            columns: ["additional_id"]
            isOneToOne: false
            referencedRelation: "additionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_additionals_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          accepted: boolean | null
          accepted_quantity: number | null
          created_at: string
          description: string | null
          discount_percentage: number | null
          id: string
          item_additionals: Json | null
          multi: Json | null
          name: string | null
          outputs: Json | null
          position: number | null
          price: number
          product_id: string | null
          product_name: string | null
          prompts: Json | null
          quantity: number | null
          quote_id: string
          updated_at: string
        }
        Insert: {
          accepted?: boolean | null
          accepted_quantity?: number | null
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          id?: string
          item_additionals?: Json | null
          multi?: Json | null
          name?: string | null
          outputs?: Json | null
          position?: number | null
          price?: number
          product_id?: string | null
          product_name?: string | null
          prompts?: Json | null
          quantity?: number | null
          quote_id: string
          updated_at?: string
        }
        Update: {
          accepted?: boolean | null
          accepted_quantity?: number | null
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          id?: string
          item_additionals?: Json | null
          multi?: Json | null
          name?: string | null
          outputs?: Json | null
          position?: number | null
          price?: number
          product_id?: string | null
          product_name?: string | null
          prompts?: Json | null
          quantity?: number | null
          quote_id?: string
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
          customer_id: string | null
          description: string | null
          discount_amount: number
          final_price: number
          hide_holded_totals: boolean
          holded_estimate_id: string | null
          holded_estimate_number: string | null
          id: string
          notes: string | null
          product_name: string | null
          quote_additionals: Json | null
          quote_number: string
          selections: Json | null
          status: string
          subtotal: number
          tax_amount: number
          terms_conditions: string | null
          title: string | null
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          description?: string | null
          discount_amount?: number
          final_price?: number
          hide_holded_totals?: boolean
          holded_estimate_id?: string | null
          holded_estimate_number?: string | null
          id?: string
          notes?: string | null
          product_name?: string | null
          quote_additionals?: Json | null
          quote_number: string
          selections?: Json | null
          status?: string
          subtotal?: number
          tax_amount?: number
          terms_conditions?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          description?: string | null
          discount_amount?: number
          final_price?: number
          hide_holded_totals?: boolean
          holded_estimate_id?: string | null
          holded_estimate_number?: string | null
          id?: string
          notes?: string | null
          product_name?: string | null
          quote_additionals?: Json | null
          quote_number?: string
          selections?: Json | null
          status?: string
          subtotal?: number
          tax_amount?: number
          terms_conditions?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      sales_order_additionals: {
        Row: {
          additional_id: string | null
          created_at: string
          id: string
          is_discount: boolean
          name: string
          sales_order_id: string
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          additional_id?: string | null
          created_at?: string
          id?: string
          is_discount?: boolean
          name: string
          sales_order_id: string
          type?: string
          updated_at?: string
          value?: number
        }
        Update: {
          additional_id?: string | null
          created_at?: string
          id?: string
          is_discount?: boolean
          name?: string
          sales_order_id?: string
          type?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_additionals_additional_id_fkey"
            columns: ["additional_id"]
            isOneToOne: false
            referencedRelation: "additionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_additionals_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          multi: Json | null
          outputs: Json | null
          position: number | null
          price: number
          product_id: string | null
          product_name: string
          production_status: string | null
          prompts: Json | null
          quantity: number
          sales_order_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          multi?: Json | null
          outputs?: Json | null
          position?: number | null
          price?: number
          product_id?: string | null
          product_name: string
          production_status?: string | null
          prompts?: Json | null
          quantity?: number
          sales_order_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          multi?: Json | null
          outputs?: Json | null
          position?: number | null
          price?: number
          product_id?: string | null
          product_name?: string
          production_status?: string | null
          prompts?: Json | null
          quantity?: number
          sales_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          created_at: string
          created_from_scratch: boolean
          customer_id: string | null
          delivery_date: string | null
          description: string | null
          discount_amount: number
          final_price: number
          holded_document_id: string | null
          holded_document_number: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          production_progress: Json | null
          quote_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          terms_conditions: string | null
          title: string | null
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_from_scratch?: boolean
          customer_id?: string | null
          delivery_date?: string | null
          description?: string | null
          discount_amount?: number
          final_price?: number
          holded_document_id?: string | null
          holded_document_number?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          production_progress?: Json | null
          quote_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          terms_conditions?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_from_scratch?: boolean
          customer_id?: string | null
          delivery_date?: string | null
          description?: string | null
          discount_amount?: number
          final_price?: number
          holded_document_id?: string | null
          holded_document_number?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          production_progress?: Json | null
          quote_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          terms_conditions?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      woocommerce_product_links: {
        Row: {
          created_at: string
          easyquote_product_id: string
          easyquote_product_name: string
          id: string
          is_linked: boolean
          last_synced_at: string
          organization_id: string
          product_count: number
          updated_at: string
          woo_products: Json
        }
        Insert: {
          created_at?: string
          easyquote_product_id: string
          easyquote_product_name: string
          id?: string
          is_linked?: boolean
          last_synced_at?: string
          organization_id: string
          product_count?: number
          updated_at?: string
          woo_products?: Json
        }
        Update: {
          created_at?: string
          easyquote_product_id?: string
          easyquote_product_name?: string
          id?: string
          is_linked?: boolean
          last_synced_at?: string
          organization_id?: string
          product_count?: number
          updated_at?: string
          woo_products?: Json
        }
        Relationships: [
          {
            foreignKeyName: "woocommerce_product_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization_api_credential: {
        Args: {
          p_api_key: string
          p_api_secret: string
          p_organization_id: string
        }
        Returns: string
      }
      decrypt_credential: { Args: { encrypted_data: string }; Returns: string }
      detect_suspicious_customer_access: {
        Args: { threshold?: number; time_window_minutes?: number }
        Returns: {
          access_count: number
          first_access: string
          last_access: string
          user_id: string
        }[]
      }
      encrypt_credential: { Args: { credential_text: string }; Returns: string }
      generate_api_key: { Args: never; Returns: string }
      generate_api_secret: { Args: never; Returns: string }
      generate_sales_order_number: { Args: never; Returns: string }
      get_current_user_role: {
        Args: never
        Returns: {
          organization_id: string
          organization_name: string
          role: string
          user_id: string
        }[]
      }
      get_customer_audit_trail: {
        Args: { p_customer_id: string; p_limit?: number }
        Returns: {
          accessed_at: string
          id: string
          metadata: Json
          operation: string
          user_id: string
        }[]
      }
      get_organization_api_credentials: {
        Args: { p_organization_id: string }
        Returns: {
          api_key: string
          api_secret: string
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string
          usage_count: number
        }[]
      }
      get_organization_easyquote_credentials: {
        Args: { p_user_id: string }
        Returns: {
          api_password: string
          api_username: string
          created_at: string
          id: string
          updated_at: string
        }[]
      }
      get_user_credentials: {
        Args: { p_user_id: string }
        Returns: {
          api_password: string
          api_username: string
          created_at: string
          id: string
          updated_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_organization_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_organization_owner: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_superadmin: { Args: never; Returns: boolean }
      search_customers: {
        Args: {
          page_limit?: number
          page_offset?: number
          search_term: string
          user_uuid: string
        }
        Returns: {
          created_at: string
          email: string
          holded_id: string
          id: string
          name: string
          phone: string
        }[]
      }
      set_user_credentials: {
        Args: { p_password: string; p_user_id: string; p_username: string }
        Returns: string
      }
      update_last_sequential_number: {
        Args: { p_document_type: string; p_user_id: string }
        Returns: number
      }
      validate_api_key: { Args: { p_api_key: string }; Returns: string }
    }
    Enums: {
      app_role: "superadmin" | "admin" | "comercial" | "operador" | "gestor"
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
      app_role: ["superadmin", "admin", "comercial", "operador", "gestor"],
    },
  },
} as const
