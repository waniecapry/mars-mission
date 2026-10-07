const { describe, test } = require( "node:test" );
const assert = require( "node:assert/strict" );
const { Library } = require( "../jsOut/Library" );
const { Actor$Crew, Actor$Passenger, Actor$Role } = require( "../jsOut/Actor" );
const { Resource, Resource$Status } = require( "../jsOut/Resource" );
const { Tier, Tier$Level } = require( "../jsOut/Tier" );

function resourceRow( id, minimumTier, status = Resource$Status.Active )
{
    return { id, type: 1, status, name: id, description: `${id} description`, minimumTier };
}

function clientReturning( rows, calls = [] )
{
    return {
        execute: async ( query, values ) =>
        {
            calls.push( { query, values } );
            return [rows, []];
        }
    };
}

async function loadTiers( t, rows, calls = [] )
{
    t.after( ()=>Tier.tiers.clear() );
    await Tier.initialise( clientReturning( rows, calls ) );
}

describe( "Library utilities", () =>
{
    test( "Given two ID requests, when generated, then both are distinct UUIDs", ()=>
    {
        const first = Library.getStringId();
        const second = Library.getStringId();

        assert.match( first, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i );
        assert.notEqual( first, second, "New actors and resources need distinct IDs" );
    });
    test( "Given a password and salt, when checked, then only the matching password succeeds", ()=>
    {
        const hash = Library.makeHash( "correct password", "salt-a" );

        assert.equal( Library.makeHash( "correct password", "salt-a" ), hash );
        assert.equal( Library.isHashValueCorrect( "correct password", "salt-a", hash ), true );
        assert.equal( Library.isHashValueCorrect( "wrong password", "salt-a", hash ), false );
        assert.notEqual( Library.makeHash( "correct password", "salt-b" ), hash );
    });
    test( "Given a Library error, when converted to auxiliary data, then its status is preserved", ()=>
    {
        const error = new Library.Error( "Invalid resource", Library.Error.status.badRequest );

        assert.equal( error.status, 400 );
        assert.equal( error.toAux().message, "Invalid resource" );
        assert.equal( Library.Error.makeAux( error ).status, 400 );
        assert.equal( Library.Error.makeAux( new Error( "Native error" ) ).message, "Native error" );
    });
});

describe( "Actors", () =>
{
    test( "Given a crew member, when read, then its role and public fields are correct", ()=>
    {
        const crew = new Actor$Crew( "crew-1", "Ari", "ari@example.com", "salt", "hash" );

        assert.equal( crew.id, "crew-1" );
        assert.equal( crew.name, "Ari" );
        assert.equal( crew.email, "ari@example.com" );
        assert.equal( crew.role, Actor$Role.crew );
        assert.deepEqual( crew.toAux(), 
        {
            id: "crew-1", role: Actor$Role.crew, name: "Ari", email: "ari@example.com"
        });
        assert.equal( "password" in crew.toAux(), false, "Public actor data must omit the password hash" );
    });
    test( "Given a passenger, when read, then its tier appears as a level", ()=>
    {
        const passenger = new Actor$Passenger(
            "passenger-1", "Mira", "mira@example.com", "salt", "hash", new Tier( Tier$Level.Gold )
        );

        assert.equal( passenger.role, Actor$Role.passenger );
        assert.equal( passenger.tier.level, Tier$Level.Gold );
        assert.deepEqual( passenger.toAux(), {
            id: "passenger-1", role: Actor$Role.passenger, name: "Mira",
            email: "mira@example.com", tier: Tier$Level.Gold
        });
        assert.equal( "password" in passenger.toAux(), false, "Public passenger data must omit the password hash" );
    });
    test( "Given a stored hash, when a crew member checks passwords, then a wrong one fails", ()=>
    {
        const salt = "crew-salt";
        const crew = new Actor$Crew(
            "crew-2", "Bo", "bo@example.com", salt, Library.makeHash( "launch", salt )
        );

        assert.equal( crew.isValidPassword( "launch" ), true );
        assert.equal( crew.isValidPassword( "land" ), false );
    });
    test( "Given Silver, Gold and Platinum passengers, when accessing resources, then minimum tiers apply", ()=>
    {
        const silverTier = new Tier( Tier$Level.Silver );
        const goldTier = new Tier( Tier$Level.Gold );
        const platinumTier = new Tier( Tier$Level.Platinum );
        const resources = [silverTier, goldTier, platinumTier].map( (tier, index)=>new Resource( `resource-${index}`, 1, Resource$Status.Active, "Resource", "Description", tier ) );
        const passengers = [silverTier, goldTier, platinumTier].map( (tier, index)=>new Actor$Passenger( `passenger-${index}`, "Name", "email@example.com", "salt", "hash", tier ) );

        assert.deepEqual( passengers.map( passenger=>resources.map( resource=>passenger.hasPermission( resource ) ) ), 
        [
            [true, false, false],
            [true, true, false],
            [true, true, true]
        ], "Each passenger may access resources at or below their tier" );
    });
});

