<script setup lang="ts">
    import type { Actor } from "../api";
    import { initials, tierName } from "../format";

    export type View = "overview" | "passengers" | "resources" | "history" | "activity" | "reports";

    defineProps<{ actor: Actor, activeView: View, working: boolean }>();
    const emit = defineEmits<{ navigate: [view: View], signOut: [] }>();
</script>

<template>
    <aside class="sidebar">
        <div class="sidebar-top">
            <div class="sidebar-brand">
                <div><strong class="ship-name">Spaceship X26</strong><small>Passenger resources</small></div>
                <button class="button button-secondary mobile-sign-out" type="button" :disabled="working" @click="emit( 'signOut' )">Sign out</button>
            </div>
            <div class="sidebar-mission"><span>ROUTE</span><strong>Earth <span aria-hidden="true">→</span> Mars</strong></div>
            <nav class="sidebar-navigation" aria-label="Main navigation">
                <span class="navigation-label">WORKSPACE</span>
                <button class="navigation-item" :class="{ 'navigation-item-active': activeView === 'overview' }" :aria-current="activeView === 'overview' ? 'page' : undefined" @click="emit( 'navigate', 'overview' )">Overview</button>
                <template v-if="actor.role === 0">
                    <button class="navigation-item" :class="{ 'navigation-item-active': activeView === 'passengers' }" :aria-current="activeView === 'passengers' ? 'page' : undefined" @click="emit( 'navigate', 'passengers' )">Passengers</button>
                    <button class="navigation-item" :class="{ 'navigation-item-active': activeView === 'resources' }" :aria-current="activeView === 'resources' ? 'page' : undefined" @click="emit( 'navigate', 'resources' )">Resources</button>
                    <span class="navigation-label navigation-label-spaced">INSIGHTS</span>
                    <button class="navigation-item" :class="{ 'navigation-item-active': activeView === 'activity' }" :aria-current="activeView === 'activity' ? 'page' : undefined" @click="emit( 'navigate', 'activity' )">Activity</button>
                    <button class="navigation-item" :class="{ 'navigation-item-active': activeView === 'reports' }" :aria-current="activeView === 'reports' ? 'page' : undefined" @click="emit( 'navigate', 'reports' )">Reports</button>
                </template>
                <template v-else>
                    <button class="navigation-item" :class="{ 'navigation-item-active': activeView === 'resources' }" :aria-current="activeView === 'resources' ? 'page' : undefined" @click="emit( 'navigate', 'resources' )">My facilities</button>
                    <button class="navigation-item" :class="{ 'navigation-item-active': activeView === 'history' }" :aria-current="activeView === 'history' ? 'page' : undefined" @click="emit( 'navigate', 'history' )">My history</button>
                </template>
            </nav>
        </div>
        <div class="sidebar-bottom">
            <div class="sidebar-profile">
                <span class="avatar">{{ initials( actor.name ) }}</span>
                <span class="sidebar-profile-copy"><strong>{{ actor.name }}</strong><small>{{ actor.role === 0 ? "Crew Lead" : `${tierName( actor.tier )} passenger` }}</small></span>
            </div>
            <button class="text-link sidebar-sign-out" type="button" :disabled="working" @click="emit( 'signOut' )">Sign out</button>
        </div>
    </aside>
</template>