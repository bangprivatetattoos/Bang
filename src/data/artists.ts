import { assetById, assetsIn, imageUrl, resolveMedia } from '../media/delivery';

export interface GalleryImage {
  url: string;
  alt: string;
  orientation: 'portrait' | 'landscape';
}

export interface Artist {
  id: string;
  name: string;
  role: string;
  specialties: string[];
  bio: string;
  portrait: string;
  instagram?: string;
  gallery: GalleryImage[];
  /**
   * Whether this artist has confirmed capacity in the current week.
   *
   * Deliberately left unset. Availability is a factual claim about a real
   * person's diary, and no availability data exists anywhere in this project
   * or its database — so the booking flow will not state it until someone
   * sets it here. An artist without this field shows the neutral, true
   * status instead (they are on the active bookable roster); set it to `true`
   * for an artist whose week is genuinely open, and the booking card upgrades
   * to "Available this week".
   */
  availableThisWeek?: boolean;
}

/**
 * Gallery and portrait imagery is served from Cloudinary once migrated, and
 * from the bundled original until then. Identity is unchanged either way: a
 * gallery image is keyed by its source filename and a portrait by its artist
 * id, exactly as the generated manifest records them.
 */
const assetFileName = (path: string) => path.split('/').pop() ?? path;

/**
 * A gallery's images, from the generated manifest.
 *
 * Returns [source path, delivery url] pairs so the blocks below keep reading
 * exactly as they did when this came from an `import.meta.glob` — same sort,
 * same alt text, same orientation rule, same order. Only where the list comes
 * from has changed.
 *
 * The globs were removed because Vite emits every file they match into the
 * build, which shipped 6.2 MB of originals the browser never requested:
 * Cloudinary serves them. `scripts/media/config.mjs` now records the folders
 * for the media sync.
 */
const galleryEntries = (artistId: string): Array<[string, string]> =>
  assetsIn('galleries')
    .filter(asset => asset.artistId === artistId)
    .map(asset => [asset.source, imageUrl(asset, 'gallery') ?? ''] as [string, string])
    .filter(([, url]) => url !== '');

const POOL: GalleryImage[] = [
  { url: 'https://images.unsplash.com/photo-1568515045052-f9a854d70bfd?w=800&h=1100&fit=crop&auto=format', alt: 'Tattoo application process', orientation: 'portrait' },
  { url: 'https://images.unsplash.com/photo-1597852075234-fd721ac361d3?w=1200&h=800&fit=crop&auto=format', alt: 'Detailed arm tattoo', orientation: 'landscape' },
  { url: 'https://images.unsplash.com/photo-1605647533135-51b5906087d0?w=1200&h=800&fit=crop&auto=format', alt: 'Full arm tattoo', orientation: 'landscape' },
  { url: 'https://images.unsplash.com/photo-1565058379802-bbe93b2f703a?w=1200&h=800&fit=crop&auto=format', alt: 'Tattoo needle work', orientation: 'landscape' },
  { url: 'https://images.unsplash.com/photo-1567071208639-716c1009517d?w=1200&h=800&fit=crop&auto=format', alt: 'Floral tattoo on leg', orientation: 'landscape' },
  { url: 'https://images.unsplash.com/photo-1479767574301-a01c78234a0c?w=1200&h=800&fit=crop&auto=format', alt: 'Arm tattoo art', orientation: 'landscape' },
  { url: 'https://images.unsplash.com/photo-1607943917700-18ec6ff5a4c2?w=800&h=1100&fit=crop&auto=format', alt: 'Body tattoo artwork', orientation: 'portrait' },
  { url: 'https://images.unsplash.com/photo-1616879564267-a336232e3a95?w=800&h=1100&fit=crop&auto=format', alt: 'Tattoo artist at work', orientation: 'portrait' },
  { url: 'https://images.unsplash.com/photo-1783973190331-53d4db4f697f?w=800&h=1100&fit=crop&auto=format', alt: 'Studio preparation', orientation: 'portrait' },
  { url: 'https://images.unsplash.com/photo-1763970540972-9479a63d6978?w=800&h=1100&fit=crop&auto=format', alt: 'Studio still life', orientation: 'portrait' },
];

const g = (indices: number[]) => indices.map(i => POOL[i]);

