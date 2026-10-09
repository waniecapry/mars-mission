<script setup lang="ts">
    import type { Resource$Usage } from "../api";
    import UsageTable from "./UsageTable.vue";

    defineProps<{ items: Resource$Usage[], crew?: boolean }>();
</script>

<template>
    <section class="page-heading">
        <div>
            <span class="eyebrow">{{ crew ? "SHIP-WIDE ACTIVITY" : "PERSONAL HISTORY" }}</span>
            <h1>{{ crew ? "Activity log" : "My usage history" }}</h1>
            <p class="muted">{{ crew ? "The 100 most recent resource interactions across the ship." : "Your facility interactions, including denied and unavailable attempts." }}</p>
        </div>
        <span class="count-pill">{{ items.length }} {{ items.length === 1 ? "INTERACTION" : "INTERACTIONS" }}</span>
    </section>
    <section class="panel history-panel">
        <div class="panel-heading"><div><span class="eyebrow">{{ crew ? "RECENT INTERACTIONS" : "RESOURCE LOG" }}</span><h2>{{ crew ? "Across the ship" : "All interactions" }}</h2></div></div>
        <UsageTable v-if="items.length" :items="items" :label="crew ? 'Ship activity table' : 'Personal history table'" :show-passenger="crew" />
        <p v-else class="empty-state">{{ crew ? "No resource interactions have been recorded yet. Activity will appear after a passenger uses a facility." : "Your history will appear here once you use a facility." }}</p>
    </section>
</template>