<script setup lang="ts">
    import { computed } from "vue";
    import type { Actor, Resource, Resource$Usage, Resource$Usage$Report } from "../api";
    import { dateTime, initials, outcomeName, tierName } from "../format";
    import type { View } from "./WorkspaceNav.vue";

    const props = defineProps<{ actor: Actor, resources: Resource[], passengers: Actor[], history: Resource$Usage[], activity: Resource$Usage[], report: Resource$Usage$Report, working: boolean }>();
    const emit = defineEmits<{ navigate: [view: View], useResource: [resource: Resource] }>();
    const isCrew = computed( ()=>props.actor.role === 0 );
    const activeCount = computed( ()=>props.resources.filter( resource=>resource.status === 1 ).length );
    const grantedCount = computed( ()=>props.report.byTier.reduce( (total, tier)=>total + tier.usageCount, 0 ) );
</script>

<template>
    <section class="page-heading">
        <div>
            <span class="eyebrow">{{ isCrew ? "CREW OVERVIEW" : "PASSENGER OVERVIEW" }}</span>
            <h1>{{ isCrew ? "Access aboard X26" : `Welcome aboard, ${actor.name.split( " " )[0]}.` }}</h1>
            <p class="muted">{{ isCrew ? "A current view of passenger access and onboard resource use." : "Your facilities and usage records for the journey." }}</p>
        </div>
        <button class="button button-primary" type="button" @click="emit( 'navigate', isCrew ? 'passengers' : 'resources' )">{{ isCrew ? "Manage passengers" : "View my facilities" }}</button>
    </section>

    <section class="mission-brief" aria-label="Current access summary">
        <div class="mission-brief-main">
            <span class="eyebrow eyebrow-light">{{ isCrew ? "ONBOARD ACCESS" : "YOUR MEMBERSHIP" }}</span>
            <strong>{{ isCrew ? resources.length ? `${activeCount} of ${resources.length} facilities active` : "No facilities provisioned" : `${tierName( actor.tier )} access` }}</strong>
            <p>{{ isCrew ? !resources.length ? "Open Resources to add the first facility." : activeCount === resources.length ? "All provisioned facilities are active." : "Review inactive facilities before passengers try to use them." : `${resources.length} ${resources.length === 1 ? "facility is" : "facilities are"} currently available to you.` }}</p>
        </div>
        <dl class="mission-brief-facts">
            <div><dt>{{ isCrew ? "Passengers aboard" : "Facilities available" }}</dt><dd>{{ isCrew ? passengers.length : resources.length }}</dd></div>
            <div><dt>{{ isCrew ? "Granted uses" : "Your interactions" }}</dt><dd>{{ isCrew ? grantedCount : history.length }}</dd></div>
        </dl>
    </section>

    <div class="dashboard-grid">
        <section class="panel dashboard-panel">
            <div class="panel-heading">
                <div><span class="eyebrow">{{ isCrew ? "USAGE LOG" : "AVAILABLE TO YOU" }}</span><h2>{{ isCrew ? "Recent interactions" : "Facilities you can use" }}</h2></div>
                <button class="text-link" type="button" @click="emit( 'navigate', isCrew ? 'activity' : 'resources' )">{{ isCrew ? "Full activity" : "All facilities" }}</button>
            </div>
            <template v-if="isCrew">
                <div v-if="activity.length" class="activity-list">
                    <div v-for="item in activity.slice( 0, 5 )" :key="item.id" class="activity-row">
                        <span class="activity-avatar">{{ initials( item.passengerName ) }}</span>
                        <div><strong>{{ item.passengerName }}</strong><span>{{ item.resourceName }} · {{ dateTime( item.occurredAt ) }}</span></div>
                        <span class="outcome-badge" :class="`outcome-${item.outcome}`">{{ outcomeName( item.outcome ) }}</span>
                    </div>
                </div>
                <p v-else class="empty-state">No resource interactions recorded yet. Open Activity after a passenger uses a facility.</p>
            </template>
            <template v-else>
                <div v-if="resources.length" class="quick-resource-list">
                    <div v-for="resource in resources.slice( 0, 4 )" :key="resource.id" class="quick-resource-row">
                        <span class="resource-glyph" :class="`tier-${resource.minimumTier}`">{{ resource.name.slice( 0, 1 ).toUpperCase() }}</span>
                        <div><strong>{{ resource.name }}</strong><span>{{ tierName( resource.minimumTier ) }} access</span></div>
                        <button class="button button-secondary button-small" type="button" :disabled="working" :aria-label="`Use ${resource.name}`" @click="emit( 'useResource', resource )">Use</button>
                    </div>
                </div>
                <p v-else class="empty-state">No facilities are available for your membership right now. Try refreshing the records.</p>
            </template>
        </section>
        <section class="panel dashboard-panel">
            <div class="panel-heading">
                <div><span class="eyebrow">{{ isCrew ? "INVENTORY" : "USAGE LOG" }}</span><h2>{{ isCrew ? "Facility status" : "Recent history" }}</h2></div>
                <button class="text-link" type="button" @click="emit( 'navigate', isCrew ? 'resources' : 'history' )">{{ isCrew ? "All resources" : "Full history" }}</button>
            </div>
            <template v-if="isCrew">
                <div v-if="resources.length" class="status-list">
                    <div v-for="resource in resources.slice( 0, 5 )" :key="resource.id" class="status-row"><span>{{ resource.name }}</span><span class="status-badge" :class="resource.status === 1 ? 'status-active' : 'status-inactive'">{{ resource.status === 1 ? "Active" : "Inactive" }}</span></div>
                </div>
                <p v-else class="empty-state">No facilities have been added. Open Resources to create one.</p>
            </template>
            <template v-else>
                <div v-if="history.length" class="status-list">
                    <div v-for="item in history.slice( 0, 5 )" :key="item.id" class="status-row"><div><strong>{{ item.resourceName }}</strong><small>{{ dateTime( item.occurredAt ) }}</small></div><span class="outcome-badge" :class="`outcome-${item.outcome}`">{{ outcomeName( item.outcome ) }}</span></div>
                </div>
                <p v-else class="empty-state">Your history will appear here after you use a facility.</p>
            </template>
        </section>
    </div>
</template>