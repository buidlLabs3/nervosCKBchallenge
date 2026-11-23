export async function queryBalance(script: unknown): Promise<bigint> {
  const response = await fetch('https://testnet.ckbapp.dev/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'get_cells_capacity',
      params: [{ script, script_type: 'lock', script_search_mode: 'exact', filter: { script_len_range: ['0x0', '0x1'] } }],
    }),
  });
  if (!response.ok) throw new Error(`The Testnet balance service returned HTTP ${response.status}.`);
  const result = await response.json();
  if (!/^0x[0-9a-f]+$/i.test(result.result?.capacity ?? '')) {
    throw new Error(result.error?.message ?? 'Unable to read the Testnet balance.');
  }
  return BigInt(result.result.capacity);
}
