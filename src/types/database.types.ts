
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "categories": {
                  Row: {
                    "connection_id": string | null,"created_at": string,"icon": string | null,"id": string,"name": string,"owner_id": string | null,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "connection_id"?: string | null,"created_at"?: string,"icon"?: string | null,"id"?: string,"name": string,"owner_id"?: string | null,"type": string
                  }
                  Update: {
                    "connection_id"?: string | null,"created_at"?: string,"icon"?: string | null,"id"?: string,"name"?: string,"owner_id"?: string | null,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "categories_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"connection_invitations": {
                  Row: {
                    "created_at": string,"id": string,"invitee_id": string,"inviter_id": string,"responded_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"invitee_id": string,"inviter_id": string,"responded_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"invitee_id"?: string,"inviter_id"?: string,"responded_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "connection_invitations_invitee_id_fkey"
      columns: ["invitee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connection_invitations_inviter_id_fkey"
      columns: ["inviter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"connection_members": {
                  Row: {
                    "connection_id": string,"joined_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "connection_id": string,"joined_at"?: string,"user_id": string
                  }
                  Update: {
                    "connection_id"?: string,"joined_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "connection_members_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connection_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"connections": {
                  Row: {
                    "created_at": string,"id": string,"monthly_spending_goal": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"monthly_spending_goal"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"monthly_spending_goal"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"event_exceptions": {
                  Row: {
                    "cancelled": boolean,"created_at": string,"id": string,"modified_event_id": string | null,"occurrence_date": string,"parent_event_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled"?: boolean,"created_at"?: string,"id"?: string,"modified_event_id"?: string | null,"occurrence_date": string,"parent_event_id": string
                  }
                  Update: {
                    "cancelled"?: boolean,"created_at"?: string,"id"?: string,"modified_event_id"?: string | null,"occurrence_date"?: string,"parent_event_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_exceptions_modified_event_id_fkey"
      columns: ["modified_event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_exceptions_parent_event_id_fkey"
      columns: ["parent_event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "all_day": boolean,"companions": string | null,"connection_id": string | null,"created_at": string,"created_by": string,"end_at": string | null,"id": string,"location": string | null,"owner_id": string,"recurrence_count": number | null,"recurrence_end_type": string | null,"recurrence_freq": string | null,"recurrence_interval": number,"recurrence_until": string | null,"start_at": string,"title": string,"updated_at": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "all_day"?: boolean,"companions"?: string | null,"connection_id"?: string | null,"created_at"?: string,"created_by": string,"end_at"?: string | null,"id"?: string,"location"?: string | null,"owner_id": string,"recurrence_count"?: number | null,"recurrence_end_type"?: string | null,"recurrence_freq"?: string | null,"recurrence_interval"?: number,"recurrence_until"?: string | null,"start_at": string,"title": string,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "all_day"?: boolean,"companions"?: string | null,"connection_id"?: string | null,"created_at"?: string,"created_by"?: string,"end_at"?: string | null,"id"?: string,"location"?: string | null,"owner_id"?: string,"recurrence_count"?: number | null,"recurrence_end_type"?: string | null,"recurrence_freq"?: string | null,"recurrence_interval"?: number,"recurrence_until"?: string | null,"start_at"?: string,"title"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_method_milestone_log": {
                  Row: {
                    "notified_at": string,"payment_method_id": string,"threshold": number,"year_month": string
                  }
                  ComputedFields: never
                  Insert: {
                    "notified_at"?: string,"payment_method_id": string,"threshold": number,"year_month": string
                  }
                  Update: {
                    "notified_at"?: string,"payment_method_id"?: string,"threshold"?: number,"year_month"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_method_milestone_log_payment_method_id_fkey"
      columns: ["payment_method_id"]
isOneToOne: false
      referencedRelation: "payment_methods"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_methods": {
                  Row: {
                    "created_at": string,"icon": string | null,"id": string,"monthly_goal": number | null,"name": string,"owner_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"icon"?: string | null,"id"?: string,"monthly_goal"?: number | null,"name": string,"owner_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"icon"?: string | null,"id"?: string,"monthly_goal"?: number | null,"name"?: string,"owner_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_methods_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "brand_color": string,"created_at": string,"daily_digest_enabled": boolean,"display_name": string,"email": string,"id": string,"locale": string,"telegram_chat_id": string | null,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand_color"?: string,"created_at"?: string,"daily_digest_enabled"?: boolean,"display_name"?: string,"email": string,"id": string,"locale"?: string,"telegram_chat_id"?: string | null,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "brand_color"?: string,"created_at"?: string,"daily_digest_enabled"?: boolean,"display_name"?: string,"email"?: string,"id"?: string,"locale"?: string,"telegram_chat_id"?: string | null,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"signup_verifications": {
                  Row: {
                    "attempts": number,"created_at": string,"last_sent_at": string | null,"link_expires_at": string,"otp_expires_at": string | null,"otp_hash": string | null,"telegram_chat_id": string | null,"token": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"last_sent_at"?: string | null,"link_expires_at": string,"otp_expires_at"?: string | null,"otp_hash"?: string | null,"telegram_chat_id"?: string | null,"token": string,"user_id": string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"last_sent_at"?: string | null,"link_expires_at"?: string,"otp_expires_at"?: string | null,"otp_hash"?: string | null,"telegram_chat_id"?: string | null,"token"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"telegram_link_codes": {
                  Row: {
                    "code": string,"created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"user_id": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "telegram_link_codes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"transactions": {
                  Row: {
                    "amount": number,"category_id": string,"connection_id": string | null,"created_at": string,"created_by": string,"id": string,"memo": string | null,"occurred_at": string,"owner_id": string,"payment_method_id": string | null,"type": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category_id": string,"connection_id"?: string | null,"created_at"?: string,"created_by": string,"id"?: string,"memo"?: string | null,"occurred_at"?: string,"owner_id": string,"payment_method_id"?: string | null,"type": string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"category_id"?: string,"connection_id"?: string | null,"created_at"?: string,"created_by"?: string,"id"?: string,"memo"?: string | null,"occurred_at"?: string,"owner_id"?: string,"payment_method_id"?: string | null,"type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "transactions_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_connection_id_fkey"
      columns: ["connection_id"]
isOneToOne: false
      referencedRelation: "connections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "transactions_payment_method_id_fkey"
      columns: ["payment_method_id"]
isOneToOne: false
      referencedRelation: "payment_methods"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_connection_invitation":
{ Args: { "target_invitation_id": string }; Returns: string
                           },
"is_connection_member":
{ Args: { "target_connection_id": string }; Returns: boolean
                           },
"prepare_account_deletion":
{ Args: { "target_user_id": string }; Returns: undefined
                           },
"search_profile_by_email":
{ Args: { "target_email": string }; Returns: {
              "display_name": string,"id": string
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
