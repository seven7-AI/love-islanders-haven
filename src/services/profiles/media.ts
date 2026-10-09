import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch visible profile images for a user
 */
export const fetchVisibleProfileImages = async (profileId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('profile_images')
      .select('url')
      .eq('profile_id', profileId)
      .eq('is_visible', true)
      .lt('position', 999) // Exclude videos
      .order('position', { ascending: true });
      
    if (error) {
      console.error('Error fetching visible profile images:', error);
      throw error;
    }
    
    return data ? data.map(img => img.url) : [];
  } catch (error) {
    console.error("Error in fetchVisibleProfileImages:", error);
    return [];
  }
};
