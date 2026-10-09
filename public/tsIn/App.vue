<script setup lang="ts">
    import { computed, onMounted, reactive, ref } from "vue";
    import { api, ApiError, type Actor, type Resource, type Session, type TierLevel, type Resource$Usage, type Resource$Usage$Report } from "./api";
    import { dateTime, tierName } from "./format";
    import LoginView from "./components/LoginView.vue";
    import WorkspaceNav, { type View } from "./components/WorkspaceNav.vue";
    import OverviewView from "./components/OverviewView.vue";
    import ResourcesView from "./components/ResourcesView.vue";
    import PassengersView from "./components/PassengersView.vue";
    import HistoryView from "./components/HistoryView.vue";
    import ReportsView from "./components/ReportsView.vue";
    import "./app.css";
    import "@fontsource/dm-sans/400.css";
    import "@fontsource/dm-sans/500.css";
    import "@fontsource/dm-sans/600.css";
    import "@fontsource/dm-sans/700.css";
    import "@fontsource/manrope/500.css";
    import "@fontsource/manrope/600.css";
    import "@fontsource/manrope/700.css";
    import "@fontsource/manrope/800.css";

    type Notice = { text: string, tone: "success" | "error" };

    const loading = ref( true );
    const loginBusy = ref( false );
    const working = ref( false );
    const refreshing = ref( false );
    const session = ref<Session | null>( null );
    const activeView = ref<View>( "overview" );
    const notice = ref<Notice | null>( null );
    const resources = ref<Resource[]>( [] );
    const passengers = ref<Actor[]>( [] );
    const history = ref<Resource$Usage[]>( [] );
    const passengerHistory = ref<Resource$Usage[]>( [] );
    const passengerHistoryLoading = ref( false );
    const activity = ref<Resource$Usage[]>( [] );
    const report = ref<Resource$Usage$Report>( { byTier: [], popularResources: [] } );
    const selectedPassengerId = ref<string | null>( null );
    const lastUpdated = ref<Date | null>( null );
    const passengerForm = reactive( { name: "", email: "", password: "", tier: 1 as TierLevel } );
    const resourceForm = reactive( { name: "", description: "", minimumTier: 1 as TierLevel } );

    const actor = computed( ()=>session.value?.actor );
    const isCrew = computed( ()=>actor.value?.role === 0 );
    const selectedPassenger = computed( ()=>passengers.value.find( passenger=>passenger.id === selectedPassengerId.value ) );
    const currentDate = new Intl.DateTimeFormat( undefined, { weekday: "long", month: "long", day: "numeric" } ).format( new Date() );

    function showError( error: unknown ): void
    {
        if( error instanceof ApiError && error.status === 401 )
            session.value = null;

        const connectionFailed = error instanceof TypeError || (error instanceof ApiError && [502, 503, 504].includes( error.status ));
        notice.value = { text: connectionFailed ? "Mission records are unavailable. Try again shortly." : error instanceof Error ? error.message : "Something went wrong. Please try again.", tone: "error" };
    }
    function showSuccess( text: string ): void
    {
        notice.value = { text, tone: "success" };
    }
    async function refreshWorkspace(): Promise<void>
    {
        if( !session.value )
            return;

        refreshing.value = true;
        notice.value = null;

        try
        {
            if( isCrew.value )
            {
                const [resourceData, passengerData, activityData, reportData] = await Promise.all
                ([
                    api<Resource[]>( "/i/resources" ),
                    api<Actor[]>( "/i/passengers" ),
                    api<Resource$Usage[]>( "/i/activity" ),
                    api<Resource$Usage$Report>( "/i/reports/usage" )
                ]);

                resources.value = resourceData;
                passengers.value = passengerData;
                activity.value = activityData;
                report.value = reportData;
            }
            else
            {
                const [resourceData, historyData] = await Promise.all
                ([api<Resource[]>( "/i/resources" ), api<Resource$Usage[]>( "/i/usage" )]);

                resources.value = resourceData;
                history.value = historyData;
            }

            lastUpdated.value = new Date();
        }
        catch( error )
        {
            showError( error );
        }
        finally
        {
            refreshing.value = false;
        }
    }
    async function restoreSession(): Promise<void>
    {
        try
        {
            const restored = await api<Session>( "/i/session" );

            session.value = restored;
            resources.value = restored.resources;
            await refreshWorkspace();
        }
        catch( error )
        {
            if( !(error instanceof ApiError && error.status === 401) )
                showError( error );
        }
        finally
        {
            loading.value = false;
        }
    }
    async function signIn( email: string, password: string ): Promise<void>
    {
        loginBusy.value = true;
        notice.value = null;

        try
        {
            const signedIn = await api<Session>( "/login", "POST", { email, password } );

            session.value = signedIn;
            resources.value = signedIn.resources;
            lastUpdated.value = null;
            activeView.value = "overview";

            await refreshWorkspace();
        }
        catch( error )
        {
            showError( error );
        }
        finally
        {
            loginBusy.value = false;
        }
    }
    async function signOut(): Promise<void>
    {
        working.value = true;

        try
        {
            await api<void>( "/i/logout", "POST" );
    
            session.value = null;
            notice.value = null;
            resources.value = [];
            passengers.value = [];
            history.value = [];
            passengerHistory.value = [];
            activity.value = [];
            report.value = { byTier: [], popularResources: [] };
            lastUpdated.value = null;
            selectedPassengerId.value = null;
            activeView.value = "overview";
        }
        catch( error )
        {
            showError( error );
        }
        finally
        {
            working.value = false;
        }
    }
    async function perform( action: ()=>Promise<void> ): Promise<void>
    {
        working.value = true;
        notice.value = null;

        try
        {
            await action();
        }
        catch( error )
        {
            showError( error );
        }
        finally
        {
            working.value = false;
        }
    }
    async function createPassenger(): Promise<void>
    {
        await perform( async ()=>
        {
            await api<Actor>( "/i/passengers", "POST", passengerForm );
    
            passengerForm.name = "";
            passengerForm.email = "";
            passengerForm.password = "";
            passengerForm.tier = 1;
            passengers.value = await api<Actor[]>( "/i/passengers" );
    
            showSuccess( "Passenger profile created." );
        });
    }
    async function changeTier( passenger: Actor, event: Event ): Promise<void>
    {
        const select = event.target as HTMLSelectElement;
        const previousTier = passenger.tier;
        const tier = Number( select.value ) as TierLevel;

        if( tier === previousTier )
            return;

        await perform( async ()=>
        {
            const updated = await api<Actor>( `/i/passengers/${encodeURIComponent( passenger.id )}/tier`, "PATCH", { tier } );

            passenger.tier = updated.tier;
    
            showSuccess( `${passenger.name} is now ${tierName( updated.tier )}.` );
        });

        select.value = String( passenger.tier ?? previousTier );
    }
    async function openPassengerHistory( passenger: Actor ): Promise<void>
    {
        selectedPassengerId.value = passenger.id;
        passengerHistory.value = [];
        passengerHistoryLoading.value = true;

        try
        {
            const usage = await api<Resource$Usage[]>( `/i/passengers/${encodeURIComponent( passenger.id )}/usage` );

            if( selectedPassengerId.value === passenger.id )
                passengerHistory.value = usage;
        }
        catch( error )
        {
            if( selectedPassengerId.value === passenger.id )
            {
                selectedPassengerId.value = null;
    
                showError( error );
            }
        }
        finally
        {
            if( selectedPassengerId.value === passenger.id || selectedPassengerId.value === null )
                passengerHistoryLoading.value = false;
        }
    }
    async function createResource(): Promise<void>
    {
        await perform( async ()=>
        {
            await api<Resource>( "/i/resources", "POST", resourceForm );
        
            resourceForm.name = "";
            resourceForm.description = "";
            resourceForm.minimumTier = 1;
            resources.value = await api<Resource[]>( "/i/resources" );
    
            showSuccess( "Resource added to the ship." );
        });
    }
    async function changeResourceStatus( resource: Resource ): Promise<void>
    {
        await perform( async ()=>
        {
            const status = resource.status === 1 ? 0 : 1;
            const updated = await api<Resource>( `/i/resources/${encodeURIComponent( resource.id )}/status`, "PATCH", { status } );

            resource.status = updated.status;
    
            showSuccess( `${resource.name} is now ${updated.status === 1 ? "active" : "inactive"}.` );
        });
    }
    async function useResource( resource: Resource ): Promise<void>
    {
        await perform( async ()=>
        {
            let usageError: unknown = null;

            try
            {
                await api<Resource$Usage>( `/i/resources/${encodeURIComponent( resource.id )}/usage`, "POST" );
            }
            catch( error )
            {
                usageError = error;
            }

            const [historyResult, resourcesResult] = await Promise.allSettled( [api<Resource$Usage[]>( "/i/usage" ), api<Resource[]>( "/i/resources" )] );

            if( historyResult.status === "fulfilled" )
                history.value = historyResult.value;

            if( resourcesResult.status === "fulfilled" )
                resources.value = resourcesResult.value;

            if( usageError )
                throw usageError;

            if( historyResult.status === "rejected" )
                throw historyResult.reason;

            if( resourcesResult.status === "rejected" )
                throw resourcesResult.reason;

            showSuccess( `${resource.name} use recorded.` );
        });
    }

    onMounted( ()=>{ void restoreSession(); } );
