const PAGE_SIZE = 1000;
const BATCH_CONCURRENCY = 10;

// Supabase/PostgREST caps a single select at 1000 rows by default. Every
// table here (sales, purchases, dish_ingredients) can exceed that for an
// active restaurant, so anything reading a full table must paginate through
// .range() instead of trusting one unbounded select("*") to return everything.
//
// Pages are fetched in concurrent batches rather than one at a time — a
// restaurant with hundreds of thousands of rows would otherwise mean
// hundreds of sequential round-trips on every page load. A batch stops
// (and the outer loop ends) as soon as any page in it comes back short;
// any requests fired in that same batch past the true end of the table
// just return empty and are harmlessly discarded.
export async function fetchAllRows(buildQuery) {
  let allRows = [];
  let from = 0;
  let done = false;
  while (!done) {
    const pages = await Promise.all(
      Array.from({ length: BATCH_CONCURRENCY }, (_, i) => {
        const pageFrom = from + i * PAGE_SIZE;
        return buildQuery().range(pageFrom, pageFrom + PAGE_SIZE - 1);
      })
    );
    for (const { data, error } of pages) {
      if (error) throw error;
      allRows = allRows.concat(data || []);
      if (!data || data.length < PAGE_SIZE) { done = true; break; }
    }
    from += BATCH_CONCURRENCY * PAGE_SIZE;
  }
  return allRows;
}
