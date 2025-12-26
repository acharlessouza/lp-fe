
PROMPT PARA CODEX — FRONTEND DISCOVER (LIQUIDITY POOLS)

Objetivo:
Implementar a tela Discover (Liquidity Pools) consumindo dados reais de um endpoint backend.

Stack:
- React + Vite
- TypeScript
- Tailwind CSS
- Fetch API ou Axios

Endpoint a ser consumido:
GET /api/discover/pools

Query params:
- network (string, opcional)
- exchange (string, opcional)
- timeframe_days (number, default 14)
- page (number, default 1)
- page_size (number, default 10)
- order_by (string)
- order_dir (asc|desc)

Regras:
- NÃO usar dados mockados
- A tabela deve ser populada exclusivamente a partir da resposta do endpoint
- Implementar loading, empty state e error state
- Paginação deve refletir os dados do backend
- Ordenação deve disparar nova chamada ao endpoint

Contrato esperado do backend:
{
  "page": number,
  "page_size": number,
  "total": number,
  "data": [
    {
      "pool_id": number,
      "pool_name": string,
      "fee_tier": string,
      "average_apr": number,
      "price_volatility": number | null,
      "tvl_usd": number,
      "correlation": number | null,
      "avg_daily_fees_usd": number,
      "daily_fees_tvl_pct": number,
      "avg_daily_volume_usd": number,
      "daily_volume_tvl_pct": number
    }
  ]
}

Componentes obrigatórios:
- Header
- Filters
- Tabs
- PoolsTable
- Pagination

Fluxo:
1. Página carrega -> fetch inicial
2. Alteração de filtros -> refetch
3. Paginação -> refetch
4. Ordenação -> refetch

Objetivo final:
Tela totalmente integrada ao backend, pronta para produção.
