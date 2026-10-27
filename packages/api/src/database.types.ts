export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      activities: {
        Row: {
          actor_id: string;
          created_at: string;
          id: string;
          list_id: string | null;
          other_pick_id: string | null;
          pick_id: string | null;
          target_user_id: string | null;
          type: Database['public']['Enums']['activity_type'];
        };
        ComputedFields: never;
        Insert: {
          actor_id: string;
          created_at?: string;
          id?: string;
          list_id?: string | null;
          other_pick_id?: string | null;
          pick_id?: string | null;
          target_user_id?: string | null;
          type: Database['public']['Enums']['activity_type'];
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          id?: string;
          list_id?: string | null;
          other_pick_id?: string | null;
          pick_id?: string | null;
          target_user_id?: string | null;
          type?: Database['public']['Enums']['activity_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'activities_actor_id_fkey';
            columns: ['actor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activities_list_id_fkey';
            columns: ['list_id'];
            isOneToOne: false;
            referencedRelation: 'shared_lists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activities_other_pick_id_fkey';
            columns: ['other_pick_id'];
            isOneToOne: false;
            referencedRelation: 'picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activities_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'activities_target_user_id_fkey';
            columns: ['target_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      blocks: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        ComputedFields: never;
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'blocks_blocked_id_fkey';
            columns: ['blocked_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'blocks_blocker_id_fkey';
            columns: ['blocker_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      cities: {
        Row: {
          ascii_name: string;
          country: string;
          country_name: string;
          geoname_id: number;
          id: string;
          location: unknown;
          name: string;
          population: number;
          region_code: string | null;
          region_name: string | null;
          city_label: string | null;
        };
        ComputedFields: 'city_label';
        Insert: {
          ascii_name: string;
          country: string;
          country_name: string;
          geoname_id: number;
          id?: string;
          location: unknown;
          name: string;
          population?: number;
          region_code?: string | null;
          region_name?: string | null;
        };
        Update: {
          ascii_name?: string;
          country?: string;
          country_name?: string;
          geoname_id?: number;
          id?: string;
          location?: unknown;
          name?: string;
          population?: number;
          region_code?: string | null;
          region_name?: string | null;
        };
        Relationships: [];
      };
      device_attestations: {
        Row: {
          checked_at: string;
          created_at: string;
          id: string;
          platform: string;
          result: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          checked_at?: string;
          created_at?: string;
          id?: string;
          platform: string;
          result?: string | null;
          user_id: string;
        };
        Update: {
          checked_at?: string;
          created_at?: string;
          id?: string;
          platform?: string;
          result?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'device_attestations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      dishes: {
        Row: {
          created_at: string;
          id: string;
          merged_into_id: string | null;
          name: string;
          name_key: string;
          place_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          merged_into_id?: string | null;
          name: string;
          name_key: string;
          place_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          merged_into_id?: string | null;
          name?: string;
          name_key?: string;
          place_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dishes_merged_into_id_fkey';
            columns: ['merged_into_id'];
            isOneToOne: false;
            referencedRelation: 'dish_stats';
            referencedColumns: ['dish_id'];
          },
          {
            foreignKeyName: 'dishes_merged_into_id_fkey';
            columns: ['merged_into_id'];
            isOneToOne: false;
            referencedRelation: 'dishes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dishes_place_id_fkey';
            columns: ['place_id'];
            isOneToOne: false;
            referencedRelation: 'places';
            referencedColumns: ['id'];
          },
        ];
      };
      follows: {
        Row: {
          created_at: string;
          followee_id: string;
          follower_id: string;
          status: Database['public']['Enums']['follow_status'];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          followee_id: string;
          follower_id: string;
          status?: Database['public']['Enums']['follow_status'];
        };
        Update: {
          created_at?: string;
          followee_id?: string;
          follower_id?: string;
          status?: Database['public']['Enums']['follow_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'follows_followee_id_fkey';
            columns: ['followee_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'follows_follower_id_fkey';
            columns: ['follower_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          activity_id: string;
          created_at: string;
          id: string;
          read_at: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          activity_id: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          user_id: string;
        };
        Update: {
          activity_id?: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_activity_id_fkey';
            columns: ['activity_id'];
            isOneToOne: false;
            referencedRelation: 'activities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      pick_tags: {
        Row: {
          created_at: string;
          pick_id: string;
          tag_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          pick_id: string;
          tag_id: string;
        };
        Update: {
          created_at?: string;
          pick_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pick_tags_pick_id_fkey';
            columns: ['pick_id'];
            isOneToOne: false;
            referencedRelation: 'picks';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pick_tags_tag_id_fkey';
            columns: ['tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
        ];
      };
      picks: {
        Row: {
          created_at: string;
          dish_id: string;
          id: string;
          note: string | null;
          original_dish_name: string;
          photo_path: string | null;
          slot: number | null;
          tier: Database['public']['Enums']['pick_tier'];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          dish_id: string;
          id?: string;
          note?: string | null;
          original_dish_name: string;
          photo_path?: string | null;
          slot?: number | null;
          tier: Database['public']['Enums']['pick_tier'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          dish_id?: string;
          id?: string;
          note?: string | null;
          original_dish_name?: string;
          photo_path?: string | null;
          slot?: number | null;
          tier?: Database['public']['Enums']['pick_tier'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'picks_dish_id_fkey';
            columns: ['dish_id'];
            isOneToOne: false;
            referencedRelation: 'dish_stats';
            referencedColumns: ['dish_id'];
          },
          {
            foreignKeyName: 'picks_dish_id_fkey';
            columns: ['dish_id'];
            isOneToOne: false;
            referencedRelation: 'dishes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'picks_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      places: {
        Row: {
          address: string | null;
          area: string | null;
          category_ids: string[];
          category_labels: string[];
          city: string;
          closed_at: string | null;
          country: string;
          created_at: string;
          created_by: string | null;
          id: string;
          location: unknown;
          merged_into_id: string | null;
          name: string;
          no_fixed_address: boolean;
          postcode: string | null;
          region: string | null;
          search_key: string | null;
          source: Database['public']['Enums']['place_source'];
          source_id: string | null;
          updated_at: string;
          mask_place: {
            address: string | null;
            area: string | null;
            category_ids: string[];
            category_labels: string[];
            city: string;
            closed_at: string | null;
            country: string;
            created_at: string;
            created_by: string | null;
            id: string;
            location: unknown;
            merged_into_id: string | null;
            name: string;
            no_fixed_address: boolean;
            postcode: string | null;
            region: string | null;
            search_key: string | null;
            source: Database['public']['Enums']['place_source'];
            source_id: string | null;
            updated_at: string;
          } | null;
        };
        ComputedFields: 'mask_place';
        Insert: {
          address?: string | null;
          area?: string | null;
          category_ids?: string[];
          category_labels?: string[];
          city: string;
          closed_at?: string | null;
          country: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location: unknown;
          merged_into_id?: string | null;
          name: string;
          no_fixed_address?: boolean;
          postcode?: string | null;
          region?: string | null;
          search_key?: never;
          source: Database['public']['Enums']['place_source'];
          source_id?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          area?: string | null;
          category_ids?: string[];
          category_labels?: string[];
          city?: string;
          closed_at?: string | null;
          country?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          location?: unknown;
          merged_into_id?: string | null;
          name?: string;
          no_fixed_address?: boolean;
          postcode?: string | null;
          region?: string | null;
          search_key?: never;
          source?: Database['public']['Enums']['place_source'];
          source_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'places_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'places_merged_into_id_fkey';
            columns: ['merged_into_id'];
            isOneToOne: false;
            referencedRelation: 'places';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          affiliation_note: string | null;
          avatar_path: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          home_city_id: string | null;
          home_location: unknown;
          home_place_text: string | null;
          id: string;
          is_business_affiliated: boolean;
          onboarded_at: string | null;
          show_home_city: boolean;
          trust_level: Database['public']['Enums']['trust_level'];
          updated_at: string;
          username: string;
          visibility: Database['public']['Enums']['profile_visibility'];
        };
        ComputedFields: never;
        Insert: {
          affiliation_note?: string | null;
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          home_city_id?: string | null;
          home_location?: unknown;
          home_place_text?: string | null;
          id: string;
          is_business_affiliated?: boolean;
          onboarded_at?: string | null;
          show_home_city?: boolean;
          trust_level?: Database['public']['Enums']['trust_level'];
          updated_at?: string;
          username: string;
          visibility?: Database['public']['Enums']['profile_visibility'];
        };
        Update: {
          affiliation_note?: string | null;
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          home_city_id?: string | null;
          home_location?: unknown;
          home_place_text?: string | null;
          id?: string;
          is_business_affiliated?: boolean;
          onboarded_at?: string | null;
          show_home_city?: boolean;
          trust_level?: Database['public']['Enums']['trust_level'];
          updated_at?: string;
          username?: string;
          visibility?: Database['public']['Enums']['profile_visibility'];
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_home_city_id_fkey';
            columns: ['home_city_id'];
            isOneToOne: false;
            referencedRelation: 'cities';
            referencedColumns: ['id'];
          },
        ];
      };
      push_tokens: {
        Row: {
          created_at: string;
          expo_token: string;
          id: string;
          platform: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          expo_token: string;
          id?: string;
          platform?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expo_token?: string;
          id?: string;
          platform?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'push_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          id: string;
          reason: string;
          reporter_id: string;
          status: Database['public']['Enums']['report_status'];
          target_id: string;
          target_type: Database['public']['Enums']['report_target'];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          reason: string;
          reporter_id: string;
          status?: Database['public']['Enums']['report_status'];
          target_id: string;
          target_type: Database['public']['Enums']['report_target'];
        };
        Update: {
          created_at?: string;
          id?: string;
          reason?: string;
          reporter_id?: string;
          status?: Database['public']['Enums']['report_status'];
          target_id?: string;
          target_type?: Database['public']['Enums']['report_target'];
        };
        Relationships: [
          {
            foreignKeyName: 'reports_reporter_id_fkey';
            columns: ['reporter_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      saves: {
        Row: {
          created_at: string;
          dish_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          dish_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          dish_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'saves_dish_id_fkey';
            columns: ['dish_id'];
            isOneToOne: false;
            referencedRelation: 'dish_stats';
            referencedColumns: ['dish_id'];
          },
          {
            foreignKeyName: 'saves_dish_id_fkey';
            columns: ['dish_id'];
            isOneToOne: false;
            referencedRelation: 'dishes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saves_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      shared_lists: {
        Row: {
          created_at: string;
          filter: NonNullable<Json>;
          id: string;
          is_active: boolean;
          note: string | null;
          owner_id: string;
          slug: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          filter?: NonNullable<Json>;
          id?: string;
          is_active?: boolean;
          note?: string | null;
          owner_id: string;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          filter?: NonNullable<Json>;
          id?: string;
          is_active?: boolean;
          note?: string | null;
          owner_id?: string;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'shared_lists_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      tags: {
        Row: {
          aliases: string[];
          created_at: string;
          display_order: number | null;
          id: string;
          is_featured: boolean;
          kind: Database['public']['Enums']['tag_kind'];
          name: string;
          owner_id: string | null;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          aliases?: string[];
          created_at?: string;
          display_order?: number | null;
          id?: string;
          is_featured?: boolean;
          kind: Database['public']['Enums']['tag_kind'];
          name: string;
          owner_id?: string | null;
          slug: string;
        };
        Update: {
          aliases?: string[];
          created_at?: string;
          display_order?: number | null;
          id?: string;
          is_featured?: boolean;
          kind?: Database['public']['Enums']['tag_kind'];
          name?: string;
          owner_id?: string | null;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tags_owner_id_fkey';
            columns: ['owner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      dish_stats: {
        Row: {
          dish_id: string | null;
          final_count: number | null;
          honorable_count: number | null;
          list_count: number | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      _begin_pick_write: { Args: Record<PropertyKey, never>; Returns: string };
      _check_pick_photo: { Args: { p_path: string; p_uid: string }; Returns: undefined };
      _claim_final_slot: {
        Args: { p_replace_slot: number; p_uid: string };
        Returns: Record<string, unknown>;
      };
      _close_slot_gap: { Args: { p_slot: number; p_uid: string }; Returns: undefined };
      _own_pick: {
        Args: { p_pick_id: string; p_uid: string };
        Returns: {
          created_at: string;
          dish_id: string;
          id: string;
          note: string | null;
          original_dish_name: string;
          photo_path: string | null;
          slot: number | null;
          tier: Database['public']['Enums']['pick_tier'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'picks';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      _resolve_dish: {
        Args: { p_dish_id: string; p_dish_name: string; p_place_id: string };
        Returns: string;
      };
      _set_pick_tags: {
        Args: { p_personal_tags: string[]; p_pick_id: string; p_tag_ids: string[] };
        Returns: undefined;
      };
      add_pick: {
        Args: {
          p_dish_id: string;
          p_dish_name: string;
          p_note?: string;
          p_personal_tags?: string[];
          p_photo_path?: string;
          p_place_id: string;
          p_replace_slot?: number;
          p_tag_ids?: string[];
          p_tier: Database['public']['Enums']['pick_tier'];
        };
        Returns: {
          created_at: string;
          dish_id: string;
          id: string;
          note: string | null;
          original_dish_name: string;
          photo_path: string | null;
          slot: number | null;
          tier: Database['public']['Enums']['pick_tier'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'picks';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      apply_tag_vocabulary: { Args: Record<PropertyKey, never>; Returns: undefined };
      city_fold: { Args: { input: string }; Returns: string };
      city_label: {
        Args: {
          c: Omit<
            Database['public']['Tables']['cities']['Row'],
            Database['public']['Tables']['cities']['ComputedFields']
          >;
        };
        Returns: string;
      };
      create_custom_place: {
        Args: {
          p_address?: string;
          p_city_id: string;
          p_name: string;
          p_no_fixed_address?: boolean;
        };
        Returns: {
          address: string | null;
          area: string | null;
          category_ids: string[];
          category_labels: string[];
          city: string;
          closed_at: string | null;
          country: string;
          created_at: string;
          created_by: string | null;
          id: string;
          location: unknown;
          merged_into_id: string | null;
          name: string;
          no_fixed_address: boolean;
          postcode: string | null;
          region: string | null;
          search_key: string | null;
          source: Database['public']['Enums']['place_source'];
          source_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'places';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_my_profile: {
        Args: { p_display_name: string; p_username: string };
        Returns: {
          affiliation_note: string | null;
          avatar_path: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          home_city_id: string | null;
          home_location: unknown;
          home_place_text: string | null;
          id: string;
          is_business_affiliated: boolean;
          onboarded_at: string | null;
          show_home_city: boolean;
          trust_level: Database['public']['Enums']['trust_level'];
          updated_at: string;
          username: string;
          visibility: Database['public']['Enums']['profile_visibility'];
        };
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_personal_tag: {
        Args: { p_name: string };
        Returns: {
          aliases: string[];
          created_at: string;
          display_order: number | null;
          id: string;
          is_featured: boolean;
          kind: Database['public']['Enums']['tag_kind'];
          name: string;
          owner_id: string | null;
          slug: string;
        };
        SetofOptions: {
          from: '*';
          to: 'tags';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      demote_pick: {
        Args: { p_pick_id: string };
        Returns: {
          created_at: string;
          dish_id: string;
          id: string;
          note: string | null;
          original_dish_name: string;
          photo_path: string | null;
          slot: number | null;
          tier: Database['public']['Enums']['pick_tier'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'picks';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      finish_onboarding: {
        Args: Record<PropertyKey, never>;
        Returns: {
          affiliation_note: string | null;
          avatar_path: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          home_city_id: string | null;
          home_location: unknown;
          home_place_text: string | null;
          id: string;
          is_business_affiliated: boolean;
          onboarded_at: string | null;
          show_home_city: boolean;
          trust_level: Database['public']['Enums']['trust_level'];
          updated_at: string;
          username: string;
          visibility: Database['public']['Enums']['profile_visibility'];
        };
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_place: {
        Args: { p_id: string };
        Returns: {
          address: string | null;
          area: string | null;
          category_ids: string[];
          category_labels: string[];
          city: string;
          closed_at: string | null;
          country: string;
          created_at: string;
          created_by: string | null;
          id: string;
          location: unknown;
          merged_into_id: string | null;
          name: string;
          no_fixed_address: boolean;
          postcode: string | null;
          region: string | null;
          search_key: string | null;
          source: Database['public']['Enums']['place_source'];
          source_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: '*';
          to: 'places';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      is_username_available: { Args: { p_username: string }; Returns: boolean };
      mask_place: {
        Args: {
          p: Omit<
            Database['public']['Tables']['places']['Row'],
            Database['public']['Tables']['places']['ComputedFields']
          >;
        };
        Returns: {
          address: string | null;
          area: string | null;
          category_ids: string[];
          category_labels: string[];
          city: string;
          closed_at: string | null;
          country: string;
          created_at: string;
          created_by: string | null;
          id: string;
          location: unknown;
          merged_into_id: string | null;
          name: string;
          no_fixed_address: boolean;
          postcode: string | null;
          region: string | null;
          search_key: string | null;
          source: Database['public']['Enums']['place_source'];
          source_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: 'places';
          to: 'places';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      move_final: {
        Args: { p_pick_id: string; p_to_slot: number };
        Returns: {
          created_at: string;
          dish_id: string;
          id: string;
          note: string | null;
          original_dish_name: string;
          photo_path: string | null;
          slot: number | null;
          tier: Database['public']['Enums']['pick_tier'];
          updated_at: string;
          user_id: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'picks';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      nearest_city: {
        Args: { lat: number; lng: number };
        Returns: {
          ascii_name: string;
          country: string;
          country_name: string;
          geoname_id: number;
          id: string;
          location: unknown;
          name: string;
          population: number;
          region_code: string | null;
          region_name: string | null;
        };
        SetofOptions: {
          from: '*';
          to: 'cities';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      normalize_dish_name: { Args: { input: string }; Returns: string };
      place_search_key: { Args: { input: string }; Returns: string };
      popular_tags: {
        Args: { p_kind: Database['public']['Enums']['tag_kind'] };
        Returns: {
          aliases: string[];
          created_at: string;
          display_order: number | null;
          id: string;
          is_featured: boolean;
          kind: Database['public']['Enums']['tag_kind'];
          name: string;
          owner_id: string | null;
          slug: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'tags';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      promote_pick: {
        Args: { p_pick_id: string; p_replace_slot?: number };
        Returns: {
          created_at: string;
          dish_id: string;
          id: string;
          note: string | null;
          original_dish_name: string;
          photo_path: string | null;
          slot: number | null;
          tier: Database['public']['Enums']['pick_tier'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'picks';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      remove_pick: { Args: { p_pick_id: string }; Returns: undefined };
      search_cities: {
        Args: { lim?: number; q: string };
        Returns: {
          ascii_name: string;
          country: string;
          country_name: string;
          geoname_id: number;
          id: string;
          location: unknown;
          name: string;
          population: number;
          region_code: string | null;
          region_name: string | null;
        }[];
        SetofOptions: {
          from: '*';
          to: 'cities';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      search_places: {
        Args: { p_lat?: number; p_lim?: number; p_lng?: number; p_q: string };
        Returns: {
          distance_m: number;
          place: Database['public']['Tables']['places']['Row'];
        }[];
      };
      search_tags: {
        Args: { p_kind: Database['public']['Enums']['tag_kind']; p_lim?: number; p_q: string };
        Returns: {
          aliases: string[];
          created_at: string;
          display_order: number | null;
          id: string;
          is_featured: boolean;
          kind: Database['public']['Enums']['tag_kind'];
          name: string;
          owner_id: string | null;
          slug: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'tags';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      set_my_home_city: {
        Args: { p_city_id: string };
        Returns: {
          affiliation_note: string | null;
          avatar_path: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          home_city_id: string | null;
          home_location: unknown;
          home_place_text: string | null;
          id: string;
          is_business_affiliated: boolean;
          onboarded_at: string | null;
          show_home_city: boolean;
          trust_level: Database['public']['Enums']['trust_level'];
          updated_at: string;
          username: string;
          visibility: Database['public']['Enums']['profile_visibility'];
        };
        SetofOptions: {
          from: '*';
          to: 'profiles';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      suggest_dishes: {
        Args: { p_lim?: number; p_place_id: string; p_q: string };
        Returns: {
          dish: Database['public']['Tables']['dishes']['Row'];
          pick_count: number;
        }[];
      };
      tag_slug: { Args: { input: string }; Returns: string };
      update_pick: {
        Args: {
          p_note: string;
          p_personal_tags: string[];
          p_photo_path: string;
          p_pick_id: string;
          p_tag_ids: string[];
        };
        Returns: {
          created_at: string;
          dish_id: string;
          id: string;
          note: string | null;
          original_dish_name: string;
          photo_path: string | null;
          slot: number | null;
          tier: Database['public']['Enums']['pick_tier'];
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: '*';
          to: 'picks';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      activity_type:
        | 'added_final'
        | 'added_honorable'
        | 'dethroned'
        | 'promoted'
        | 'followed'
        | 'saved_pick'
        | 'saved_from_list';
      follow_status: 'active' | 'requested';
      pick_tier: 'final' | 'honorable';
      place_source: 'fsq' | 'custom';
      profile_visibility: 'public' | 'private';
      report_status: 'open' | 'actioned' | 'dismissed';
      report_target: 'pick' | 'profile' | 'list' | 'place';
      tag_kind: 'food_type' | 'dietary' | 'personal';
      trust_level: 'new' | 'trusted' | 'flagged';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_type: [
        'added_final',
        'added_honorable',
        'dethroned',
        'promoted',
        'followed',
        'saved_pick',
        'saved_from_list',
      ],
      follow_status: ['active', 'requested'],
      pick_tier: ['final', 'honorable'],
      place_source: ['fsq', 'custom'],
      profile_visibility: ['public', 'private'],
      report_status: ['open', 'actioned', 'dismissed'],
      report_target: ['pick', 'profile', 'list', 'place'],
      tag_kind: ['food_type', 'dietary', 'personal'],
      trust_level: ['new', 'trusted', 'flagged'],
    },
  },
} as const;
