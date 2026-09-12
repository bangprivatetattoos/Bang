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
  instagram: string;
  gallery: GalleryImage[];
}

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

export const ARTISTS: Artist[] = [
  {
    id: 'marcus-veil',
    name: 'Marcus Veil',
    role: 'Senior Artist',
    specialties: ['BLACK & GREY', 'REALISM', 'PORTRAITURE'],
    bio: 'Marcus has spent 14 years mastering the intersection of photographic realism and tattooing. His black and grey portraiture carries a quiet emotional weight that sets his work apart from anyone else operating today.',
    portrait: 'https://images.unsplash.com/photo-1637059880830-59a90102de77?w=800&h=1000&fit=crop&auto=format',
    instagram: '@marcus.veil',
    gallery: g([0, 1, 6, 3, 7]),
  },
  {
    id: 'yuna-sato',
    name: 'Yuna Sato',
    role: 'Senior Artist',
    specialties: ['JAPANESE TRADITIONAL', 'NEO-TRADITIONAL', 'COLOR'],
    bio: "Trained in Osaka before relocating to New York, Yuna brings an authentic understanding of Japanese tattooing traditions. Her work channels centuries of artistic heritage through an unmistakably contemporary lens.",
    portrait: 'https://images.unsplash.com/photo-1675726205553-4e348f24da2c?w=800&h=1000&fit=crop&auto=format',
    instagram: '@yuna.ink',
    gallery: g([2, 4, 5, 8, 0]),
  },
  {
    id: 'damien-cross',
    name: 'Damien Cross',
    role: 'Lead Artist',
    specialties: ['TRADITIONAL AMERICAN', 'BOLD LINE', 'OLD SCHOOL'],
    bio: "Damien comes from a lineage of traditional American tattooers. His bold, clean lines and confident color work honor the craft's history while bringing something unmistakably current to every piece.",
    portrait: 'https://images.unsplash.com/photo-1674572040136-5d454798c681?w=800&h=1000&fit=crop&auto=format',
    instagram: '@damien.cross',
    gallery: g([3, 6, 1, 9, 4]),
  },
  {
    id: 'astrid-norden',
    name: 'Astrid Norden',
    role: 'Senior Artist',
    specialties: ['WATERCOLOR', 'ILLUSTRATIVE', 'BOTANICAL'],
    bio: "Astrid's background in fine arts illustration translates into tattooing with unusual fluency. Her botanical watercolor work in particular has earned her an international following and a multi-year waitlist.",
    portrait: 'https://images.unsplash.com/photo-1634733049839-0292be607569?w=800&h=1000&fit=crop&auto=format',
    instagram: '@astrid.norden',
    gallery: g([4, 0, 5, 7, 2]),
  },
  {
    id: 'rafael-cruz',
    name: 'Rafael Cruz',
    role: 'Artist',
    specialties: ['FINE LINE', 'GEOMETRIC', 'MINIMALIST'],
    bio: "Rafael's precision-first approach produces work of extraordinary delicacy. His fine line geometric compositions feel engineered rather than drawn—an architecture of ink that ages beautifully.",
    portrait: 'https://images.unsplash.com/photo-1627890458144-4c0c481bf4b8?w=800&h=1000&fit=crop&auto=format',
    instagram: '@rafael.cruz.ink',
    gallery: g([1, 3, 8, 6, 5]),
  },
  {
    id: 'celia-voss',
    name: 'Celia Voss',
    role: 'Senior Artist',
    specialties: ['BLACKWORK', 'ORNAMENTAL', 'MANDALA'],
    bio: 'Celia constructs her tattoos with an architect\'s discipline. Her ornamental blackwork—intricate, symmetrical, intensely detailed—transforms the body into a site of permanent ceremony.',
    portrait: 'https://images.unsplash.com/photo-1724611512159-57c9d8376180?w=800&h=1000&fit=crop&auto=format',
    instagram: '@celia.voss',
    gallery: g([7, 2, 9, 0, 3]),
  },
  {
    id: 'kai-laurent',
    name: 'Kai Laurent',
    role: 'Artist',
    specialties: ['SURREALISM', 'DARK ART', 'CONCEPTUAL'],
    bio: "Kai's tattoos feel less like decoration and more like fragments of another world pressed into skin. His conceptual dark surrealism attracts collectors who want something that cannot be categorized.",
    portrait: 'https://images.unsplash.com/photo-1612537550127-24232ea565aa?w=800&h=1000&fit=crop&auto=format',
    instagram: '@kai.laurent',
    gallery: g([5, 9, 1, 7, 4]),
  },
  {
    id: 'mia-chen',
    name: 'Mia Chen',
    role: 'Artist',
    specialties: ['MICRO-REALISM', 'BOTANICAL', 'PORTRAIT'],
    bio: 'Mia specializes in the impossibly small. Her micro-realism work achieves a resolution that seems to defy what ink on skin can do—miniature portraits, botanical specimens, and animal studies rendered with surgical precision.',
    portrait: 'https://images.unsplash.com/photo-1780537014266-3726ab6e2e42?w=800&h=1000&fit=crop&auto=format',
    instagram: '@mia.chen.tattoo',
    gallery: g([0, 6, 3, 8, 2]),
  },
  {
    id: 'theo-blackwood',
    name: 'Theo Blackwood',
    role: 'Senior Artist',
    specialties: ['CELTIC', 'TRIBAL', 'DOTWORK'],
    bio: 'Theo spent years studying Celtic knotwork, Polynesian tribal traditions, and global pattern languages before bringing that research into his tattooing. His work feels ancient and considered in equal measure.',
    portrait: 'https://images.unsplash.com/photo-1759247943101-f1b32bcc6a8b?w=800&h=1000&fit=crop&auto=format',
    instagram: '@theo.blackwood',
    gallery: g([2, 5, 9, 1, 7]),
  },
  {
    id: 'zara-vance',
    name: 'Zara Vance',
    role: 'Artist',
    specialties: ['ABSTRACT', 'NEO-TRADITIONAL', 'COLOR REALISM'],
    bio: "Zara resists easy categorization. Her work sits at the intersection of abstract expressionism and neo-traditional tattooing—emotionally charged, technically rigorous, and unmistakably hers.",
    portrait: 'https://images.unsplash.com/photo-1671695157166-c4bbd8e6e94e?w=800&h=1000&fit=crop&auto=format',
    instagram: '@zara.vance',
    gallery: g([4, 8, 0, 6, 3]),
  },
];

