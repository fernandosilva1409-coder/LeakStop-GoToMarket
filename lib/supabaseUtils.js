const PAGE_SIZE = 1000;

// Supabase/PostgREST caps a single select at 1000 rows by default. Every
// table here (sales, purchases, dish_ingredients) can exceed that for an
// active restaurant, so anything reading a full table must paginate through
// .range() instead of trusting one unbounded select("*") to return everything.
export async function fetchAllRows(buildQuery) {
  let allRows = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    allRows = allRows.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}