const BANG_BANG_GALLERY: GalleryImage[] = galleryEntries('bang-bang')
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({
    url,
    alt: `Bang Bang tattoo artwork — ${path.split('/').pop()?.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '') ?? 'gallery image'}`,
    orientation: /BangBangForever|Screenshot|Odell|Thierry|IMG|original|roses/i.test(path) ? 'landscape' : 'portrait',
  }));

const SOLAR_GALLERY: GalleryImage[] = galleryEntries('solar')
  .filter(([path]) => !path.endsWith('/IMG_4930.webp'))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({
    url,
    alt: `Solar tattoo artwork — ${path.split('/').pop()?.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '') ?? 'gallery image'}`,
    orientation: 'portrait',
  }));

const JAY_SHIN_GALLERY: GalleryImage[] = galleryEntries('jay-shin')
  .filter(([path]) => !path.endsWith('/JAY232.jpg'))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({
    url,
    alt: `Jay Shin tattoo artwork — ${path.split('/').pop()?.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '') ?? 'gallery image'}`,
    orientation: 'portrait',
  }));

const SARA_KORI_GALLERY: GalleryImage[] = galleryEntries('sara-kori')
  .filter(([path]) => !path.endsWith('/Sara_Kori_Website_photo.jpg'))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({
    url,
    alt: `Sara Kori tattoo artwork — ${path.split('/').pop()?.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '') ?? 'gallery image'}`,
    orientation: 'portrait',
  }));

const VICTOR_GALLERY: GalleryImage[] = galleryEntries('victor')
  .filter(([path]) => !path.endsWith('/Victor_Final_.jpg'))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({
    url,
    alt: `Victor tattoo artwork — ${path.split('/').pop()?.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '') ?? 'gallery image'}`,
    orientation: 'portrait',
  }));

const SAINT_GALLERY: GalleryImage[] = galleryEntries('saint')
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({
    url,
    alt: `Saint tattoo artwork — ${path.split('/').pop()?.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '') ?? 'gallery image'}`,
    orientation: 'portrait',
  }));

const PAWEL_GALLERY: GalleryImage[] = galleryEntries('pawel')
  .filter(([path]) => !path.endsWith('/pawel.jpg'))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({
    url,
    alt: `Pawel tattoo artwork — ${path.split('/').pop()?.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '') ?? 'gallery image'}`,
    orientation: 'portrait',
  }));

const TEE_GALLERY: GalleryImage[] = galleryEntries('tee')
  .filter(([path]) => !path.endsWith('/DSC00288.jpg'))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({
    url,
    alt: `Tee tattoo artwork — ${path.split('/').pop()?.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '') ?? 'gallery image'}`,
    orientation: 'portrait',
  }));

const NEMO_GALLERY: GalleryImage[] = galleryEntries('nemo')
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({
    url,
    alt: `Nemo tattoo artwork — ${path.split('/').pop()?.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '') ?? 'gallery image'}`,
    orientation: 'portrait',
  }));

const NATASHIA_GALLERY: GalleryImage[] = galleryEntries('natashia')
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, url]) => ({
    url,
    alt: `Natashia tattoo artwork — ${path.split('/').pop()?.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '') ?? 'gallery image'}`,
    orientation: 'portrait',
  }));

