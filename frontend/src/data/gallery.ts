export type GalleryItem = { id: string; title: string; image?: string; resourceId?: string };
export const gallery: GalleryItem[] = Array.from({ length: 8 }).map((_, i) => ({ id: `g-${i + 1}`, title: `תמונה ${i + 1}`, resourceId: 'design-1' }));
