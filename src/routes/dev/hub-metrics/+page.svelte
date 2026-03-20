<script lang="ts">
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import ServiceMetricsView from '$lib/components/shared/ServiceMetricsView.svelte'
  import Sun from '@lucide/svelte/icons/sun'
  import Moon from '@lucide/svelte/icons/moon'

  let darkMode = $state(document.documentElement.classList.contains('dark'))
  function toggleTheme() {
    darkMode = !darkMode
    document.documentElement.classList.toggle('dark', darkMode)
  }

  const SAMPLE_DATA = `uptime_seconds 7.22
pid 53365

# Runtime
goroutines 22
memory_alloc_bytes 6420416
memory_sys_bytes 29903112
memory_heap_inuse_bytes 9396224
gc_num 4
gc_last_pause_ns 144124
cpu_count 24

# DB Pool
db_dialect postgresql
db_max_open 25
db_open 10
db_in_use 0
db_idle 10
db_wait_count 0
db_wait_duration_seconds 0.000

# HTTP Methods
http_msg_total{method="GET /api/v1/license"} 1
http_msg_duration_seconds{method="GET /api/v1/license"} 0.002140
http_msg_avg_latency_us{method="GET /api/v1/license"} 2139.7
http_msg_histogram_min_us{method="GET /api/v1/license"} 2139.7
http_msg_histogram_max_us{method="GET /api/v1/license"} 2139.7
http_msg_histogram_count{method="GET /api/v1/license"} 1
http_msg_histogram_sum_seconds{method="GET /api/v1/license"} 0.002140
http_msg_histogram_bucket{method="GET /api/v1/license",le="3ms"} 1
http_msg_total{method="GET /api/v1/regions/:regionId/nodes"} 1
http_msg_duration_seconds{method="GET /api/v1/regions/:regionId/nodes"} 0.006044
http_msg_avg_latency_us{method="GET /api/v1/regions/:regionId/nodes"} 6043.8
http_msg_histogram_min_us{method="GET /api/v1/regions/:regionId/nodes"} 6043.8
http_msg_histogram_max_us{method="GET /api/v1/regions/:regionId/nodes"} 6043.8
http_msg_histogram_count{method="GET /api/v1/regions/:regionId/nodes"} 1
http_msg_histogram_sum_seconds{method="GET /api/v1/regions/:regionId/nodes"} 0.006044
http_msg_histogram_bucket{method="GET /api/v1/regions/:regionId/nodes",le="7.5ms"} 1
http_msg_total{method="GET /api/v1/accounts/list"} 1
http_msg_duration_seconds{method="GET /api/v1/accounts/list"} 0.004302
http_msg_avg_latency_us{method="GET /api/v1/accounts/list"} 4302.1
http_msg_histogram_min_us{method="GET /api/v1/accounts/list"} 4302.1
http_msg_histogram_max_us{method="GET /api/v1/accounts/list"} 4302.1
http_msg_histogram_count{method="GET /api/v1/accounts/list"} 1
http_msg_histogram_sum_seconds{method="GET /api/v1/accounts/list"} 0.004302
http_msg_histogram_bucket{method="GET /api/v1/accounts/list",le="5ms"} 1

# SRPC Methods

# DB Queries
db_query_total{query="DeactivateDeadServiceNodes"} 1
db_query_duration_seconds{query="DeactivateDeadServiceNodes"} 0.000385
db_query_avg_latency_us{query="DeactivateDeadServiceNodes"} 385.1
db_query_stddev_us{query="DeactivateDeadServiceNodes"} 0.0
db_query_histogram_min_us{query="DeactivateDeadServiceNodes"} 385.1
db_query_histogram_max_us{query="DeactivateDeadServiceNodes"} 385.1
db_query_histogram_count{query="DeactivateDeadServiceNodes"} 1
db_query_histogram_sum_seconds{query="DeactivateDeadServiceNodes"} 0.000385
db_query_histogram_bucket{query="DeactivateDeadServiceNodes",le="500us"} 1
db_query_total{query="ListAccountsAdmin"} 1
db_query_duration_seconds{query="ListAccountsAdmin"} 0.002478
db_query_avg_latency_us{query="ListAccountsAdmin"} 2478.2
db_query_stddev_us{query="ListAccountsAdmin"} 0.0
db_query_histogram_min_us{query="ListAccountsAdmin"} 2478.2
db_query_histogram_max_us{query="ListAccountsAdmin"} 2478.2
db_query_histogram_count{query="ListAccountsAdmin"} 1
db_query_histogram_sum_seconds{query="ListAccountsAdmin"} 0.002478
db_query_histogram_bucket{query="ListAccountsAdmin",le="3ms"} 1
db_query_total{query="MarkUnhealthyClientSessions"} 1
db_query_duration_seconds{query="MarkUnhealthyClientSessions"} 0.002315
db_query_avg_latency_us{query="MarkUnhealthyClientSessions"} 2314.7
db_query_stddev_us{query="MarkUnhealthyClientSessions"} 0.0
db_query_histogram_min_us{query="MarkUnhealthyClientSessions"} 2314.7
db_query_histogram_max_us{query="MarkUnhealthyClientSessions"} 2314.7
db_query_histogram_count{query="MarkUnhealthyClientSessions"} 1
db_query_histogram_sum_seconds{query="MarkUnhealthyClientSessions"} 0.002315
db_query_histogram_bucket{query="MarkUnhealthyClientSessions",le="3ms"} 1
db_query_total{query="ListHubNodesByRegion"} 1
db_query_duration_seconds{query="ListHubNodesByRegion"} 0.002450
db_query_avg_latency_us{query="ListHubNodesByRegion"} 2450.0
db_query_stddev_us{query="ListHubNodesByRegion"} 0.0
db_query_histogram_min_us{query="ListHubNodesByRegion"} 2450.0
db_query_histogram_max_us{query="ListHubNodesByRegion"} 2450.0
db_query_histogram_count{query="ListHubNodesByRegion"} 1
db_query_histogram_sum_seconds{query="ListHubNodesByRegion"} 0.002450
db_query_histogram_bucket{query="ListHubNodesByRegion",le="3ms"} 1
db_query_total{query="MarkUnhealthyServiceNodes"} 1
db_query_duration_seconds{query="MarkUnhealthyServiceNodes"} 0.009242
db_query_avg_latency_us{query="MarkUnhealthyServiceNodes"} 9242.4
db_query_stddev_us{query="MarkUnhealthyServiceNodes"} 0.0
db_query_histogram_min_us{query="MarkUnhealthyServiceNodes"} 9242.4
db_query_histogram_max_us{query="MarkUnhealthyServiceNodes"} 9242.4
db_query_histogram_count{query="MarkUnhealthyServiceNodes"} 1
db_query_histogram_sum_seconds{query="MarkUnhealthyServiceNodes"} 0.009242
db_query_histogram_bucket{query="MarkUnhealthyServiceNodes",le="10ms"} 1
db_query_total{query="DeactivateDeadClientSessions"} 1
db_query_duration_seconds{query="DeactivateDeadClientSessions"} 0.000489
db_query_avg_latency_us{query="DeactivateDeadClientSessions"} 489.2
db_query_stddev_us{query="DeactivateDeadClientSessions"} 0.0
db_query_histogram_min_us{query="DeactivateDeadClientSessions"} 489.2
db_query_histogram_max_us{query="DeactivateDeadClientSessions"} 489.2
db_query_histogram_count{query="DeactivateDeadClientSessions"} 1
db_query_histogram_sum_seconds{query="DeactivateDeadClientSessions"} 0.000489
db_query_histogram_bucket{query="DeactivateDeadClientSessions",le="500us"} 1
db_query_total{query="CountAccountsAdmin"} 1
db_query_duration_seconds{query="CountAccountsAdmin"} 0.000434
db_query_avg_latency_us{query="CountAccountsAdmin"} 434.0
db_query_stddev_us{query="CountAccountsAdmin"} 0.0
db_query_histogram_min_us{query="CountAccountsAdmin"} 434.0
db_query_histogram_max_us{query="CountAccountsAdmin"} 434.0
db_query_histogram_count{query="CountAccountsAdmin"} 1
db_query_histogram_sum_seconds{query="CountAccountsAdmin"} 0.000434
db_query_histogram_bucket{query="CountAccountsAdmin",le="500us"} 1
db_query_total{query="GetRegionByShardID"} 1
db_query_duration_seconds{query="GetRegionByShardID"} 0.002577
db_query_avg_latency_us{query="GetRegionByShardID"} 2576.7
db_query_stddev_us{query="GetRegionByShardID"} 0.0
db_query_histogram_min_us{query="GetRegionByShardID"} 2576.7
db_query_histogram_max_us{query="GetRegionByShardID"} 2576.7
db_query_histogram_count{query="GetRegionByShardID"} 1
db_query_histogram_sum_seconds{query="GetRegionByShardID"} 0.002577
db_query_histogram_bucket{query="GetRegionByShardID",le="3ms"} 1
db_query_total{query="UpsertHubNode"} 1
db_query_duration_seconds{query="UpsertHubNode"} 0.001995
db_query_avg_latency_us{query="UpsertHubNode"} 1994.7
db_query_stddev_us{query="UpsertHubNode"} 0.0
db_query_histogram_min_us{query="UpsertHubNode"} 1994.7
db_query_histogram_max_us{query="UpsertHubNode"} 1994.7
db_query_histogram_count{query="UpsertHubNode"} 1
db_query_histogram_sum_seconds{query="UpsertHubNode"} 0.001995
db_query_histogram_bucket{query="UpsertHubNode",le="2ms"} 1
db_query_total{query="GetRegionByID"} 1
db_query_duration_seconds{query="GetRegionByID"} 0.007655
db_query_avg_latency_us{query="GetRegionByID"} 7655.5
db_query_stddev_us{query="GetRegionByID"} 0.0
db_query_histogram_min_us{query="GetRegionByID"} 7655.5
db_query_histogram_max_us{query="GetRegionByID"} 7655.5
db_query_histogram_count{query="GetRegionByID"} 1
db_query_histogram_sum_seconds{query="GetRegionByID"} 0.007655
db_query_histogram_bucket{query="GetRegionByID",le="10ms"} 1`
</script>

<div class="space-y-6 max-w-6xl mx-auto p-6">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-bold tracking-tight font-mono">Hub Metrics (Dev)</h1>
    <Button variant="outline" size="sm" onclick={toggleTheme}>
      {#if darkMode}<Sun class="h-4 w-4" />{:else}<Moon class="h-4 w-4" />{/if}
      {darkMode ? 'Light' : 'Dark'}
    </Button>
  </div>

  <ServiceMetricsView raw={SAMPLE_DATA} />
</div>