describe( "Resources", () =>
{
    test( "Given an active resource, when read, then its fields and auxiliary data match", ()=>
    {
        const tier = new Tier( Tier$Level.Gold );
        const resource = new Resource( "resource-1", 2, Resource$Status.Active, "Lab", "Research lab", tier );

        assert.equal( resource.id, "resource-1" );
        assert.equal( resource.type, 2 );
        assert.equal( resource.status, Resource$Status.Active );
        assert.equal( resource.name, "Lab" );
        assert.equal( resource.description, "Research lab" );
        assert.equal( resource.minimumTier, tier );
        assert.deepEqual( resource.toAux(), 
        {
            id: "resource-1", type: 2, status: Resource$Status.Active,
            name: "Lab", description: "Research lab", minimumTier: Tier$Level.Gold
        });
    });
    test( "Given an inactive resource, when serialized, then its inactive status is retained", ()=>
    {
        const resource = new Resource
        (
            "resource-2", 1, Resource$Status.Inactive, "Storage", "Inactive storage",
            new Tier( Tier$Level.Silver )
        );

        assert.equal( resource.status, Resource$Status.Inactive );
        assert.equal( resource.toAux().status, Resource$Status.Inactive );
    });
});

describe( "Tier resource loading", () =>
{
    test( "Given zero database rows, when loaded, then all three tiers have no resources", async t=>
    {
        const calls = [];
        await loadTiers( t, [], calls );

        assert.equal( calls.length, 1, "Loading tiers should issue one resource query" );
        assert.match( calls[0].query, /FROM Resource/ );
        assert.deepEqual( calls[0].values, [] );
        assert.deepEqual( [...Tier.tiers.keys()], [Tier$Level.Silver, Tier$Level.Gold, Tier$Level.Platinum] );

        for( const tier of Tier.tiers.values() )
            assert.deepEqual( tier.getResources(), [], `Tier ${tier.level} should be empty` );
    });
    test( "Given one Silver resource, when loaded, then all tiers can list it", async t=>
    {
        await loadTiers( t, [resourceRow( "silver-1", Tier$Level.Silver )] );

        for( const tier of Tier.tiers.values() )
            assert.deepEqual( tier.getResources().map( resource=>resource.id ), ["silver-1"] );
    });
    test( "Given resources at all three levels, when loaded, then each tier lists its allowed resources", async t=>
    {
        await loadTiers
        ( 
            t, 
            [
                resourceRow( "silver-1", Tier$Level.Silver ),
                resourceRow( "gold-1", Tier$Level.Gold ),
                resourceRow( "platinum-1", Tier$Level.Platinum )
            ] 
        );

        assert.deepEqual( Tier.tiers.get( Tier$Level.Silver ).getResources().map( resource=>resource.id ), ["silver-1"] );
        assert.deepEqual( Tier.tiers.get( Tier$Level.Gold ).getResources().map( resource=>resource.id ), ["silver-1", "gold-1"] );
        assert.deepEqual( Tier.tiers.get( Tier$Level.Platinum ).getResources().map( resource=>resource.id ), ["silver-1", "gold-1", "platinum-1"] );
        assert.equal( Tier.tiers.get( 0 ), undefined, "Unknown tiers have no entry" );
    });
    test( "Given a loaded resource, when read, then it references its minimum tier object", async t=>
    {
        await loadTiers( t, [resourceRow( "gold-1", Tier$Level.Gold )] );

        const goldTier = Tier.tiers.get( Tier$Level.Gold );
        const resource = goldTier.getResources()[0];

        assert.equal( resource instanceof Resource, true );
        assert.equal( resource.minimumTier, goldTier );
        assert.equal( resource.toAux().minimumTier, Tier$Level.Gold );
    });
    test( "Given a returned resource list, when changed, then the stored list is unchanged", async t=>
    {
        await loadTiers( t, [resourceRow( "silver-1", Tier$Level.Silver )] );
    
        const goldTier = Tier.tiers.get( Tier$Level.Gold );
        const returned = goldTier.getResources();
    
        returned.pop();
        assert.deepEqual( goldTier.getResources().map( resource=>resource.id ), ["silver-1"] );
    });

    for( const level of [0, 4] )
    {
        test( `Given invalid minimumTier ${level}, when loaded, then a server data error is raised`, async t=>
        {
            t.after( ()=>Tier.tiers.clear() );
            await assert.rejects
            (
                Tier.initialise( clientReturning( [resourceRow( "invalid-tier", level )] ) ),
                error=>error instanceof Library.Error && error.status === 500
            );
        });
    }

    test( "Given an invalid resource status, when loaded, then a server data error is raised", async t=>
    {
        t.after( ()=>Tier.tiers.clear() );
        await assert.rejects
        (
            Tier.initialise( clientReturning( [resourceRow( "invalid-status", Tier$Level.Silver, 9 )] ) ),
            error=>error instanceof Library.Error && error.status === 500
        );
    });
    test( "Given a non-row query result, when loaded, then a server data error is raised", async t=>
    {
        t.after( ()=>Tier.tiers.clear() );
        await assert.rejects
        (
            Tier.initialise( clientReturning( { unexpected: "result" } ) ),
            error=>error instanceof Library.Error && error.status === 500
        );
    });
    test( "Given a database query failure, when loaded, then the failure is propagated", async t=>
    {
        t.after( ()=>Tier.tiers.clear() );

        const databaseError = new Error( "database unavailable" );
    
        await assert.rejects
        (
            Tier.initialise( { execute: async ()=>{ throw databaseError; } } ),
            error=>error === databaseError
        );
    });
    test( "Given new database rows, when reloaded, then the tier lists are refreshed", async t=>
    {
        await loadTiers( t, [resourceRow( "old", Tier$Level.Silver )] );
        await Tier.initialise( clientReturning( [resourceRow( "new", Tier$Level.Platinum )] ) );

        assert.deepEqual( Tier.tiers.get( Tier$Level.Silver ).getResources(), [] );
        assert.deepEqual( Tier.tiers.get( Tier$Level.Gold ).getResources(), [] );
        assert.deepEqual( Tier.tiers.get( Tier$Level.Platinum ).getResources().map( resource=>resource.id ), ["new"] );
    });
    test( "Given a valid load, when a later load has invalid data, then the valid tiers remain available", async t=>
    {
        await loadTiers( t, [resourceRow( "working", Tier$Level.Gold )] );

        await assert.rejects
        (
            Tier.initialise( clientReturning( [resourceRow( "invalid", Tier$Level.Silver, 9 )] ) ),
            error=>error instanceof Library.Error && error.status === 500
        );
        assert.deepEqual
        ( 
            Tier.tiers.get( Tier$Level.Gold ).getResources().map( resource=>resource.id ), ["working"],
            "A failed reload should leave the previously loaded resource available" 
        );
    });
});
