
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
            "activities": {
                  Row: {
                    "actor_id": string,"created_at": string,"id": string,"list_id": string | null,"other_pick_id": string | null,"pick_id": string | null,"target_user_id": string | null,"type": Database["public"]['Enums']["activity_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id": string,"created_at"?: string,"id"?: string,"list_id"?: string | null,"other_pick_id"?: string | null,"pick_id"?: string | null,"target_user_id"?: string | null,"type": Database["public"]['Enums']["activity_type"]
                  }
                  Update: {
                    "actor_id"?: string,"created_at"?: string,"id"?: string,"list_id"?: string | null,"other_pick_id"?: string | null,"pick_id"?: string | null,"target_user_id"?: string | null,"type"?: Database["public"]['Enums']["activity_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "activities_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "shared_lists"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_other_pick_id_fkey"
      columns: ["other_pick_id"]
isOneToOne: false
      referencedRelation: "picks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_pick_id_fkey"
      columns: ["pick_id"]
isOneToOne: false
      referencedRelation: "picks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_target_user_id_fkey"
      columns: ["target_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"device_attestations": {
                  Row: {
                    "checked_at": string,"created_at": string,"id": string,"platform": string,"result": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_at"?: string,"created_at"?: string,"id"?: string,"platform": string,"result"?: string | null,"user_id": string
                  }
                  Update: {
                    "checked_at"?: string,"created_at"?: string,"id"?: string,"platform"?: string,"result"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "device_attestations_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"dishes": {
                  Row: {
                    "created_at": string,"id": string,"merged_into_id": string | null,"name": string,"name_key": string,"place_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"merged_into_id"?: string | null,"name": string,"name_key": string,"place_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"merged_into_id"?: string | null,"name"?: string,"name_key"?: string,"place_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dishes_merged_into_id_fkey"
      columns: ["merged_into_id"]
isOneToOne: false
      referencedRelation: "dishes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dishes_place_id_fkey"
      columns: ["place_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    }
                  ]
                },"follows": {
                  Row: {
                    "created_at": string,"followee_id": string,"follower_id": string,"status": Database["public"]['Enums']["follow_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"followee_id": string,"follower_id": string,"status"?: Database["public"]['Enums']["follow_status"]
                  }
                  Update: {
                    "created_at"?: string,"followee_id"?: string,"follower_id"?: string,"status"?: Database["public"]['Enums']["follow_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "follows_followee_id_fkey"
      columns: ["followee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_follower_id_fkey"
      columns: ["follower_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "activity_id": string,"created_at": string,"id": string,"read_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_id": string,"created_at"?: string,"id"?: string,"read_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "activity_id"?: string,"created_at"?: string,"id"?: string,"read_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_activity_id_fkey"
      columns: ["activity_id"]
isOneToOne: false
      referencedRelation: "activities"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"pick_tags": {
                  Row: {
                    "created_at": string,"pick_id": string,"tag_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"pick_id": string,"tag_id": string
                  }
                  Update: {
                    "created_at"?: string,"pick_id"?: string,"tag_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pick_tags_pick_id_fkey"
      columns: ["pick_id"]
isOneToOne: false
      referencedRelation: "picks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pick_tags_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id"]
    }
                  ]
                },"picks": {
                  Row: {
                    "created_at": string,"dish_id": string,"id": string,"note": string | null,"original_dish_name": string,"photo_path": string | null,"slot": number | null,"tier": Database["public"]['Enums']["pick_tier"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dish_id": string,"id"?: string,"note"?: string | null,"original_dish_name": string,"photo_path"?: string | null,"slot"?: number | null,"tier": Database["public"]['Enums']["pick_tier"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"dish_id"?: string,"id"?: string,"note"?: string | null,"original_dish_name"?: string,"photo_path"?: string | null,"slot"?: number | null,"tier"?: Database["public"]['Enums']["pick_tier"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "picks_dish_id_fkey"
      columns: ["dish_id"]
isOneToOne: false
      referencedRelation: "dishes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "picks_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"places": {
                  Row: {
                    "area": string | null,"category_ids": (string)[],"city": string,"country": string,"created_at": string,"created_by": string | null,"id": string,"location": unknown,"merged_into_id": string | null,"name": string,"region": string | null,"source": Database["public"]['Enums']["place_source"],"source_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area"?: string | null,"category_ids"?: (string)[],"city": string,"country": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"location": unknown,"merged_into_id"?: string | null,"name": string,"region"?: string | null,"source": Database["public"]['Enums']["place_source"],"source_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "area"?: string | null,"category_ids"?: (string)[],"city"?: string,"country"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"location"?: unknown,"merged_into_id"?: string | null,"name"?: string,"region"?: string | null,"source"?: Database["public"]['Enums']["place_source"],"source_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "places_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "places_merged_into_id_fkey"
      columns: ["merged_into_id"]
isOneToOne: false
      referencedRelation: "places"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "affiliation_note": string | null,"avatar_path": string | null,"bio": string | null,"created_at": string,"display_name": string,"home_location": unknown,"home_place_text": string | null,"id": string,"is_business_affiliated": boolean,"trust_level": Database["public"]['Enums']["trust_level"],"updated_at": string,"username": string,"visibility": Database["public"]['Enums']["profile_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "affiliation_note"?: string | null,"avatar_path"?: string | null,"bio"?: string | null,"created_at"?: string,"display_name": string,"home_location"?: unknown,"home_place_text"?: string | null,"id": string,"is_business_affiliated"?: boolean,"trust_level"?: Database["public"]['Enums']["trust_level"],"updated_at"?: string,"username": string,"visibility"?: Database["public"]['Enums']["profile_visibility"]
                  }
                  Update: {
                    "affiliation_note"?: string | null,"avatar_path"?: string | null,"bio"?: string | null,"created_at"?: string,"display_name"?: string,"home_location"?: unknown,"home_place_text"?: string | null,"id"?: string,"is_business_affiliated"?: boolean,"trust_level"?: Database["public"]['Enums']["trust_level"],"updated_at"?: string,"username"?: string,"visibility"?: Database["public"]['Enums']["profile_visibility"]
                  }
                  Relationships: [
                    
                  ]
                },"push_tokens": {
                  Row: {
                    "created_at": string,"expo_token": string,"id": string,"platform": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expo_token": string,"id"?: string,"platform"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"expo_token"?: string,"id"?: string,"platform"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"id": string,"reason": string,"reporter_id": string,"status": Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"reason": string,"reporter_id": string,"status"?: Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"reason"?: string,"reporter_id"?: string,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string,"target_type"?: Database["public"]['Enums']["report_target"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"saves": {
                  Row: {
                    "created_at": string,"dish_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dish_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"dish_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saves_dish_id_fkey"
      columns: ["dish_id"]
isOneToOne: false
      referencedRelation: "dishes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saves_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"shared_lists": {
                  Row: {
                    "created_at": string,"filter": NonNullable<Json>,"id": string,"is_active": boolean,"note": string | null,"owner_id": string,"slug": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"filter"?: NonNullable<Json>,"id"?: string,"is_active"?: boolean,"note"?: string | null,"owner_id": string,"slug": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"filter"?: NonNullable<Json>,"id"?: string,"is_active"?: boolean,"note"?: string | null,"owner_id"?: string,"slug"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shared_lists_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tags": {
                  Row: {
                    "created_at": string,"id": string,"is_featured": boolean,"kind": Database["public"]['Enums']["tag_kind"],"name": string,"owner_id": string | null,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_featured"?: boolean,"kind": Database["public"]['Enums']["tag_kind"],"name": string,"owner_id"?: string | null,"slug": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_featured"?: boolean,"kind"?: Database["public"]['Enums']["tag_kind"],"name"?: string,"owner_id"?: string | null,"slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tags_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "normalize_dish_name":
{ Args: { "input": string }; Returns: string
                           }
          }
          Enums: {
            "activity_type": "added_final"|"added_honorable"|"dethroned"|"promoted"|"followed"|"saved_pick"|"saved_from_list","follow_status": "active"|"requested","pick_tier": "final"|"honorable","place_source": "fsq"|"custom","profile_visibility": "public"|"private","report_status": "open"|"actioned"|"dismissed","report_target": "pick"|"profile"|"list"|"place","tag_kind": "food_type"|"dietary"|"personal","trust_level": "new"|"trusted"|"flagged"
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
            "activity_type": ["added_final", "added_honorable", "dethroned", "promoted", "followed", "saved_pick", "saved_from_list"],"follow_status": ["active", "requested"],"pick_tier": ["final", "honorable"],"place_source": ["fsq", "custom"],"profile_visibility": ["public", "private"],"report_status": ["open", "actioned", "dismissed"],"report_target": ["pick", "profile", "list", "place"],"tag_kind": ["food_type", "dietary", "personal"],"trust_level": ["new", "trusted", "flagged"]
          }
        }
} as const
