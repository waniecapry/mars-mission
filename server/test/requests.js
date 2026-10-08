const { test } = require( "node:test" );
const assert = require( "node:assert/strict" );
const { once } = require( "node:events" );
const express = require( "express" );
const session = require( "express-session" );
const { handleRequests } = require( "../jsOut/requests" );
const { Library } = require( "../jsOut/Library" );
const { Center } = require( "../jsOut/Center" );
const { Actor$Crew, Actor$Passenger } = require( "../jsOut/Actor" );
const { Resource, Resource$Status } = require( "../jsOut/Resource" );
const { Tier, Tier$Level } = require( "../jsOut/Tier" );

test( "Vue API authenticates sessions and enforces passenger and crew permissions", async t =>
{
    Actor$Crew.members.clear();
    Actor$Passenger.members.clear();
    Resource.resourcesByMinimumTier.clear();
    Tier.tiers.clear();

    const silver = new Tier( Tier$Level.Silver );
    const gold = new Tier( Tier$Level.Gold );
    const platinum = new Tier( Tier$Level.Platinum );

    Tier.tiers.set( silver.level, silver );
    Tier.tiers.set( gold.level, gold );
    Tier.tiers.set( platinum.level, platinum );

    const crew = new Actor$Crew( "crew-1", "Ari", "ari@example.com", "salt", Library.makeHash( "crew-pass", "salt" ) );
    const passenger = new Actor$Passenger( "passenger-1", "Mira", "mira@example.com", "salt", Library.makeHash( "passenger-pass", "salt" ), silver );

    Actor$Crew.members.set( crew.id, crew );
    Actor$Passenger.members.set( passenger.id, passenger );
    Resource.resourcesByMinimumTier.set( silver.level, new Set([new Resource( "food", 0, Resource$Status.Active, "Food", "", silver )]) );
    Resource.resourcesByMinimumTier.set( gold.level, new Set([new Resource( "cabin", 0, Resource$Status.Active, "Cabin", "", gold )]) );

    const originalClient = Center.getMySqlClient;
    const writes = [];

    Center.getMySqlClient = ()=>
    ({
        execute: async ( query, values )=>{ writes.push( { query, values } ); return [{ affectedRows: 1 }]; },
        withTransaction: async work=>work( { execute: async ( query, values )=>
        {
            if( query.startsWith( "INSERT INTO Actor (" ) && values[3] === "mira@example.com" )
                throw Object.assign( new Error( "Duplicate entry" ), { code: "ER_DUP_ENTRY" } );

            writes.push( { query, values } );
        }})
    });
    t.after( ()=>
    {
        Center.getMySqlClient = originalClient;

        Actor$Crew.members.clear();
        Actor$Passenger.members.clear();
        Resource.resourcesByMinimumTier.clear();
        Tier.tiers.clear();
    });

    const httpServer = new Center.HttpServer( { port: 0, sessionSecret: "test" }, "127.0.0.1", 3306, "unused", "unused", "unused" );
    const app = httpServer.app;

    app.use( express.json() );
    app.use( session( { secret: "test-session-secret-test-session-secret", resave: false, saveUninitialized: false } ) );
    handleRequests( app );
    httpServer.initEnd();

    const server = app.listen( 0, "127.0.0.1" );

    await once( server, "listening" );
    t.after( ()=>new Promise( resolve=>server.close( resolve ) ) );

    const base = `http://127.0.0.1:${server.address().port}`;

    async function request( method, path, body, cookie, origin )
    {
        const headers = {};

        if( body !== undefined )
            headers["content-type"] = "application/json";

        if( cookie )
            headers.cookie = cookie;

        if( origin )
            headers.origin = origin;

        const response = await fetch( `${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify( body ) } );
        const data = response.status === 204 ? null : await response.json();

        return { status: response.status, data, cookie: response.headers.get( "set-cookie" )?.split( ";" )[0] };
    }

    assert.equal( (await request( "GET", "/i/session" )).status, 401 );
    assert.equal( (await request( "POST", "/login", { email: "ari@example.com", password: "wrong" } )).status, 401 );
    assert.deepEqual
    (
        await request( "POST", "/login", { email: "unknown@example.com", password: "wrong" } ),
        { status: 401, data: { error: "Invalid email or password" }, cookie: undefined }
    );
    assert.equal( (await request( "POST", "/login", { email: "ari@example.com", password: "crew-pass" }, undefined, "http://evil.example" )).status, 403 );

    const passengerLogin = await request( "POST", "/login", { email: "MIRA@EXAMPLE.COM", password: "passenger-pass" }, undefined, base );

    assert.equal( passengerLogin.status, 200 );
    assert.ok( passengerLogin.cookie );
    assert.deepEqual( passengerLogin.data.resources.map( item=>item.id ), ["food"] );
    assert.deepEqual( (await request( "GET", "/i/resources", undefined, passengerLogin.cookie )).data.map( item=>item.id ), ["food"] );
    assert.equal( (await request( "GET", "/i/passengers", undefined, passengerLogin.cookie )).status, 403 );
    assert.equal( (await request( "POST", "/i/passengers", { name: "Bo" }, passengerLogin.cookie )).status, 403 );

    const crewLogin = await request( "POST", "/login", { email: "ari@example.com", password: "crew-pass" } );

    assert.equal( crewLogin.status, 200 );
    assert.deepEqual( crewLogin.data.resources.map( item=>item.id ), ["food", "cabin"] );
    assert.equal( (await request( "GET", "/i/passengers", undefined, crewLogin.cookie )).data.length, 1 );
    assert.equal( (await request( "POST", "/i/passengers", { name: "Bad", email: "bad", password: "pass", tier: 2 }, crewLogin.cookie )).status, 400 );
    assert.equal( (await request( "POST", "/i/passengers", { name: "Duplicate", email: "mira@example.com", password: "pass", tier: 2 }, crewLogin.cookie )).status, 409 );

    const created = await request( "POST", "/i/passengers", { name: "Bo", email: "bo@example.com", password: "pass", tier: 2 }, crewLogin.cookie );
    
    assert.equal( created.status, 201 );
    assert.equal( created.data.tier, 2 );
    assert.ok( writes.some( item=>item.query.includes( "INSERT INTO Actor$Passenger" ) ) );
    assert.equal( (await request( "PATCH", `/i/passengers/${created.data.id}/tier`, { tier: 4 }, crewLogin.cookie )).status, 400 );

    const changed = await request( "PATCH", `/i/passengers/${created.data.id}/tier`, { tier: 3 }, crewLogin.cookie );
    
    assert.equal( changed.status, 200 );
    assert.equal( changed.data.tier, 3 );
    assert.equal( (await request( "GET", "/i/session", undefined, crewLogin.cookie )).data.actor.id, crew.id );
    assert.equal( (await request( "POST", "/i/logout", undefined, crewLogin.cookie )).status, 204 );
    assert.equal( (await request( "GET", "/i/session", undefined, crewLogin.cookie )).status, 401 );
    assert.equal( (await request( "GET", "/i/unknown" )).status, 401 );
});