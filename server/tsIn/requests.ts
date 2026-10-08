import express, { type Application, type NextFunction, type Request, type Response } from "express";
import { resolve } from "node:path";
import { Library } from "./Library";
import { Center } from "./Center";
import { Actor, Actor$Crew, Actor$Passenger, Actor$Role } from "./Actor";
import { Tier } from "./Tier";

export function handleRequests( app: Application ): void
{
    const clientDirectory = resolve( __dirname, "../../client/dist" );

    app.use( (req: Request, res: Response, next: NextFunction) =>
    {
        if( req.path !== "/assets" && !req.path.startsWith( "/assets/" ) )
            res.setHeader( "Cache-Control", "no-store" );

        next();
    });
    app.use( (req: Request, res: Response, next: NextFunction)=>
    {
        const path: string = req.path.toLowerCase();
        const isPrivateRoute: boolean = path === "/i" || path.startsWith( "/i/" ); // anything starts with i considered as private and need authorisation

        if( isPrivateRoute )
        {
            const isAuthenticatedSession: boolean = Center.isAuthenticatedSession( req );
        
            if( !isAuthenticatedSession )
            {
                res.status( Center.HttpServer.status.unauthorized ).json( { error: "Authentication required" } );

                return;
            }
        }

        next();
    });
    app.use( ["/login", "/i"], (req: Request, res: Response, next: NextFunction)=> // Entry point and to ensure the origin is correct.
    {
        if( req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS" )
        {
            const origin = req.get( "origin" );
            const serverOrigin = `${req.protocol}://${req.get( "host" )}`;

            if( origin && origin !== serverOrigin )
            {
                res.status( Center.HttpServer.status.forbidden ).json( { error: "Origin not allowed" } );

                return;
            }
        }

        next();
    });
    app.post( "/login", async (req: Request, res: Response)=> // Login to the system
    {
        if( Center.isAuthenticatedSession( req ) )
        {
            const caller: Actor | undefined = req.session.userRole === Actor$Role.crew ? Actor$Crew.members.get( req.session.userId! ) : Actor$Passenger.members.get( req.session.userId! );

            if( caller )
            {
                res.json( Center.toAux( caller ) );

                return;
            }
        }

        const body: unknown = req.body;

        if( !body || typeof body !== "object" || Array.isArray( body ) )
        {
            res.status( Center.HttpServer.status.badRequest ).json( { error: "Email and password are required" } );

            return;
        }

        const { email, password } = body as Record<string, unknown>;

        if( typeof email !== "string" || typeof password !== "string" || !email.trim() || !password )
        {
            res.status( Center.HttpServer.status.badRequest ).json( { error: "Email and password are required" } );

            return;
        }

        const normalizedEmail: string = email.trim().toLowerCase();
        const caller: Actor | undefined = Actor.getByEmail( normalizedEmail );

        if( !caller || !caller.isValidPassword( password.trim() ) )
        {
            res.status( Center.HttpServer.status.unauthorized ).json( { error: "Invalid email or password" } );

            return;
        }

        req.session.userId = caller.id;
        req.session.userRole = caller.role;
        req.session.isAuthenticated = true;

        res.json( Center.toAux( caller ) );
    });
    app.post( "/i/logout", async (req: Request, res: Response)=> // Logout from the system
    {
        await new Promise<void>( (resolve, reject)=>req.session.destroy( error=>error ? reject( error ) : resolve() ) );
    
        res.clearCookie( "connect.sid" );
        res.sendStatus( Center.HttpServer.status.noContent );
    });
    app.get( "/i/session", (req: Request, res: Response)=> // After login, or refresh page this is the entry point.
    {
        const caller: Actor = req.session.userRole === Actor$Role.crew ? Actor$Crew.members.get( req.session.userId! )! : Actor$Passenger.members.get( req.session.userId! )!;

        res.json( Center.toAux( caller ) );
    });
    app.get( "/i/resources", (req: Request, res: Response)=> // Get the resources of the caller
    {
        const caller: Actor | undefined = req.session.userRole === Actor$Role.crew ? Actor$Crew.members.get( req.session.userId! )! : Actor$Passenger.members.get( req.session.userId! )!;

        res.json( Center.toAux( caller ).resources );
    });
    app.get( "/i/passengers", (req: Request, res: Response)=> // Get the list of passengers
    {
        if( req.session.userRole !== Actor$Role.crew || !Actor$Crew.members.get( req.session.userId! ) )
        {
            res.status( Center.HttpServer.status.forbidden ).json( { error: "Unauthorised" } );
        
            return;
        }

        res.json( [...Actor$Passenger.members.values()].map( passenger=>passenger.toAux() ) );
    });
    app.post( "/i/passengers", async (req: Request, res: Response)=> // Creating new passengers
    {
        if( req.session.userRole !== Actor$Role.crew )
        {
            res.status( Center.HttpServer.status.forbidden ).json( { error: "Unauthorised" } );
        
            return;
        }

        const caller: Actor$Crew = Actor$Crew.members.get( req.session.userId! )!;
        const body: unknown = req.body;

        if( !body || typeof body !== "object" || Array.isArray( body ) )
        {
            res.status( Center.HttpServer.status.badRequest ).json( { error: "Passenger details are required" } );
    
            return;
        }

        const { name, email, password, tier } = body as Record<string, unknown>;
        const selectedTier: Tier | undefined = Tier.tiers.get( tier as number );

        if
        ( 
            typeof name !== "string" || !name.trim() || name.trim().length > 30 ||
            typeof email !== "string" || email.length > 200 || !Library.EMAIL_REGEX.test( email.trim() ) ||
            typeof password !== "string" || !password.trim() || !selectedTier 
        )
        {
            res.status( Center.HttpServer.status.badRequest ).json( { error: "Invalid passenger details or tier" } );
    
            return;
        }

        const passenger = await Actor.create( caller, Actor$Role.passenger, name, email, password, selectedTier );

        res.status( Center.HttpServer.status.created ).json( passenger.toAux() );
    });
    app.patch( "/i/passengers/:id/tier", async (req: Request, res: Response)=> // Set new tier for the passenger
    {
        if( req.session.userRole !== Actor$Role.crew || !Actor$Crew.members.get( req.session.userId! ) )
        {
            res.status( Center.HttpServer.status.unauthorized ).json( { error: "Unauthorised" } );
        
            return;
        }

        const id: Library.Identifier = req.params.id as Library.Identifier;
        const passenger: Actor$Passenger | undefined = Actor$Passenger.members.get( id );

        if( !passenger )
        {
            res.status( Center.HttpServer.status.notFound ).json( { error: "Passenger not found" } );
        
            return;
        }

        const tier: number | null = req.body?.tier ?? null;
        const selectedTier: Tier | undefined = tier === null ? undefined : Tier.tiers.get( tier );

        if( !selectedTier )
        {
            res.status( Center.HttpServer.status.badRequest ).json( { error: "Invalid tier" } );
    
            return;
        }

        const caller: Actor$Crew = Actor$Crew.members.get( req.session.userId! )!;

        await passenger.setTier( caller, selectedTier );
        res.json( passenger.toAux() );
    });
    app.use( "/assets", express.static( resolve( clientDirectory, "assets" ), { immutable: true, maxAge: "1y" } ) );
    app.use( express.static( clientDirectory, { index: false } ) );
    app.use( (req: Request, res: Response, next: NextFunction)=>
    {
        if
        ( 
            req.method === "GET" && 
            req.path !== "/i" && 
            !req.path.startsWith( "/i/" ) &&
            !req.path.startsWith( "/assets/" ) && 
            req.accepts( "html" ) 
        )
            res.sendFile( resolve( clientDirectory, "index.html" ) );
    
        else next();
    });
}