export const WORK_IMAGES = [
  { url: 'https://images.unsplash.com/photo-1568515045052-f9a854d70bfd?w=600&h=750&fit=crop&auto=format', alt: 'Portfolio work', artistId: 'marcus-veil', span: 'tall' },
  { url: 'https://images.unsplash.com/photo-1597852075234-fd721ac361d3?w=800&h=500&fit=crop&auto=format', alt: 'Portfolio work', artistId: 'yuna-sato', span: 'wide' },
  { url: 'https://images.unsplash.com/photo-1607943917700-18ec6ff5a4c2?w=600&h=750&fit=crop&auto=format', alt: 'Portfolio work', artistId: 'damien-cross', span: 'tall' },
  { url: 'https://images.unsplash.com/photo-1565058379802-bbe93b2f703a?w=800&h=500&fit=crop&auto=format', alt: 'Portfolio work', artistId: 'astrid-norden', span: 'wide' },
  { url: 'https://images.unsplash.com/photo-1616879564267-a336232e3a95?w=600&h=750&fit=crop&auto=format', alt: 'Portfolio work', artistId: 'rafael-cruz', span: 'normal' },
  { url: 'https://images.unsplash.com/photo-1479767574301-a01c78234a0c?w=800&h=500&fit=crop&auto=format', alt: 'Portfolio work', artistId: 'celia-voss', span: 'wide' },
  { url: 'https://images.unsplash.com/photo-1567071208639-716c1009517d?w=600&h=750&fit=crop&auto=format', alt: 'Portfolio work', artistId: 'kai-laurent', span: 'normal' },
  { url: 'https://images.unsplash.com/photo-1783973190331-53d4db4f697f?w=600&h=750&fit=crop&auto=format', alt: 'Portfolio work', artistId: 'mia-chen', span: 'tall' },
  { url: 'https://images.unsplash.com/photo-1605647533135-51b5906087d0?w=800&h=500&fit=crop&auto=format', alt: 'Portfolio work', artistId: 'theo-blackwood', span: 'wide' },
  { url: 'https://images.unsplash.com/photo-1763970540972-9479a63d6978?w=600&h=750&fit=crop&auto=format', alt: 'Portfolio work', artistId: 'zara-vance', span: 'normal' },
];
