export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      notices: {
        Row: {
          attachment_url: string | null;
          category: string;
          content: string;
          created_at: string;
          created_by: string | null;
          is_pinned: boolean;
          notice_id: string;
          sender_name: string;
          sender_role: string;
          target_audience: string;
          title: string;
        };
        Insert: {
          attachment_url?: string | null;
          category: string;
          content: string;
          created_at?: string;
          created_by?: string | null;
          is_pinned?: boolean;
          notice_id?: string;
          sender_name?: string;
          sender_role?: string;
          target_audience?: string;
          title: string;
        };
        Update: {
          attachment_url?: string | null;
          category?: string;
          content?: string;
          created_at?: string;
          created_by?: string | null;
          is_pinned?: boolean;
          notice_id?: string;
          sender_name?: string;
          sender_role?: string;
          target_audience?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notices_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          designation: string;
          full_name: string;
          id: string;
          role: string;
          student_year: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          designation?: string;
          full_name?: string;
          id: string;
          role?: string;
          student_year?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          designation?: string;
          full_name?: string;
          id?: string;
          role?: string;
          student_year?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      calendar_events: {
        Row: {
          event_id: string;
          title: string;
          description: string | null;
          category: string;
          target_audience: string;
          visibility: string;
          start_at: string;
          end_at: string | null;
          all_day: boolean;
          location: string | null;
          attachment_url: string | null;
          is_pinned: boolean;
          status: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          event_id?: string;
          title: string;
          description?: string | null;
          category?: string;
          target_audience?: string;
          visibility?: string;
          start_at: string;
          end_at?: string | null;
          all_day?: boolean;
          location?: string | null;
          attachment_url?: string | null;
          is_pinned?: boolean;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          event_id?: string;
          title?: string;
          description?: string | null;
          category?: string;
          target_audience?: string;
          visibility?: string;
          start_at?: string;
          end_at?: string | null;
          all_day?: boolean;
          location?: string | null;
          attachment_url?: string | null;
          is_pinned?: boolean;
          status?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      calendar_bookmarks: {
        Row: {
          id: string;
          user_id: string;
          event_id: string | null;
          important_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id?: string | null;
          important_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string | null;
          important_date?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      personal_reminders: {
        Row: {
          reminder_id: string;
          user_id: string;
          event_id: string | null;
          title: string;
          notes: string | null;
          remind_at: string;
          channel: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          reminder_id?: string;
          user_id: string;
          event_id?: string | null;
          title: string;
          notes?: string | null;
          remind_at: string;
          channel?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          reminder_id?: string;
          user_id?: string;
          event_id?: string | null;
          title?: string;
          notes?: string | null;
          remind_at?: string;
          channel?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      google_calendar_connections: {
        Row: {
          user_id: string;
          google_account_email: string | null;
          access_token_enc: string | null;
          refresh_token_enc: string | null;
          token_expiry: string | null;
          scope: string | null;
          sync_token: string | null;
          connected_at: string;
          last_synced_at: string | null;
          status: string;
        };
        Insert: {
          user_id: string;
          google_account_email?: string | null;
          access_token_enc?: string | null;
          refresh_token_enc?: string | null;
          token_expiry?: string | null;
          scope?: string | null;
          sync_token?: string | null;
          connected_at?: string;
          last_synced_at?: string | null;
          status?: string;
        };
        Update: {
          user_id?: string;
          google_account_email?: string | null;
          access_token_enc?: string | null;
          refresh_token_enc?: string | null;
          token_expiry?: string | null;
          scope?: string | null;
          sync_token?: string | null;
          connected_at?: string;
          last_synced_at?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      google_calendar_event_mappings: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          google_event_id: string | null;
          google_calendar_id: string | null;
          sync_status: string;
          retry_count: number;
          last_error: string | null;
          last_error_at: string | null;
          deleted_at: string | null;
          purge_after: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          user_id: string;
          google_event_id?: string | null;
          google_calendar_id?: string | null;
          sync_status?: string;
          retry_count?: number;
          last_error?: string | null;
          last_error_at?: string | null;
          deleted_at?: string | null;
          purge_after?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          event_id?: string;
          user_id?: string;
          google_event_id?: string | null;
          google_calendar_id?: string | null;
          sync_status?: string;
          retry_count?: number;
          last_error?: string | null;
          last_error_at?: string | null;
          deleted_at?: string | null;
          purge_after?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      google_sync_queue: {
        Row: {
          id: string;
          mapping_id: string | null;
          operation: string;
          status: string;
          attempts: number;
          next_retry_at: string;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mapping_id?: string | null;
          operation: string;
          status?: string;
          attempts?: number;
          next_retry_at?: string;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          mapping_id?: string | null;
          operation?: string;
          status?: string;
          attempts?: number;
          next_retry_at?: string;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_deliveries: {
        Row: {
          id: string;
          user_id: string;
          event_id: string | null;
          reminder_id: string | null;
          offset_minutes: number;
          scheduled_for: string;
          channel: string;
          status: string;
          delivered_at: string | null;
          idempotency_key: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id?: string | null;
          reminder_id?: string | null;
          offset_minutes?: number;
          scheduled_for: string;
          channel?: string;
          status?: string;
          delivered_at?: string | null;
          idempotency_key: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string | null;
          reminder_id?: string | null;
          offset_minutes?: number;
          scheduled_for?: string;
          channel?: string;
          status?: string;
          delivered_at?: string | null;
          idempotency_key?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
