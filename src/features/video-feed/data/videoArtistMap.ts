/**
 * Authoritative video → artist attribution.
 *
 * The feed will only credit an artist for a piece of work when that mapping is
 * recorded here. Anything absent from this map is presented under the BANG
 * PRIVATE TATTOOS studio identity instead, because attributing a tattoo to an
 * artist who did not make it is a claim about a real person's work.
 *
 * To add a mapping, use the content id (the source filename without its
 * extension, lowercased and hyphenated — `videoManifest.ts` logs the full list
 * in development) and an artist id from `src/data/artists.ts`:
 *
 *   export const VIDEO_ARTIST_MAP: Record<string, string> = {
 *     '16-cherry-blossoms-tattoo-equipment': 'solar',
 *   };
 *
 * Artist ids currently available: bang-bang, solar, jay-shin, sara-kori,
 * victor, saint, pawel, tee, nemo, natashia.
 */
export const VIDEO_ARTIST_MAP: Record<string, string> = {};
