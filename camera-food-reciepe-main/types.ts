
export enum Category {
  Vegetable = 'Vegetable',
  Fruit = 'Fruit',
  Meat = 'Meat',
  Dairy = 'Dairy',
  Pantry = 'Pantry',
  Other = 'Other'
}

export enum ItemStatus {
  Active = 'Active',
  Used = 'Used',
  Deleted = 'Deleted' // Soft delete
}

export interface PantryItem {
  id: string;
  name: string;
  category: Category;
  acquiredAt: string; // ISO string
  status: ItemStatus;
}

export interface Recipe {
    recipeName: string;
    description: string;
    ingredientsNeeded: string[];
}

export interface RecipeVideo {
    id: string;
    title: string;
    channelTitle: string;
    thumbnailUrl: string;
    videoUrl: string;
}

export interface RecipeWithVideos extends Recipe {
    videos: RecipeVideo[];
}