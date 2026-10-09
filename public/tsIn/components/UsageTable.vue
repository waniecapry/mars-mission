<script setup lang="ts">
    import type { Resource$Usage } from "../api";
    import { dateTime, outcomeName, tierName } from "../format";

    defineProps<{ items: Resource$Usage[], label: string, showPassenger?: boolean }>();
</script>

<template>
    <p class="table-hint">Scroll across to see all columns.</p>
    <div class="table-scroll" tabindex="0" :aria-label="`${label}, scroll horizontally for all columns`">
        <table class="data-table">
            <thead><tr><th v-if="showPassenger" scope="col">Passenger</th><th scope="col">Facility</th><th scope="col">Outcome</th><th scope="col">Tier at use</th><th scope="col">Date &amp; time</th></tr></thead>
            <tbody>
                <tr v-for="item in items" :key="item.id">
                    <td v-if="showPassenger"><strong>{{ item.passengerName }}</strong></td>
                    <td><strong>{{ item.resourceName }}</strong></td>
                    <td><span class="outcome-badge" :class="`outcome-${item.outcome}`">{{ outcomeName( item.outcome ) }}</span></td>
                    <td>{{ tierName( item.tierAtUse ) }}</td>
                    <td>{{ dateTime( item.occurredAt ) }}</td>
                </tr>
            </tbody>
        </table>
    </div>
</template>