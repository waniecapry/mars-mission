<script setup lang="ts">
    import { computed } from "vue";
    import type { Resource$Usage$Report } from "../api";
    import { tierName } from "../format";

    const props = defineProps<{ report: Resource$Usage$Report }>();
    const totalGranted = computed( ()=>props.report.byTier.reduce( (total, tier)=>total + tier.usageCount, 0 ) );
    const highestCount = computed( ()=>Math.max( 1, ...props.report.popularResources.map( resource=>resource.usageCount ) ) );
</script>

<template>
    <section class="page-heading">
        <div><span class="eyebrow">USAGE REPORTS</span><h1>Mission reports</h1><p class="muted">Granted facility uses grouped by membership and resource.</p></div>
        <span class="count-pill">{{ totalGranted }} GRANTED USES</span>
    </section>
    <div class="report-grid">
        <section class="panel report-panel">
            <div class="panel-heading"><div><span class="eyebrow">MEMBERSHIP DISTRIBUTION</span><h2>Usage by tier</h2></div></div>
            <div v-if="report.byTier.length" class="tier-report-list">
                <div v-for="tier in report.byTier" :key="tier.tier" class="tier-report-row">
                    <div class="tier-report-heading"><span class="tier-tag" :class="`tier-tag-${tier.tier}`">{{ tierName( tier.tier ) }}</span><strong>{{ tier.usageCount }} uses</strong></div>
                    <div class="progress-track"><span :style="{ width: `${totalGranted ? tier.usageCount / totalGranted * 100 : 0}%` }"></span></div>
                    <div v-if="tier.resources.length" class="tier-resource-summary"><span v-for="resource in tier.resources" :key="resource.resourceId">{{ resource.resourceName }} <strong>{{ resource.usageCount }}</strong></span></div>
                    <p v-else class="muted">No uses recorded for this tier.</p>
                </div>
            </div>
            <p v-else class="empty-state">No granted uses are available to group by membership yet.</p>
        </section>
        <section class="panel report-panel">
            <div class="panel-heading"><div><span class="eyebrow">RESOURCE DEMAND</span><h2>Most used facilities</h2></div></div>
            <div v-if="report.popularResources.length" class="popularity-list">
                <div v-for="(resource, index) in report.popularResources" :key="resource.resourceId" class="popularity-row">
                    <span class="rank-number">{{ String( index + 1 ).padStart( 2, "0" ) }}</span>
                    <div><div class="popularity-heading"><strong>{{ resource.resourceName }}</strong><span>{{ resource.usageCount }} uses</span></div><div class="progress-track"><span :style="{ width: `${resource.usageCount / highestCount * 100}%` }"></span></div></div>
                </div>
            </div>
            <p v-else class="empty-state">No granted resource uses to rank yet.</p>
        </section>
    </div>
</template>