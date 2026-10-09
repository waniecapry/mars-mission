<script setup lang="ts">
    import { reactive } from "vue";

    defineProps<{ busy: boolean, error?: string }>();
    const emit = defineEmits<{ signIn: [email: string, password: string] }>();
    const form = reactive( { email: "", password: "" } );

    function submit(): void
    {
        emit( "signIn", form.email, form.password );
        form.password = "";
    }
</script>

<template>
    <main class="login-layout">
        <section class="login-story" aria-label="Spaceship X26 passenger resources">
            <div class="login-story-header">
                <strong class="ship-name">Spaceship X26</strong>
                <span class="mission-route">Earth <span aria-hidden="true">→</span> Mars</span>
            </div>
            <div class="login-story-copy">
                <span class="eyebrow eyebrow-light">PASSENGER RESOURCE MANAGEMENT</span>
                <h1>Resources for the journey.</h1>
                <p>Manage onboard facilities, passenger access, and usage records in one place.</p>
            </div>
            <p class="login-story-footer">CREW AND PASSENGER ACCESS</p>
        </section>
        <section class="login-form-area">
            <div class="login-card">
                <span class="eyebrow">ACCOUNT ACCESS</span>
                <h2>Sign in</h2>
                <p class="muted">Use the credentials provided during mission setup.</p>
                <form class="stacked-form" @submit.prevent="submit">
                    <label class="field-label" for="login-email">Email address</label>
                    <input id="login-email" v-model.trim="form.email" class="text-input" type="email" autocomplete="username" placeholder="name@example.com" required>
                    <label class="field-label" for="login-password">Password</label>
                    <input id="login-password" v-model="form.password" class="text-input" type="password" autocomplete="current-password" placeholder="Enter your password" required>
                    <p v-if="error" class="form-message form-message-error" role="alert">{{ error }}</p>
                    <button class="button button-primary button-wide" type="submit" :disabled="busy">{{ busy ? "Signing in…" : "Sign in" }}</button>
                </form>
            </div>
        </section>
    </main>
</template>