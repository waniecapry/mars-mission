import type { Page, Route } from "@playwright/test";
import type { Actor, Resource, Resource$Usage, Resource$Usage$Report } from "../tsIn/api";

type Role = "crew" | "passenger";
type Options = { role: Role, sessionGate?: Promise<void>, failFirstResourceLoad?: boolean };

export const crewEmail = "crew@example.test";
export const passengerEmail = "mira@example.test";
export const password = "mission-pass";

async function respond( route: Route, status: number, data?: unknown ): Promise<void>
{
    await route.fulfill( { status, contentType: "application/json", body: data === undefined ? "" : JSON.stringify( data ) } );
}

export async function mockApi( page: Page, options: Options )
{
    const crew: Actor = { id: "crew-1", role: 0, name: "Ari Vale", email: crewEmail };
    const passenger: Actor = { id: "passenger-1", role: 1, name: "Mira Chen", email: passengerEmail, tier: 1 };
    const passengers: Actor[] = [passenger];
    const resources: Resource[] =
    [
        { id: "food", type: 0, status: 1, name: "Food Station", description: "Daily meals", minimumTier: 1 },
        { id: "cabin", type: 0, status: 1, name: "Private Cabin", description: "Private rest", minimumTier: 2 }
    ];
    const usage: Resource$Usage[] = [];
    let signedIn = false;
    let failNextHistory = false;
    let failNextResources = options.failFirstResourceLoad ?? false;

    function visibleResources(): Resource[]
    {
        return options.role === "crew" ? resources : resources.filter( resource=>resource.status === 1 && resource.minimumTier <= passenger.tier! );
    }
    function session()
    {
        return { actor: options.role === "crew" ? crew : passenger, resources: visibleResources() };
    }
    function report(): Resource$Usage$Report
    {
        return {
            byTier: [1, 2, 3].map( tier=>({ tier: tier as 1 | 2 | 3, usageCount: usage.filter( item=>item.tierAtUse === tier && item.outcome === 1 ).length, resources: [] }) ),
            popularResources: []
        };
    }
    function recordActivity(): void
    {
        usage.push( { id: `usage-${usage.length + 1}`, passengerId: passenger.id, resourceId: resources[0].id, resourceName: resources[0].name, tierAtUse: passenger.tier!, outcome: 1, occurredAt: Date.now() } );
    }

    await page.route( "**/*", async route=>
    {
        const request = route.request();
        const url = new URL( request.url() );
        const path = url.pathname;
        const method = request.method();

        if( url.origin !== "http://127.0.0.1:4174" )
            return route.abort();

        if( path !== "/login" && path !== "/i" && !path.startsWith( "/i/" ) )
            return route.continue();

        if( path === "/login" && method === "POST" )
        {
            const body = request.postDataJSON() as { email: string, password: string };
            const expectedEmail = options.role === "crew" ? crewEmail : passengerEmail;

            if( body.email !== expectedEmail || body.password !== password )
                return respond( route, 401, { error: "Invalid email or password" } );

            signedIn = true;

            return respond( route, 200, session() );
        }

        if( path === "/i/session" && method === "GET" )
        {
            await options.sessionGate;

            return signedIn ? respond( route, 200, session() ) : respond( route, 401, { error: "Authentication required" } );
        }

        if( !signedIn )
            return respond( route, 401, { error: "Authentication required" } );

        if( path === "/i/logout" && method === "POST" )
        {
            signedIn = false;

            return respond( route, 204 );
        }

        if( path === "/i/resources" && method === "GET" )
        {
            if( failNextResources )
            {
                failNextResources = false;

                return respond( route, 503, { error: "Resources temporarily unavailable" } );
            }

            return respond( route, 200, visibleResources() );
        }

        if( path === "/i/usage" && method === "GET" )
        {
            if( failNextHistory )
            {
                failNextHistory = false;

                return respond( route, 503, { error: "History temporarily unavailable" } );
            }

            return respond( route, 200, usage.filter( item=>item.passengerId === passenger.id ) );
        }

        if( /^\/i\/resources\/[^/]+\/usage$/.test( path ) && method === "POST" )
        {
            recordActivity();

            return respond( route, 201, usage.at( -1 ) );
        }

        if( path === "/i/passengers" && method === "GET" )
            return respond( route, 200, passengers );

        if( path === "/i/passengers" && method === "POST" )
        {
            const body = request.postDataJSON() as { name: string, email: string, tier: 1 | 2 | 3 };
            const created: Actor = { id: `passenger-${passengers.length + 1}`, role: 1, name: body.name, email: body.email, tier: body.tier };
            passengers.push( created );

            return respond( route, 201, created );
        }

        if( path.startsWith( "/i/passengers/" ) && path.endsWith( "/tier" ) && method === "PATCH" )
        {
            const selected = passengers.find( item=>item.id === path.split( "/" )[3] );

            if( !selected )
                return respond( route, 404, { error: "Passenger not found" } );

            selected.tier = (request.postDataJSON() as { tier: 1 | 2 | 3 }).tier;

            return respond( route, 200, selected );
        }

        if( path.startsWith( "/i/passengers/" ) && path.endsWith( "/usage" ) && method === "GET" )
            return respond( route, 200, usage.filter( item=>item.passengerId === path.split( "/" )[3] ) );

        if( path === "/i/activity" && method === "GET" )
            return respond( route, 200, usage.map( item=>({ ...item, passengerName: passengers.find( person=>person.id === item.passengerId )?.name ?? "Passenger" }) ).reverse() );

        if( path === "/i/reports/usage" && method === "GET" )
            return respond( route, 200, report() );

        return respond( route, 500, { error: `Unexpected test request: ${method} ${path}` } );
    });

    return { recordActivity, failNextHistory: ()=>{ failNextHistory = true; } };
}