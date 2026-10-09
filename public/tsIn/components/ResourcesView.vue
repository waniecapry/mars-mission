<script setup lang="ts">
    import { computed } from "vue";
    import type { Actor, Resource, TierLevel } from "../api";
    import { tierName } from "../format";

    const props = defineProps<{ actor: Actor, resources: Resource[], form: { name: string, description: string, minimumTier: TierLevel }, working: boolean }>();
    const emit = defineEmits<{ create: [], changeStatus: [resource: Resource], useResource: [resource: Resource] }>();
    const isCrew = computed( ()=>props.actor.role === 0 );
    const activeCount = computed( ()=>props.resources.filter( resource=>resource.status === 1 ).length );
</script>

<template>
    <section class="page-heading">
        <div>
            <span class="eyebrow">{{ isCrew ? "RESOURCE MANAGEMENT" : "FACILITY DIRECTORY" }}</span>
            <h1>{{ isCrew ? "Ship resources" : "Your facilities" }}</h1>
            <p class="muted">{{ isCrew ? "Set membership access and keep the onboard inventory current." : "These active facilities are included in your membership." }}</p>
        </div>
        <span class="count-pill">{{ resources.length }} {{ resources.length === 1 ? "RESOURCE" : "RESOURCES" }}</span>
    </section>

    <div v-if="isCrew" class="management-grid">
        <section class="panel form-panel">
            <div class="panel-heading"><div><span class="eyebrow">ADD FACILITY</span><h2>Provision a resource</h2></div></div>
            <form class="stacked-form" @submit.prevent="emit( 'create' )">
                <label class="field-label" for="resource-name">Resource name</label>
                <input id="resource-name" v-model.trim="form.name" class="text-input" maxlength="30" placeholder="Facility name" required>
                <label class="field-label" for="resource-description">Description</label>
                <textarea id="resource-description" v-model.trim="form.description" class="text-input text-area" maxlength="200" placeholder="What does this facility offer?"></textarea>
                <label class="field-label" for="resource-tier">Minimum membership</label>
                <select id="resource-tier" v-model.number="form.minimumTier" class="text-input select-input"><option :value="1">Silver</option><option :value="2">Gold</option><option :value="3">Platinum</option></select>
                <button class="button button-primary button-wide" type="submit" :disabled="working">Add resource</button>
            </form>
        </section>
        <section class="panel list-panel">
            <div class="panel-heading"><div><span class="eyebrow">ONBOARD INVENTORY</span><h2>All facilities</h2></div><span class="muted">{{ activeCount }} active</span></div>
            <div v-if="resources.length" class="inventory-list">
                <div v-for="resource in resources" :key="resource.id" class="inventory-row">
                    <span class="resource-glyph" :class="`tier-${resource.minimumTier}`">{{ resource.name.slice( 0, 1 ).toUpperCase() }}</span>
                    <div class="inventory-copy"><strong>{{ resource.name }}</strong><span>{{ tierName( resource.minimumTier ) }} minimum <span class="middle-dot">·</span> {{ resource.description || "No description" }}</span></div>
                    <span class="status-badge" :class="resource.status === 1 ? 'status-active' : 'status-inactive'">{{ resource.status === 1 ? "Active" : "Inactive" }}</span>
                    <button class="button button-secondary button-small" type="button" :disabled="working" @click="emit( 'changeStatus', resource )">{{ resource.status === 1 ? "Deactivate" : "Activate" }}</button>
                </div>
            </div>
            <p v-else class="empty-state">No facilities have been added. Use the form to create the first one.</p>
        </section>
    </div>

    <div v-else class="facility-grid">
        <article v-for="resource in resources" :key="resource.id" class="panel facility-card">
            <div class="facility-card-top"><span class="resource-glyph resource-glyph-large" :class="`tier-${resource.minimumTier}`">{{ resource.name.slice( 0, 1 ).toUpperCase() }}</span><span class="tier-tag" :class="`tier-tag-${resource.minimumTier}`">{{ tierName( resource.minimumTier ) }}</span></div>
            <h2>{{ resource.name }}</h2>
            <p class="muted">{{ resource.description || "No description provided." }}</p>
            <div class="facility-card-footer"><span class="status-badge status-active">Available</span><button class="button button-primary button-small" type="button" :disabled="working" @click="emit( 'useResource', resource )">Use facility</button></div>
        </article>
        <div v-if="!resources.length" class="panel empty-state facility-empty">No facilities are available for your membership right now. Try refreshing the records.</div>
    </div>
</template>