const ARTIST_RECORDS: Artist[] = [
  {
    id: 'bang-bang',
    name: 'Bang Bang',
    role: 'Owner / Operator',
    specialties: ['FINE LINE', 'BLACK & GREY', 'CUSTOM TATTOOS'],
    bio: 'Owner/operator Keith “Bang Bang” McCurdy has been named by Vogue as “the most famous tattoo artist in the world”. Bang Bang is responsible for iconic tattoos on Rihanna, Selena Gomez, Lebron James, Justin Bieber, Miley Cyrus, Cara Delevingne, Adele and countless others.',
    portrait: new URL('../../Bang Bang/BBFINAL2018.webp', import.meta.url).href,
    instagram: '@bangbangnyc',
    gallery: BANG_BANG_GALLERY,
  },
  {
    id: 'solar',
    name: 'Solar',
    role: 'Senior Artist',
    specialties: ['ILLUSTRATIVE COLOR', 'FINE LINE', 'ORNAMENTAL'],
    bio: 'Solar specializes in illustrative color and decorative fine-line ornamental art. She recreates antique jewels and royal artifacts using the fine-line tattooing technique popular in South Korea. Solar is all about the details, from brooches to crowns, curlicues, and bling!',
    portrait: new URL('../../Solar/IMG_4930.webp', import.meta.url).href,
    gallery: SOLAR_GALLERY,
  },
  {
    id: 'jay-shin',
    name: 'JAY SHIN',
    role: 'Artist',
    specialties: ['ILLUSTRATIVE COLOR', 'FINE LINE', 'SINGLE NEEDLE'],
    bio: 'Specializes in illustrative color, fine line and single needle. Originally from Seoul, Korea Jay became a tattoo artist eight years ago after learning from his brother. Shin says, “Previously I did a lot of different jobs, but none satisfied me. I’m much happier as a tattoo artist.”',
    portrait: new URL('../../JAY SHIN/JAY232.jpg', import.meta.url).href,
    gallery: JAY_SHIN_GALLERY,
  },
  {
    id: 'sara-kori',
    name: 'SARA KORI',
    role: 'Artist',
    specialties: ['FINE LINE'],
    bio: 'Specializes in fine line technique. Her designs celebrate the strength and individuality of women. Sara’s work blends delicate precision with raw emotional power, creating tattoos that are both deeply personal and unique.',
    portrait: new URL('../../SARA Kori/Sara_Kori_Website_photo.jpg', import.meta.url).href,
    gallery: SARA_KORI_GALLERY,
  },
  {
    id: 'victor',
    name: 'VICTOR',
    role: 'Artist',
    specialties: ['BLACKWORK', 'FINE LINE', 'GEOMETRIC REALISM', 'CYBERPUNK'],
    bio: 'Specializes in blackwork, fine line, geometric realism, and cyberpunk. Originally from León, Spain, Victor has an intricate array of unique decorative styles. His professionalism and top-notch skill level are continuously recognized globally, earning him a solid reputation in the international tattoo community.',
    portrait: new URL('../../victor/Victor_Final_.jpg', import.meta.url).href,
    gallery: VICTOR_GALLERY,
  },
  {
    id: 'saint',
    name: 'SAINT',
    role: 'Artist',
    specialties: ['ILLUSTRATIVE REALISM', 'FINE LINE'],
    bio: 'Specializes in illustrative realism and fine line. Saint has a professional career spanning over a decade. She says, "My favorite subject to tattoo is black and grey realism. I cannot express how grateful I am for being able to work amongst so many other great artists at Bang Bang."',
    portrait: new URL('../../saint/Screenshot_2024-08-24_at_4.27.20 PM.png', import.meta.url).href,
    gallery: SAINT_GALLERY,
  },
  {
    id: 'pawel',
    name: 'PAWEL',
    role: 'Artist',
    specialties: ['BLACK & GREY', 'HYPER REALISM'],
    bio: 'Specializes in black and gray hyper realism. Originally from Poland, Pawel’s style typically displays a gradation of baroque light using fine line and shading. His range of influences are from renaissance painters and sculptors including modern art and film.',
    portrait: new URL('../../Pawel/pawel.jpg', import.meta.url).href,
    gallery: PAWEL_GALLERY,
  },
  {
    id: 'tee',
    name: 'TEE',
    role: 'Artist',
    specialties: ['WATERCOLOR', 'ILLUSTRATIVE COLOR'],
    bio: 'Specializes in watercolor and illustrative color. Originally from Brooklyn, New York, Tee’s style is defined by her fine line realism and diverse styles and subject matter.',
    portrait: new URL('../../TEE/DSC00288.jpg', import.meta.url).href,
    gallery: TEE_GALLERY,
  },
  {
    id: 'nemo',
    name: 'NEMO',
    role: 'Artist',
    specialties: ['BLACK & GREY REALISM'],
    bio: 'Specializes in black and gray realism. Nemo says, “My goal as an artist has always been to push myself and my style to the limits. I will never stop learning and will always strive to become the best I can be.”',
    portrait: new URL('../../nemo/DSC00408.jfif', import.meta.url).href,
    gallery: NEMO_GALLERY,
  },
  {
    id: 'natashia',
    name: 'NATASHIA',
    role: 'Artist',
    specialties: ['REALISM', 'FINE LINE'],
    bio: 'Specializes in realism and fine line. Miami based, frequents NYC. Natashia says, “Each person I work with I see as a unique canvas with the intent to be adorned. Nothing truly compares to the feeling of giving my clients a meaningful and beautiful tattoo for them to cherish on their life’s journey.”',
    portrait: new URL('../../NTS241.jpg', import.meta.url).href,
    gallery: NATASHIA_GALLERY,
  },
];