</script>

<template>
    <div v-if="loading" class="loading-screen" role="status"><div class="brand-mark">X<span>26</span></div><p class="muted">Connecting to mission control…</p></div>
    <LoginView v-else-if="!session" :busy="loginBusy" :error="notice?.tone === 'error' ? notice.text : undefined" @sign-in="signIn" />
    <div v-else class="workspace">
        <a class="skip-link" href="#workspace-main">Skip to content</a>
        <WorkspaceNav :actor="session.actor" :active-view="activeView" :working="working" @navigate="activeView = $event" @sign-out="signOut" />
        <div class="workspace-body">
            <header class="topbar">
                <div><span class="topbar-kicker">{{ isCrew ? "CREW WORKSPACE" : "PASSENGER ACCESS" }}</span><strong>{{ currentDate }}</strong></div>
                <div class="topbar-actions"><span v-if="lastUpdated" class="updated-label">Updated {{ dateTime( lastUpdated.getTime() ) }}</span><button class="button button-secondary refresh-button" type="button" :disabled="refreshing" @click="refreshWorkspace">{{ refreshing ? "Refreshing…" : "Refresh data" }}</button></div>
            </header>
            <main class="main-content" id="workspace-main">
                <div v-if="notice" class="notice" :class="notice.tone === 'error' ? 'notice-error' : 'notice-success'" :role="notice.tone === 'error' ? 'alert' : 'status'"><span>{{ notice.text }}</span><button type="button" aria-label="Dismiss message" @click="notice = null">×</button></div>
                <section v-if="!lastUpdated" class="panel data-state" role="status">
                    <span class="eyebrow">MISSION RECORDS</span>
                    <h1>{{ refreshing ? "Loading onboard records" : "Records are unavailable" }}</h1>
                    <p class="muted">{{ refreshing ? "Fetching passenger, facility, and usage information." : "Try loading the records again." }}</p>
                    <button v-if="!refreshing" class="button button-secondary" type="button" @click="refreshWorkspace">Retry</button>
                </section>
                <template v-else>
                    <OverviewView v-if="activeView === 'overview'" :actor="session.actor" :resources="resources" :passengers="passengers" :history="history" :activity="activity" :report="report" :working="working" @navigate="activeView = $event" @use-resource="useResource" />
                    <ResourcesView v-else-if="activeView === 'resources'" :actor="session.actor" :resources="resources" :form="resourceForm" :working="working" @create="createResource" @change-status="changeResourceStatus" @use-resource="useResource" />
                    <PassengersView v-else-if="activeView === 'passengers' && isCrew" :passengers="passengers" :form="passengerForm" :working="working" :selected-passenger="selectedPassenger" :history="passengerHistory" :history-loading="passengerHistoryLoading" @create="createPassenger" @change-tier="changeTier" @open-history="openPassengerHistory" @close-history="selectedPassengerId = null" />
                    <HistoryView v-else-if="activeView === 'history' && !isCrew" :items="history" />
                    <HistoryView v-else-if="activeView === 'activity' && isCrew" :items="activity" crew />
                    <ReportsView v-else-if="activeView === 'reports' && isCrew" :report="report" />
                </template>
            </main>
        </div>
    </div>
</template>