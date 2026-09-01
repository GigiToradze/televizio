export type CategoryRow = {
  slug: string; name_ka: string; name_en: string; sort_order: number;
};

export type ChannelRow = {
  slug: string; name_ka: string; name_en: string;
  logo_path: string | null; logo_w: number | null; logo_h: number | null;
  sort_order: number; in_slider: boolean; slider_order: number;
  cats: string[];    // ordered — the first is the card's tag
  plans: string[];
};

export type PlanRow = {
  slug: string; name_ka: string; name_en: string;
  price: number; currency: string; period_ka: string; period_en: string;
  badge_ka: string | null; badge_en: string | null;
  is_featured: boolean; total_label: string; sort_order: number;
  features: { ka: string; en: string }[];
};

export type SettingRow = {
  key: string; value_text: string | null; value_num: number | null;
};

export type SnapshotInput = {
  logoBaseUrl: string;
  categories: CategoryRow[];
  channels: ChannelRow[];
  plans: PlanRow[];
  settings: SettingRow[];
};

export type SnapshotChannel = {
  slug: string; name_ka: string; name_en: string;
  logo: string; w: number; h: number;
  cats: string[]; plans: string[];
  in_slider: boolean; slider_order: number; sort: number;
};

export type SnapshotPlan = {
  slug: string; name_ka: string; name_en: string;
  price: number; currency: string; period_ka: string; period_en: string;
  featured: boolean; badge_ka: string | null; badge_en: string | null;
  total_label: string;
  features: { ka: string; en: string }[];
};

export type Snapshot = {
  version: 1;
  published_at: string;
  settings: Record<string, string | number>;
  categories: { slug: string; name_ka: string; name_en: string; sort: number }[];
  channels: SnapshotChannel[];
  plans: SnapshotPlan[];
};
