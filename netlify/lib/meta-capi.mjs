// BPT- references come from the consultation form (booking_leads); BPI-
// references come from the feed's anonymous booking intents. Both are
// database-issued and both map to a single Meta Lead conversion.
const REFERENCE_PATTERN = /^BP[TI]-\d{2}-\d{6,}$/;

export function metaLeadEventId(reference) {
  if (typeof reference !== "string" || !REFERENCE_PATTERN.test(reference)) return null;
  return `bpt_lead_${reference}`;
}

export async function sendMetaLead({ reference, eventSourceUrl }) {
  const pixelId = process.env.META_PIXEL_ID?.trim();
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  const eventId = metaLeadEventId(reference);
  if (!pixelId || !accessToken || !eventId) return { attempted: false, eventId };

  const graphVersion = process.env.META_GRAPH_API_VERSION?.trim() || "v23.0";
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pixelId)}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      data: [{
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1_000),
        event_id: eventId,
        event_source_url: eventSourceUrl,
        action_source: "website",
      }],
      access_token: accessToken,
    }),
  });

  if (!response.ok) throw new Error(`Meta CAPI returned ${response.status}`);
  return { attempted: true, eventId };
}
