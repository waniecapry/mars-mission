import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig( ({ mode })=>
{
    const environment = loadEnv( mode, process.cwd(), "" );
    const target: string = environment.API_PROXY_TARGET || "http://127.0.0.1:3000";

    return {
        plugins: [vue()],
        server: {
            proxy: {
            }
        }
    };
});
