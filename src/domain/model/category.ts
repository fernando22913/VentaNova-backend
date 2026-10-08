export interface Category {
  id: string;
  slug: string;
  name: string;
}

export interface CategoryCreateInput {
  slug: string;
  name: string;
}
