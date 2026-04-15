const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
  if (chunkSize <= 0) return [items];

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
};

const collectReferencedCustomerIds = async (
  supabaseClient: any,
  table: 'quotes' | 'sales_orders',
  organizationId: string,
  customerIds: string[],
): Promise<Set<string>> => {
  const referencedIds = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabaseClient
      .from(table)
      .select('customer_id')
      .eq('organization_id', organizationId)
      .in('customer_id', customerIds)
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to inspect ${table}: ${error.message}`);
    }

    for (const row of data || []) {
      if (row.customer_id) {
        referencedIds.add(row.customer_id);
      }
    }

    if (!data || data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return referencedIds;
};

export const cleanupObsoleteHoldedCustomers = async (
  supabaseClient: any,
  organizationId: string,
  latestHoldedIds: Set<string>,
) => {
  const { data: existingCustomers, error: existingError } = await supabaseClient
    .from('customers')
    .select('id, holded_id')
    .eq('organization_id', organizationId)
    .eq('source', 'holded')
    .not('holded_id', 'is', null);

  if (existingError) {
    throw new Error(`Failed to fetch existing Holded customers: ${existingError.message}`);
  }

  const staleCustomers = (existingCustomers || []).filter(
    (customer: { id: string; holded_id: string | null }) =>
      customer.holded_id && !latestHoldedIds.has(customer.holded_id),
  );

  if (staleCustomers.length === 0) {
    return {
      staleFound: 0,
      deleted: 0,
      preservedHistorical: 0,
    };
  }

  const referencedIds = new Set<string>();

  for (const customerIdChunk of chunkArray(
    staleCustomers.map((customer: { id: string }) => customer.id),
    500,
  )) {
    const [quoteRefs, orderRefs] = await Promise.all([
      collectReferencedCustomerIds(supabaseClient, 'quotes', organizationId, customerIdChunk),
      collectReferencedCustomerIds(supabaseClient, 'sales_orders', organizationId, customerIdChunk),
    ]);

    quoteRefs.forEach((id) => referencedIds.add(id));
    orderRefs.forEach((id) => referencedIds.add(id));
  }

  const deletableIds = staleCustomers
    .filter((customer: { id: string }) => !referencedIds.has(customer.id))
    .map((customer: { id: string }) => customer.id);

  for (const deleteChunk of chunkArray(deletableIds, 500)) {
    const { error: deleteError } = await supabaseClient
      .from('customers')
      .delete()
      .in('id', deleteChunk);

    if (deleteError) {
      throw new Error(`Failed to delete obsolete Holded customers: ${deleteError.message}`);
    }
  }

  return {
    staleFound: staleCustomers.length,
    deleted: deletableIds.length,
    preservedHistorical: staleCustomers.length - deletableIds.length,
  };
};