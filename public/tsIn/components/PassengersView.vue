<script setup lang="ts">
    import { nextTick, ref } from "vue";
    import type { Actor, TierLevel, Resource$Usage } from "../api";
    import { initials } from "../format";
    import UsageTable from "./UsageTable.vue";

    defineProps<{ passengers: Actor[], form: { name: string, email: string, password: string, tier: TierLevel }, working: boolean, selectedPassenger?: Actor, history: Resource$Usage[], historyLoading: boolean }>();
    
    const emit = defineEmits<{ create: [], changeTier: [passenger: Actor, event: Event], openHistory: [passenger: Actor], closeHistory: [] }>();
    const closeButton = ref<HTMLButtonElement | null>( null );
    const historyButton = ref<HTMLButtonElement | null>( null );

    async function showHistory( passenger: Actor, event: Event ): Promise<void>
    {
        historyButton.value = event.currentTarget as HTMLButtonElement;
        emit( "openHistory", passenger );
        await nextTick();
        closeButton.value?.focus();
        closeButton.value?.scrollIntoView( { block: "center" } );
    }
    async function closeHistory(): Promise<void>
    {
        emit( "closeHistory" );
        await nextTick();
        historyButton.value?.focus();
    }
</script>

<template>
    <section class="page-heading">
        <div><span class="eyebrow">PASSENGER MANAGEMENT</span><h1>Passengers aboard</h1><p class="muted">Create profiles, change membership, and review individual usage.</p></div>
        <span class="count-pill">{{ passengers.length }} {{ passengers.length === 1 ? "PASSENGER" : "PASSENGERS" }}</span>
    </section>
    <div class="management-grid">
        <section class="panel form-panel">
            <div class="panel-heading"><div><span class="eyebrow">NEW PASSENGER</span><h2>Create a profile</h2></div></div>
            <form class="stacked-form" @submit.prevent="emit( 'create' )">
                <label class="field-label" for="passenger-name">Full name</label>
                <input id="passenger-name" v-model.trim="form.name" class="text-input" maxlength="30" placeholder="Passenger name" required>
                <label class="field-label" for="passenger-email">Email address</label>
                <input id="passenger-email" v-model.trim="form.email" class="text-input" type="email" maxlength="200" placeholder="name@example.com" required>
                <label class="field-label" for="passenger-password">Temporary password</label>
                <input id="passenger-password" v-model="form.password" class="text-input" type="password" autocomplete="new-password" placeholder="Set a password" required>
                <label class="field-label" for="passenger-tier">Membership level</label>
                <select id="passenger-tier" v-model.number="form.tier" class="text-input select-input"><option :value="1">Silver</option><option :value="2">Gold</option><option :value="3">Platinum</option></select>
                <button class="button button-primary button-wide" type="submit" :disabled="working">Create passenger</button>
            </form>
        </section>
        <section class="panel list-panel">
            <div class="panel-heading"><div><span class="eyebrow">CREW DIRECTORY</span><h2>Passenger list</h2></div><span class="muted">{{ passengers.length }} aboard</span></div>
            <div v-if="passengers.length" class="passenger-list">
                <div v-for="passenger in passengers" :key="passenger.id" class="passenger-row">
                    <span class="avatar avatar-soft">{{ initials( passenger.name ) }}</span>
                    <div class="passenger-copy"><strong>{{ passenger.name }}</strong><span>{{ passenger.email }}</span></div>
                    <select class="text-input select-input tier-select" :value="passenger.tier" :aria-label="`Membership level for ${passenger.name}`" :disabled="working" @change="emit( 'changeTier', passenger, $event )"><option :value="1">Silver</option><option :value="2">Gold</option><option :value="3">Platinum</option></select>
                    <button class="text-link history-link" type="button" :disabled="working" @click="showHistory( passenger, $event )">History</button>
                </div>
            </div>
            <p v-else class="empty-state">No passengers have been added. Use the form to create the first profile.</p>
            <div v-if="selectedPassenger" class="passenger-history">
                <div class="panel-heading"><div><span class="eyebrow">PASSENGER HISTORY</span><h2>{{ selectedPassenger.name }}'s activity</h2></div><button ref="closeButton" class="text-link" type="button" :aria-label="`Close ${selectedPassenger.name}'s activity`" @click="closeHistory">Close</button></div>
                <p v-if="historyLoading" class="empty-state" role="status">Loading passenger history…</p>
                <UsageTable v-else-if="history.length" :items="history" label="Passenger history table" />
                <p v-else class="empty-state">No interactions have been recorded for this passenger.</p>
            </div>
        </section>
    </div>
</template>