export const fetchGameGenres = async (title: string, slug?: string | null): Promise<string[]> => {
  try {
    let searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&l=spanish&cc=AR`;
    let response = await fetch(searchUrl);
    if (!response.ok) {
      return [];
    }

    let searchJson = (await response.json()) as { items?: Array<{ id: number; name: string }> };
    let app = searchJson.items?.[0];

    if (!app && slug) {
      const cleanSlug = slug.replace(/-\d+$/, "").replace(/-/g, " ");
      searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleanSlug)}&l=spanish&cc=AR`;
      response = await fetch(searchUrl);
      if (response.ok) {
        searchJson = (await response.json()) as { items?: Array<{ id: number; name: string }> };
        app = searchJson.items?.[0];
      }
    }

    if (app?.id) {
      const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${app.id}&l=spanish`;
      const detailsRes = await fetch(detailsUrl);
      if (!detailsRes.ok) {
        return [];
      }

      const detailsJson = (await detailsRes.json()) as Record<
        string,
        { data?: { genres?: Array<{ id: string; description: string }> } }
      >;
      const rawGenres = detailsJson[String(app.id)]?.data?.genres?.map((genre) => genre.description) ?? [];
      const filtered = rawGenres.filter((genre) => genre.toLowerCase() !== "free to play");
      return filtered.length > 0 ? filtered : rawGenres;
    }
  } catch {
    // Si la consulta externa falla, no debe interrumpir el envío del reporte
  }

  return [];
};
