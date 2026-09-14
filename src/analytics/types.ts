export type DateRange = "today" | "yesterday" | "7d" | "30d" | "custom";

export interface AnalyticsFilters {
  dateRange: DateRange;
  start: string;
  end: string;
  source: string;
  campaign: string;
  country: string;
  state: string;
  device: string;
  artist: string;
  service: string;
}

export interface KpiMetric {
  label: string;
  value: number;
  previousChange?: number;
  format?: "number" | "percent";
}

export interface TrafficPoint { label: string; visitors: number; sessions: number; bookings: number; }
export interface TrafficSource { source: string; visitors: number; sessions: number; leads: number; color: string; }
export interface CampaignPerformance { id: string; campaign: string; source: string; visitors: number; starts: number; leads: number; whatsapp: number; }
export interface LocationPerformance { id: string; country: string; state: string; city: string; visitors: number; sessions: number; bookings: number; }
export interface StatePerformance { state: string; visitors: number; bookings: number; }
export interface ArtistPerformance { artist: string; profileViews: number; galleryOpens: number; bookClicks: number; starts: number; leads: number; }
export interface PortfolioPerformance { image: string; artist: string; views: number; clicks: number; artistVisits: number; bookings: number; }
export interface DevicePerformance { device: string; visitors: number; conversions: number; color: string; }
export interface ContentPerformance { page: string; views: number; engagement: string; starts: number; exitRate: number; }
export interface FunnelStep { label: string; value: number; }
export interface ActivityRow { id: string; dateTime: string; source: string; campaign: string; country: string; state: string; device: string; artist: string; event: string; converted: boolean; }

export interface DashboardAnalytics {
  overview: KpiMetric[];
  traffic: TrafficPoint[];
  sources: TrafficSource[];
  campaigns: CampaignPerformance[];
  locations: LocationPerformance[];
  states: StatePerformance[];
  funnel: FunnelStep[];
  artists: ArtistPerformance[];
  portfolio: PortfolioPerformance[];
  devices: DevicePerformance[];
  platforms: Array<{ name: string; visitors: number }>;
  content: ContentPerformance[];
  homeCall: { views: number; clicks: number; starts: number; leads: number; states: StatePerformance[] };
  booking: { starts: number; submissions: number; abandoned: number; studio: number; homeCall: number; artistSpecific: number; noPreference: number };
  activity: ActivityRow[];
  activityPagination?: { page: number; pageSize: number; total: number };
  filterOptions?: { campaigns: string[]; countries: string[]; states: string[]; artists: string[] };
}

export const DEFAULT_FILTERS: AnalyticsFilters = {
  dateRange: "today",
  start: "",
  end: "",
  source: "all",
  campaign: "all",
  country: "all",
  state: "all",
  device: "all",
  artist: "all",
  service: "all",
};

export const conversionRate = (numerator: number, denominator: number) => denominator ? (numerator / denominator) * 100 : 0;