/**
 * The published records.
 *
 * A portrait's stable key is the artist, not the photograph's filename, so
 * replacing the photo later does not change what the manifest is looked up
 * by. Galleries are already resolved above, where the source path is in
 * scope.
 */
export const ARTISTS: Artist[] = ARTIST_RECORDS.map(artist => ({
  ...artist,
  portrait: resolveMedia(artist.id, artist.portrait, 'portrait') ?? artist.portrait,
}));

type Span = [columns: number, rows: number];

export interface WorkImage {
  url: string;
  alt: string;
  artistId: string;
  /** Grid spans per breakpoint (2 / 3 / 4 columns). A row is a quarter of a column, so spans track each photo's aspect ratio. */
  layout: { base: Span; md: Span; lg: Span };
}

// Reuses the gallery asset URL itself, so the viewer can locate the image inside the artist's gallery.
const workImage = (fileName: string, work: Omit<WorkImage, 'url'>): WorkImage[] => {
  const url = imageUrl(assetById(fileName), 'gallery');
  if (!url) {
    console.error(`WORK image is not in the media manifest: ${fileName}`);
    return [];
  }
  return [{ url, ...work }];
};

// One tattoo per artist. Order and spans are tuned together so grid-auto-flow: dense packs every breakpoint into a gap-free block.
export const WORK_IMAGES: WorkImage[] = [
  ...workImage('0S6A1429.jpg', {
    alt: 'Bang Bang — Buddha and rose forearm sleeve',
    artistId: 'bang-bang',
    layout: { base: [2, 5], md: [2, 5], lg: [2, 5] },
  }),
  ...workImage('Jshin1.jpg', {
    alt: 'Jay Shin — French bulldog portraits',
    artistId: 'jay-shin',
    layout: { base: [1, 4], md: [1, 4], lg: [1, 4] },
  }),
  ...workImage('71681496_1024428594561374_337327927774706866_n.jpg', {
    alt: 'Victor — skeleton holding an anatomical heart',
    artistId: 'victor',
    layout: { base: [1, 4], md: [2, 7], lg: [1, 4] },
  }),
  ...workImage('IMG_4063.jpg', {
    alt: 'Saint — neck and back piece with cherubs and sacred heart',
    artistId: 'saint',
    layout: { base: [1, 6], md: [1, 5], lg: [1, 6] },
  }),
  ...workImage('IMG_5100.webp', {
    alt: 'Solar — ornamental spoon and knife',
    artistId: 'solar',
    layout: { base: [1, 6], md: [2, 13], lg: [1, 6] },
  }),
  ...workImage('Z1.jpeg', {
    alt: 'Natashia — butterfly and lotus with script',
    artistId: 'natashia',
    layout: { base: [1, 5], md: [1, 5], lg: [1, 5] },
  }),
  ...workImage('IMG_3008.jpg', {
    alt: 'Pawel — Zeus statue in black and grey',
    artistId: 'pawel',
    layout: { base: [2, 10], md: [1, 5], lg: [1, 5] },
  }),
  ...workImage('96B4CFE2-E20F-438D-9053-9030D536D4D1.jpg', {
    alt: 'Sara Kori — kneeling figure',
    artistId: 'sara-kori',
    layout: { base: [1, 5], md: [1, 5], lg: [1, 5] },
  }),
  ...workImage('DSCF4661.webp', {
    alt: 'Nemo — four dog portraits in black and grey',
    artistId: 'nemo',
    layout: { base: [2, 5], md: [2, 4], lg: [2, 5] },
  }),
  ...workImage('IMG_0246.jpg', {
    alt: 'Tee — watercolor house lifted by balloons',
    artistId: 'tee',
    layout: { base: [2, 10], md: [1, 5], lg: [1, 5] },
  }),
];
